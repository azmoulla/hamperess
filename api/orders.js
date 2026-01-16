// FILE: api/orders.js
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';

// --- HELPERS ---
async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        return null;
    }
}

function generateOrderId() {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
}

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const uid = await getVerifiedUid(req);

    // 1. GET: FETCH ORDER HISTORY (Registered Users Only)
    // Logic adapted from your original get-orders.js
    if (req.method === 'GET') {
        if (!uid) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const snapshot = await db.collection('orders')
                .where('userId', '==', uid)
                .orderBy('orderDate', 'desc')
                .get();

            if (snapshot.empty) return res.status(200).json([]);

            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    status: data.status || 'Pending',
                    orderDate: data.orderDate?.toDate().toISOString() || new Date().toISOString()
                };
            });
            return res.status(200).json(orders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // 2. POST: CREATE ORDER (Guest OR Registered)
    // Combines logic from create-order.js and create-guest-order.js
    if (req.method === 'POST') {
        try {
            const { orderPayload } = req.body;
            if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
                return res.status(400).json({ error: 'Order payload with items is required.' });
            }

            const newOrderId = generateOrderId();
            const newOrderRef = db.collection('orders').doc(newOrderId);

            await db.runTransaction(async (transaction) => {
                // A. READ PHASE
                const standardItems = orderPayload.items.filter(item => !item.isCustom);
                const productRefs = standardItems.map(item => db.collection('products').doc(item.productId));
                const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];

                // Check Store Credit (Only if registered)
                let creditDoc = null;
                if (uid && orderPayload.appliedDiscount?.type === 'store_credit' && orderPayload.appliedDiscount.id) {
                    const creditRef = db.collection('storeCredits').doc(orderPayload.appliedDiscount.id);
                    creditDoc = await transaction.get(creditRef);
                    if (!creditDoc.exists) throw new Error('Store credit voucher not found.');
                }

                // B. VALIDATION PHASE
                const itemsWithPrice = orderPayload.items.filter(item => item.isCustom); // Start with custom items
                
                // Validate Stock for Standard Items
                productDocs.forEach((doc, index) => {
                    const requestedItem = standardItems[index];
                    if (!doc.exists) throw new Error(`Product "${requestedItem.title}" is no longer available.`);
                    
                    const productData = doc.data();
                    if (productData.stock < requestedItem.quantity) {
                        throw new Error(`Out of stock: ${productData.title} (Only ${productData.stock} left).`);
                    }
                    // Ensure price security (use server price, not client price)
                    itemsWithPrice.push({ ...requestedItem, price: productData.price });
                });

                // C. CALCULATION PHASE
                const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
                const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
                
                let discountApplied = 0;

                // Handle Credit Logic
                if (creditDoc) {
                    const creditData = creditDoc.data();
                    if (creditData.isActive && creditData.remainingValue > 0) {
                        discountApplied = Math.min(chargeableTotal, creditData.remainingValue);
                    }
                } else if (orderPayload.appliedDiscount) {
                    // Fallback for simple percentage/fixed discounts
                    const discount = orderPayload.appliedDiscount;
                    if (discount.type === 'percent') discountApplied = (itemsSubtotal * discount.value) / 100;
                    else if (discount.type === 'fixed') discountApplied = discount.value;
                }
                
                discountApplied = Math.min(chargeableTotal, discountApplied);
                const totalAmount = chargeableTotal - discountApplied;

                // D. WRITE PHASE
                // Decrement Stock
                productRefs.forEach((ref, i) => {
                    transaction.update(ref, { stock: admin.firestore.FieldValue.increment(-standardItems[i].quantity) });
                });

                // Update Credit (if used)
                if (creditDoc) {
                    const newRemaining = creditDoc.data().remainingValue - discountApplied;
                    transaction.update(creditDoc.ref, {
                        remainingValue: newRemaining,
                        isActive: newRemaining > 0,
                        usageHistory: admin.firestore.FieldValue.arrayUnion({
                            orderId: newOrderId,
                            amountUsed: discountApplied,
                            date: new Date()
                        })
                    });
                }

                // Save Order
                transaction.set(newOrderRef, {
                    ...orderPayload,
                    id: newOrderId,
                    userId: uid || null, // null = Guest
                    isGuestOrder: !uid,
                    items: itemsWithPrice,
                    itemsSubtotal,
                    deliveryChargeApplied,
                    discountApplied,
                    totalAmount,
                    status: 'Pending',
                    orderDate: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            return res.status(201).json({ success: true, orderId: newOrderId });

        } catch (error) {
            console.error('Create Order Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
}