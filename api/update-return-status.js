// FILE: api/update-return-status.js (Final Authoritative Version)
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'PUT') return res.status(405).end();
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { returnId, newStatus, orderId, userId } = req.body;
        if (!returnId || !newStatus || !orderId || !userId) {
            return res.status(400).json({ error: 'All IDs and a new status are required.' });
        }

        const returnRef = db.collection('users').doc(userId).collection('returns').doc(returnId);
        const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);

        await db.runTransaction(async (transaction) => {
            const returnDoc = await transaction.get(returnRef);
            if (!returnDoc.exists) throw new Error('Return request not found.');
            
            // 1. Update the return document's status
            transaction.update(returnRef, { status: newStatus });

            // 2. If the return is "Approved", intelligently update the original order
            if (newStatus === 'Approved') {
                const orderSnapshot = await transaction.get(orderQuery);
                if (orderSnapshot.empty) throw new Error('Original order not found.');
                
                const orderDoc = orderSnapshot.docs[0];
                const orderData = orderDoc.data();
                const returnData = returnDoc.data();

                // Determine if it's a full or partial return
                const orderItemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
                const returnedItemCount = returnData.items.reduce((sum, item) => sum + item.quantity, 0);
                const isFullAction = returnedItemCount >= orderItemCount;

                let finalOrderStatus = orderData.status; // Default to no change

                // --- THIS IS THE AGREED-UPON STRATEGY ---

                if (['Pending', 'Processing'].includes(orderData.status)) {
                    // Path B: Order is marked as unshipped. Check its age.
                    const orderDate = orderData.orderDate.toDate();
                    const ageInHours = (new Date() - orderDate) / (1000 * 60 * 60);

                    if (ageInHours < 48) {
                        // B1: It's a recent order - treat as a PRE-SHIPMENT CANCELLATION
                        finalOrderStatus = isFullAction ? 'Cancelled' : 'Partially Cancelled';
                    } else {
                        // B2: It's a stale order - treat as a POST-SHIPMENT RETURN
                        finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                    }
                } else if (['Shipped', 'Completed', 'Dispatched'].includes(orderData.status)) {
                    // Path A: Order was shipped - treat as a POST-SHIPMENT RETURN
                    finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                }

                // 3. Update the original order's status if a change was determined
                if (finalOrderStatus !== orderData.status) {
                    transaction.update(orderDoc.ref, { status: finalOrderStatus });
                }
            }
        });

        res.status(200).json({ success: true, message: 'Return and associated order have been updated.' });

    } catch (error) {
        console.error('Error updating return status:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}