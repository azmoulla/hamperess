// FILE: api/paypal-webhook.js
//
// Added 2026-08-02 alongside the "pending capture" handling in api/paypal.js.
// When a PayPal capture comes back PENDING (PayPal's own fraud/e-check
// review -- see api/paypal.js for the full explanation), we still create the
// order (flagged paymentStatus: 'pending_review') rather than failing the
// checkout outright. This endpoint is how that gets resolved: PayPal calls
// it when the capture's real outcome is known, and we update the order
// accordingly -- mark it paid and send the confirmation email, or roll back
// the stock/discount/credit reservation if the payment was ultimately
// declined.
//
// Requires a webhook subscription to be created in the PayPal developer
// dashboard (Sandbox or Live app -> Sandbox Webhooks / Webhooks section)
// pointing at this endpoint's public URL, subscribed to at least:
//   - PAYMENT.CAPTURE.COMPLETED
//   - PAYMENT.CAPTURE.DECLINED
// The Webhook ID PayPal generates for that subscription must be set as
// PAYPAL_WEBHOOK_ID (separate from PAYPAL_CLIENT_ID/SECRET). Note: PayPal's
// servers must be able to reach this URL, so a localhost dev server can only
// receive these via a tunnel (e.g. ngrok) -- pointing the sandbox webhook at
// the deployed Vercel URL is the simpler option for testing.
import admin from 'firebase-admin';
import { db } from './_lib/firebase-admin-helper.js';
import { verifyWebhookSignature } from './_lib/paypal-helper.js';
import { sendOrderConfirmation } from './_lib/brevo-helper.js';

async function findOrderByTransactionId(transactionId) {
    const snapshot = await db.collection('orders').where('transactionId', '==', transactionId).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0];
}

// Reverses the stock decrement / discount usage / store credit deduction
// that createOrderTransaction() applied optimistically when the order was
// first created as 'pending_review'. Best-effort: logs loudly so a human can
// double-check store credit/discount bookkeeping, which is the one part of
// this that isn't purely mechanical (e.g. another order could have used the
// same discount code in the meantime).
async function rollbackReservedOrder(orderDoc) {
    const order = orderDoc.data();

    await db.runTransaction(async (transaction) => {
        // Restore stock for standard (non-custom) items.
        const standardItems = (order.items || []).filter(item => !item.isCustom && item.productId);
        for (const item of standardItems) {
            const productRef = db.collection('products').doc(item.productId);
            transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(item.quantity) });
        }

        // Restore discount code usage, if one was applied.
        if (order.appliedDiscount?.type && ['percent', 'fixed', 'shipping'].includes(order.appliedDiscount.type) && order.appliedDiscount.id) {
            const discountRef = db.collection('discounts').doc(order.appliedDiscount.id);
            const customerEmailLower = (order.customerEmail || '').trim().toLowerCase();
            transaction.update(discountRef, {
                usageCount: admin.firestore.FieldValue.increment(-1),
                ...(customerEmailLower ? { usedByEmails: admin.firestore.FieldValue.arrayRemove(customerEmailLower) } : {})
            });
        }

        // Restore store credit, if one was applied.
        if (order.appliedDiscount?.type === 'store_credit' && order.appliedDiscount.id && order.discountApplied > 0) {
            const creditRef = db.collection('storeCredits').doc(order.appliedDiscount.id);
            transaction.update(creditRef, {
                remainingValue: admin.firestore.FieldValue.increment(order.discountApplied),
                isActive: true,
                usageHistory: admin.firestore.FieldValue.arrayUnion({
                    orderId: order.id,
                    amountUsed: -order.discountApplied,
                    date: new Date(),
                    note: 'Reversed -- PayPal payment ultimately declined after PENDING_REVIEW'
                })
            });
        }

        transaction.update(orderDoc.ref, {
            status: 'Cancelled',
            paymentStatus: 'failed',
            paymentFailureNote: 'PayPal capture was declined after initially being PENDING_REVIEW. Stock/discount/credit reservations have been reversed automatically -- verify store credit balance if one was used.'
        });
    });

    console.error(`Order ${order.id}: PayPal capture ultimately DECLINED after PENDING_REVIEW. Reservations rolled back automatically. Verify manually if a store credit or discount code was involved.`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const event = req.body;

    try {
        const isValid = await verifyWebhookSignature(req.headers, event);
        if (!isValid) {
            console.error('PayPal webhook signature verification FAILED -- ignoring event.', event?.id);
            return res.status(400).json({ error: 'Invalid webhook signature.' });
        }

        const eventType = event?.event_type;
        const captureId = event?.resource?.id;

        if (!captureId) {
            // Nothing we can act on (e.g. a subscription-type event we didn't
            // ask for) -- acknowledge so PayPal doesn't keep retrying it.
            return res.status(200).json({ received: true });
        }

        if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
            const orderDoc = await findOrderByTransactionId(captureId);
            if (!orderDoc) {
                console.error(`PayPal webhook: no order found for capture ${captureId} (PAYMENT.CAPTURE.COMPLETED).`);
                return res.status(200).json({ received: true });
            }
            const order = orderDoc.data();
            if (order.paymentStatus === 'pending_review') {
                await orderDoc.ref.update({ paymentStatus: 'paid' });
                try {
                    await sendOrderConfirmation({ ...order, paymentStatus: 'paid' });
                } catch (emailError) {
                    console.error(`Order ${order.id} confirmed via webhook, but confirmation email failed:`, emailError.message);
                }
            }
            return res.status(200).json({ received: true });
        }

        if (eventType === 'PAYMENT.CAPTURE.DECLINED' || eventType === 'PAYMENT.CAPTURE.DENIED') {
            const orderDoc = await findOrderByTransactionId(captureId);
            if (!orderDoc) {
                console.error(`PayPal webhook: no order found for capture ${captureId} (${eventType}).`);
                return res.status(200).json({ received: true });
            }
            if (orderDoc.data().paymentStatus === 'pending_review') {
                await rollbackReservedOrder(orderDoc);
            }
            return res.status(200).json({ received: true });
        }

        // Any other subscribed event type -- acknowledge, nothing to do.
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('PayPal webhook handler error:', error);
        // Still 200 here would suppress PayPal's retry; 500 lets PayPal retry
        // delivery, which is what we want for a transient failure on our end.
        return res.status(500).json({ error: error.message });
    }
}
