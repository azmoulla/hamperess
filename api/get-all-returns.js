// FILE: /api/get-all-returns.js (This is the final corrected version)
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
        const returnsSnapshot = await db.collectionGroup('returns').orderBy('requestDate', 'desc').get();
        
        const returns = [];
for (const doc of returnsSnapshot.docs) {
    const returnData = doc.data();
    const userRef = doc.ref.parent.parent;
    const userDoc = await userRef.get();

    // Convert Firestore Timestamp to a standardized ISO string
    if (returnData.requestDate && typeof returnData.requestDate.toDate === 'function') {
        returnData.requestDate = returnData.requestDate.toDate().toISOString();
    }

    returns.push({
        returnId: doc.id,
        returnPath: doc.ref.path,
        userId: userRef.id,
        customerName: userDoc.data()?.name || 'N/A',
        customerEmail: userDoc.data()?.email || 'N/A',
        ...returnData
    });
}
        
        res.status(200).json(returns);
    } catch (error) {
        console.error('Error fetching all returns:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}