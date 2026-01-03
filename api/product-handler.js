// FILE: api/product-handler.js
// COMBINES: products.js, hamper-components.js, custom-hamper-components.js

import admin from 'firebase-admin';

// --- 1. FIREBASE INITIALIZATION ---
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

// --- 2. HELPER FUNCTIONS ---
async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        return null;
    }
}

async function verifyAdmin(req) {
    const uid = await getVerifiedUid(req);
    return !!uid; // Checks if user is logged in (add specific admin logic if needed)
}

// --- 3. MAIN ROUTER ---
export default async function handler(req, res) {
    const { action } = req.query;

    try {
        switch (action) {
            case 'products':
                return await handleProducts(req, res);
            case 'components': // Covers both hamper-components and custom-hamper-components
                return await handleComponents(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action requested' });
        }
    } catch (error) {
        console.error(`Product API Error (${action}):`, error);
        return res.status(500).json({ error: error.message });
    }
}

// --- 4. LOGIC HANDLERS ---

// Logic from products.js
async function handleProducts(req, res) {
    // GET (Public - Read All Active)
    if (req.method === 'GET') {
        try {
            const productsRef = db.collection('products');
            const snapshot = await productsRef.get();
            if (snapshot.empty) return res.status(200).json([]);
            
            const products = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(product => product.isArchived !== true);

            return res.status(200).json(products);
        } catch (error) {
            console.error("Error in api/products GET:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Admin Check for Writes
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'POST') {
        const newProduct = req.body;
        newProduct.isArchived = false;
        const docRef = await db.collection('products').add(newProduct);
        return res.status(201).json({ id: docRef.id, ...newProduct });
    }
    
    if (req.method === 'PUT') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Product ID is required.'});
        await db.collection('products').doc(id).update(req.body);
        return res.status(200).json({ success: true, message: 'Product updated.' });
    }

    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Product ID is required.'});
        await db.collection('products').doc(id).update({ isArchived: true });
        return res.status(200).json({ success: true, message: 'Product archived.' });
    }
    return res.status(405).end();
}

// Logic from hamper-components.js & custom-hamper-components.js
async function handleComponents(req, res) {
    const collectionName = 'custom_hamper_components';

    // GET (Public)
    if (req.method === 'GET') {
        try {
            const snapshot = await db.collection(collectionName).get();
            const components = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(components);
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Admin Check for Writes
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'POST') {
        const { title, price, imageUrls } = req.body;
        const newComponent = {
            name: title,
            price: price,
            imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
        };
        const docRef = await db.collection(collectionName).add(newComponent);
        return res.status(201).json({ id: docRef.id, ...newComponent });
    }
    
    if (req.method === 'PUT') {
        const { id } = req.query;
        const { title, price, imageUrls } = req.body;
        if (!id) return res.status(400).json({ error: 'Component ID required.'});
        await db.collection(collectionName).doc(id).update({
            name: title, price: price,
            imageUrl1: imageUrls && imageUrls.length > 0 ? imageUrls[0] : ''
        });
        return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Component ID required.'});
        await db.collection(collectionName).doc(id).delete();
        return res.status(200).json({ success: true });
    }
    return res.status(405).end();
}
