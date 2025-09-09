// FILE: api/create-order.js (With Custom Order ID Generation)
import admin from 'firebase-admin';

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

// --- NEW HELPER FUNCTION TO GENERATE A READABLE ORDER ID ---
function generateOrderId() {
    const now = new Date();
    // Format: YYMMDD (e.g., 250906 for September 6, 2025)
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, ""); 
    // Format: 5 random alphanumeric characters (e.g., A3K9B)
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
}

async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return null;
    }
}

export default async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        if (req.method === 'OPTIONS') return res.status(200).end();
        if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized' });

        const { orderPayload } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
            return res.status(400).json({ error: 'Invalid order data.' });
        }

        const productRefs = orderPayload.items
            .filter(item => !item.isCustom)
            .map(item => db.collection('products').doc(item.productId));

        const newOrderRef = await db.runTransaction(async (transaction) => {
            
            // --- THIS IS THE FIX ---
            // Only perform stock checks if there are standard (non-custom) products in the cart.
            // This prevents the .getAll() error when the cart contains only a custom hamper.
            if (productRefs.length > 0) {
                const stockIssues = [];
                const productDocs = await transaction.getAll(...productRefs);

                for (const doc of productDocs) {
                    if (!doc.exists) {
                        const missingItem = orderPayload.items.find(item => item.productId === doc.id);
                        throw new Error(`Product "${missingItem?.title || doc.id}" is no longer available.`);
                    }
                    const productData = doc.data();
                    const cartItem = orderPayload.items.find(item => item.productId === doc.id);
                    if (productData.stock < cartItem.quantity) {
                        stockIssues.push(`${cartItem.title} (Available: ${productData.stock || 0})`);
                    }
                }

                if (stockIssues.length > 0) throw new Error(`Out of stock: ${stockIssues.join(', ')}`);

                for (const doc of productDocs) {
                    const cartItem = orderPayload.items.find(item => item.productId === doc.id);
                    const newStock = admin.firestore.FieldValue.increment(-cartItem.quantity);
                    transaction.update(doc.ref, { stock: newStock });
                }
            }
            // --- END FIX ---
            
            // This part of the logic runs for ALL orders (custom-only or mixed).
            const newOrderId = generateOrderId();
            const newDocRef = db.collection('orders').doc(newOrderId);
            
            const newOrder = {
                id: newOrderId, // Also save the ID inside the document
                ...orderPayload,
                userId: uid,
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };
            
            transaction.set(newDocRef, newOrder);
            return newDocRef;
        });

        res.status(201).json({ success: true, orderId: newOrderRef.id });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
    }
}
