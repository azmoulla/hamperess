// FILE: api/user-profile.js
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';

// --- HELPERS ---
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

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

    const { type } = req.query; // 'address' or 'cart'
    const userRef = db.collection('users').doc(uid);

    try {
        // ==========================================
        // ADDRESS MANAGEMENT (Replaces addresses.js)
        // ==========================================
        if (type === 'address') {
            const addressesRef = userRef.collection('addresses');

            // --- GET ADDRESSES ---
            if (req.method === 'GET') {
                const snapshot = await addressesRef.orderBy('isDefault', 'desc').get();
                const addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return res.status(200).json(addresses);
            }

            // --- ADD ADDRESS ---
            if (req.method === 'POST') {
                const newAddress = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

                // Logic: If it's the first address, force it to be default
                const existingAddresses = await addressesRef.limit(1).get();
                if (existingAddresses.empty) {
                    newAddress.isDefault = true;
                }

                // Logic: If setting as default, unset others
                if (newAddress.isDefault) {
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => batch.update(doc.ref, { isDefault: false }));
                    await batch.commit();
                }

                const docRef = await addressesRef.add(newAddress);
                return res.status(201).json({ id: docRef.id, ...newAddress });
            }

            // --- UPDATE ADDRESS ---
            if (req.method === 'PUT') {
                const { addressId, ...addressData } = req.body;
                if (!addressId) return res.status(400).json({ error: 'Address ID required' });

                if (addressData.isDefault) {
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => {
                        if (doc.id !== addressId) batch.update(doc.ref, { isDefault: false });
                    });
                    await batch.commit();
                }
                await addressesRef.doc(addressId).update(addressData);
                return res.status(200).json({ success: true, message: 'Address updated.' });
            }

            // --- DELETE ADDRESS ---
            if (req.method === 'DELETE') {
                const { addressId } = req.query; // Pass ID via query for deletes
                if (!addressId) return res.status(400).json({ error: 'Address ID required' });
                await addressesRef.doc(addressId).delete();
                return res.status(200).json({ success: true });
            }
        }

        // ==========================================
        // CART MANAGEMENT (Replaces cart.js)
        // ==========================================
        if (type === 'cart') {
            // --- GET CART ---
            if (req.method === 'GET') {
                const doc = await userRef.get();
                return res.status(200).json(doc.exists && doc.data().cart ? doc.data().cart : []);
            }

            // --- SAVE CART ---
            if (req.method === 'POST') {
                const { cart } = req.body;
                if (!Array.isArray(cart)) return res.status(400).json({ error: 'Invalid cart data.' });
                // Use set with merge to avoid destroying address/profile data
                await userRef.set({ cart }, { merge: true });
                return res.status(200).json({ success: true, message: 'Cart saved.' });
            }
        }

        return res.status(400).json({ error: 'Invalid type parameter.' });

    } catch (error) {
        console.error('User Profile API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
