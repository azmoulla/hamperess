// FILE: /api/create-order.js (Definitive, Secure Version)
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

async function validateDiscount(code) {
    if (!code) return null;
    const discountRef = db.collection('discounts').where('code', '==', code.toUpperCase()).limit(1);
    const snapshot = await discountRef.get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    if (data.isActive) return { id: doc.id, ...data };
    return null;
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
            // --- 1. READ PHASE: Fetch all product data and validate stock ---
            const productRefs = orderPayload.items.map(item => db.collection('products').doc(item.productId));
            const productDocs = await transaction.getAll(...productRefs);
            const itemsWithPrice = [];

            for (let i = 0; i < productDocs.length; i++) {
                const productDoc = productDocs[i];
                const item = orderPayload.items[i];
                if (!productDoc.exists) throw new Error(`Product ID ${item.productId} not found.`);
                
                const productData = productDoc.data();
                if (productData.stock < item.quantity) {
                    throw new Error(`Not enough stock for ${productData.title}.`);
                }
                itemsWithPrice.push({ ...item, price: productData.price });
            }

            // --- 2. CALCULATION PHASE: Calculate all totals on the server ---
            const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            let discountApplied = 0;
            let appliedDiscountData = null;

            // Safely check for and validate the discount code
            if (orderPayload.appliedDiscount && orderPayload.appliedDiscount.code) {
                const validDiscount = await validateDiscount(orderPayload.appliedDiscount.code);
                if (validDiscount) {
                    appliedDiscountData = { code: validDiscount.code, description: validDiscount.description };
                    if (validDiscount.type === 'percent') {
                        discountApplied = (itemsSubtotal * validDiscount.value) / 100;
                    } else if (validDiscount.type === 'fixed') {
                        discountApplied = validDiscount.value;
                    }
                }
            }

               // --- ADD THIS VOUCHER UPDATE LOGIC ---
    const { appliedDiscount } = orderPayload; // Make sure this is passed from the client

    if (appliedDiscount && appliedDiscount.type === 'store_credit') {
        const creditRef = db.collection('storeCredits').where('code', '==', appliedDiscount.code).limit(1);
        const creditSnap = await transaction.get(creditRef);

        if (!creditSnap.empty) {
            const creditDoc = creditSnap.docs[0];
            const creditData = creditDoc.data();
            const creditUsed = Math.min(creditData.remainingValue, totalAmount); // Amount of credit to use
            const newRemainingValue = creditData.remainingValue - creditUsed;

            const updatePayload = { remainingValue: newRemainingValue };
            if (newRemainingValue <= 0) {
                updatePayload.isActive = false; // Deactivate if balance is zero
            }
            transaction.update(creditDoc.ref, updatePayload);
        }
    }
    // --- END OF VOUCHER LOGIC ---
            const totalAmount = itemsSubtotal + deliveryChargeApplied - discountApplied;
            
            // --- 3. WRITE PHASE: Update stock and create the order ---
            for (let i = 0; i < productDocs.length; i++) {
                const item = orderPayload.items[i];
                transaction.update(productRefs[i], { stock: admin.firestore.FieldValue.increment(-item.quantity) });
            }

            const finalOrderPayload = {
                ...orderPayload,
                id: orderId,
                itemsSubtotal,
                deliveryChargeApplied,
                discountApplied,
                appliedDiscount: appliedDiscountData,
                totalAmount,
                status: 'Pending',
                orderDate: admin.firestore.FieldValue.serverTimestamp()
            };
            delete finalOrderPayload.items; // Remove client-side items to replace with server-verified ones
            finalOrderPayload.items = itemsWithPrice;

           transaction.set(newOrderRef, finalOrderPayload);
        });

        res.status(200).json({ success: true, orderId: orderId });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'An unexpected server error occurred. Please contact support.', details: error.message });
    }
}