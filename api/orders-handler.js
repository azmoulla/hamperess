// FILE: api/orders-handler.js
// COMBINES: get-orders, create-order, create-guest-order, create-admin-order, find-order, cancel-order

import admin from 'firebase-admin';

// --- 1. FIREBASE INITIALIZATION (Robust check from your files) ---
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

// --- 2. SHARED HELPER FUNCTIONS ---

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

// Replicating verifyAdmin logic (checks if user has valid token)
async function verifyAdmin(req) {
    const uid = await getVerifiedUid(req);
    // If you have specific admin claims (e.g. if (token.admin === true)), add them here.
    // For now, this ensures the request comes from an authenticated user.
    return !!uid; 
}

function generateOrderId(isGuest = false, docId = null) {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
    
    if (isGuest) {
        // Format from create-guest-order.js
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `ORD-${datePart}-${randomPart}`;
    } else {
        // Format from create-order.js / create-admin-order.js
        const suffix = docId ? docId.slice(0, 5).toUpperCase() : Math.random().toString(36).substring(2, 7).toUpperCase();
        return `ORD-${datePart}-${suffix}`;
    }
}

// --- 3. MAIN ROUTER ---

export default async function handler(req, res) {
    const { action } = req.query;

    try {
        switch (action) {
            case 'get_orders':
                return await handleGetOrders(req, res);
            case 'find_order':
                return await handleFindOrder(req, res);
            case 'create':
                return await handleCreateOrder(req, res);
            case 'create_guest':
                return await handleCreateGuestOrder(req, res);
            case 'create_admin':
                return await handleCreateAdminOrder(req, res);
            case 'cancel':
                return await handleCancelOrder(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action requested' });
        }
    } catch (error) {
        console.error(`API Handler Error (${action}):`, error);
        return res.status(500).json({ error: error.message });
    }
}

// --- 4. LOGIC HANDLERS (Exact Logic from your files) ---

// 1. Logic from get-orders.js
async function handleGetOrders(req, res) {
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('userId', '==', uid)
                                       .orderBy('orderDate', 'desc')
                                       .get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            const orderDate = data.orderDate && typeof data.orderDate.toDate === 'function' 
                ? data.orderDate.toDate().toISOString() 
                : new Date().toISOString();

            return {
                id: doc.id,
                ...data,
                status: data.status || 'Pending',
                orderDate: orderDate
            };
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// 2. Logic from create-guest-order.js
async function handleCreateGuestOrder(req, res) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    const { orderPayload } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing order data.' });
    }

    const productRefs = orderPayload.items
        .filter(item => !item.isCustom)
        .map(item => db.collection('products').doc(item.productId));

    try {
        const newOrderRef = await db.runTransaction(async (transaction) => {
            const stockIssues = [];
            if (productRefs.length > 0) {
                const productDocs = await transaction.getAll(...productRefs);
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
                throw new Error(`Some items are out of stock: ${stockIssues.join(', ')}`);
            }

            if (productRefs.length > 0) {
                const productDocs = await transaction.getAll(...productRefs);
                for (const doc of productDocs) {
                    const cartItem = orderPayload.items.find(item => item.productId === doc.id);
                    const newStock = admin.firestore.FieldValue.increment(-cartItem.quantity);
                    transaction.update(doc.ref, { stock: newStock });
                }
            }

            const newOrderId = generateOrderId(true);
            const newDocRef = db.collection('orders').doc(newOrderId);

            const newOrder = {
                id: newOrderId,
                ...orderPayload,
                isGuestOrder: true,
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };

            transaction.set(newDocRef, newOrder);
            return newDocRef;
        });

        res.status(201).json({ success: true, orderId: newOrderRef.id });
    } catch (error) {
        console.error('Error creating guest order:', error);
        res.status(500).json({ error: `Failed to create guest order: ${error.message}` });
    }
}

