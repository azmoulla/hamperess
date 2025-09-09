// FILE: /api/find-order.js
// This function has been SECURED. It now verifies that the request
// is coming from a logged-in user who has been designated as an admin.

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
const auth = admin.auth(); // Added auth service for token verification

/**
 * Verifies the user's token and checks if they have admin privileges.
 * @param {object} req - The incoming request object.
 * @returns {Promise<boolean>} True if the user is an admin, false otherwise.
 */
async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Admin Verification: No auth header found.');
        return false;
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    try {
        // 1. Verify the token is valid
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Check the user's document in Firestore for the admin flag
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data().isAdmin === true) {
            console.log(`Admin access granted for user: ${uid}`);
            return true; // User is a verified admin
        } else {
             console.log(`Admin Verification Failed: User ${uid} is not an admin.`);
            return false;
        }
    } catch (error) {
        console.error('Admin verification error:', error);
        return false;
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

  // --- THIS IS THE NEW SECURITY CHECK ---
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to access this resource.' });
  }
  // --- END SECURITY CHECK ---

  try {
    const { orderId, email } = req.query;
    let orders = [];

    if (orderId) {
      // --- Search by a specific Order ID ---
      const orderRef = db.collection('orders').doc(orderId);
      const doc = await orderRef.get();
      if (doc.exists) {
        orders.push({ id: doc.id, ...doc.data() });
      }
    } else if (email) {
      // --- Search by customer email address ---
      const ordersRef = db.collection('orders');
      // This now searches the top-level customerEmail field for guest orders
      const snapshot = await ordersRef.where('customerEmail', '==', email).get();
      if (!snapshot.empty) {
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() });
        });
      }
    } else {
      return res.status(400).json({ error: 'Please provide either an orderId or an email.' });
    }

    if (orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for the given criteria.' });
    }

    // Return the found order(s)
    res.status(200).json(orders);

  } catch (error) {
    console.error('Error finding order:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

