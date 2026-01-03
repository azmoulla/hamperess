// FILE: api/user-handler.js
// COMBINES: addresses, get-address-by-id, address-autocomplete, validate-discount, 
// submit-review, returns, AND cart.js

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
        console.error('Error verifying auth token:', error);
        return null;
    }
}

function generateReturnId() {
    const timestamp = Date.now().toString().slice(-5);
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RET-${timestamp}-${randomChars}`;
}

// --- 3. MAIN ROUTER ---

export default async function handler(req, res) {
    const { action } = req.query;

    try {
        switch (action) {
            case 'cart': // <--- ADDED CART ACTION
                return await handleCart(req, res);
            case 'addresses':
                return await handleAddresses(req, res);
            case 'get_address_by_id':
                return await handleGetAddressById(req, res);
            case 'address_autocomplete':
                return await handleAddressAutocomplete(req, res);
            case 'validate_discount':
                return await handleValidateDiscount(req, res);
            case 'submit_review':
                return await handleSubmitReview(req, res);
            case 'returns':
                return await handleReturns(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action requested' });
        }
    } catch (error) {
        console.error(`API Handler Error (${action}):`, error);
        return res.status(500).json({ error: error.message });
    }
}

// --- 4. LOGIC HANDLERS ---

// 1. Logic from cart.js
async function handleCart(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const userDocRef = db.collection('users').doc(uid);

    try {
        if (req.method === 'GET') {
            // --- FETCH THE CART ---
            const doc = await userDocRef.get();
            if (!doc.exists || !doc.data().cart) {
                return res.status(200).json([]); // Return empty array if no cart
            }
            return res.status(200).json(doc.data().cart);

        } else if (req.method === 'POST') {
            // --- SAVE THE CART ---
            const { cart } = req.body;
            if (!Array.isArray(cart)) {
                return res.status(400).json({ error: 'Invalid cart data provided.' });
            }
            // Use set with merge to avoid overwriting other user fields
            await userDocRef.set({ cart: cart }, { merge: true });
            return res.status(200).json({ success: true, message: 'Cart saved successfully.' });

        } else {
            return res.status(405).end('Method Not Allowed');
        }
    } catch (error) {
        console.error(`Error processing cart for user ${uid}:`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// 2. Logic from addresses.js
async function handleAddresses(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing authentication token.' });
    }

    const addressesRef = db.collection('users').doc(uid).collection('addresses');

    try {
        switch (req.method) {
            case 'GET': {
                const snapshot = await addressesRef.orderBy('isDefault', 'desc').get();
                const addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return res.status(200).json(addresses);
            }

            case 'POST': {
                const newAddress = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                
                const existingAddresses = await addressesRef.limit(1).get();
                if (existingAddresses.empty) {
                    newAddress.isDefault = true;
                }

                if (newAddress.isDefault) {
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => {
                        batch.update(doc.ref, { isDefault: false });
                    });
                    await batch.commit();
                }
                const docRef = await addressesRef.add(newAddress);
                return res.status(201).json({ id: docRef.id, ...newAddress });
            }

            case 'PUT': {
                const { addressId, ...addressData } = req.body;
                if (!addressId) return res.status(400).json({ error: 'Address ID is required.' });

                if (addressData.isDefault) {
                    const batch = db.batch();
                    const currentDefaults = await addressesRef.where('isDefault', '==', true).get();
                    currentDefaults.forEach(doc => {
                        if (doc.id !== addressId) {
                           batch.update(doc.ref, { isDefault: false });
                        }
                    });
                    await batch.commit();
                }
                await addressesRef.doc(addressId).update(addressData);
                return res.status(200).json({ success: true, message: 'Address updated.' });
            }

            case 'DELETE': {
                const { addressId } = req.query;
                if (!addressId) return res.status(400).json({ error: 'Address ID is required.' });

                await addressesRef.doc(addressId).delete();
                return res.status(200).json({ success: true, message: 'Address deleted.' });
            }

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error(`Error in /api/addresses (${req.method}):`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// 3. Logic from get-address-by-id.js
async function handleGetAddressById(req, res) {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Address ID is required.' });
    }

    const apiKey = process.env.GETADDRESS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        const apiUrl = `https://api.getAddress.io/get/${id}?api-key=${apiKey}`;
        const apiResponse = await fetch(apiUrl);
        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: `API Error: ${apiResponse.statusText}` });
        }
        
        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve full address.' });
    }
}

// 4. Logic from address-autocomplete.js
async function handleAddressAutocomplete(req, res) {
    const { term } = req.query;
    if (!term) {
        return res.status(400).json({ error: 'Search term is required.' });
    }

    const apiKey = process.env.GETADDRESS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        const apiUrl = `https://api.getAddress.io/autocomplete/${encodeURIComponent(term)}?api-key=${apiKey}`;
        const apiResponse = await fetch(apiUrl);
        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: `API Error: ${apiResponse.statusText}` });
        }

        res.status(200).json(data.suggestions);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch address suggestions.' });
    }
}

