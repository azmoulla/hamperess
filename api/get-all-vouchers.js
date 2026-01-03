// FILE: /api/get-all-vouchers.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (!(await verifyAdmin(req))) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const snapshot = await db.collection('storeCredits').orderBy('creationDate', 'desc').get();
        const vouchers = snapshot.docs.map(doc => {
            const data = doc.data();
            // Ensure timestamp is sent in a consistent format
            if (data.creationDate && typeof data.creationDate.toDate === 'function') {
                data.creationDate = data.creationDate.toDate().toISOString();
            }
            return { id: doc.id, ...data };
        });
        res.status(200).json(vouchers);
    } catch (error) {
        console.error('Error fetching vouchers:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}