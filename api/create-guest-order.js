// FILE: /api/create-guest-order.js
// This file has been updated to use modern ES Module syntax and include
// critical stock management logic, consistent with the rest of the application.

import admin from 'firebase-admin';

// --- Initialize Firebase Admin SDK ---
if (!admin.apps.length) {
  try {
    // This securely reads your Firebase credentials from the .env file (environment variables)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();

/**
 * Generates a readable, unique order ID.
 * Format: ORD-YYMMDD-5CHAR
 * @returns {string} The generated order ID.
 */
function generateOrderId() {
    const now = new Date();
    // Format: YYMMDD (e.g., 250907 for September 7, 2025)
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
    // Format: 5 random alphanumeric characters (e.g., A3K9B)
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
}

// --- Main API Handler ---
export default async function handler(req, res) {
  try {
    // --- Standard CORS & Method Check (for consistency) ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    // For guest orders, we don't need to verify a user token.

    const { orderPayload } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Basic validation to ensure we have a valid payload
    if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing order data.' });
    }

    // --- CRITICAL FIX: ADDED STOCK MANAGEMENT ---
    // Get references to all non-custom products in the cart
    const productRefs = orderPayload.items
        .filter(item => !item.isCustom)
        .map(item => db.collection('products').doc(item.productId));

    // Use a Firestore transaction to safely check stock and create the order
    const newOrderRef = await db.runTransaction(async (transaction) => {
        const stockIssues = [];
        if (productRefs.length > 0) {
            const productDocs = await transaction.getAll(...productRefs);

            // First, check if all products have enough stock
            for (const doc of productDocs) {
                if (!doc.exists) {
                    const missingItem = orderPayload.items.find(item => item.productId === doc.id);
                    throw new Error(`Product "${missingItem?.title || doc.id}" is no longer available.`);
                }
                const productData = doc.data();
                const cartItem = orderPayload.items.find(item => item.productId === doc.id);
                if (productData.stock < cartItem.quantity) {
                    stockIssues.push(`${cartItem.title} (Only ${productData.stock || 0} available)`);
                }
            }
        }

        if (stockIssues.length > 0) {
            // If any item is out of stock, abort the transaction
            throw new Error(`Some items are out of stock: ${stockIssues.join(', ')}`);
        }

        // If all stock is fine, decrement the stock for each product
        if (productRefs.length > 0) {
            const productDocs = await transaction.getAll(...productRefs);
            for (const doc of productDocs) {
                const cartItem = orderPayload.items.find(item => item.productId === doc.id);
                const newStock = admin.firestore.FieldValue.increment(-cartItem.quantity);
                transaction.update(doc.ref, { stock: newStock });
            }
        }

        // --- Create the new order document ---
        const newOrderId = generateOrderId();
        const newDocRef = db.collection('orders').doc(newOrderId);

        const newOrder = {
            id: newOrderId, // Also save the ID inside the document
            ...orderPayload,
            isGuestOrder: true,
            orderDate: admin.firestore.FieldValue.serverTimestamp(),
            status: 'Pending'
        };

        transaction.set(newDocRef, newOrder);
        return newDocRef; // Return the reference to the newly created order
    });

    // Send a success response back to the frontend with the new Order ID
    res.status(201).json({ success: true, orderId: newOrderRef.id });

  } catch (error) {
    console.error('Error creating guest order:', error);
    // Send back a specific error message to the frontend
    res.status(500).json({ error: `Failed to create guest order: ${error.message}` });
  }
}