// 5. Logic from validate-discount.js
async function handleValidateDiscount(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    try {
        const upperCaseCode = code.trim().toUpperCase();

        const discountSnap = await db.collection('discounts').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!discountSnap.empty) {
            const doc = discountSnap.docs[0];
            return res.status(200).json({ id: doc.id, ...doc.data() });
        }

        const creditSnap = await db.collection('storeCredits').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!creditSnap.empty) {
            const creditDoc = creditSnap.docs[0];
            const creditData = creditDoc.data();
            if (creditData.remainingValue > 0) {
                return res.status(200).json({
                    id: creditDoc.id,
                    type: 'store_credit',
                    value: creditData.remainingValue,
                    code: creditData.code,
                    usageHistory: creditData.usageHistory || [],
                    description: `Store credit with £${creditData.remainingValue.toFixed(2)} remaining.`
                });
            }
        }
        
        return res.status(404).json({ error: 'Invalid or expired code.' });

    } catch (error) {
        console.error('Error validating code:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}

// 6. Logic from submit-review.js
async function handleSubmitReview(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
    }
    
    let userId, userName;
    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
        userName = decodedToken.name || null;
    } catch (error) {
        console.error("[submit-review] Error verifying Firebase ID token:", error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    const { orderId, reviews } = req.body;
    console.log(`[submit-review] Received request for Order ID: ${orderId}, User ID: ${userId}`);

    if (!orderId || !reviews || !Array.isArray(reviews) || reviews.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid orderId or reviews array.' });
    }

    try {
        await db.runTransaction(async (transaction) => {
            const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);
            const orderSnap = await transaction.get(orderQuery);

            if (orderSnap.empty) {
                throw new Error('Order not found.');
            }
            const orderDoc = orderSnap.docs[0];
            const orderRef = orderDoc.ref;
            const orderData = orderDoc.data();

            if (orderData.userId !== userId) {
                 throw new Error('Order access denied.');
            }

             if (orderData.status !== 'Completed' && orderData.status !== 'Completed (Reviewed)') {
                throw new Error('Reviews can only be submitted for completed orders.');
            }

            const productIds = reviews.map(r => r.productId);
            const productRefs = productIds.map(id => db.collection('products').doc(id));
            const productSnaps = await transaction.getAll(...productRefs);
            const productDataMap = new Map();
            productSnaps.forEach(snap => {
                if (snap.exists) {
                    productDataMap.set(snap.id, { ref: snap.ref, data: snap.data() });
                }
            });

            for (const review of reviews) {
                const { productId, rating, comment } = review;

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

                const newReviewRef = db.collection('reviews').doc();
                transaction.set(newReviewRef, {
                    userId: userId,
                    userName: userName || 'Anonymous',
                    productId: productId,
                    orderId: orderId,
                    rating: rating,
                    comment: comment || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            transaction.update(orderRef, {
                status: 'Completed (Reviewed)'
            });
        });

        res.status(200).json({ success: true, message: 'Reviews submitted successfully.' });

    } catch (error) {
        console.error(`Error in submit-review transaction: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to submit reviews.' });
    }
}

// 7. Logic from returns.js
async function handleReturns(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

    if (req.method === 'POST') {
        try {
            const { returnRequest } = req.body;
            if (!returnRequest || !returnRequest.orderId || !returnRequest.items) {
                return res.status(400).json({ error: 'Return request with orderId and items is required.' });
            }

            const { orderId, reason, items, refundAmount, desiredOutcome } = returnRequest;
            const orderQuery = db.collection('orders').where('id', '==', orderId).where('userId', '==', uid).limit(1);
            const orderSnapshot = await orderQuery.get();

            if (orderSnapshot.empty) {
                throw new Error('Original order not found.');
            }
            const orderData = orderSnapshot.docs[0].data();

            const newReturnRef = db.collection('users').doc(uid).collection('returns').doc();
            const newReturnPayload = {
                id: generateReturnId(),
                orderId: orderId,
                customerName: orderData.customerName || 'N/A',
                customerEmail: orderData.customerEmail || 'unknown@example.com',
                reason: reason,
                items: items,
                refundAmount: refundAmount,
                desiredOutcome: desiredOutcome,
                requestDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };

            await newReturnRef.set(newReturnPayload);
            res.status(200).json({ success: true, returnId: newReturnPayload.id });

        } catch (error) {
            console.error('Error creating return request:', error);
            res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
        }
    }
    
    if (req.method === 'GET') {
        try {
            const returnsRef = db.collection('users').doc(uid).collection('returns').orderBy('requestDate', 'desc');
            const snapshot = await returnsRef.get();
            const returns = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.requestDate && typeof data.requestDate.toDate === 'function') {
                    data.requestDate = data.requestDate.toDate().toISOString();
                }
                return data;
            });
            res.status(200).json(returns);
        } catch (error) {
            console.error('Error fetching returns:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    
    if (req.method === 'PUT') {
        try {
            const { returnId } = req.query;
            if (!returnId) return res.status(400).json({ error: 'Return ID is required.' });

            const returnsCollectionRef = db.collection('users').doc(uid).collection('returns');
            
            const query = returnsCollectionRef.where('id', '==', returnId).limit(1);
            const snapshot = await query.get();

            if (snapshot.empty) {
                throw new Error(`No return found with the ID: ${returnId}`);
            }

            const returnDocRef = snapshot.docs[0].ref;
            await returnDocRef.update({ status: 'Cancelled' });
            
            res.status(200).json({ success: true });

        } catch (error) {
            console.error('Error cancelling return:', error);
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    }
}
