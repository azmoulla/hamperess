// FILE: /api/find-order.js (Corrected)
import admin from 'firebase-admin';
import { verifyAdmin } from './_lib/firebase-admin-helper.js';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) { console.error('Firebase admin init error:', error.stack); }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { orderId, email } = req.query;
    const db = admin.firestore();
    const ordersRef = db.collection('orders');
    let snapshot;

    if (orderId) {
      // THIS IS THE FIX: We now query the 'id' field instead of the internal document ID.
      snapshot = await ordersRef.where('id', '==', orderId).get();
    } else if (email) {
      snapshot = await ordersRef.where('customerEmail', '==', email).orderBy('orderDate', 'desc').get();
    } else {
      return res.status(400).json({ error: 'Please provide either an orderId or an email.' });
    }

    if (snapshot.empty) {
      return res.status(404).json({ message: 'No orders found.' });
    }
    
    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate.toDate().toISOString()
    }));
    
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error in find-order handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}