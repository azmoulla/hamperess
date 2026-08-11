// FILE: api/reviews.js
import admin from 'firebase-admin';
import { db, auth } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    const { productId } = req.query;

    // ==========================================
    // GET REQUESTS (Public: Fetch Reviews)
    // ==========================================
    if (req.method === 'GET') {
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required.' });
        }

        try {
            const snapshot = await db.collection('reviews')
                .where('productId', '==', productId)
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) return res.status(200).json([]);

            const reviews = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    userName: data.userName || 'Anonymous',
                    rating: data.rating || 0,
                    comment: data.comment || '',
                    date: data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Recently'
                };
            });

            return res.status(200).json(reviews);

        } catch (error) {
            console.error('Reviews GET Error:', error);
            return res.status(500).json({ error: 'Failed to load reviews.' });
        }
    }

    // ==========================================
    // POST REQUESTS (User: Submit Review)
    // ==========================================
    if (req.method === 'POST') {
        // 1. Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }
        
        let userId, userName;
        try {
            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await auth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            userName = decodedToken.name || null;
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        }

        const { orderId, reviews } = req.body;

        if (!orderId || !reviews || !Array.isArray(reviews) || reviews.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid orderId or reviews array.' });
        }

        try {
            await db.runTransaction(async (transaction) => {
                // --- STEP 1: READ PHASE ---

                // 1a. Read the Order (by 'id' field, not doc ID)
                const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);
                const orderSnap = await transaction.get(orderQuery);

                if (orderSnap.empty) throw new Error('Order not found.');
                
                const orderDoc = orderSnap.docs[0];
                const orderRef = orderDoc.ref;
                const orderData = orderDoc.data();

                // Security & Status Checks
                if (orderData.userId !== userId) throw new Error('Order access denied.');
                if (orderData.status !== 'Completed' && orderData.status !== 'Completed (Reviewed)') {
                    throw new Error('Reviews can only be submitted for completed orders.');
                }

                // 1b. Read All Products
                const productIds = reviews.map(r => r.productId);
                const productRefs = productIds.map(id => db.collection('products').doc(id));
                const productSnaps = await transaction.getAll(...productRefs);
                
                const productDataMap = new Map();
                productSnaps.forEach(snap => {
                    if (snap.exists) productDataMap.set(snap.id, { ref: snap.ref, data: snap.data() });
                });

                // --- STEP 2: WRITE PHASE ---

                for (const review of reviews) {
                    const { productId, rating, comment } = review;

                    // Update Product Ratings (if product exists)
                    if (productDataMap.has(productId)) {
                        const { ref: productRef, data: productData } = productDataMap.get(productId);
                        const oldRating = productData.rating || 0;
                        const oldReviewCount = productData.reviewCount || 0;
                        const newReviewCount = oldReviewCount + 1;
                        const newAvgRating = ((oldRating * oldReviewCount) + rating) / newReviewCount;

                        transaction.update(productRef, {
                            reviewCount: newReviewCount,
                            rating: newAvgRating
                        });
                    }

                    // Create Review Document
                    const newReviewRef = db.collection('reviews').doc();
                    transaction.set(newReviewRef, {
                        userId,
                        userName: userName || 'Anonymous',
                        productId,
                        orderId,
                        rating,
                        comment: comment || '',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // Update Order Status
                transaction.update(orderRef, { status: 'Completed (Reviewed)' });
            });

            return res.status(200).json({ success: true, message: 'Reviews submitted successfully.' });

        } catch (error) {
            console.error('Submit Review Error:', error);
            return res.status(500).json({ error: error.message || 'Failed to submit reviews.' });
        }
    }

    return res.status(405).end();
}
