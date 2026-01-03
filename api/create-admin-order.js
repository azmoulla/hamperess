// FILE: api/create-admin-order.js (Definitive, Corrected Version)
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    try {
        // --- ADDED `originalOrderId` to the request body ---
        const { customerDetails, deliveryAddress, items, paymentMethod, appliedDiscount, transactionId , isReplacement, replacesReturnId, originalOrderId } = req.body;

        if (!customerDetails || !deliveryAddress || !items || !items.length) {
            return res.status(400).json({ error: 'Missing required order information.' });
        }
        
        const newOrderRef = db.collection('orders').doc();
        const orderId = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${newOrderRef.id.slice(0, 5).toUpperCase()}`;

        await db.runTransaction(async (transaction) => {
            // PHASE 1: READ ALL DATA FIRST (Original Logic Preserved)
            const productRefs = items
                .filter(item => !item.isCustom)
                .map(item => db.collection('products').doc(item.id));
            
            let productDocs = [];
            if (productRefs.length > 0) {
                productDocs = await transaction.getAll(...productRefs);
            }

            let creditDoc = null;
            if (appliedDiscount && appliedDiscount.type === 'store_credit') {
                const creditRef = db.collection('storeCredits').where('code', '==', appliedDiscount.code).limit(1);
                const creditSnap = await transaction.get(creditRef);
                if (!creditSnap.empty) {
                    creditDoc = creditSnap.docs[0];
                }
            }

            // PHASE 2: PERFORM ALL CALCULATIONS (Original Logic Preserved)
            const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            if (appliedDiscount && appliedDiscount.code && appliedDiscount.code.startsWith('RET-') && appliedDiscount.usageHistory && appliedDiscount.usageHistory.length === 0) {
                deliveryChargeApplied = 0;
            }
            let discountApplied = 0;
            if (appliedDiscount && typeof appliedDiscount.value === 'number') {
                if (appliedDiscount.type === 'percent') {
                    discountApplied = (itemsSubtotal * appliedDiscount.value) / 100;
                } else if (appliedDiscount.type === 'fixed' || appliedDiscount.type === 'store_credit') {
                    discountApplied = appliedDiscount.value;
                }
            }
            const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
            discountApplied = Math.min(chargeableTotal, discountApplied);
            const totalAmount = chargeableTotal - discountApplied;

            // PHASE 3: WRITE ALL DATA LAST (Original Logic Preserved)
            for (const doc of productDocs) {
                const cartItem = items.find(item => item.id === doc.id);
                if (cartItem) {
                    const newStock = admin.firestore.FieldValue.increment(-cartItem.quantity);
                    transaction.update(doc.ref, { stock: newStock });
                }
            }
            
            if (creditDoc) {
                const newRemainingValue = creditDoc.data().remainingValue - discountApplied;
                const newUsageRecord = { orderId: orderId, amountUsed: discountApplied, date: new Date() };
                transaction.update(creditDoc.ref, {
                    remainingValue: newRemainingValue,
                    isActive: newRemainingValue > 0,
                    usageHistory: admin.firestore.FieldValue.arrayUnion(newUsageRecord)
                });
            }
            
            const orderPayload = {
                id: orderId, userId: null, customerName: customerDetails.name,
                customerEmail: customerDetails.email, deliveryAddress, items,
                itemsSubtotal, deliveryChargeApplied, discountApplied, appliedDiscount,
                totalAmount, status: 'Pending', paymentMethod: paymentMethod || 'External Card Reader',
                transactionId: transactionId || null,
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                notes: [],
                isReplacement: isReplacement || false,   
                replacesReturnId: replacesReturnId || null,
                // --- ADDED `originalOrderId` to the payload ---
                originalOrderId: originalOrderId || null 
            };
            transaction.set(newOrderRef, orderPayload);
        });

        res.status(200).json({ success: true, orderId, message: `Order ${orderId} created successfully.` });

    } catch (error) {
        console.error('Error creating admin order:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}