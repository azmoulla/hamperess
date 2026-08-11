// FILE: api/vouchers.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendVoucherEmail } from './_lib/email-helper.js';
import { refundPayPalCapture } from './_lib/paypal-helper.js';
import { sendRefundConfirmationEmail } from './_lib/brevo-helper.js';

// --- HELPERS ---
function generateUniqueCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RET-';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 2) code += '-';
    }
    return code;
}

// NEW: discount codes (the `discounts` collection) are a separate feature
// from store credits -- percent/fixed/shipping promo codes with optional
// constraints (validity window, usage cap, per-customer limit, min order
// value, product/category restriction). These helpers only touch that
// collection; store credit logic below is untouched.
function parseOptionalDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function csvToArray(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (!value) return [];
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
}

// FIX (2026-08-09): admin-created discount codes (percent/fixed/shipping)
// never had a `description` field set at all -- only store_credit codes did
// (see the GET ?code= handler below). public/app.js's applyDiscount() and
// public/admin.js's POS discount handler both render
// `Success: "${discountData.description}" applied!`, so every admin-created
// discount code showed the literal text "undefined" there. Confirmed live
// both at customer checkout and via the POS screen. Synthesizing a
// human-readable description here (used by both create and update below)
// fixes it at the source going forward; see the frontend fallback in
// app.js/admin.js for codes created before this fix.
function generateDiscountDescription(type, value) {
    const numericValue = Number(value) || 0;
    if (type === 'percent') return `${numericValue}% off`;
    if (type === 'fixed') return `£${numericValue.toFixed(2)} off`;
    if (type === 'shipping') return 'Free shipping';
    return 'Discount applied';
}

