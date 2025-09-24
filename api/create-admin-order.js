// FILE: /api/create-admin-order.js (This is the final, corrected version)
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

// This is the upgraded helper function that returns all necessary voucher details
async function validateDiscount(code) {
    if (!code) return null;
    const upperCaseCode = code.trim().toUpperCase();

    const discountRef = db.collection('discounts').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1);
    const discountSnap = await discountRef.get();
    if (!discountSnap.empty) {
        const doc = discountSnap.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    const creditRef = db.collection('storeCredits').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1);
    const creditSnap = await creditRef.get();
    if (!creditSnap.empty) {
        const doc = creditSnap.docs[0];
        const data = doc.data();
        if (data.remainingValue > 0) {
            return {
                id: doc.id,
                code: data.code,
                description: `Store credit with £${data.remainingValue.toFixed(2)} remaining.`,
                type: 'store_credit',
                value: data.remainingValue,
                usageHistory: data.usageHistory || [] // Ensure usageHistory is always an array
            };
        }
    }
    
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { customerDetails, deliveryAddress, items, paymentMethod, appliedDiscount, transactionId } = req.body;

        if (!customerDetails || !deliveryAddress || !items || !items.length) {
            return res.status(400).json({ error: 'Missing required order information.' });
        }
        
        const newOrderRef = db.collection('orders').doc();
        const orderId = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${newOrderRef.id.slice(0, 5).toUpperCase()}`;

        await db.runTransaction(async (transaction) => {
            const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // This transaction now uses the appliedDiscount object from the frontend, no need to re-validate
            const validDiscount = appliedDiscount;
            
            let deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            
            // Waive delivery ONLY if it's a replacement voucher being used for the FIRST time.
            if (validDiscount && validDiscount.code && validDiscount.code.startsWith('RET-') && validDiscount.usageHistory && validDiscount.usageHistory.length === 0) {
                deliveryChargeApplied = 0;
            }

            let discountApplied = 0;
            if (validDiscount) {
                if (validDiscount.type === 'percent') {
                    discountApplied = (itemsSubtotal * validDiscount.value) / 100;
                } else if (validDiscount.type === 'fixed' || validDiscount.type === 'store_credit') {
                    discountApplied = validDiscount.value;
                }
            }
            
            const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
            discountApplied = Math.min(chargeableTotal, discountApplied);
            const totalAmount = chargeableTotal - discountApplied;

            if (validDiscount && validDiscount.type === 'store_credit') {
                const creditRef = db.collection('storeCredits').where('code', '==', validDiscount.code).limit(1);
                const creditSnap = await transaction.get(creditRef);

                if (!creditSnap.empty) {
                    const creditDoc = creditSnap.docs[0];
                    const creditData = creditDoc.data();
                    const newRemainingValue = creditData.remainingValue - discountApplied;
                    
                    // THIS FIXES THE SERVER ERROR by using a standard Date object
                    const newUsageRecord = {
                        orderId: orderId,
                        amountUsed: discountApplied,
                        date: new Date() // Use a standard JS Date, not serverTimestamp
                    };

                    transaction.update(creditDoc.ref, {
                        remainingValue: newRemainingValue,
                        isActive: newRemainingValue > 0,
                        usageHistory: admin.firestore.FieldValue.arrayUnion(newUsageRecord)
                    });
                }
            }
            
            const orderPayload = {
                id: orderId,
                userId: null,
                customerName: customerDetails.name,
                customerEmail: customerDetails.email,
                deliveryAddress,
                items,
                itemsSubtotal,
                deliveryChargeApplied,
                discountApplied,
                appliedDiscount,
                totalAmount,
                status: 'Pending',
                paymentMethod: paymentMethod || 'External Card Reader',
                transactionId: transactionId || null,
                orderDate: admin.firestore.FieldValue.serverTimestamp()
            };
            
            transaction.set(newOrderRef, orderPayload);
        });

        res.status(200).json({ success: true, orderId, message: `Order ${orderId} created successfully.` });

    } catch (error) {
        console.error('Error creating admin order:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}