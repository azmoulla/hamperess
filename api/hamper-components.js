// FILE: api/hamper-components.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    const collectionName = 'custom_hamper_components'; // The only major change is here

    // READ ALL COMPONENTS
    if (req.method === 'GET') {
        try {
            const snapshot = await db.collection(collectionName).get();
            if (snapshot.empty) return res.status(200).json([]);
            
            const components = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(components);
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // All subsequent methods require admin privileges.
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // CREATE NEW COMPONENT
    if (req.method === 'POST') {
        try {
            // Map frontend field names (like 'title') to Firestore field names (like 'name')
            const { title, price, imageUrls } = req.body;
            const newComponent = {
                name: title, // Map 'title' from form to 'name' in Firestore
                price: price,
                imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
            };
            const docRef = await db.collection(collectionName).add(newComponent);
            return res.status(201).json({ id: docRef.id, ...newComponent });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to create component.' });
        }
    }
    
    // UPDATE EXISTING COMPONENT
    if (req.method === 'PUT') {
        try {
            const { id } = req.query;
            const { title, price, imageUrls } = req.body;
            if (!id) return res.status(400).json({ error: 'Component ID is required.'});

            const updatedData = {
                name: title,
                price: price,
                imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
            };
            await db.collection(collectionName).doc(id).update(updatedData);
            return res.status(200).json({ success: true, message: 'Component updated.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update component.' });
        }
    }

    // DELETE COMPONENT (Permanent Delete)
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Component ID is required.'});
            
            await db.collection(collectionName).doc(id).delete();
            return res.status(200).json({ success: true, message: 'Component deleted.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to delete component.' });
        }
    }
    
    return res.status(405).end();
}