// FILE: api/cancel-order.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId, itemsToCancel } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found. It may have been deleted.' });
        }

        const isFullCancellation = (!itemsToCancel || itemsToCancel.length === 0);
        const newStatus = isFullCancellation ? 'Cancelled' : 'Partially Cancelled';

        // Here you would add logic to handle partial cancellations,
        // like refunding specific items and adjusting stock.
        // For now, we will just update the status.
        
        await orderRef.update({ status: newStatus });

        res.status(200).json({ success: true, message: `Order updated to ${newStatus}` });

    } catch (error) {
        console.error('Error in cancel-order API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}