// 3. Logic from create-order.js (Standard User)
async function handleCreateOrder(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

    try {
        const { orderPayload } = req.body;
        if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
            return res.status(400).json({ error: 'Order payload with items is required.' });
        }

        const newOrderRef = db.collection('orders').doc();
        const orderId = generateOrderId(false, newOrderRef.id);

        await db.runTransaction(async (transaction) => {
            const standardItems = orderPayload.items.filter(item => !item.isCustom);
            const productRefs = standardItems.map(item => db.collection('products').doc(item.productId));
            const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];
            
            let creditDoc = null;
            if (orderPayload.appliedDiscount?.type === 'store_credit' && orderPayload.appliedDiscount.id) {
                const creditDocRef = db.collection('storeCredits').doc(orderPayload.appliedDiscount.id);
                creditDoc = await transaction.get(creditDocRef);
                if (!creditDoc.exists) {
                    throw new Error('Store credit voucher not found or has been deleted.');
                }
            }

            const itemsWithPrice = orderPayload.items.filter(item => item.isCustom);
            for (let i = 0; i < productDocs.length; i++) {
                const productDoc = productDocs[i];
                if (!productDoc.exists) throw new Error(`Product ID ${standardItems[i].productId} not found.`);
                const productData = productDoc.data();
                if (productData.stock < standardItems[i].quantity) throw new Error(`Not enough stock for ${productData.title}.`);
                itemsWithPrice.push({ ...standardItems[i], price: productData.price });
            }

            const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
            let discountApplied = 0;
            
            if (creditDoc) {
                const creditData = creditDoc.data();
                if (creditData.isActive && creditData.remainingValue > 0) {
                    discountApplied = Math.min(chargeableTotal, creditData.remainingValue);
                }
            } else if (orderPayload.appliedDiscount) {
                const discount = orderPayload.appliedDiscount;
                if (discount.type === 'percent') {
                    discountApplied = (itemsSubtotal * discount.value) / 100;
                } else if (discount.type === 'fixed') {
                    discountApplied = discount.value;
                }
            }
            
            discountApplied = Math.min(chargeableTotal, discountApplied);
            const totalAmount = chargeableTotal - discountApplied;
            
            for (let i = 0; i < productRefs.length; i++) {
                transaction.update(productRefs[i], { stock: admin.firestore.FieldValue.increment(-standardItems[i].quantity) });
            }

            if (creditDoc) {
                const creditData = creditDoc.data();
                const newRemainingValue = creditData.remainingValue - discountApplied;
                const newUsageRecord = { orderId: orderId, amountUsed: discountApplied, date: new Date() };
                transaction.update(creditDoc.ref, {
                    remainingValue: newRemainingValue,
                    isActive: newRemainingValue > 0,
                    usageHistory: admin.firestore.FieldValue.arrayUnion(newUsageRecord)
                });
            }

            const finalOrderPayload = {
                ...orderPayload, id: orderId, itemsSubtotal, deliveryChargeApplied,
                discountApplied, totalAmount, status: 'Pending',
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                items: itemsWithPrice
            };
            transaction.set(newOrderRef, finalOrderPayload);
        });

        res.status(200).json({ success: true, orderId: orderId });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'An unexpected server error occurred.', details: error.message });
    }
}

