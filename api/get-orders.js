// FILE: api/get-orders.js
// This secure serverless function fetches all orders for the
// currently authenticated user, sorted by the most recent first.

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const ordersRef = db.collection('orders');
        // Query for orders belonging to this user, sorted by date
        const snapshot = await ordersRef.where('userId', '==', uid)
                                       .orderBy('orderDate', 'desc')
                                       .get();

        if (snapshot.empty) {
            return res.status(200).json([]); // Return an empty array if no orders found
        }

        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to a simple ISO string for the frontend
                orderDate: data.orderDate.toDate().toISOString()
            };
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}