// FILE: api/_lib/brevo-helper.js (Corrected for Brevo SDK v3)
const Brevo = require('@getbrevo/brevo');

const SENDER_EMAIL = 'a.moulla@btinternet.com';
const SENDER_NAME = 'Luxury Hampers';

async function sendOrderConfirmation(order) {
    console.log(`[brevo-helper] Preparing to send email for order ${order.id}...`);
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('[brevo-helper] CRITICAL: BREVO_API_KEY is missing. Email cannot be sent.');
        return;
    }

    try {
        // --- THIS IS THE UPDATED PART FOR V3 ---
        // Initialize the API and set the authentication key directly on the instance.
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        // --- END OF UPDATE ---
        
        // Construct the email (this part remains the same)
        const sendSmtpEmail = new Brevo.SendSmtpEmail();

        sendSmtpEmail.subject = `Your Luxury Hampers Order Confirmation #${order.id}`;
        sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: order.customerEmail, name: order.customerName }];
        
        sendSmtpEmail.htmlContent = `
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
                <h3 style="margin-top: 20px; text-align: right;">Total: £${order.totalAmount.toFixed(2)}</h3>
            </div>`;

        console.log(`[brevo-helper] Sending API request to Brevo for ${order.customerEmail}...`);
        
        // Send the email
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[brevo-helper] SUCCESS: Brevo API responded with:`, data);

    } catch (error) {
        console.error('[brevo-helper] FATAL: Failed to send email via Brevo. Full error:', error);
    }
}


module.exports = { sendOrderConfirmation };
