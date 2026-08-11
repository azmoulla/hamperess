// FILE: api/returns.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendReturnStatusEmail } from './_lib/email-helper.js';

// --- HELPERS ---
function generateReturnId() {
    const timestamp = Date.now().toString().slice(-5);
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RET-${timestamp}-${randomChars}`;
}

async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        return null;
    }
}

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const { action } = req.query; // Used to distinguish Admin actions ('all', 'updateStatus')

    // ==========================================
    // GET REQUESTS
    // ==========================================
    if (req.method === 'GET') {
        
        // --- CASE A: Admin Get All Returns (from get-all-returns.js) ---
        if (action === 'all') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            try {
                const returnsSnapshot = await db.collectionGroup('returns').orderBy('requestDate', 'desc').get();
                const returns = [];

                for (const doc of returnsSnapshot.docs) {
                    const returnData = doc.data();
                    const userRef = doc.ref.parent.parent;
                    // Fetch user details for the Admin UI
                    const userDoc = await userRef.get();

                    if (returnData.requestDate && typeof returnData.requestDate.toDate === 'function') {
                        returnData.requestDate = returnData.requestDate.toDate().toISOString();
                    }

                    // ADDED (2026-08-09): lets the admin UI show a "Refund via
                    // PayPal" option only for returns whose original order was
                    // actually paid through PayPal (POS/"Card" orders have no
                    // gateway to call, so they only ever get Issue Credit).
                    // One extra lookup per return, same N+1 pattern already
                    // used above for the user doc -- acceptable at admin
                    // listing scale.
                    let orderPaymentMethod = null;
                    try {
                        const orderQuery = await db.collection('orders').where('id', '==', returnData.orderId).limit(1).get();
                        if (!orderQuery.empty) orderPaymentMethod = orderQuery.docs[0].data().paymentMethod || null;
                    } catch (lookupError) {
                        console.error(`Could not look up order ${returnData.orderId} payment method for return ${doc.id}:`, lookupError.message);
                    }

                    returns.push({
                        docId: doc.id, // Explicit docId for admin actions
                        returnPath: doc.ref.path,
                        userId: userRef.id,
                        customerName: userDoc.data()?.name || 'N/A',
                        customerEmail: userDoc.data()?.email || 'N/A',
                        orderPaymentMethod,
                        ...returnData
                    });
                }
                return res.status(200).json(returns);
            } catch (error) {
                console.error('Error fetching all returns:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
        }

        // --- CASE B: User Get My Returns (from returns.js GET) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

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
            return res.status(200).json(returns);
        } catch (error) {
            console.error('Error fetching user returns:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // ==========================================
    // POST REQUESTS
    // ==========================================
    if (req.method === 'POST') {
        // --- CASE: User Create Return (from returns.js POST) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        try {
            const { returnRequest } = req.body;
            if (!returnRequest || !returnRequest.orderId || !returnRequest.items) {
                return res.status(400).json({ error: 'Return request with orderId and items is required.' });
            }

            const { orderId, reason, items, refundAmount, desiredOutcome } = returnRequest;
            // Verify order belongs to user
            const orderQuery = db.collection('orders').where('id', '==', orderId).where('userId', '==', uid).limit(1);
            const orderSnapshot = await orderQuery.get();

            if (orderSnapshot.empty) throw new Error('Original order not found.');

            const orderData = orderSnapshot.docs[0].data();

            // ADDED (2026-08-09): the "Return Window (Days)" setting (Site &
            // Content > Delivery & Legal Compliance, `returnWindowInDays` on
            // `settings/site_settings`) was previously only enforced
            // client-side -- public/app.js hides the "Need to return an
            // item?" button once an order is older than the window, but the
            // API itself accepted a return request of any age if called
            // directly. Now checked authoritatively here too, reading the
            // same setting the client reads via GET /api/site-settings, so
            // both stay in sync automatically if the admin changes the
            // window. Admin actions taken on an existing Pending return
            // (Approve/Reject/Issue Credit/Refund via PayPal) don't need
            // their own separate check -- a return can no longer come into
            // existence past the window in the first place.
            const settingsDoc = await db.doc('settings/site_settings').get();
            const returnWindowInDays = settingsDoc.exists && typeof settingsDoc.data().returnWindowInDays === 'number'
                ? settingsDoc.data().returnWindowInDays
                : 28;
            const orderDate = orderData.orderDate?.toDate ? orderData.orderDate.toDate() : new Date(orderData.orderDate);
            const daysSinceOrder = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
            if (daysSinceOrder > returnWindowInDays) {
                throw new Error(`This order was placed more than ${returnWindowInDays} days ago and is outside the return window.`);
            }

            const newReturnRef = db.collection('users').doc(uid).collection('returns').doc();
            
            const newReturnPayload = {
                id: generateReturnId(),
                orderId: orderId,
                customerName: orderData.customerName || 'N/A',
                customerEmail: orderData.customerEmail || 'unknown@example.com',
                reason, items, refundAmount, desiredOutcome,
                requestDate: admin.firestore.FieldValue.serverTimestamp(),
                status: 'Pending'
            };

            await newReturnRef.set(newReturnPayload);
            return res.status(200).json({ success: true, returnId: newReturnPayload.id });

        } catch (error) {
            console.error('Error creating return request:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // ==========================================
    // PUT REQUESTS
    // ==========================================
    if (req.method === 'PUT') {
        
        // --- CASE A: Admin Update Status (from update-return-status.js) ---
        if (action === 'updateStatus') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            try {
                const { returnId, newStatus, orderId, userId } = req.body;
                if (!returnId || !newStatus || !orderId || !userId) {
                    return res.status(400).json({ error: 'All IDs and new status are required.' });
                }

                const returnRef = db.collection('users').doc(userId).collection('returns').doc(returnId);
                const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);

                // Captured inside the transaction below, used after it commits to
                // send a status email (Approved/Rejected only). Declared outside
                // so it survives Firestore's automatic retry-on-contention -- only
                // the data from whichever run actually commits matters, and we
                // send the email once, after the write is durable, not from
                // inside the transaction callback itself (which could otherwise
                // retry and fire duplicate emails, or send one for a write that
                // ultimately fails).
                let returnEmailData = null;

                // FIX (2026-08-08): Firestore transactions require ALL reads to
                // happen before ANY writes. This used to call
                // transaction.update(returnRef, ...) (a write) and THEN, inside
                // the 'Approved' branch, transaction.get(orderQuery) (a read) --
                // a write followed by a read, which Firestore rejects outright
                // with "Firestore transactions require all reads to be executed
                // before all writes." Every single 'Approve' click failed with a
                // 500 because of this, 100% of the time -- confirmed live via a
                // direct API call during e2e return testing. The admin UI never
                // surfaced this because the fetch() call that triggers it (in
                // admin.js) doesn't check response.ok before showing "Return
                // status updated successfully!", so admins had no way to know
                // Approve was silently doing nothing. Fixed by restructuring so
                // every transaction.get() happens first, then every
                // transaction.update() -- same logic/outcome, just reordered.
                await db.runTransaction(async (transaction) => {
                    const returnDoc = await transaction.get(returnRef);
                    if (!returnDoc.exists) throw new Error('Return request not found.');

                    let orderDocRef = null;
                    let finalOrderStatus = null;
                    let currentOrderStatus = null;

                    // Sync with Order Status if "Approved" (Logic from update-return-status.js)
                    if (newStatus === 'Approved') {
                        const orderSnapshot = await transaction.get(orderQuery);
                        if (orderSnapshot.empty) throw new Error('Original order not found.');

                        const orderDoc = orderSnapshot.docs[0];
                        const orderData = orderDoc.data();
                        const returnData = returnDoc.data();
                        orderDocRef = orderDoc.ref;
                        currentOrderStatus = orderData.status;

                        const orderItemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
                        const returnedItemCount = returnData.items.reduce((sum, item) => sum + item.quantity, 0);
                        const isFullAction = returnedItemCount >= orderItemCount;

                        finalOrderStatus = orderData.status;

                        // Logic: Determine if this is a "Cancellation" (Pre-ship) or "Return" (Post-ship)
                        if (['Pending', 'Processing'].includes(orderData.status)) {
                            const orderDate = orderData.orderDate.toDate();
                            const ageInHours = (new Date() - orderDate) / (1000 * 60 * 60);

                            if (ageInHours < 48) {
                                finalOrderStatus = isFullAction ? 'Cancelled' : 'Partially Cancelled';
                            } else {
                                finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                            }
                        } else if (['Shipped', 'Completed', 'Dispatched'].includes(orderData.status)) {
                            finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                        }
                    }

                    // All writes happen after all reads above.
                    transaction.update(returnRef, { status: newStatus });
                    if (orderDocRef && finalOrderStatus !== currentOrderStatus) {
                        transaction.update(orderDocRef, { status: finalOrderStatus });
                    }

                    const returnData = returnDoc.data();
                    returnEmailData = {
                        email: returnData.customerEmail,
                        name: returnData.customerName,
                        returnId: returnData.id,
                        orderId: returnData.orderId
                    };
                });

                // Fire the status email after the transaction has durably
                // committed. Only Approved/Rejected notify the customer here --
                // Issue Credit/Create Replacement already send their own email
                // (sendVoucherEmail, api/vouchers.js) when the return reaches a
                // Completed(Credit:...) status, so this deliberately doesn't
                // double up on those. Wrapped in try/catch, same pattern as
                // sendVoucherEmail's own call site, so a Brevo hiccup can't turn
                // an already-successful status update into a 500.
                if (returnEmailData?.email && ['Approved', 'Rejected'].includes(newStatus)) {
                    try {
                        await sendReturnStatusEmail({ ...returnEmailData, status: newStatus });
                    } catch (emailError) {
                        console.error('Error sending return status email:', emailError);
                    }
                }

                return res.status(200).json({ success: true, message: 'Return updated.' });

            } catch (error) {
                console.error('Error updating return status:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        // --- CASE B: User Cancel Return (from returns.js PUT) ---
        const uid = await getVerifiedUid(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized.' });

        try {
            const { returnId } = req.query;
            if (!returnId) return res.status(400).json({ error: 'Return ID required.' });

            const returnsRef = db.collection('users').doc(uid).collection('returns');
            const query = returnsRef.where('id', '==', returnId).limit(1);
            const snapshot = await query.get();

            if (snapshot.empty) throw new Error(`No return found with ID: ${returnId}`);

            await snapshot.docs[0].ref.update({ status: 'Cancelled' });
            return res.status(200).json({ success: true });

        } catch (error) {
            console.error('Error cancelling return:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
}
