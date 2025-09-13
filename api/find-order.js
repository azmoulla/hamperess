import admin from 'firebase-admin';
import { verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
  console.log(`[API LOG] /api/find-order received a ${req.method} request.`);

  if (req.method !== 'GET') return res.status(405).end();

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
      console.log('[API LOG] Admin verification FAILED.');
      return res.status(403).json({ error: 'Forbidden' });
  }
  console.log('[API LOG] Admin verification successful.');

  try {
    const { orderId, email } = req.query;
    console.log(`[API LOG] Search parameters received: email=${email}, orderId=${orderId}`);
    
    const db = admin.firestore();
    const ordersRef = db.collection('orders');
    let snapshot;

    if (orderId) {
      console.log(`[API LOG] Performing search by Order ID: ${orderId}`);
      const doc = await ordersRef.doc(orderId).get();
      snapshot = { docs: doc.exists ? [doc] : [], empty: !doc.exists };
    } else if (email) {
      console.log(`[API LOG] Performing search by Email: ${email}`);
      snapshot = await ordersRef.where('customerEmail', '==', email).orderBy('orderDate', 'desc').get();
    } else {
      console.log('[API LOG] No search parameters provided.');
      return res.status(400).json({ error: 'Please provide either an orderId or an email.' });
    }

    console.log(`[API LOG] Firestore query completed. Found ${snapshot.docs.length} documents.`);

    if (snapshot.empty) {
      return res.status(404).json({ message: 'No orders found.' });
    }
    
    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate.toDate().toISOString()
    }));

    console.log('[API LOG] Successfully formatted orders. Sending response.');
    res.status(200).json(orders);

  } catch (error) {
    console.error('[API LOG] CRITICAL ERROR in find-order handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}