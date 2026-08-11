// FILE: api/_lib/brevo-helper.js
import Brevo from '@getbrevo/brevo';

const SENDER_EMAIL = 'az.moulla@gmail.com';
const SENDER_NAME = 'Luxury Hampers';

// Wraps inner email markup in a complete HTML document. Both emails
// previously sent a bare <div>...</div> fragment with no <!DOCTYPE html>,
// <html>, or <body>. Desktop Gmail tolerates that, but the Gmail mobile
// app doesn't -- it mis-parses where Brevo's server-side open-tracking
// pixel (<img ... style="display:none"/>, injected automatically before
// send) lands in a bodyless fragment, and the raw tag leaks out as visible
// text at the top of the email instead of staying invisible.
function wrapEmailHtml(innerHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Luxury Hampers</title>
</head>
<body style="margin:0; padding:0;">
${innerHtml}
</body>
</html>`;
}

export async function sendOrderConfirmation(order) { // Changed to export
    console.log(`[brevo-helper] Preparing to send email for order ${order.id}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }
    // ... rest of the function remains identical ...
    try {
        // NOTE (2026-08-02): @getbrevo/brevo 2.0.0-beta.4 has no
        // `Brevo.ApiClient` export at all (confirmed by inspecting the
        // package directly) -- the old `Brevo.ApiClient.instance...`
        // singleton pattern from the SDK's v1 docs silently threw
        // "Cannot read properties of undefined" and meant this function
        // has never actually sent an email. Auth is per-API-instance in
        // this version via setApiKey().
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        sendSmtpEmail.subject = `Your Luxury Hampers Order Confirmation #${order.id}`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: order.customerEmail, name: order.customerName }];
        
        sendSmtpEmail.htmlContent = wrapEmailHtml(`
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0a0a0a;">Thank You For Your Order!</h2>
                <p>Hi ${order.customerName},</p>
                <p>We've received your order #${order.id}. We will notify you once it has shipped.</p>
                <h3 style="margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Order Summary:</h3>
                <ul style="list-style: none; padding: 0;">
                    ${order.items.map(item => `
                        <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;">
                            ${item.title} (x${item.quantity}) - <strong>£${(item.price * item.quantity).toFixed(2)}</strong>
                        </li>`).join('')}
                </ul>
                <h3 style="margin-top: 20px; text-align: right;">Total: £${(order.totalAmount).toFixed(2)}</h3>
            </div>`);

        console.log(`[brevo-helper] Sending API request to Brevo for ${order.customerEmail}...`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send email via Brevo. Full error:', JSON.stringify(error, null, 2));
        throw new Error('Failed to send transactional email via Brevo.');
    }
}

// ADDED (2026-08-09): api/admin-orders.js's cancel action previously sent no
// email at all -- a customer whose self-service cancellation succeeded (or
// whose order was cancelled by an admin) had no confirmation it had actually
// happened, unlike shipping updates and order confirmations above. Mirrors
// their structure/sender exactly. `cancelledItems` is the list of {title,
// quantity} actually cancelled by this specific call (not the whole order,
// for a partial cancellation).
export async function sendCancellationEmail(order, cancelledItems, isFull) {
    console.log(`[brevo-helper] Preparing to send cancellation email for order ${order.id}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }

    try {
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        const itemsHtml = (cancelledItems || []).map(item => `
            <li style="margin-bottom: 6px;">${item.title}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</li>`).join('');

        sendSmtpEmail.subject = isFull
            ? `Your Luxury Hampers Order #${order.id} Has Been Cancelled`
            : `An Item Was Cancelled From Your Luxury Hampers Order #${order.id}`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: order.customerEmail, name: order.customerName }];

        sendSmtpEmail.htmlContent = wrapEmailHtml(`
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0a0a0a;">${isFull ? 'Your order has been cancelled' : 'An item has been cancelled from your order'}</h2>
                <p>Hi ${order.customerName},</p>
                <p>${isFull
                    ? `Order #${order.id} has been cancelled as requested.`
                    : `The following item(s) from order #${order.id} have been cancelled. The rest of your order remains unaffected.`}</p>
                <ul style="list-style: none; padding: 0;">${itemsHtml}</ul>
                <p>If any payment is owed back to you for this cancellation, our team will process that separately and be in touch if we need anything from you.</p>
            </div>`);

        console.log(`[brevo-helper] Sending cancellation email to Brevo for ${order.customerEmail}...`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send cancellation email via Brevo. Full error:', JSON.stringify(error, null, 2));
        throw new Error('Failed to send cancellation email via Brevo.');
    }
}

// ADDED (2026-08-09): none of the three refund paths (cancellation
// auto-refund, admin "Process Refund", returns "Refund via PayPal") ever
// told the customer their refund had actually completed -- the
// cancellation email above only says a refund "will be processed
// separately", with no follow-up once it happens. Fired after a real
// PayPal refund succeeds, from all three call sites, wrapped in try/catch
// at each call site so a Brevo hiccup never turns an already-successful
// refund into a failed request.
export async function sendRefundConfirmationEmail(order, amount) {
    console.log(`[brevo-helper] Preparing to send refund confirmation for order ${order.id}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }

    try {
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        sendSmtpEmail.subject = `Your Refund of £${amount.toFixed(2)} Has Been Processed -- Order #${order.id}`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: order.customerEmail, name: order.customerName }];

        sendSmtpEmail.htmlContent = wrapEmailHtml(`
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0a0a0a;">Your refund has been processed</h2>
                <p>Hi ${order.customerName},</p>
                <p>We've issued a refund of <strong>£${amount.toFixed(2)}</strong> for order #${order.id}.</p>
                <p>It should appear back on your original payment method within a few business days, depending on your bank or card provider.</p>
            </div>`);

        console.log(`[brevo-helper] Sending refund confirmation to Brevo for ${order.customerEmail}...`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send refund confirmation via Brevo. Full error:', JSON.stringify(error, null, 2));
        throw new Error('Failed to send refund confirmation email via Brevo.');
    }
}

