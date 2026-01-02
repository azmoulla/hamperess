// FILE: /api/create-order.js (FINAL, CORRECTED VERSION)
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';

async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('Error verifying auth token in create-order:', error);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

    try {
        const { orderPayload } = req.body;
        if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
            return res.status(400).json({ error: 'Order payload with items is required.' });
        }

        const newOrderRef = db.collection('orders').doc();
        const orderId = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${newOrderRef.id.slice(0, 5).toUpperCase()}`;

        await db.runTransaction(async (transaction) => {
            // --- 1. READ PHASE (ALL READS MUST HAPPEN FIRST) ---
            const standardItems = orderPayload.items.filter(item => !item.isCustom);
            const productRefs = standardItems.map(item => db.collection('products').doc(item.productId));
            const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];
            
            // --- THIS IS THE FIX: Read the credit document inside the transaction ---
            let creditDoc = null;
            if (orderPayload.appliedDiscount?.type === 'store_credit' && orderPayload.appliedDiscount.id) {
                const creditDocRef = db.collection('storeCredits').doc(orderPayload.appliedDiscount.id);
                creditDoc = await transaction.get(creditDocRef);
                if (!creditDoc.exists) {
                    throw new Error('Store credit voucher not found or has been deleted.');
                }
            }
            // --- END OF FIX ---

            // --- 2. VALIDATION & CALCULATION PHASE ---
            const itemsWithPrice = orderPayload.items.filter(item => item.isCustom);
            for (let i = 0; i < productDocs.length; i++) {
                const productDoc = productDocs[i];
                if (!productDoc.exists) throw new Error(`Product ID ${standardItems[i].productId} not found.`);
                const productData = productDoc.data();
                if (productData.stock < standardItems[i].quantity) throw new Error(`Not enough stock for ${productData.title}.`);
                itemsWithPrice.push({ ...standardItems[i], price: productData.price });
            }

            const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
            let discountApplied = 0;
            
            if (creditDoc) { // If we successfully read a credit document
                const creditData = creditDoc.data();
                if (creditData.isActive && creditData.remainingValue > 0) {
                    discountApplied = Math.min(chargeableTotal, creditData.remainingValue);
                }
            } else if (orderPayload.appliedDiscount) { // Handle other discount types
                const discount = orderPayload.appliedDiscount;
                if (discount.type === 'percent') {
                    discountApplied = (itemsSubtotal * discount.value) / 100;
                } else if (discount.type === 'fixed') {
                    discountApplied = discount.value;
                }
            }
            
            discountApplied = Math.min(chargeableTotal, discountApplied);
            const totalAmount = chargeableTotal - discountApplied;
            
            // --- 3. WRITE PHASE (ALL WRITES HAPPEN LAST) ---
            for (let i = 0; i < productRefs.length; i++) {
                transaction.update(productRefs[i], { stock: admin.firestore.FieldValue.increment(-standardItems[i].quantity) });
            }

            if (creditDoc) {
                const creditData = creditDoc.data();
                const newRemainingValue = creditData.remainingValue - discountApplied;
                const newUsageRecord = { orderId: orderId, amountUsed: discountApplied, date: new Date() };
                transaction.update(creditDoc.ref, {
                    remainingValue: newRemainingValue,
                    isActive: newRemainingValue > 0,
                    usageHistory: admin.firestore.FieldValue.arrayUnion(newUsageRecord)
                });
            }

            const finalOrderPayload = {
                ...orderPayload, id: orderId, itemsSubtotal, deliveryChargeApplied,
                discountApplied, totalAmount, status: 'Pending',
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                items: itemsWithPrice
            };
            transaction.set(newOrderRef, finalOrderPayload);
        });

        res.status(200).json({ success: true, orderId: orderId });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'An unexpected server error occurred.', details: error.message });
    }
}