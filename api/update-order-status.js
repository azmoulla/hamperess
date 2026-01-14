// FILE: /api/update-order-status.js
import admin from 'firebase-admin';
import { verifyAdmin } from './_lib/firebase-admin-helper.js';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) { console.error('Firebase admin init error:', error.stack); }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { orderId, newStatus, trackingNumber, courier } = req.body;
    if (!orderId || !newStatus) {
        return res.status(400).json({ error: 'Order ID and new status are required.' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    
    const updateData = {
        status: newStatus
    };

    if (trackingNumber && courier) {
    updateData.trackingNumber = trackingNumber.trim().toUpperCase(); // Enforce format
        updateData.courier = courier;
        const courierUrls = {
            'Royal Mail': 'https://www.royalmail.com/track-your-item#/track/',
            'DPD': 'https://www.dpd.co.uk/service/tracking?match=',
            'Evri': 'https://www.evri.com/track/parcel/'
        };
        updateData.courierUrl = courierUrls[courier] || null;
    }

    await orderRef.update(updateData);

    res.status(200).json({ success: true, message: `Order ${orderId} updated to ${newStatus}.` });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}