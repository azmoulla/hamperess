// FILE: /api/update-return-status.js (Corrected and Complete)
import admin from 'firebase-admin';
// Note: This helper file must exist in /api/_lib/
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'PUT') return res.status(405).end();

    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { userId, returnId, newStatus, orderId } = req.body;

    if (!userId || !returnId || !newStatus) {
        return res.status(400).json({ error: 'userId, returnId, and newStatus are required.' });
    }

    try {
        const returnDocRef = db.collection('users').doc(userId).collection('returns').doc(returnId);

        await db.runTransaction(async (transaction) => {
            const returnDoc = await transaction.get(returnDocRef);
            if (!returnDoc.exists) {
                throw new Error('Return request not found.');
            }

            const updateData = { status: newStatus };

            if (newStatus === 'Approved') {
                if (!orderId) throw new Error('orderId is required to approve a return.');
                
                // 1. Add an approval date to the return document.
                updateData.approvalDate = admin.firestore.FieldValue.serverTimestamp();
                
                // 2. Update the original order's status to 'Returned'.
                const orderDocRef = db.collection('orders').doc(orderId);
                transaction.update(orderDocRef, { status: 'Returned' });
            }
            
            transaction.update(returnDocRef, updateData);
        });
        
        res.status(200).json({ success: true, message: `Return status updated to ${newStatus}` });

    } catch (error) {
        console.error(`Error updating return ${returnId}:`, error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}