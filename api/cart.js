// FILE: /api/cart.js
// This new, secure serverless function handles both saving and fetching
// the user's shopping cart from their Firestore user profile.

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
    
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const userDocRef = db.collection('users').doc(uid);

    try {
        if (req.method === 'GET') {
            // --- FETCH THE CART ---
            const doc = await userDocRef.get();
            if (!doc.exists || !doc.data().cart) {
                return res.status(200).json([]); // Return empty array if no cart
            }
            res.status(200).json(doc.data().cart);

        } else if (req.method === 'POST') {
            // --- SAVE THE CART ---
            const { cart } = req.body;
            if (!Array.isArray(cart)) {
                return res.status(400).json({ error: 'Invalid cart data provided.' });
            }
            // Use set with merge to avoid overwriting other user fields
            await userDocRef.set({ cart: cart }, { merge: true });
            res.status(200).json({ success: true, message: 'Cart saved successfully.' });

        } else {
            res.status(405).end('Method Not Allowed');
        }
    } catch (error) {
        console.error(`Error processing cart for user ${uid}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}