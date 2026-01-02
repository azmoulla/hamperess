// FILE: api/find-order.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId, email } = req.query;
        const ordersRef = db.collection('orders');
        let snapshot;

        if (orderId) {
            snapshot = await ordersRef.where('id', '==', orderId).get();
        } else if (email) {
            snapshot = await ordersRef.where('customerEmail', '==', email).orderBy('orderDate', 'desc').get();
        } else {
            return res.status(400).json({ error: 'Please provide either an orderId or an email.' });
        }

        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        const orders = snapshot.docs.map(doc => {
            const orderData = doc.data();
            // Safely convert the Firestore Timestamp to an ISO string
            const orderDate = orderData.orderDate && typeof orderData.orderDate.toDate === 'function' 
                ? orderData.orderDate.toDate().toISOString() 
                : new Date().toISOString(); // Fallback to current date if missing

            return {
                docId: doc.id,
                ...orderData,
                orderDate: orderDate
            };
        });
        
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error in find-order handler:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}