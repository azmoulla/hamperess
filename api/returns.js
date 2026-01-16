// FILE: api/returns.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

// --- HELPERS ---
function generateReturnId() {
    const timestamp = Date.now().toString().slice(-5);
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RET-${timestamp}-${randomChars}`;
}

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
    const { action } = req.query; // Used to distinguish Admin actions ('all', 'updateStatus')

    // ==========================================
    // GET REQUESTS
    // ==========================================
    if (req.method === 'GET') {
        
        // --- CASE A: Admin Get All Returns (from get-all-returns.js) ---
        if (action === 'all') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            try {
                const returnsSnapshot = await db.collectionGroup('returns').orderBy('requestDate', 'desc').get();
                const returns = [];

                for (const doc of returnsSnapshot.docs) {
                    const returnData = doc.data();
                    const userRef = doc.ref.parent.parent;
                    // Fetch user details for the Admin UI
                    const userDoc = await userRef.get();

                    if (returnData.requestDate && typeof returnData.requestDate.toDate === 'function') {
                        returnData.requestDate = returnData.requestDate.toDate().toISOString();
                    }

                    returns.push({
                        docId: doc.id, // Explicit docId for admin actions
                        returnPath: doc.ref.path,
                        userId: userRef.id,
                        customerName: userDoc.data()?.name || 'N/A',
                        customerEmail: userDoc.data()?.email || 'N/A',
                        ...returnData
                    });
                }
                return res.status(200).json(returns);
            } catch (error) {
                console.error('Error fetching all returns:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
        }

        // --- CASE B: User Get My Returns (from returns.js GET) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        try {
            const returnsRef = db.collection('users').doc(uid).collection('returns').orderBy('requestDate', 'desc');
            const snapshot = await returnsRef.get();
            const returns = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.requestDate && typeof data.requestDate.toDate === 'function') {
                    data.requestDate = data.requestDate.toDate().toISOString();
                }
                return data;
            });
            return res.status(200).json(returns);
        } catch (error) {
            console.error('Error fetching user returns:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // ==========================================
    // POST REQUESTS
    // ==========================================
    if (req.method === 'POST') {
        // --- CASE: User Create Return (from returns.js POST) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        try {
            const { returnRequest } = req.body;
            if (!returnRequest || !returnRequest.orderId || !returnRequest.items) {
                return res.status(400).json({ error: 'Return request with orderId and items is required.' });
            }

            const { orderId, reason, items, refundAmount, desiredOutcome } = returnRequest;
            // Verify order belongs to user
            const orderQuery = db.collection('orders').where('id', '==', orderId).where('userId', '==', uid).limit(1);
            const orderSnapshot = await orderQuery.get();

            if (orderSnapshot.empty) throw new Error('Original order not found.');
            
            const orderData = orderSnapshot.docs[0].data();
            const newReturnRef = db.collection('users').doc(uid).collection('returns').doc();
            
            const newReturnPayload = {
                id: generateReturnId(),
                orderId: orderId,
                customerName: orderData.customerName || 'N/A',
                customerEmail: orderData.customerEmail || 'unknown@example.com',
                reason, items, refundAmount, desiredOutcome,
                requestDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };

            await newReturnRef.set(newReturnPayload);
            return res.status(200).json({ success: true, returnId: newReturnPayload.id });

        } catch (error) {
            console.error('Error creating return request:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // ==========================================
    // PUT REQUESTS
    // ==========================================
    if (req.method === 'PUT') {
        
        // --- CASE A: Admin Update Status (from update-return-status.js) ---
        if (action === 'updateStatus') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            try {
                const { returnId, newStatus, orderId, userId } = req.body;
                if (!returnId || !newStatus || !orderId || !userId) {
                    return res.status(400).json({ error: 'All IDs and new status are required.' });
                }

                const returnRef = db.collection('users').doc(userId).collection('returns').doc(returnId);
                const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);

                await db.runTransaction(async (transaction) => {
                    const returnDoc = await transaction.get(returnRef);
                    if (!returnDoc.exists) throw new Error('Return request not found.');
                    
                    // 1. Update Return Status
                    transaction.update(returnRef, { status: newStatus });

                    // 2. Sync with Order Status if "Approved" (Logic from update-return-status.js)
                    if (newStatus === 'Approved') {
                        const orderSnapshot = await transaction.get(orderQuery);
                        if (orderSnapshot.empty) throw new Error('Original order not found.');
                        
                        const orderDoc = orderSnapshot.docs[0];
                        const orderData = orderDoc.data();
                        const returnData = returnDoc.data();

                        const orderItemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
                        const returnedItemCount = returnData.items.reduce((sum, item) => sum + item.quantity, 0);
                        const isFullAction = returnedItemCount >= orderItemCount;

                        let finalOrderStatus = orderData.status;

                        // Logic: Determine if this is a "Cancellation" (Pre-ship) or "Return" (Post-ship)
                        if (['Pending', 'Processing'].includes(orderData.status)) {
                            const orderDate = orderData.orderDate.toDate();
                            const ageInHours = (new Date() - orderDate) / (1000 * 60 * 60);
                            
                            if (ageInHours < 48) {
                                finalOrderStatus = isFullAction ? 'Cancelled' : 'Partially Cancelled';
                            } else {
                                finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                            }
                        } else if (['Shipped', 'Completed', 'Dispatched'].includes(orderData.status)) {
                            finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                        }

                        if (finalOrderStatus !== orderData.status) {
                            transaction.update(orderDoc.ref, { status: finalOrderStatus });
                        }
                    }
                });

                return res.status(200).json({ success: true, message: 'Return updated.' });

            } catch (error) {
                console.error('Error updating return status:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        // --- CASE B: User Cancel Return (from returns.js PUT) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        try {
            const { returnId } = req.query;
            if (!returnId) return res.status(400).json({ error: 'Return ID required.' });

            const returnsRef = db.collection('users').doc(uid).collection('returns');
            const query = returnsRef.where('id', '==', returnId).limit(1);
            const snapshot = await query.get();

            if (snapshot.empty) throw new Error(`No return found with ID: ${returnId}`);

            await snapshot.docs[0].ref.update({ status: 'Cancelled' });
            return res.status(200).json({ success: true });

        } catch (error) {
            console.error('Error cancelling return:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
}
