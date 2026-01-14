// FILE: api/get-unshipped-orders.js (Upgraded)
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { startDate, endDate } = req.query;
        let query = db.collection('orders').where('status', 'in', ['Pending', 'Processing']);

        if (startDate) {
            query = query.where('orderDate', '>=', new Date(startDate));
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.where('orderDate', '<=', endOfDay);
        }

        const snapshot = await query.get();
        if (snapshot.empty) return res.status(200).json([]);

        const unshippedOrders = snapshot.docs.map(doc => ({
            docId: doc.id,
            ...doc.data()
        }));
        
        unshippedOrders.sort((a, b) => a.orderDate.seconds - b.orderDate.seconds);
        res.status(200).json(unshippedOrders);
    } catch (error) {
        console.error('Error fetching unshipped orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}