// FILE: api/_lib/paypal-helper.js
//
// Thin wrapper around PayPal's REST API (Orders v2 + OAuth2), used by
// api/paypal.js. Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET env
// vars (server-side only -- never expose the secret to the client). Set
// PAYPAL_MODE=live to switch from the sandbox API to the real one; any
// other value (or unset) defaults to sandbox for safety.

function getBaseUrl() {
    return process.env.PAYPAL_MODE === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('PayPal is not configured (missing PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET).');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`PayPal auth failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Creates a PayPal order for the given amount. Returns the PayPal order id
 * to hand back to the client so it can render/approve the Smart Button.
 * @param {number} amount - total in GBP, e.g. 12.99
 * @param {string} referenceId - our own order reference (not yet a real order id at this point -- just for PayPal's records)
 * @param {Object} [shippingAddress] - the delivery address already collected
 *   and validated on our own checkout page (fullName, addressLine1,
 *   addressLine2?, city, postcode). When present, this is handed to PayPal
 *   with shipping_preference: SET_PROVIDED_ADDRESS -- see comment below.
 */
export async function createPayPalOrder(amount, referenceId, shippingAddress) {
    const accessToken = await getAccessToken();

    const purchaseUnit = {
        reference_id: referenceId,
        amount: {
            currency_code: 'GBP',
            value: amount.toFixed(2)
        }
    };
    const body = { intent: 'CAPTURE', purchase_units: [purchaseUnit] };

    // ADDED (2026-08-12): without this, PayPal falls back to its own default
    // shipping_preference (GET_FROM_FILE), which shows the buyer an address
    // selection/entry step INSIDE the PayPal popup -- even though we already
    // collected and validated a delivery address on our own checkout page
    // moments earlier. This is what caused customers to effectively enter
    // their address twice. SET_PROVIDED_ADDRESS locks PayPal to exactly the
    // address we already have (shown read-only, not editable there), which
    // removes the redundant step entirely. UK-only site (no country field
    // collected anywhere) -- country_code is always GB.
    if (shippingAddress && shippingAddress.addressLine1 && shippingAddress.postcode) {
        purchaseUnit.shipping = {
            name: { full_name: shippingAddress.fullName || '' },
            address: {
                address_line_1: shippingAddress.addressLine1,
                address_line_2: shippingAddress.addressLine2 || undefined,
                admin_area_2: shippingAddress.city || '',
                postal_code: shippingAddress.postcode,
                country_code: 'GB'
            }
        };
        body.application_context = { shipping_preference: 'SET_PROVIDED_ADDRESS' };
    }

    const response = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        // NEW (2026-08-01): PayPal's error responses carry the real reason in
        // `details` (e.g. issue: "COMPLIANCE_VIOLATION") and a `debug_id` you
        // can hand to PayPal support -- both of these were previously
        // dropped, leaving only the generic top-level `message`. Log the
        // full body server-side and fold the detail into the thrown error so
        // it's visible without needing to catch it live in the browser.
        console.error('PayPal create-order failed. Full response:', JSON.stringify(data, null, 2));
        const detail = data.details?.map(d => `${d.issue}${d.description ? ': ' + d.description : ''}`).join('; ');
        throw new Error(`PayPal create order failed: ${detail || data.message || response.status}${data.debug_id ? ` (debug_id: ${data.debug_id})` : ''}`);
    }
    return data; // { id, status, links, ... }
}

/**
 * Captures a previously-created PayPal order (i.e. actually takes the
 * payment, after the buyer approved it in the PayPal popup). Returns the
 * full capture response so the caller can verify status === 'COMPLETED'
 * and cross-check the captured amount before writing a real order.
 */
export async function capturePayPalOrder(paypalOrderId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${getBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();
    if (!response.ok) {
        // Same reasoning as createPayPalOrder() above -- surface the real
        // `details`/`debug_id` instead of just the generic message.
        console.error('PayPal capture failed. Full response:', JSON.stringify(data, null, 2));
        const detail = data.details?.map(d => `${d.issue}${d.description ? ': ' + d.description : ''}`).join('; ');
        throw new Error(`PayPal capture failed: ${detail || data.message || response.status}${data.debug_id ? ` (debug_id: ${data.debug_id})` : ''}`);
    }
    // A 200/201 HTTP response doesn't guarantee the capture itself
    // succeeded -- a DECLINED capture still comes back with response.ok
    // true, but purchase_units[0].payments.captures[0].status will be
    // something other than COMPLETED, and processor_response carries the
    // actual decline reason (response_code, avs_code, cvv_code). Log it so
    // the terminal shows *why* a card was declined, not just that it was.
    const captureStatus = data?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (captureStatus && captureStatus !== 'COMPLETED') {
        const processorResponse = data.purchase_units[0].payments.captures[0].processor_response;
        console.error(`PayPal capture returned status "${captureStatus}" (not completed). processor_response:`, JSON.stringify(processorResponse, null, 2));
    }
    return data; // { id, status, purchase_units: [{ payments: { captures: [{ id, status, amount }] } }], ... }
}

/**
 * Refunds (fully or partially) a previously-captured PayPal payment. Used by
 * order cancellations and return refunds (2026-08-09) -- both call this with
 * the order's stored `transactionId` (the capture id PayPal returned back in
 * capturePayPalOrder()) and an amount that must be <= the original capture
 * amount. PayPal supports multiple partial refunds against the same capture
 * as long as the running total doesn't exceed what was captured, so this is
 * safe to call more than once for the same order (e.g. two separate partial
 * cancellations).
 * @param {string} captureId - PayPal capture id, i.e. order.transactionId
 * @param {number} amount - GBP amount to refund, e.g. 12.99
 */
export async function refundPayPalCapture(captureId, amount) {
    if (process.env.PAYPAL_MOCK === 'true') {
        console.log(`PAYPAL_MOCK is active: Simulating refund of £${amount.toFixed(2)} against capture ${captureId}`);
        return { id: `MOCK-REFUND-${Date.now()}`, status: 'COMPLETED' };
    }

    const accessToken = await getAccessToken();
    const response = await fetch(`${getBaseUrl()}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: { value: amount.toFixed(2), currency_code: 'GBP' }
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('PayPal refund failed. Full response:', JSON.stringify(data, null, 2));
        const detail = data.details?.map(d => `${d.issue}${d.description ? ': ' + d.description : ''}`).join('; ');
        throw new Error(`PayPal refund failed: ${detail || data.message || response.status}${data.debug_id ? ` (debug_id: ${data.debug_id})` : ''}`);
    }
    return data; // { id, status, amount, ... }
}

/**
 * Verifies that a webhook POST actually came from PayPal (not spoofed) using
 * PayPal's own /v1/notifications/verify-webhook-signature endpoint -- this is
 * PayPal's documented approach rather than manual crypto verification.
 * Requires PAYPAL_WEBHOOK_ID (the ID of the webhook subscription created in
 * the developer dashboard, NOT the client id/secret) to be set.
 *
 * @param {Object} headers - the incoming request's headers (lowercase keys, as Node/Vercel provides)
 * @param {Object} webhookEventBody - the parsed JSON body of the webhook POST
 * @returns {Promise<boolean>} true only if PayPal confirms the signature is valid
 */
export async function verifyWebhookSignature(headers, webhookEventBody) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.error('PayPal webhook verification skipped: PAYPAL_WEBHOOK_ID is not configured.');
        return false;
    }

    const accessToken = await getAccessToken();
    const response = await fetch(`${getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: webhookId,
            webhook_event: webhookEventBody
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error('PayPal webhook verification request failed:', response.status, errBody);
        return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
}
