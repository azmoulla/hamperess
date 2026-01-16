// FILE: api/inventory.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    const { type, id } = req.query; // type: 'product' or 'component'
    
    // Determine the collection name dynamically
    let collectionName;
    if (type === 'product') collectionName = 'products';
    else if (type === 'component') collectionName = 'custom_hamper_components';
    else return res.status(400).json({ error: 'Valid type (product or component) is required.' });

    // ==========================================
    // GET REQUESTS (Public Access)
    // ==========================================
    if (req.method === 'GET') {
        try {
            const snapshot = await db.collection(collectionName).get();
            if (snapshot.empty) return res.status(200).json([]);
            
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Logic from products.js: Filter out archived products
            if (type === 'product') {
                items = items.filter(p => p.isArchived !== true);
            }
            
            return res.status(200).json(items);
        } catch (error) {
            console.error('Inventory API Error:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // ==========================================
    // AUTHENTICATION (Required for Write Ops)
    // ==========================================
    // All subsequent methods (POST, PUT, DELETE) require Admin privileges.
    if (!(await verifyAdmin(req))) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // ==========================================
    // POST REQUESTS (Create)
    // ==========================================
    if (req.method === 'POST') {
        try {
            let data = req.body;

            // Logic from products.js: Ensure isArchived is initialized
            if (type === 'product') {
                data.isArchived = false;
            }
            
            // Logic from hamper-components.js: Map Admin UI fields to Firestore Schema
            if (type === 'component') {
                const { title, price, imageUrls } = req.body;
                data = {
                    name: title, // Map 'title' -> 'name'
                    price: price,
                    imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
                };
            }

            const docRef = await db.collection(collectionName).add(data);
            return res.status(201).json({ id: docRef.id, ...data });

        } catch (error) {
            console.error('Create Error:', error);
            return res.status(500).json({ error: 'Failed to create item.' });
        }
    }

    // ==========================================
    // PUT REQUESTS (Update)
    // ==========================================
    if (req.method === 'PUT') {
        if (!id) return res.status(400).json({ error: 'ID is required.' });
        
        try {
            let updatedData = req.body;

            // Logic from hamper-components.js: Maintain field mapping logic
            if (type === 'component') {
                const { title, price, imageUrls } = req.body;
                // Only remap if the Admin UI sent the specific form fields
                if (title !== undefined) {
                    updatedData = {
                        name: title,
                        price: price,
                        imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
                    };
                }
            }

            await db.collection(collectionName).doc(id).update(updatedData);
            return res.status(200).json({ success: true, message: 'Item updated.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update item.' });
        }
    }

    // ==========================================
    // DELETE REQUESTS (Archive or Delete)
    // ==========================================
    if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ error: 'ID is required.' });

        try {
            if (type === 'product') {
                // Logic from products.js: Soft Delete (Archive)
                await db.collection('products').doc(id).update({ isArchived: true });
                return res.status(200).json({ success: true, message: 'Product archived.' });
            } else {
                // Logic from hamper-components.js: Hard Delete
                await db.collection('custom_hamper_components').doc(id).delete();
                return res.status(200).json({ success: true, message: 'Component deleted.' });
            }
        } catch (error) {
            return res.status(500).json({ error: 'Failed to delete item.' });
        }
    }

    return res.status(405).end();
}
