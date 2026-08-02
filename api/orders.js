// FILE: api/orders.js
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';
import { createOrderTransaction } from './_lib/order-helper.js';
import { sendOrderConfirmation } from './_lib/brevo-helper.js';

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

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const uid = await getVerifiedUid(req);

    // 1. GET: FETCH ORDER HISTORY (Registered Users Only)
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
    // NOTE (2026-07-22): this used to contain the full stock/discount/credit
    // transaction logic inline. It's now extracted into
    // api/_lib/order-helper.js's createOrderTransaction() so the PayPal
    // capture flow (api/paypal.js) can reuse the exact same, already-tested
    // logic instead of duplicating it. Behavior here is unchanged -- this
    // still creates an order with no payment step, same as before (the
    // "Card" checkout path was left as-is, per explicit instruction, while
    // PayPal was wired up as a real payment flow separately).
    if (req.method === 'POST') {
        try {
            const { orderPayload } = req.body;
            const { orderId } = await createOrderTransaction({ orderPayload, uid });

            // Fire the confirmation email, but never let an email problem
            // fail an order that was already successfully created. Brevo
            // outages/misconfig should only ever be a logged warning here.
            try {
                const orderDoc = await db.collection('orders').doc(orderId).get();
                if (orderDoc.exists) await sendOrderConfirmation(orderDoc.data());
            } catch (emailError) {
                console.error(`Order ${orderId} created OK, but confirmation email failed:`, emailError.message);
            }

            return res.status(201).json({ success: true, orderId });
        } catch (error) {
            console.error('Create Order Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
}
