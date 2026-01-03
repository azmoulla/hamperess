// FILE: api/submit-review.js
// Final version: Fixes transaction read/write order.

import admin from 'firebase-admin';
import { db, auth } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Authentication (No changes needed here) ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("[submit-review] Authentication failed: Missing or invalid Authorization header.");
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
        req.user = { uid: decodedToken.uid, name: decodedToken.name || null };
        console.log(`[submit-review] User authenticated: ${req.user.uid}`);
    } catch (error) {
        console.error("[submit-review] Error verifying Firebase ID token:", error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
    // --- End Authentication ---

    const { orderId, reviews } = req.body;
    const { uid: userId, name: userName } = req.user;

    console.log(`[submit-review] Received request for Order ID: ${orderId}, User ID: ${userId}`);

    if (!orderId || !reviews || !Array.isArray(reviews) || reviews.length === 0) {
        console.error("[submit-review] Validation failed: Missing or invalid orderId or reviews array.");
        return res.status(400).json({ error: 'Missing or invalid orderId or reviews array.' });
    }

    try {
        await db.runTransaction(async (transaction) => {
            // --- STEP 1: READ ALL DATA FIRST ---

            // 1a. Read the Order
            const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);
            console.log(`[submit-review] Reading order by ID field: ${orderId}`);
            const orderSnap = await transaction.get(orderQuery);

            if (orderSnap.empty) {
                console.error(`[submit-review] Firestore Read: Order not found for id field: ${orderId}`);
                throw new Error('Order not found.');
            }
            const orderDoc = orderSnap.docs[0];
            const orderRef = orderDoc.ref; // Use this ref for the final update
            const orderData = orderDoc.data();

            // Security Check
            if (orderData.userId !== userId) {
                 console.error(`[submit-review] Security check failed: User ${userId} tried to review order ${orderId} belonging to user ${orderData.userId}`);
                 throw new Error('Order access denied.');
            }
             console.log(`[submit-review] Firestore Read: Order found. Document ID: ${orderRef.id}, Status: ${orderData.status}`);

            // Status Check
             if (orderData.status !== 'Completed' && orderData.status !== 'Completed (Reviewed)') {
                console.warn(`[submit-review] Attempted review for order with status: ${orderData.status}`);
                throw new Error('Reviews can only be submitted for completed orders.');
            }

            // 1b. Read ALL Products involved in the reviews
            const productIds = reviews.map(r => r.productId);
            const productRefs = productIds.map(id => db.collection('products').doc(id));
            console.log(`[submit-review] Reading product documents for IDs: ${productIds.join(', ')}`);
            const productSnaps = await transaction.getAll(...productRefs); // Use getAll for efficiency
            const productDataMap = new Map();
            productSnaps.forEach(snap => {
                if (snap.exists) {
                    productDataMap.set(snap.id, { ref: snap.ref, data: snap.data() });
                } else {
                     console.warn(`[submit-review] Firestore Read: Product ID ${snap.id} not found.`);
                }
            });

            // --- STEP 2: PERFORM ALL WRITES ---

            // 2a. Loop through reviews, calculate updates, and schedule writes
            for (const review of reviews) {
                const { productId, rating, comment } = review;
                console.log(`[submit-review] Preparing writes for Product ID: ${productId}`);

                // Update Product Rating (if product exists)
                if (productDataMap.has(productId)) {
                    const { ref: productRef, data: productData } = productDataMap.get(productId);
                    const oldRating = productData.rating || 0;
                    const oldReviewCount = productData.reviewCount || 0;
                    const newReviewCount = oldReviewCount + 1;
                    const newAvgRating = ((oldRating * oldReviewCount) + rating) / newReviewCount;

                    transaction.update(productRef, { // Schedule product update
                        reviewCount: newReviewCount,
                        rating: newAvgRating
                    });
                    console.log(`[submit-review] Scheduled product ${productId} update: rating=${newAvgRating.toFixed(2)}, count=${newReviewCount}`);
                } else {
                     console.warn(`[submit-review] Skipping product update for missing product ID ${productId}.`);
                }

                // Create New Review Document
                const newReviewRef = db.collection('reviews').doc(); // Auto-generate ID
                transaction.set(newReviewRef, { // Schedule review creation
                    userId: userId,
                    userName: userName || 'Anonymous',
                    productId: productId,
                    orderId: orderId, // Use the 'id' field from the order
                    rating: rating,
                    comment: comment || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`[submit-review] Scheduled new review document for product ${productId}`);
            }

            // 2b. Update Order Status
            transaction.update(orderRef, { // Schedule order status update
                status: 'Completed (Reviewed)'
            });
            console.log(`[submit-review] Scheduled order ${orderId} status update to 'Completed (Reviewed)'`);
        }); // End of the transaction block

        console.log(`[submit-review] Transaction successful for Order ID: ${orderId}`);
        res.status(200).json({ success: true, message: 'Reviews submitted successfully.' });

    } catch (error) {
        console.error(`Error in /api/submit-review.js transaction for Order ID ${orderId}: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to submit reviews.' });
    }
};