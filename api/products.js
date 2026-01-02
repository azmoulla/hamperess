// FILE: api/products.js (Final Version with Full CRUD and Soft Delete)
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    
    // READ ALL ACTIVE PRODUCTS (GET)
    if (req.method === 'GET') {
        try {
            const productsRef = db.collection('products');
            const snapshot = await productsRef.get();
            if (snapshot.empty) return res.status(200).json([]);
            
            // Fetches all docs and filters in memory to ensure products without 'isArchived' are included.
            const products = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(product => product.isArchived !== true);

            return res.status(200).json(products);
        } catch (error) {
            console.error("Error in api/products GET:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // All subsequent methods require admin privileges.
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // CREATE NEW PRODUCT (POST)
    if (req.method === 'POST') {
        try {
            const newProduct = req.body;
            newProduct.isArchived = false; // Explicitly mark new products as not archived.
            const docRef = await db.collection('products').add(newProduct);
            return res.status(201).json({ id: docRef.id, ...newProduct });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to create product.' });
        }
    }
    
    // UPDATE EXISTING PRODUCT (PUT)
    if (req.method === 'PUT') {
        try {
            const { id } = req.query;
            const updatedData = req.body;
            if (!id) return res.status(400).json({ error: 'Product ID is required.'});

            await db.collection('products').doc(id).update(updatedData);
            return res.status(200).json({ success: true, message: 'Product updated.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update product.' });
        }
    }

    // ARCHIVE PRODUCT (DELETE)
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Product ID is required.'});
            
            // This performs a "soft delete" by setting the isArchived flag.
            await db.collection('products').doc(id).update({ isArchived: true });
            return res.status(200).json({ success: true, message: 'Product archived.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to archive product.' });
        }
    }
    
    return res.status(405).end();
}