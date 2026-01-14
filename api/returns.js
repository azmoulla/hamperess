// FILE: /api/returns.js (This is the final, corrected version)
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';

// Helper to generate new Return IDs
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

export default async function handler(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

    // --- LOGIC FOR CREATING A NEW RETURN (POST) ---
    if (req.method === 'POST') {
        try {
            const { returnRequest } = req.body;
            if (!returnRequest || !returnRequest.orderId || !returnRequest.items) {
                return res.status(400).json({ error: 'Return request with orderId and items is required.' });
            }

            const { orderId, reason, items, refundAmount, desiredOutcome } = returnRequest;
            const orderQuery = db.collection('orders').where('id', '==', orderId).where('userId', '==', uid).limit(1);
            const orderSnapshot = await orderQuery.get();

            if (orderSnapshot.empty) {
                throw new Error('Original order not found.');
            }
            const orderData = orderSnapshot.docs[0].data();

            const newReturnRef = db.collection('users').doc(uid).collection('returns').doc();
            const newReturnPayload = {
                id: generateReturnId(),
                orderId: orderId,
                customerName: orderData.customerName || 'N/A',
                customerEmail: orderData.customerEmail || 'unknown@example.com',
                reason: reason,
                items: items,
                refundAmount: refundAmount,
                desiredOutcome: desiredOutcome,
                requestDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };

            await newReturnRef.set(newReturnPayload);
            res.status(200).json({ success: true, returnId: newReturnPayload.id });

        } catch (error) {
            console.error('Error creating return request:', error);
            res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
        }
    }
    
    // --- LOGIC FOR GETTING ALL RETURNS (GET) ---
    if (req.method === 'GET') {
        try {
            const returnsRef = db.collection('users').doc(uid).collection('returns').orderBy('requestDate', 'desc');
            const snapshot = await returnsRef.get();
            const returns = snapshot.docs.map(doc => {
                const data = doc.data();
                // THIS FIXES THE "INVALID DATE" ERROR
                if (data.requestDate && typeof data.requestDate.toDate === 'function') {
                    data.requestDate = data.requestDate.toDate().toISOString();
                }
                return data;
            });
            res.status(200).json(returns);
        } catch (error) {
            console.error('Error fetching returns:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    
    // --- LOGIC FOR CANCELLING A RETURN (PUT) ---
    if (req.method === 'PUT') {
        try {
            const { returnId } = req.query;
            if (!returnId) return res.status(400).json({ error: 'Return ID is required.' });

            const returnsCollectionRef = db.collection('users').doc(uid).collection('returns');
            
            // THIS FIXES THE "INTERNAL SERVER ERROR" FOR NEW RETURN IDS
            const query = returnsCollectionRef.where('id', '==', returnId).limit(1);
            const snapshot = await query.get();

            if (snapshot.empty) {
                throw new Error(`No return found with the ID: ${returnId}`);
            }

            const returnDocRef = snapshot.docs[0].ref;
            await returnDocRef.update({ status: 'Cancelled' });
            
            res.status(200).json({ success: true });

        } catch (error)
        {
            console.error('Error cancelling return:', error);
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    }
}