// ADDED (2026-08-10): closes the "Sign up with Google" email gap --
// social signups (Google/Facebook via _socialLogin() in public/auth.js)
// never sent any email at all, unlike email/password signups which get a
// Firebase verification email. A verification email isn't appropriate
// here (Google/Facebook already verify the address), but customers still
// got zero confirmation their account was created. Fired once, only for
// genuinely first-time social sign-ins -- see the `welcomeEmailSent` guard
// in api/user-profile.js's `type=welcome-email` action.
export async function sendWelcomeEmail(customerName, customerEmail) {
    console.log(`[brevo-helper] Preparing to send welcome email to ${customerEmail}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }

    try {
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        sendSmtpEmail.subject = `Welcome to Luxury Hampers!`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: customerEmail, name: customerName }];

        sendSmtpEmail.htmlContent = wrapEmailHtml(`
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0a0a0a;">Welcome, ${customerName}!</h2>
                <p>Your account is ready to go. We're glad you're here.</p>
                <p>Browse our collections and let us know if there's ever anything we can help with.</p>
            </div>`);

        console.log(`[brevo-helper] Sending welcome email to Brevo for ${customerEmail}...`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send welcome email via Brevo. Full error:', JSON.stringify(error, null, 2));
        throw new Error('Failed to send welcome email via Brevo.');
    }
}

export async function sendShippingUpdate(order) {
    console.log(`[brevo-helper] Preparing to send shipping update for order ${order.id}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }

    try {
        // See note in sendOrderConfirmation() above -- Brevo.ApiClient
        // doesn't exist in this SDK version, auth is per-instance.
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        const trackingHtml = order.trackingNumber
            ? `<p>Tracking number: <strong>${order.trackingNumber}</strong>${order.courier ? ` (${order.courier})` : ''}</p>
               ${order.courierUrl ? `<p><a href="${order.courierUrl}${order.trackingNumber}" style="color:#0a0a0a;">Track your parcel</a></p>` : ''}`
            : '';

        sendSmtpEmail.subject = `Your Luxury Hampers Order #${order.id} Has Shipped`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: order.customerEmail, name: order.customerName }];

        sendSmtpEmail.htmlContent = wrapEmailHtml(`
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0a0a0a;">Your Order Is On Its Way!</h2>
                <p>Hi ${order.customerName},</p>
                <p>Good news -- order #${order.id} has shipped.</p>
                ${trackingHtml}
            </div>`);

        console.log(`[brevo-helper] Sending shipping update to Brevo for ${order.customerEmail}...`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send shipping update via Brevo. Full error:', JSON.stringify(error, null, 2));
        throw new Error('Failed to send shipping update email via Brevo.');
    }
}