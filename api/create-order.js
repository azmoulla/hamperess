// FILE: api/create-order.js (Final, Robust Version)
import admin from 'firebase-admin';
// --- 1. IMPORT THE HELPER ---
// NOTE: Adjust this path if your 'helpers' folder is located elsewhere.
import { sendOrderConfirmation } from '../../helpers/brevo-helper';

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

function generateOrderId() {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, ""); 
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
        if (!orderPayload || !orderPayload.items || !orderPayload.items.length === 0) {
            return res.status(400).json({ error: 'Invalid order data.' });
        }

        const productRefs = orderPayload.items
            .filter(item => !item.isCustom)
            .map(item => db.collection('products').doc(item.productId));
        
        let finalOrderObjectForEmail; 

        const newOrderRef = await db.runTransaction(async (transaction) => {
            if (productRefs.length > 0) {
                const stockIssues = [];
                const productDocs = await transaction.getAll(...productRefs);

                for (const doc of productDocs) {
                    if (!doc.exists) throw new Error(`Product is no longer available.`);
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
            
            const newOrderId = generateOrderId();
            const newDocRef = db.collection('orders').doc(newOrderId);
            
            finalOrderObjectForEmail = {
                id: newOrderId,
                ...orderPayload,
                userId: uid,
                orderDate: new Date(), // Use a standard Date object for the email
                status: 'Pending'
            };
            
            const firestoreOrder = { ...finalOrderObjectForEmail, orderDate: admin.firestore.FieldValue.serverTimestamp() };
            
            transaction.set(newDocRef, firestoreOrder);
            return newDocRef;
        });

        // --- 2. RESPOND TO THE USER IMMEDIATELY ---
        // The most important step is to confirm the order was created.
        res.status(201).json({ success: true, orderId: newOrderRef.id });

        // --- 3. SEND EMAIL IN THE BACKGROUND ---
        // This code runs after the response has been sent. It will not affect the user.
        if (finalOrderObjectForEmail) {
            console.log(`Order ${finalOrderObjectForEmail.id} confirmed. Attempting to send email in background...`);
            // We don't use 'await' here, as we don't need to wait for it.
            sendOrderConfirmation(finalOrderObjectForEmail);
        }

    } catch (error) {
        console.error("CRITICAL ERROR during order creation transaction:", error);
        res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
    }
}