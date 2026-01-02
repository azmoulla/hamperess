// Cache-bust version: 1.0.2 - Forcing a fresh deploy
// FILE: api/get-orders.js (Definitive Final Version)
import admin from 'firebase-admin';

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

export default async function handler(req, res) {
   
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const ordersRef = db.collection('orders');
        // This query now correctly matches your database index (descending)
        const snapshot = await ordersRef.where('userId', '==', uid)
                                       .orderBy('orderDate', 'desc')
                                       .get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        // This mapping logic is now simple, direct, and correct.
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            const orderDate = data.orderDate && typeof data.orderDate.toDate === 'function' 
                ? data.orderDate.toDate().toISOString() 
                : new Date().toISOString();

            return {
                id: doc.id,
                ...data,
                status: data.status || 'Pending', // Use the real status, or fall back to Pending.
                orderDate: orderDate
            };
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}