// Checks the constraints that DON'T require cart/customer context (date
// window + global usage cap). minOrderValue, product/category restriction,
// and the per-customer limit need the cart and the customer's identity, so
// those are enforced authoritatively at order-creation time instead (see
// api/orders.js and api/admin-orders.js) -- this is only a pre-check for
// the "apply code" UX at checkout.
function checkDiscountAvailability(data) {
    if (!data.isActive) return 'This code is no longer active.';
    const now = new Date();
    const start = parseOptionalDate(data.startDate);
    if (start && now < start) return 'This code is not active yet.';
    const end = parseOptionalDate(data.endDate);
    if (end && now > endOfDay(end)) return 'This code has expired.';
    if (typeof data.maxUses === 'number' && data.maxUses !== null && (data.usageCount || 0) >= data.maxUses) {
        return 'This code has reached its usage limit.';
    }
    return null;
}

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const { code } = req.query;

    try {
        // ==========================================
        // GET REQUESTS
        // ==========================================
        if (req.method === 'GET') {

            // --- NEW CASE: Get All Discount Codes (Admin Only) ---
            // Separate from the storeCredits listing below -- does not
            // touch or affect it.
            if (req.query.adminList === 'discounts') {
                if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
                const snapshot = await db.collection('discounts').orderBy('creationDate', 'desc').get();
                const discounts = snapshot.docs.map(doc => {
                    const data = doc.data();
                    if (data.creationDate && typeof data.creationDate.toDate === 'function') {
                        data.creationDate = data.creationDate.toDate().toISOString();
                    }
                    return { id: doc.id, ...data };
                });
                return res.status(200).json(discounts);
            }

            // --- CASE A: Validate Discount (Public) ---
            // (Replaces validate-discount.js)
            if (code) {
                const upperCaseCode = code.trim().toUpperCase();

                // 1. Check Standard Discounts
                const discountSnap = await db.collection('discounts')
                    .where('code', '==', upperCaseCode)
                    .limit(1).get();

                if (!discountSnap.empty) {
                    const doc = discountSnap.docs[0];
                    const data = doc.data();
                    const unavailableReason = checkDiscountAvailability(data);
                    if (unavailableReason) {
                        return res.status(404).json({ error: unavailableReason });
                    }
                    return res.status(200).json({ id: doc.id, ...data });
                }

                // 2. Check Store Credits
                const creditSnap = await db.collection('storeCredits')
                    .where('code', '==', upperCaseCode)
                    .where('isActive', '==', true)
                    .limit(1).get();

                if (!creditSnap.empty) {
                    const creditDoc = creditSnap.docs[0];
                    const creditData = creditDoc.data();
                    
                    if (creditData.remainingValue > 0) {
                        return res.status(200).json({
                            id: creditDoc.id, // Crucial for order processing
                            type: 'store_credit',
                            value: creditData.remainingValue,
                            code: creditData.code,
                            usageHistory: creditData.usageHistory || [],
                            description: `Store credit with £${creditData.remainingValue.toFixed(2)} remaining.`
                        });
                    }
                }
                
                return res.status(404).json({ error: 'Invalid or expired code.' });
            }

            // --- CASE B: Get All Vouchers (Admin Only) ---
            // (Replaces get-all-vouchers.js)
            if (await verifyAdmin(req)) {
                const snapshot = await db.collection('storeCredits').orderBy('creationDate', 'desc').get();
                const vouchers = snapshot.docs.map(doc => {
                    const data = doc.data();
                    if (data.creationDate && typeof data.creationDate.toDate === 'function') {
                        data.creationDate = data.creationDate.toDate().toISOString();
                    }
                    return { id: doc.id, ...data };
                });
                return res.status(200).json(vouchers);
            }
            
            return res.status(403).json({ error: 'Forbidden' });
        }

        // ==========================================
        // POST REQUESTS
        // ==========================================
        if (req.method === 'POST') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            // --- NEW: Create a Discount Code ---
            // Entirely separate from store credit creation below -- keyed
            // off `kind` so the existing store-credit request shape (no
            // `kind` field) falls through to the untouched logic further
            // down.
            if (req.body.kind === 'discount') {
                const {
                    code: rawCode, discountType, value: discountValue,
                    startDate, endDate, maxUses,
                    oneRedemptionPerCustomer, minOrderValue,
                    applicableProductIds, applicableCategories
                } = req.body;

                if (!rawCode || !discountType || discountValue === undefined || discountValue === null || discountValue === '') {
                    return res.status(400).json({ error: 'Code, type, and value are required.' });
                }
                const upperCode = String(rawCode).trim().toUpperCase();
                if (!upperCode) return res.status(400).json({ error: 'Code is required.' });
                if (!['percent', 'fixed', 'shipping'].includes(discountType)) {
                    return res.status(400).json({ error: 'Type must be percent, fixed, or shipping.' });
                }

                const existing = await db.collection('discounts').where('code', '==', upperCode).limit(1).get();
                if (!existing.empty) {
                    return res.status(409).json({ error: `Code "${upperCode}" already exists.` });
                }

                const discountRef = db.collection('discounts').doc();
                const discountData = {
                    code: upperCode,
                    type: discountType,
                    value: Number(discountValue) || 0,
                    description: generateDiscountDescription(discountType, discountValue),
                    isActive: true,
                    creationDate: admin.firestore.FieldValue.serverTimestamp(),
                    startDate: startDate || null,
                    endDate: endDate || null,
                    maxUses: (maxUses !== undefined && maxUses !== null && maxUses !== '') ? Number(maxUses) : null,
                    usageCount: 0,
                    oneRedemptionPerCustomer: !!oneRedemptionPerCustomer,
                    usedByEmails: [],
                    minOrderValue: (minOrderValue !== undefined && minOrderValue !== null && minOrderValue !== '') ? Number(minOrderValue) : null,
                    applicableProductIds: csvToArray(applicableProductIds),
                    applicableCategories: csvToArray(applicableCategories)
                };

                await discountRef.set(discountData);
                return res.status(200).json({ success: true, code: upperCode });
            }

            // --- NEW: Edit an existing Discount Code ---
            // Updates the admin-set fields only -- `code`, `isActive`,
            // `usageCount`, `usedByEmails`, and `creationDate` are left
            // alone (code is immutable to avoid collision/history issues;
            // isActive has its own toggle action; usage tracking shouldn't
            // be resettable from an edit form).
            if (req.body.kind === 'update-discount') {
                const {
                    id, discountType, value: discountValue,
                    startDate, endDate, maxUses,
                    oneRedemptionPerCustomer, minOrderValue,
                    applicableProductIds, applicableCategories
                } = req.body;

                if (!id) return res.status(400).json({ error: 'Discount id is required.' });
                if (!discountType || discountValue === undefined || discountValue === null || discountValue === '') {
                    return res.status(400).json({ error: 'Type and value are required.' });
                }
                if (!['percent', 'fixed', 'shipping'].includes(discountType)) {
                    return res.status(400).json({ error: 'Type must be percent, fixed, or shipping.' });
                }

                const discountRef = db.collection('discounts').doc(id);
                const existingDoc = await discountRef.get();
                if (!existingDoc.exists) return res.status(404).json({ error: 'Discount code not found.' });

                await discountRef.update({
                    type: discountType,
                    value: Number(discountValue) || 0,
                    description: generateDiscountDescription(discountType, discountValue),
                    startDate: startDate || null,
                    endDate: endDate || null,
                    maxUses: (maxUses !== undefined && maxUses !== null && maxUses !== '') ? Number(maxUses) : null,
                    oneRedemptionPerCustomer: !!oneRedemptionPerCustomer,
                    minOrderValue: (minOrderValue !== undefined && minOrderValue !== null && minOrderValue !== '') ? Number(minOrderValue) : null,
                    applicableProductIds: csvToArray(applicableProductIds),
                    applicableCategories: csvToArray(applicableCategories)
                });

                return res.status(200).json({ success: true });
            }

            // --- NEW: Activate/Deactivate a Discount Code ---
            if (req.body.kind === 'toggle-discount-active') {
                const { id, isActive } = req.body;
                if (!id) return res.status(400).json({ error: 'Discount id is required.' });
                await db.collection('discounts').doc(id).update({ isActive: !!isActive });
                return res.status(200).json({ success: true });
            }

            // --- ADDED (2026-08-09): Refund a return via PayPal (real money
            // back to the original payment method) instead of/alongside
            // Issue Credit (store credit). Only usable when the original
            // order was actually paid through PayPal -- everything else
            // (POS/"External Card Reader", the unpaid "Card" checkout path)
            // has no gateway to call, so those returns still only ever get
            // Issue Credit. Mirrors Issue Credit's pattern of stamping the
            // return status and letting the admin confirm/edit the exact
            // amount before it fires (see public/admin.js's modal).
            if (req.body.kind === 'refund-paypal') {
                const { returnPath, amount } = req.body;
                if (!returnPath || !(Number(amount) > 0)) {
                    return res.status(400).json({ error: 'Return path and a positive amount are required.' });
                }

                const returnDocRef = db.doc(returnPath);
                const returnDoc = await returnDocRef.get();
                if (!returnDoc.exists) return res.status(404).json({ error: 'Return document not found.' });
                const returnData = returnDoc.data();

                const orderQuery = await db.collection('orders').where('id', '==', returnData.orderId).limit(1).get();
                if (orderQuery.empty) return res.status(404).json({ error: 'Original order not found.' });
                const orderDoc = orderQuery.docs[0];
                const orderData = orderDoc.data();

                if (orderData.paymentMethod !== 'PayPal' || !orderData.transactionId) {
                    return res.status(400).json({ error: 'This order has no PayPal payment to refund -- please refund manually.' });
                }

                const refundAmount = Number(amount);

                try {
                    const refundResult = await refundPayPalCapture(orderData.transactionId, refundAmount);
                    await db.runTransaction(async (transaction) => {
                        transaction.update(returnDocRef, { status: `Completed (Refunded: £${refundAmount.toFixed(2)} via PayPal)` });
                        transaction.update(orderDoc.ref, {
                            refunds: admin.firestore.FieldValue.arrayUnion({
                                amount: refundAmount, date: new Date(), orderId: orderDoc.id, status: 'completed',
                                paypalRefundId: refundResult.id, triggeredBy: 'admin_return_refund', returnId: returnData.id
                            })
                        });
                    });
                    if (orderData.customerEmail) {
                        try {
                            await sendRefundConfirmationEmail(
                                { id: orderDoc.id, customerName: orderData.customerName, customerEmail: orderData.customerEmail },
                                refundAmount
                            );
                        } catch (emailError) {
                            console.error(`Return ${returnData.id} refunded OK, but refund confirmation email failed:`, emailError.message);
                        }
                    }
                    return res.status(200).json({ success: true, message: `Refunded £${refundAmount.toFixed(2)} via PayPal.` });
                } catch (refundError) {
                    console.error(`PayPal refund failed for return ${returnData.id}:`, refundError.message);
                    return res.status(500).json({ error: `PayPal refund failed: ${refundError.message}` });
                }
            }

            // --- (Replaces generate-store-credit.js) ---
            const { returnPath, value, customerEmail } = req.body;
            if (!value || !customerEmail) {
                return res.status(400).json({ error: 'Value and customer email are required.' });
            }

            const newCode = generateUniqueCode();
            const creditRef = db.collection('storeCredits').doc();
            const returnId = returnPath ? returnPath.split('/').pop() : null;

            await db.runTransaction(async (transaction) => {
                let returnDocRef = null;
                
                // If linked to a return, verify it exists first
                if (returnPath) {
                    returnDocRef = db.doc(returnPath);
                    const returnDoc = await transaction.get(returnDocRef);
                    if (!returnDoc.exists) throw new Error('Return document not found.');
                }

                const creditData = {
                    code: newCode,
                    initialValue: Number(value),
                    remainingValue: Number(value),
                    isActive: true,
                    isSingleUse: false,
                    customerEmail,
                    creationDate: admin.firestore.FieldValue.serverTimestamp(),
                    usageHistory: []
                };

                if (returnId) creditData.createdForReturnId = returnId;

                transaction.set(creditRef, creditData);

                // Update the return status if linked
                if (returnPath && returnDocRef) {
                    transaction.update(returnDocRef, { status: `Completed (Credit: ${newCode})` });
                }
            });

            // Send the email BEFORE responding. Serverless functions (Vercel)
            // can freeze/kill execution the moment the response is sent, so a
            // "fire and forget" call here (previous behaviour) could get cut
            // off before the fetch to Brevo ever completed -- matches the
            // await-before-respond pattern already used for order/shipping
            // emails in orders.js / admin-orders.js. Wrapped in try/catch so
            // a Brevo hiccup doesn't fail the voucher creation itself, since
            // the credit is already committed to Firestore at this point.
            try {
                await sendVoucherEmail({
                    email: customerEmail,
                    name: 'Valued Customer',
                    code: newCode,
                    value: value
                });
            } catch (emailError) {
                console.error(`Voucher ${newCode} created OK, but email failed:`, emailError.message);
            }

            return res.status(200).json({ success: true, code: newCode, value });
        }

    } catch (error) {
        console.error('Vouchers API Error:', error);
        // If headers aren't sent yet, send 500
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    }

    return res.status(405).end();
}
