// FILE: api/addresses.js
// This serverless function handles all CRUD operations for user addresses.
// It ensures that users can only access their own data by verifying
// their Firebase Authentication token with every request.

import admin from 'firebase-admin';

// --- Initialize Firebase Admin SDK ---
// This reuses the existing initialization from your other functions.
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

/**
 * Verifies the Firebase ID token from the Authorization header.
 * @param {object} req - The request object.
 * @returns {Promise<string|null>} The user's UID if the token is valid, otherwise null.
 */
async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return null;
    }
}

// --- Main API Handler ---
export default async function handler(req, res) {
   

    // --- Authentication Check ---
    const uid = await getVerifiedUid(req);
    if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing authentication token.' });
    }

    const addressesRef = db.collection('users').doc(uid).collection('addresses');

    try {
        switch (req.method) {
            // --- READ Addresses ---
            case 'GET': {
                const snapshot = await addressesRef.orderBy('isDefault', 'desc').get();
                const addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return res.status(200).json(addresses);
            }

            // --- CREATE Address ---
              case 'POST': {
            
                const newAddress = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                
                // Check if this will be the user's first address
                const existingAddresses = await addressesRef.limit(1).get();
                if (existingAddresses.empty) {
                    // If it's the first address, force it to be the default
                    newAddress.isDefault = true;
                }
                // --- FIX ENDS HERE ---

                if (newAddress.isDefault) {
                    // If the new address is default, unset any other default addresses.
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => {
                        batch.update(doc.ref, { isDefault: false });
                    });
                    await batch.commit();
                }
                const docRef = await addressesRef.add(newAddress);
                return res.status(201).json({ id: docRef.id, ...newAddress });
            }

            // --- UPDATE Address ---
            case 'PUT': {
                const { addressId, ...addressData } = req.body;
                if (!addressId) return res.status(400).json({ error: 'Address ID is required.' });

                if (addressData.isDefault) {
                    // If setting this address to default, unset others in a transaction.
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => {
                        if (doc.id !== addressId) {
                           batch.update(doc.ref, { isDefault: false });
                        }
                    });
                    await batch.commit();
                }
                await addressesRef.doc(addressId).update(addressData);
                return res.status(200).json({ success: true, message: 'Address updated.' });
            }

            // --- DELETE Address ---
            case 'DELETE': {
                const { addressId } = req.query;
                if (!addressId) return res.status(400).json({ error: 'Address ID is required.' });

                await addressesRef.doc(addressId).delete();
                return res.status(200).json({ success: true, message: 'Address deleted.' });
            }

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error(`Error in /api/addresses (${req.method}):`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}