// FILE: api/admin-orders.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    // 1. Universal Admin Security Check
    if (!(await verifyAdmin(req))) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { action } = req.query;

    try {
        // ==========================================
        // HANDLE GET REQUESTS
        // ==========================================
        if (req.method === 'GET') {
            
            // --- CASE: Get Unshipped Orders (from get-unshipped-orders.js) ---
            if (action === 'unshipped') {
                const { startDate, endDate } = req.query;
                let query = db.collection('orders').where('status', 'in', ['Pending', 'Processing']);

                if (startDate) query = query.where('orderDate', '>=', new Date(startDate));
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query = query.where('orderDate', '<=', endOfDay);
                }

                const snapshot = await query.get();
                if (snapshot.empty) return res.status(200).json([]);

                const unshippedOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
                // Sort by date ascending (oldest first)
                unshippedOrders.sort((a, b) => a.orderDate.seconds - b.orderDate.seconds);
                return res.status(200).json(unshippedOrders);
            }

            // --- CASE: Find Order (from find-order.js) ---
            if (action === 'search') {
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

                if (snapshot.empty) return res.status(200).json([]);
                
                const orders = snapshot.docs.map(doc => {
                    const orderData = doc.data();
                    return {
                        docId: doc.id,
                        ...orderData,
                        orderDate: orderData.orderDate?.toDate().toISOString() || new Date().toISOString()
                    };
                });
                return res.status(200).json(orders);
            }

            // --- CASE: Order Details (from order-details.js) ---
            if (action === 'details') {
                const { orderId } = req.query; // Expecting Document ID here
                if (!orderId) return res.status(400).json({ error: 'Order document ID is required.' });

                const doc = await db.collection('orders').doc(orderId).get();
                if (!doc.exists) return res.status(404).json({ error: 'Order not found.' });

                const data = doc.data();
                return res.status(200).json({
                    docId: doc.id,
                    ...data,
                    orderDate: data.orderDate?.toDate().toISOString()
                });
            }

            // --- CASE: Rich Order Details (from rich-order-details.js) ---
            if (action === 'rich') {
                const { orderId } = req.query; // Expecting friendly ID e.g. "ORD-..."
                if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

                const orderQuery = await db.collection('orders').where('id', '==', orderId).limit(1).get();
                if (orderQuery.empty) return res.status(404).json({ error: `Order #${orderId} not found.` });

                const orderDoc = orderQuery.docs[0];
                const orderData = { docId: orderDoc.id, ...orderDoc.data() };

                // 1. Find returns
                const returnsSnapshot = await db.collectionGroup('returns').where('orderId', '==', orderId).get();
                const associatedReturns = returnsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 2. Find replacement orders
                const replacementOrders = [];
                if (associatedReturns.length > 0) {
                    const returnIds = associatedReturns.map(r => r.id);
                    // Firestore 'in' query supports up to 10 items
                    const chunkedIds = [];
                    for (let i = 0; i < returnIds.length; i += 10) chunkedIds.push(returnIds.slice(i, i + 10));
                    
                    for (const chunk of chunkedIds) {
                        const repQuery = await db.collection('orders').where('replacesReturnId', 'in', chunk).get();
                        repQuery.forEach(d => replacementOrders.push({ id: d.data().id, status: d.data().status }));
                    }
                }

                // 3. Calculate active vs returned items
                const approvedReturnedItems = associatedReturns
                    .filter(r => r.status === 'Approved')
                    .flatMap(r => r.items);
                
                if (orderData.items) {
                    orderData.items.forEach(item => {
                        const qtyReturned = approvedReturnedItems
                            .filter(ri => ri.productId === item.productId)
                            .reduce((sum, ri) => sum + ri.quantity, 0);
                        item.quantityReturned = qtyReturned;
                        item.quantityActive = item.quantity - qtyReturned;
                    });
                }

                return res.status(200).json({ ...orderData, associatedReturns, replacementOrders });
            }

            // --- CASE: Picking List (from picking-list.js) ---
            if (action === 'picking') {
                const { startDate, endDate } = req.query;
                let query = db.collection('orders').where('status', 'in', ['Pending', 'Processing']);
                if (startDate) query = query.where('orderDate', '>=', new Date(startDate));
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.where('orderDate', '<=', end);
                }

                const snapshot = await query.get();
                const itemQuantities = new Map();

                snapshot.forEach(doc => {
                    const order = doc.data();
                    if (!order.items) return;
                    
                    const processItem = (id, name, qty, type) => {
                        const key = `${type}_${id}`;
                        const jsDate = order.orderDate.toDate();
                        const existing = itemQuantities.get(key) || { totalQuantity: 0, type, name, dates: [] };
                        existing.totalQuantity += qty;
                        existing.dates.push(jsDate);
                        itemQuantities.set(key, existing);
                    };

                    order.items.forEach(item => {
                        if (item.isCustom && item.contents) {
                            item.contents.forEach(c => processItem(c.id, c.name, item.quantity * c.quantity, 'Component'));
                        } else if (item.isHamper && item.hamperContents) {
                            item.hamperContents.forEach(c => processItem(c.productId, c.title, item.quantity * c.quantity, 'Component'));
                        }
                        if (item.productId) {
                            processItem(item.productId, item.title, item.quantity, 'Product');
                        }
                    });
                });

                const list = Array.from(itemQuantities.values()).map(val => ({
                    ...val,
                    dates: val.dates.map(d => d.toISOString())
                }));
                return res.status(200).json(list.sort((a, b) => a.name.localeCompare(b.name)));
            }
        }

        // ==========================================
        // HANDLE POST REQUESTS
        // ==========================================
        if (req.method === 'POST') {
            
            // --- CASE: Create Admin Order (from create-admin-order.js) ---
            if (action === 'create') {
                const { customerDetails, deliveryAddress, items, paymentMethod, appliedDiscount, transactionId, isReplacement, replacesReturnId, originalOrderId } = req.body;

                if (!customerDetails || !items || !items.length) {
                    return res.status(400).json({ error: 'Missing required order info.' });
                }

                const newOrderRef = db.collection('orders').doc();
                const orderId = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${newOrderRef.id.slice(0, 5).toUpperCase()}`;

                await db.runTransaction(async (transaction) => {
                    // Read Phase
                    const productRefs = items.filter(i => !i.isCustom).map(i => db.collection('products').doc(i.id));
                    const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];

                    let creditDoc = null;
                    if (appliedDiscount?.type === 'store_credit') {
                        const creditQuery = db.collection('storeCredits').where('code', '==', appliedDiscount.code).limit(1);
                        const creditSnap = await transaction.get(creditQuery);
                        if (!creditSnap.empty) creditDoc = creditSnap.docs[0];
                    }

                    // Calculation Phase
                    const itemsSubtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                    let deliveryCharge = itemsSubtotal < 50 ? 4.99 : 0;
                    // Check for free shipping return code logic
                    if (appliedDiscount?.code?.startsWith('RET-') && appliedDiscount?.usageHistory?.length === 0) {
                        deliveryCharge = 0;
                    }

                    let discount = 0;
                    if (appliedDiscount && typeof appliedDiscount.value === 'number') {
                        if (appliedDiscount.type === 'percent') discount = (itemsSubtotal * appliedDiscount.value) / 100;
                        else discount = appliedDiscount.value;
                    }
                    const total = (itemsSubtotal + deliveryCharge) - Math.min(itemsSubtotal + deliveryCharge, discount);

                    // Write Phase
                    productDocs.forEach(doc => {
                        const item = items.find(i => i.id === doc.id);
                        if (item) transaction.update(doc.ref, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
                    });

                    if (creditDoc) {
                        const remaining = creditDoc.data().remainingValue - discount;
                        transaction.update(creditDoc.ref, {
                            remainingValue: remaining,
                            isActive: remaining > 0,
                            usageHistory: admin.firestore.FieldValue.arrayUnion({ orderId, amountUsed: discount, date: new Date() })
                        });
                    }

                    transaction.set(newOrderRef, {
                        id: orderId, userId: null, customerName: customerDetails.name,
                        customerEmail: customerDetails.email, deliveryAddress, items,
                        itemsSubtotal, deliveryChargeApplied: deliveryCharge, discountApplied: discount,
                        appliedDiscount, totalAmount: total, status: 'Pending',
                        paymentMethod: paymentMethod || 'External Card Reader',
                        transactionId: transactionId || null,
                        orderDate: admin.firestore.FieldValue.serverTimestamp(),
                        isReplacement: isReplacement || false,
                        replacesReturnId: replacesReturnId || null,
                        originalOrderId: originalOrderId || null,
                        notes: []
                    });
                });

                return res.status(200).json({ success: true, orderId, message: `Order ${orderId} created.` });
            }

            // --- CASE: Cancel Order (from cancel-order.js) ---
            if (action === 'cancel') {
                const { orderId, itemsToCancel } = req.body;
                if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

                const orderRef = db.collection('orders').doc(orderId);
                const orderDoc = await orderRef.get();
                if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found.' });

                const isFull = (!itemsToCancel || itemsToCancel.length === 0);
                const newStatus = isFull ? 'Cancelled' : 'Partially Cancelled';

                await orderRef.update({ status: newStatus });
                return res.status(200).json({ success: true, message: `Order updated to ${newStatus}` });
            }
        }

        // ==========================================
        // HANDLE PUT REQUESTS
        // ==========================================
        if (req.method === 'PUT') {
            // --- CASE: Update Status (from update-order-status.js) ---
            const { orderId, newStatus, trackingNumber, courier } = req.body;
            if (!orderId || !newStatus) return res.status(400).json({ error: 'Order ID and Status required.' });

            const updateData = { status: newStatus };
            if (trackingNumber && courier) {
                updateData.trackingNumber = trackingNumber.trim().toUpperCase();
                updateData.courier = courier;
                const urls = {
                    'Royal Mail': 'https://www.royalmail.com/track-your-item#/track/',
                    'DPD': 'https://www.dpd.co.uk/service/tracking?match=',
                    'Evri': 'https://www.evri.com/track/parcel/'
                };
                updateData.courierUrl = urls[courier] || null;
            }

            await db.collection('orders').doc(orderId).update(updateData);
            return res.status(200).json({ success: true, message: `Order ${orderId} updated.` });
        }

    } catch (error) {
        console.error('Admin Orders API Error:', error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(405).end();
}