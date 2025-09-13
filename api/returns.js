import admin from 'firebase-admin';

// --- Initialize Firebase Admin SDK ---
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

// Get db and auth instances once, matching the working cart.js pattern
const db = admin.firestore();
const auth = admin.auth();

/**
 * Verifies the Firebase ID token from the Authorization header.
 * @param {object} req - The request object.
 * @returns {Promise<string|null>} The user's UID if valid, otherwise null.
 */
async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return null;
    }
}

// --- Main API Handler ---
export default async function handler(req, res) {
    // --- Standard CORS & Method Check ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const returnsCollectionRef = db.collection('users').doc(uid).collection('returns');

    try {
        if (req.method === 'GET') {
            const snapshot = await returnsCollectionRef.orderBy('requestDate', 'desc').get();
            if (snapshot.empty) {
                return res.status(200).json([]);
            }
            const returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.status(200).json(returns);

        } else if (req.method === 'POST') {
    // --- THIS IS THE NEW, SECURE POST LOGIC ---
    const { returnRequest } = req.body;
    if (!returnRequest || !returnRequest.orderId || !returnRequest.items || returnRequest.items.length === 0) {
        return res.status(400).json({ error: 'Invalid return data provided.' });
    }

    // Server-side validation
    const orderRef = db.collection('orders').doc(returnRequest.orderId);
    const existingReturnsRef = db.collection('users').doc(uid).collection('returns');

    const [orderDoc, existingReturnsSnapshot] = await Promise.all([
        orderRef.get(),
        existingReturnsRef.where('orderId', '==', returnRequest.orderId).get()
    ]);

    if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Original order not found.' });
    }

    const orderData = orderDoc.data();
    if (orderData.userId !== uid) {
        return res.status(403).json({ error: 'This order does not belong to you.' });
    }

    // Calculate already returned quantities from non-cancelled/rejected returns
    const returnedQuantities = {};
    existingReturnsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'Cancelled' && data.status !== 'Rejected') {
            data.items.forEach(item => {
                returnedQuantities[item.productId] = (returnedQuantities[item.productId] || 0) + item.quantity;
            });
        }
    });

    // Check if the new request is valid
    for (const itemToReturn of returnRequest.items) {
        const originalItem = orderData.items.find(i => i.productId === itemToReturn.productId);
        if (!originalItem) {
            return res.status(400).json({ error: `Item ${itemToReturn.title} was not in the original order.` });
        }
        const alreadyReturned = returnedQuantities[itemToReturn.productId] || 0;
        if (itemToReturn.quantity > (originalItem.quantity - alreadyReturned)) {
            return res.status(400).json({ error: `You cannot return ${itemToReturn.quantity} of ${itemToReturn.title}. Only ${originalItem.quantity - alreadyReturned} are available to be returned.` });
        }
    }

    const newReturnData = {
        ...returnRequest,
        status: 'Pending',
        requestDate: admin.firestore.FieldValue.serverTimestamp()
    };

    const newReturnRef = await db.collection('users').doc(uid).collection('returns').add(newReturnData);
    res.status(201).json({ success: true, returnId: newReturnRef.id });
    // --- END OF SECURE POST LOGIC ---
         

          
           
            
            } else if (req.method === 'PUT') {
        const { returnId } = req.query; // Get the ID from the URL query
        if (!returnId) {
            return res.status(400).json({ error: 'Return ID is required.' });
        }

        const returnDocRef = returnsCollectionRef.doc(returnId);
        
        // Update the status field to 'Cancelled'
        await returnDocRef.update({ status: 'Cancelled' });

        res.status(200).json({ success: true, message: 'Return cancelled successfully.' });
    // --- END OF REPLACEMENT BLOCK ---

        } else {
            res.status(405).end('Method Not Allowed');
        }
    } catch (error) {
        console.error(`[API/RETURNS] Error processing returns for user ${uid}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}