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