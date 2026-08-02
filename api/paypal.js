// FILE: api/paypal.js
//
// Real PayPal payment processing for customer checkout, added 2026-07-22.
// Two-phase flow, matching PayPal's own recommended pattern:
//   1. action=create-order -- server computes the authoritative total
//      (never trusts the client) and asks PayPal to create an order for
//      that amount. Returns a PayPal order id for the Smart Button to render.
//   2. action=capture-order -- called after the buyer approves in the
//      PayPal popup. Captures the payment, then -- only once money has
//      actually been received -- writes the real Firestore order via the
//      same createOrderTransaction() helper the existing "Card" checkout
//      uses, so stock/discount/credit handling is identical either way.
//
// Requires PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars (server-side
// only). See api/_lib/paypal-helper.js.
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';
import { createPayPalOrder, capturePayPalOrder } from './_lib/paypal-helper.js';
import { calculateOrderTotal, createOrderTransaction } from './_lib/order-helper.js';
import { sendOrderConfirmation } from './_lib/brevo-helper.js';

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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { action } = req.query;
    const uid = await getVerifiedUid(req);

    try {
        if (action === 'create-order') {
            const { orderPayload } = req.body;
            const { totalAmount } = await calculateOrderTotal({ orderPayload, uid });

            if (!(totalAmount > 0)) {
                return res.status(400).json({ error: 'This order has no balance due, so PayPal is not needed.' });
            }

            const paypalOrder = await createPayPalOrder(totalAmount, `hamperess-${Date.now()}`);
            return res.status(200).json({ paypalOrderId: paypalOrder.id });
        }

        if (action === 'capture-order') {
            const { paypalOrderId, orderPayload } = req.body;
            if (!paypalOrderId) return res.status(400).json({ error: 'paypalOrderId is required.' });

            // 1. Actually take the payment.
            const captureResult = await capturePayPalOrder(paypalOrderId);
            const capture = captureResult?.purchase_units?.[0]?.payments?.captures?.[0];

            if (captureResult.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED') {
                console.error('PayPal capture did not complete:', JSON.stringify(captureResult));
                return res.status(402).json({ error: 'PayPal payment was not completed. Please try again.' });
            }

            // 2. Payment is real and confirmed -- now write the actual order,
            //    re-validating stock/discount/credit authoritatively (same
            //    logic the existing Card checkout uses).
            let orderResult;
            try {
                orderResult = await createOrderTransaction({
                    orderPayload,
                    uid,
                    paymentMethod: 'PayPal',
                    transactionId: capture.id
                });
            } catch (orderError) {
                // Payment succeeded but the order couldn't be created (e.g.
                // stock ran out in the few seconds between create-order and
                // capture). The customer HAS been charged -- this needs a
                // human to reconcile/refund via the PayPal dashboard, not a
                // silent failure. Surface everything needed for that.
                console.error(`CRITICAL: PayPal payment ${capture.id} (£${capture.amount?.value}) captured successfully but order creation failed: ${orderError.message}. Manual refund via PayPal may be required.`);
                return res.status(500).json({
                    error: `Your payment was received (PayPal reference ${capture.id}), but we couldn't complete your order: ${orderError.message}. Please contact us with this reference and we'll sort it out right away.`
                });
            }

            // 3. Fire the confirmation email -- same as the Card checkout path,
            //    never let an email problem affect the response now that
            //    payment has actually been captured and the order written.
            try {
                const orderDoc = await db.collection('orders').doc(orderResult.orderId).get();
                if (orderDoc.exists) await sendOrderConfirmation(orderDoc.data());
            } catch (emailError) {
                console.error(`Order ${orderResult.orderId} created OK, but confirmation email failed:`, emailError.message);
            }

            // 4. Sanity-check the captured amount against our own authoritative
            //    total. They should always match since we told PayPal the
            //    amount ourselves in create-order -- if they don't, it's
            //    worth a loud log for manual review, but the customer already
            //    paid and has an order, so don't fail the request over it.
            const capturedAmount = parseFloat(capture.amount?.value || '0');
            if (Math.abs(capturedAmount - orderResult.totalAmount) > 0.01) {
                console.error(`WARNING: PayPal captured amount (£${capturedAmount}) does not match order total (£${orderResult.totalAmount}) for order ${orderResult.orderId}, PayPal capture ${capture.id}. Needs manual review.`);
            }

            return res.status(201).json({ success: true, orderId: orderResult.orderId });
        }

        return res.status(400).json({ error: 'Unknown action.' });
    } catch (error) {
        console.error('PayPal API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
