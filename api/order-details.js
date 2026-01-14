// FILE: api/order-details.js (Definitive Version)
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    try {
        const { orderId } = req.query;

        if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
        if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
        if (!orderId) return res.status(400).json({ error: 'Order document ID is required.' });

        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Order not found in database.' });
        }
        
        const data = doc.data();

        const orderData = {
            docId: doc.id,
            ...data,
            orderDate: data.orderDate.toDate().toISOString()
        };

        res.status(200).json(orderData);

    } catch (error) {
        console.error('Error in order-details API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}