// 4. Logic from create-admin-order.js
async function handleCreateAdminOrder(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { customerDetails, deliveryAddress, items, paymentMethod, appliedDiscount, transactionId , isReplacement, replacesReturnId, originalOrderId } = req.body;

        if (!customerDetails || !deliveryAddress || !items || !items.length) {
            return res.status(400).json({ error: 'Missing required order information.' });
        }
        
        const newOrderRef = db.collection('orders').doc();
        const orderId = generateOrderId(false, newOrderRef.id);

        await db.runTransaction(async (transaction) => {
            const productRefs = items
                .filter(item => !item.isCustom)
                .map(item => db.collection('products').doc(item.id));
            
            let productDocs = [];
            if (productRefs.length > 0) {
                productDocs = await transaction.getAll(...productRefs);
            }

            let creditDoc = null;
            if (appliedDiscount && appliedDiscount.type === 'store_credit') {
                const creditRef = db.collection('storeCredits').where('code', '==', appliedDiscount.code).limit(1);
                const creditSnap = await transaction.get(creditRef);
                if (!creditSnap.empty) {
                    creditDoc = creditSnap.docs[0];
                }
            }

            const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
            if (appliedDiscount && appliedDiscount.code && appliedDiscount.code.startsWith('RET-') && appliedDiscount.usageHistory && appliedDiscount.usageHistory.length === 0) {
                deliveryChargeApplied = 0;
            }
            let discountApplied = 0;
            if (appliedDiscount && typeof appliedDiscount.value === 'number') {
                if (appliedDiscount.type === 'percent') {
                    discountApplied = (itemsSubtotal * appliedDiscount.value) / 100;
                } else if (appliedDiscount.type === 'fixed' || appliedDiscount.type === 'store_credit') {
                    discountApplied = appliedDiscount.value;
                }
            }
            const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
            discountApplied = Math.min(chargeableTotal, discountApplied);
            const totalAmount = chargeableTotal - discountApplied;

            for (const doc of productDocs) {
                const cartItem = items.find(item => item.id === doc.id);
                if (cartItem) {
                    const newStock = admin.firestore.FieldValue.increment(-cartItem.quantity);
                    transaction.update(doc.ref, { stock: newStock });
                }
            }
            
            if (creditDoc) {
                const newRemainingValue = creditDoc.data().remainingValue - discountApplied;
                const newUsageRecord = { orderId: orderId, amountUsed: discountApplied, date: new Date() };
                transaction.update(creditDoc.ref, {
                    remainingValue: newRemainingValue,
                    isActive: newRemainingValue > 0,
                    usageHistory: admin.firestore.FieldValue.arrayUnion(newUsageRecord)
                });
            }
            
            const orderPayload = {
                id: orderId, userId: null, customerName: customerDetails.name,
                customerEmail: customerDetails.email, deliveryAddress, items,
                itemsSubtotal, deliveryChargeApplied, discountApplied, appliedDiscount,
                totalAmount, status: 'Pending', paymentMethod: paymentMethod || 'External Card Reader',
                transactionId: transactionId || null,
                orderDate: admin.firestore.FieldValue.serverTimestamp(),
                notes: [],
                isReplacement: isReplacement || false,   
                replacesReturnId: replacesReturnId || null,
                originalOrderId: originalOrderId || null 
            };
            transaction.set(newOrderRef, orderPayload);
        });

        res.status(200).json({ success: true, orderId, message: `Order ${orderId} created successfully.` });

    } catch (error) {
        console.error('Error creating admin order:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}

// 5. Logic from find-order.js
async function handleFindOrder(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId, email } = req.query;
        const ordersRef = db.collection('orders');
        let snapshot;

        if (orderId) {
            snapshot = await ordersRef.where('id', '==', orderId).get();
        } else if (email) {
            snapshot = await ordersRef.where('customerEmail', '==', email).orderBy('orderDate', 'desc').get();
        } else {
            return res.status(400).json({ error: 'Please provide either an orderId or an email.' });
        }

        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        const orders = snapshot.docs.map(doc => {
            const orderData = doc.data();
            const orderDate = orderData.orderDate && typeof orderData.orderDate.toDate === 'function' 
                ? orderData.orderDate.toDate().toISOString() 
                : new Date().toISOString(); 

            return {
                docId: doc.id,
                ...orderData,
                orderDate: orderDate
            };
        });
        
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error in find-order handler:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// 6. Logic from cancel-order.js
async function handleCancelOrder(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId, itemsToCancel } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found. It may have been deleted.' });
        }

        const isFullCancellation = (!itemsToCancel || itemsToCancel.length === 0);
        const newStatus = isFullCancellation ? 'Cancelled' : 'Partially Cancelled';
        
        await orderRef.update({ status: newStatus });

        res.status(200).json({ success: true, message: `Order updated to ${newStatus}` });

    } catch (error) {
        console.error('Error in cancel-order API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}