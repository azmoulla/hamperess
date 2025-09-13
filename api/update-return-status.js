import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'PUT') return res.status(405).end();

    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { userId, returnId, newStatus } = req.body;
    if (!userId || !returnId || !newStatus) {
        return res.status(400).json({ error: 'userId, returnId, and newStatus are required.' });
    }

    try {
        const returnDocRef = db.collection('users').doc(userId).collection('returns').doc(returnId);
        await returnDocRef.update({ status: newStatus });
        res.status(200).json({ success: true, message: `Return status updated to ${newStatus}` });
    } catch (error) {
        console.error(`Error updating return ${returnId}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}