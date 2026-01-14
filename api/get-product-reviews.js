// FILE: api/get-product-reviews.js
import { db } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    const { productId } = req.query;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    try {
        const reviewsRef = db.collection('reviews');
        // Fetch reviews for this product, newest first
        const snapshot = await reviewsRef
            .where('productId', '==', productId)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

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

        res.status(200).json(reviews);

    } catch (error) {
        console.error('Error fetching reviews:', error);
        // If the index is missing, this might fail, but it returns an empty array to prevent frontend crash
        res.status(500).json({ error: 'Failed to load reviews.' });
    }
}
