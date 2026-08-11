// FILE: api/admin-orders.js
import admin from 'firebase-admin';
import { db, auth, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendShippingUpdate, sendCancellationEmail, sendRefundConfirmationEmail } from './_lib/brevo-helper.js';
import { refundPayPalCapture } from './_lib/paypal-helper.js';

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

export default async function handler(req, res) {
    const { action } = req.query;

    // Whether the caller is an admin, for actions (like 'cancel') that are
    // reachable by both admins and regular customers -- also used later to
    // decide whether a PayPal refund fires immediately or gets queued for
    // admin review (see the 'cancel' handler below).
    let isAdminCaller = false;

    // FIX (2026-08-09): 'cancel' is the only action in this file a regular
    // customer triggers directly -- public/app.js's "Need to cancel an item?"
    // button on the Order Details page posts here. Every other action (POS,
    // search, fulfillment, status updates) is admin-only. The old blanket
    // verifyAdmin() check below rejected every real customer's own cancellation
    // with a silent 403, since customer accounts never have isAdmin:true.
    // Confirmed live: cancelling while signed in as the admin test account
    // returned 200, but the endpoint a real customer's browser hits is the
    // exact same one -- so self-service cancellation was completely broken
    // for actual customers. Admins can still cancel any order (Fulfillment
    // Center); a non-admin caller may only cancel an order that is theirs.
    if (req.method === 'POST' && action === 'cancel') {
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        isAdminCaller = await verifyAdmin(req);
        if (!isAdminCaller) {
            const { orderId } = req.body;
            if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found.' });
            if (orderDoc.data().userId !== uid) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }
    } else {
        // 1. Universal Admin Security Check (unchanged for every other action)
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

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

                // Starts-with matching via Firestore range query: a search term
                // T matches any indexed value in [T, T + '\uF8FF') -- '\uF8FF' is a
                // very high Unicode codepoint, so this range covers every string
                // that begins with T without needing a search service. Lets admins
                // type a partial Order ID (from the start) or partial email instead
                // of pasting the whole thing. Order IDs are always stored uppercase
                // (e.g. "ORD-260806-XZ5CO"), so the term is uppercased to match
                // regardless of how the admin typed it; email is lowercased since
                // customerEmail is stored lowercase.
                if (orderId) {
                    let term = orderId.trim().toUpperCase();
                    // ADDED (2026-08-10): admins naturally search by the
                    // date embedded in an order ID (e.g. "260810" for
                    // ORD-260810-XXXXX) rather than typing the "ORD-"
                    // prefix -- but the starts-with query below can only
                    // match from the very beginning of the stored ID, so a
                    // bare date search returned nothing even though the
                    // order existed (confirmed live: searching "260810"
                    // found 0 results, "ORD-260810" found the real order).
                    // If the term is purely numeric and doesn't already
                    // have the prefix, prepend it so a bare date search
                    // "just works". Deliberately narrow -- doesn't attempt
                    // to match a suffix fragment alone (e.g. just
                    // "LLK3A"), which would need a real substring search
                    // (fetch-and-filter in memory) with a scaling cost
                    // this doesn't have.
                    if (/^\d+$/.test(term) && !term.startsWith('ORD-')) {
                        term = `ORD-${term}`;
                    }
                    snapshot = await ordersRef
                        .where('id', '>=', term)
                        .where('id', '<=', term + '\uF8FF')
                        .orderBy('id')
                        .limit(25)
                        .get();
                } else if (email) {
                    const term = email.trim().toLowerCase();
                    // FIX (2026-08-09): with only `.orderBy('customerEmail')`,
                    // every order for the same customer shares an identical
                    // sort value, so Firestore breaks the tie using an
                    // arbitrary/implicit document-ID order -- NOT recency.
                    // Confirmed live: a customer with >25 orders had two
                    // known orders (findable individually by order-ID search)
                    // silently missing from their email search results,
                    // pushed out past the `.limit(25)` cutoff by doc-ID
                    // ordering that has nothing to do with relevance. Adding
                    // `orderDate desc` as a secondary sort breaks ties by
                    // recency instead, so the 25 shown are the 25 most recent
                    // -- the cap itself is unchanged, this only fixes which
                    // 25 win.
                    snapshot = await ordersRef
                        .where('customerEmail', '>=', term)
                        .where('customerEmail', '<=', term + '\uF8FF')
                        .orderBy('customerEmail')
                        .orderBy('orderDate', 'desc')
                        .limit(25)
                        .get();
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

                    // NEW: Discount codes (percent/fixed/shipping) -- re-fetch fresh
                    // from Firestore rather than trusting the client-supplied
                    // value/type, same pattern as api/orders.js.
                    let discountDoc = null;
                    if (!creditDoc && ['percent', 'fixed', 'shipping'].includes(appliedDiscount?.type) && appliedDiscount.id) {
                        const discountRef = db.collection('discounts').doc(appliedDiscount.id);
                        discountDoc = await transaction.get(discountRef);
                        if (!discountDoc.exists) throw new Error('Discount code not found.');
                    }

                    // Calculation Phase
                    const itemsSubtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                    let deliveryCharge = itemsSubtotal < 50 ? 4.99 : 0;
                    // Check for free shipping return code logic
                    if (appliedDiscount?.code?.startsWith('RET-') && appliedDiscount?.usageHistory?.length === 0) {
                        deliveryCharge = 0;
                    }

                    let discount = 0;
                    const customerEmailLower = (customerDetails.email || '').trim().toLowerCase();

                    // FIX (2026-08-08): this branch never existed, so applying a
                    // store_credit code via POS always left `discount` at its
                    // initial value of 0 -- the POS screen calculated and showed
                    // the discount client-side (public/admin.js updateOrderSummary())
                    // and quoted the operator a lower total, but the order actually
                    // saved to Firestore recorded the FULL undiscounted total AND
                    // `discountApplied: 0`, and the credit's `remainingValue` was
                    // never decremented (confirmed live: a real £10 credit applied
                    // to a £22.50 order still showed remainingValue: 10 and
                    // usageHistory amountUsed: 0 after the order was created,
                    // while the saved order had totalAmount: 22.5 instead of the
                    // £12.50 quoted on screen). Mirrors the working logic already
                    // used by the customer checkout path in
                    // api/_lib/order-helper.js's createOrderTransaction().
                    if (creditDoc) {
                        const creditData = creditDoc.data();
                        if (!creditData.isActive || !(creditData.remainingValue > 0)) {
                            throw new Error('This store credit is no longer active or has no remaining balance.');
                        }
                        discount = Math.min(itemsSubtotal + deliveryCharge, creditData.remainingValue);
                    } else if (discountDoc) {
                        // NEW: authoritative discount-code validation -- mirrors
                        // api/orders.js. Every check re-reads from `discountData`
                        // (fresh from Firestore), never from the client-supplied
                        // `appliedDiscount`.
                        const discountData = discountDoc.data();
                        const now = new Date();

                        if (!discountData.isActive) throw new Error('This discount code is no longer active.');
                        if (discountData.startDate && now < new Date(discountData.startDate)) {
                            throw new Error('This discount code is not active yet.');
                        }
                        if (discountData.endDate) {
                            const end = new Date(discountData.endDate);
                            end.setHours(23, 59, 59, 999);
                            if (now > end) throw new Error('This discount code has expired.');
                        }
                        if (typeof discountData.maxUses === 'number' && discountData.maxUses !== null && (discountData.usageCount || 0) >= discountData.maxUses) {
                            throw new Error('This discount code has reached its usage limit.');
                        }
                        if (typeof discountData.minOrderValue === 'number' && discountData.minOrderValue !== null && itemsSubtotal < discountData.minOrderValue) {
                            throw new Error(`This code requires a minimum order of £${discountData.minOrderValue.toFixed(2)}.`);
                        }
                        if (discountData.oneRedemptionPerCustomer && customerEmailLower && (discountData.usedByEmails || []).includes(customerEmailLower)) {
                            throw new Error('This discount code has already been used on this customer\'s account.');
                        }

                        const applicableProductIds = discountData.applicableProductIds || [];
                        const applicableCategories = discountData.applicableCategories || [];
                        if (applicableProductIds.length > 0 || applicableCategories.length > 0) {
                            const cartQualifies = items.some(item => {
                                const pDoc = productDocs.find(doc => doc.id === item.id);
                                const pData = pDoc && pDoc.exists ? pDoc.data() : null;
                                const idMatch = applicableProductIds.includes(item.id);
                                const catMatch = pData && applicableCategories.includes(pData.category);
                                return idMatch || catMatch;
                            });
                            if (!cartQualifies) throw new Error('This discount code is not valid for the items in this order.');
                        }

                        if (discountData.type === 'percent') discount = (itemsSubtotal * discountData.value) / 100;
                        else if (discountData.type === 'fixed') discount = discountData.value;
                        else if (discountData.type === 'shipping') discount = deliveryCharge;
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

                    // NEW: Update Discount Code usage (if used)
                    if (discountDoc) {
                        const discountUpdate = { usageCount: admin.firestore.FieldValue.increment(1) };
                        if (customerEmailLower) {
                            discountUpdate.usedByEmails = admin.firestore.FieldValue.arrayUnion(customerEmailLower);
                        }
                        transaction.update(discountDoc.ref, discountUpdate);
                    }

                    transaction.set(newOrderRef, {
                        id: orderId, userId: null, customerName: customerDetails.name,
                        customerEmail: customerDetails.email, deliveryAddress, items,
                        itemsSubtotal, deliveryChargeApplied: deliveryCharge, discountApplied: discount,
                        appliedDiscount, totalAmount: total, status: 'Pending',
                        paymentMethod: paymentMethod || 'External Card Reader',
                        transactionId: transactionId || null,
                        // ADDED (2026-08-10): explicit order-source marker,
                        // see the matching comment in
                        // api/_lib/order-helper.js -- this is the only
                        // order-creation path that should ever write 'pos'.
                        orderSource: 'pos',
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

                // REWRITE (2026-08-09): the old version only ever flipped
                // `status` -- it never restored stock for the cancelled
                // item(s), never touched `order.items` so a partial
                // cancellation left no record of *which* item/qty was
                // cancelled, never reversed a discount code/store credit
                // used on the order, and never told the customer anything
                // happened. Fixed all four, mirroring patterns already
                // proven elsewhere in this codebase: stock restore mirrors
                // the decrement in api/_lib/order-helper.js (only
                // non-custom items were ever stock-tracked, so only those
                // are restored); discount/credit reversal mirrors the
                // consumption logic in that same file; the email mirrors
                // sendShippingUpdate/sendOrderConfirmation in brevo-helper.js.
                // Discount/credit reversal is deliberately limited to a FULL
                // cancellation only -- proportionally reversing a percent/
                // fixed discount for a *partial* cancellation is ambiguous
                // (depends on which specific items the discount applied to)
                // and was left out rather than guessed at.
                let isFull = false;
                let emailPayload = null;
                let refundContext = null;

                // NOTE (2026-08-09): orders created via customer checkout
                // (api/_lib/order-helper.js) store each item's product
                // reference as `productId`; orders created via the POS
                // ("Create Order (POS)") screen store the exact same info as
                // plain `id` instead, because `action=create` above just
                // spreads the raw product object the POS UI clicked
                // (`public/admin.js`: `{ ...product, quantity: 1 }`, and
                // `product.id` is the Firestore doc id) straight into
                // `order.items` with no renaming. Confirmed live: a POS-
                // created test order's items had `id` and no `productId` at
                // all. `getPid()` normalizes across both shapes so this
                // action works for orders from either origin.
                const getPid = (item) => item.productId || item.id;

                await db.runTransaction(async (transaction) => {
                    const orderRef = db.collection('orders').doc(orderId);
                    const orderDoc = await transaction.get(orderRef);
                    if (!orderDoc.exists) throw new Error('Order not found.');
                    const orderData = orderDoc.data();
                    const orderItems = orderData.items || [];

                    isFull = (!itemsToCancel || itemsToCancel.length === 0);

                    // Work out exactly which productId -> qty is being newly
                    // cancelled by *this* call, respecting any quantity a
                    // prior partial cancellation already removed.
                    const cancelMap = new Map();
                    if (isFull) {
                        orderItems.forEach(item => {
                            const pid = getPid(item);
                            if (!pid) return;
                            const already = item.cancelledQuantity || 0;
                            const remaining = item.quantity - already;
                            if (remaining > 0) cancelMap.set(pid, (cancelMap.get(pid) || 0) + remaining);
                        });
                    } else {
                        itemsToCancel.forEach(reqItem => {
                            const item = orderItems.find(oi => getPid(oi) === reqItem.productId);
                            if (!item) return;
                            const pid = getPid(item);
                            const already = item.cancelledQuantity || 0;
                            const remaining = item.quantity - already;
                            const qty = Math.min(Number(reqItem.quantity) || 0, remaining);
                            if (qty > 0) cancelMap.set(pid, (cancelMap.get(pid) || 0) + qty);
                        });
                    }

                    if (cancelMap.size === 0) throw new Error('No cancellable quantity found for the selected item(s).');

                    // READ PHASE -- product docs for stock restoration (only
                    // non-custom items were ever stock-decremented at order
                    // time, so only those are restored here).
                    const stockRestoreIds = Array.from(cancelMap.keys()).filter(pid => {
                        const item = orderItems.find(oi => getPid(oi) === pid);
                        return item && !item.isCustom;
                    });
                    const productRefs = stockRestoreIds.map(pid => db.collection('products').doc(pid));
                    const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];

                    // WRITE PHASE -- record cancelled quantity per item. Built
                    // before the discount/credit/refund decisions below so
                    // those can check whether EVERY item is now cancelled --
                    // not just whether *this* request happened to be a
                    // "Cancel Entire Order" click. Without this, an order
                    // cancelled via several separate partial requests that
                    // happen to add up to everything would never trigger the
                    // discount/credit reversal, refund delivery portion, or a
                    // final "Cancelled" status -- it would sit at "Partially
                    // Cancelled" forever with 0 items actually left.
                    const updatedItems = orderItems.map(item => {
                        const pid = getPid(item);
                        const qty = pid ? cancelMap.get(pid) : null;
                        if (!qty) return item;
                        return { ...item, cancelledQuantity: (item.cancelledQuantity || 0) + qty };
                    });
                    const allNowCancelled = updatedItems.every(item => (item.cancelledQuantity || 0) >= item.quantity);

                    // READ PHASE -- discount/credit reversal, only once every
                    // item on the order is cancelled (see allNowCancelled above).
                    let creditRef = null, creditDoc = null;
                    let discountRef = null, discountDoc = null;
                    if (allNowCancelled && orderData.appliedDiscount?.id && orderData.discountApplied > 0) {
                        if (orderData.appliedDiscount.type === 'store_credit') {
                            creditRef = db.collection('storeCredits').doc(orderData.appliedDiscount.id);
                            creditDoc = await transaction.get(creditRef);
                        } else if (['percent', 'fixed', 'shipping'].includes(orderData.appliedDiscount.type)) {
                            discountRef = db.collection('discounts').doc(orderData.appliedDiscount.id);
                            discountDoc = await transaction.get(discountRef);
                        }
                    }

                    // WRITE PHASE -- restore stock.
                    productDocs.forEach(doc => {
                        if (!doc.exists) return;
                        const qty = cancelMap.get(doc.id);
                        transaction.update(doc.ref, { stock: admin.firestore.FieldValue.increment(qty) });
                    });

                    const newStatus = allNowCancelled ? 'Cancelled' : 'Partially Cancelled';
                    transaction.update(orderRef, { status: newStatus, items: updatedItems });

                    // WRITE PHASE -- reverse discount/credit (only once every item is cancelled).
                    if (creditRef && creditDoc?.exists) {
                        const cd = creditDoc.data();
                        const restored = (cd.remainingValue || 0) + orderData.discountApplied;
                        transaction.update(creditRef, {
                            remainingValue: restored,
                            isActive: true,
                            usageHistory: admin.firestore.FieldValue.arrayUnion({
                                orderId, amountUsed: -orderData.discountApplied, date: new Date(), note: 'Reversed: order cancelled'
                            })
                        });
                    }
                    if (discountRef && discountDoc?.exists) {
                        const discountUpdate = { usageCount: admin.firestore.FieldValue.increment(-1) };
                        const emailLower = (orderData.customerEmail || '').trim().toLowerCase();
                        if (emailLower) discountUpdate.usedByEmails = admin.firestore.FieldValue.arrayRemove(emailLower);
                        transaction.update(discountRef, discountUpdate);
                    }

                    // ADDED (2026-08-09): work out the PayPal refund owed for
                    // *this specific cancellation call* -- proportional to
                    // what was actually paid, not the item's list price, so a
                    // discounted order refunds the discounted amount. Formula:
                    // paidRatio = totalAmount / (itemsSubtotal + delivery) --
                    // the fraction of the pre-discount total that was actually
                    // charged -- applied to the value of the item(s) just
                    // cancelled. Delivery is only refunded once every item on
                    // the order ends up cancelled (no partial-delivery
                    // refunds for cancelling one item out of several).
                    // Skipped entirely for non-PayPal orders (POS/"Card" have
                    // no gateway to call) or a capture still pending PayPal's
                    // own review (nothing settled yet to refund).
                    const cancelledItemsValue = Array.from(cancelMap.entries()).reduce((sum, [pid, qty]) => {
                        const item = orderItems.find(oi => getPid(oi) === pid);
                        return sum + (item ? item.price * qty : 0);
                    }, 0);
                    const isRefundableOrder = orderData.paymentMethod === 'PayPal'
                        && orderData.transactionId
                        && orderData.paymentStatus !== 'pending_review';
                    if (isRefundableOrder) {
                        const denom = (orderData.itemsSubtotal || 0) + (orderData.deliveryChargeApplied || 0);
                        const paidRatio = denom > 0 ? (orderData.totalAmount || 0) / denom : 0;
                        let refundAmount = cancelledItemsValue * paidRatio;
                        if (allNowCancelled) refundAmount += (orderData.deliveryChargeApplied || 0) * paidRatio;
                        refundAmount = Math.round(refundAmount * 100) / 100;

                        if (refundAmount > 0) {
                            refundContext = { captureId: orderData.transactionId, amount: refundAmount };
                        }
                    }

                    isFull = allNowCancelled;
                    emailPayload = {
                        order: { id: orderData.id, customerName: orderData.customerName, customerEmail: orderData.customerEmail },
                        cancelledItems: Array.from(cancelMap.entries()).map(([productId, qty]) => {
                            const item = orderItems.find(oi => getPid(oi) === productId);
                            return { title: item?.title || productId, quantity: qty };
                        }),
                        isFull: allNowCancelled
                    };
                });

                // Fire the cancellation email after the transaction has
                // durably committed -- never let a Brevo hiccup turn an
                // already-successful cancellation into a 500 (same pattern
                // as sendShippingUpdate's call site below).
                if (emailPayload?.order?.customerEmail) {
                    try {
                        await sendCancellationEmail(emailPayload.order, emailPayload.cancelledItems, emailPayload.isFull);
                    } catch (emailError) {
                        console.error(`Order ${orderId} cancelled OK, but cancellation email failed:`, emailError.message);
                    }
                }

                // ADDED (2026-08-09): if this cancellation is refund-eligible
                // (PayPal order, settled capture, non-zero amount owed --
                // computed inside the transaction above as `refundContext`),
                // decide whether to fire it now or queue it for admin review.
                // Admin-triggered cancellations refund immediately (an admin
                // already reviewed and confirmed the cancellation in the UI).
                // Customer-triggered self-service cancellations do NOT
                // auto-refund -- real money leaving the account with no human
                // in the loop is a materially different risk than the
                // store-credit/discount-code reversal above (which only
                // adjusts the store's own bookkeeping, no cash movement).
                // Instead the amount owed is recorded on the order for an
                // admin to trigger via the new 'process-refund' action.
                let refundWarning = null;
                if (refundContext) {
                    const refundEntryBase = { amount: refundContext.amount, date: new Date(), orderId };
                    if (isAdminCaller) {
                        try {
                            const refundResult = await refundPayPalCapture(refundContext.captureId, refundContext.amount);
                            await db.collection('orders').doc(orderId).update({
                                refunds: admin.firestore.FieldValue.arrayUnion({
                                    ...refundEntryBase, status: 'completed', paypalRefundId: refundResult.id, triggeredBy: 'admin'
                                })
                            });
                            if (emailPayload?.order?.customerEmail) {
                                try {
                                    await sendRefundConfirmationEmail(emailPayload.order, refundContext.amount);
                                } catch (emailError) {
                                    console.error(`Order ${orderId} refunded OK, but refund confirmation email failed:`, emailError.message);
                                }
                            }
                        } catch (refundError) {
                            // Mirrors the existing "captured but order creation
                            // failed" pattern in api/paypal.js -- the
                            // cancellation itself already committed
                            // successfully above, so don't fail this request
                            // over a refund problem. Record it as failed so
                            // it's visible for manual handling via the
                            // PayPal dashboard, and say so in the response.
                            console.error(`Order ${orderId} cancelled OK, but PayPal refund of £${refundContext.amount.toFixed(2)} failed:`, refundError.message);
                            await db.collection('orders').doc(orderId).update({
                                refunds: admin.firestore.FieldValue.arrayUnion({
                                    ...refundEntryBase, status: 'failed', error: refundError.message, triggeredBy: 'admin'
                                })
                            }).catch(() => {});
                            refundWarning = `Cancelled OK, but the £${refundContext.amount.toFixed(2)} PayPal refund failed (${refundError.message}). Please refund manually via the PayPal dashboard.`;
                        }
                    } else {
                        await db.collection('orders').doc(orderId).update({
                            refunds: admin.firestore.FieldValue.arrayUnion({
                                ...refundEntryBase, status: 'pending_admin_review', triggeredBy: 'customer_cancellation'
                            }),
                            refundOwed: admin.firestore.FieldValue.increment(refundContext.amount)
                        }).catch(err => console.error(`Failed to record pending refund for order ${orderId}:`, err.message));
                    }
                }

                return res.status(200).json({
                    success: true,
                    message: `Order updated to ${isFull ? 'Cancelled' : 'Partially Cancelled'}`,
                    ...(refundWarning ? { warning: refundWarning } : {})
                });
            }

            // --- CASE: Process a pending refund (admin-only) ---
            // ADDED (2026-08-09): the counterpart to the 'cancel' action's
            // "queue for review" path above -- when a *customer* cancels a
            // PayPal-paid order/item, the refund amount is recorded on
            // `order.refundOwed` instead of firing automatically (see the
            // comment on that logic above). This is where an admin actually
            // triggers that money movement, after reviewing it. Reachable
            // only through the universal verifyAdmin() gate at the top of
            // this handler (this action isn't 'cancel', so it isn't exempted
            // from that check).
            if (action === 'process-refund') {
                const { orderId, amount } = req.body;
                if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

                const orderRef = db.collection('orders').doc(orderId);
                const orderDoc = await orderRef.get();
                if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found.' });
                const orderData = orderDoc.data();

                if (orderData.paymentMethod !== 'PayPal' || !orderData.transactionId) {
                    return res.status(400).json({ error: 'This order has no PayPal payment to refund. Please refund manually.' });
                }

                // Admin can confirm the auto-computed amount or override it
                // (same "trust the admin to review the number" pattern
                // already used by Issue Credit's editable amount field) --
                // defaults to whatever is currently owed if not specified.
                const refundAmount = (typeof amount === 'number' && amount > 0) ? amount : (orderData.refundOwed || 0);
                if (!(refundAmount > 0)) {
                    return res.status(400).json({ error: 'No refund amount to process for this order.' });
                }

                try {
                    const refundResult = await refundPayPalCapture(orderData.transactionId, refundAmount);
                    await orderRef.update({
                        refunds: admin.firestore.FieldValue.arrayUnion({
                            amount: refundAmount, date: new Date(), orderId, status: 'completed',
                            paypalRefundId: refundResult.id, triggeredBy: 'admin_manual_process'
                        }),
                        refundOwed: Math.max(0, (orderData.refundOwed || 0) - refundAmount)
                    });
                    if (orderData.customerEmail) {
                        try {
                            await sendRefundConfirmationEmail(
                                { id: orderData.id, customerName: orderData.customerName, customerEmail: orderData.customerEmail },
                                refundAmount
                            );
                        } catch (emailError) {
                            console.error(`Order ${orderId} refunded OK, but refund confirmation email failed:`, emailError.message);
                        }
                    }
                    return res.status(200).json({ success: true, message: `Refunded £${refundAmount.toFixed(2)}.` });
                } catch (refundError) {
                    console.error(`Manual refund processing failed for order ${orderId}:`, refundError.message);
                    return res.status(500).json({ error: `PayPal refund failed: ${refundError.message}` });
                }
            }

            // --- CASE: Log a manually-issued refund (admin-only) ---
            // ADDED (2026-08-11): non-PayPal orders (POS/External Card
            // Reader, Bank Transfer, the legacy no-payment-method "Card"
            // checkout) have no gateway this app can call -- the admin has
            // to refund the customer directly on the card terminal/bank
            // transfer, outside this system entirely. That previously left
            // zero record of it anywhere in admin: no line in "Payment
            // Refunds", no way to tell at a glance the money had already
            // gone back. This action does NOT move any money itself -- it
            // just logs what already happened elsewhere, into the same
            // refunds[] ledger `process-refund` writes to, so it shows up
            // consistently regardless of payment method.
            if (action === 'mark-manual-refund') {
                const { orderId, amount, reference } = req.body;
                if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });
                if (!(Number(amount) > 0)) return res.status(400).json({ error: 'A positive refund amount is required.' });

                const orderRef = db.collection('orders').doc(orderId);
                const orderDoc = await orderRef.get();
                if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found.' });
                const orderData = orderDoc.data();

                const refundAmount = Number(amount);
                await orderRef.update({
                    refunds: admin.firestore.FieldValue.arrayUnion({
                        amount: refundAmount, date: new Date(), orderId, status: 'completed',
                        triggeredBy: 'admin_manual_external', reference: reference || null
                    }),
                    refundOwed: Math.max(0, (orderData.refundOwed || 0) - refundAmount)
                });

                if (orderData.customerEmail) {
                    try {
                        await sendRefundConfirmationEmail(
                            { id: orderData.id, customerName: orderData.customerName, customerEmail: orderData.customerEmail },
                            refundAmount
                        );
                    } catch (emailError) {
                        console.error(`Order ${orderId} manual refund logged OK, but confirmation email failed:`, emailError.message);
                    }
                }
                return res.status(200).json({ success: true, message: `Logged £${refundAmount.toFixed(2)} as manually refunded.` });
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

            // Fire the shipping-update email, but never let a Brevo problem
            // affect this response -- the status change already succeeded.
            if (newStatus === 'Shipped') {
                try {
                    const orderDoc = await db.collection('orders').doc(orderId).get();
                    if (orderDoc.exists) await sendShippingUpdate(orderDoc.data());
                } catch (emailError) {
                    console.error(`Order ${orderId} marked Shipped OK, but shipping email failed:`, emailError.message);
                }
            }

            return res.status(200).json({ success: true, message: `Order ${orderId} updated.` });
        }

    } catch (error) {
        console.error('Admin Orders API Error:', error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(405).end();
}