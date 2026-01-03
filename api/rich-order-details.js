// FILE: api/rich-order-details.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId } = req.query; // Expecting the short Order ID, e.g., "1004"
        if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

        const ordersRef = db.collection('orders');
        const orderQuery = await ordersRef.where('id', '==', orderId).limit(1).get();

        if (orderQuery.empty) {
            return res.status(404).json({ error: `Order #${orderId} not found.` });
        }

        const orderDoc = orderQuery.docs[0];
        const orderData = { docId: orderDoc.id, ...orderDoc.data() };

        // Now, find all related documents to create a "rich" object
        
        // 1. Find any returns associated with this order
        const returnsRef = db.collectionGroup('returns').where('orderId', '==', orderId);
        const returnsSnapshot = await returnsRef.get();
        const associatedReturns = returnsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        // 2. Find any replacement orders that were created for this order's returns
        const replacementOrders = [];
        if (associatedReturns.length > 0) {
            const returnIds = associatedReturns.map(r => r.id);
            const replacementsQuery = await ordersRef.where('replacesReturnId', 'in', returnIds).get();
            replacementsQuery.forEach(doc => {
                replacementOrders.push({id: doc.data().id, status: doc.data().status});
            });
        }
        
        // 3. Determine which items are still "active" vs returned
        const approvedReturnedItems = associatedReturns
            .filter(r => r.status === 'Approved')
            .flatMap(r => r.items);
        
        orderData.items.forEach(item => {
            const qtyReturned = approvedReturnedItems
                .filter(ri => ri.productId === item.productId)
                .reduce((sum, ri) => sum + ri.quantity, 0);
            item.quantityReturned = qtyReturned;
            item.quantityActive = item.quantity - qtyReturned;
        });

        const richOrder = {
            ...orderData,
            associatedReturns: associatedReturns,
            replacementOrders: replacementOrders
        };

        res.status(200).json(richOrder);

    } catch (error) {
        console.error(`Error fetching rich details for order ${req.query.orderId}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}