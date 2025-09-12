// FILE: helpers/brevo-helper.js (Final, Robust Version)
import SibApiV3Sdk from '@sendinblue/client';

console.log('[API DIAGNOSTIC] brevo-helper.js module has been loaded.');

// This is the verified sender email you configured in Brevo
const SENDER_EMAIL = 'Az.moulla@gmail.com'; 
const SENDER_NAME = 'Luxury Hampers';

/**
 * Sends an order confirmation email using Brevo. This function is now self-contained
 * and will only fail when called, not when the module is loaded.
 * @param {object} order - The complete order object.
 */
export async function sendOrderConfirmation(order) {
    // Check for the API key at the moment the function is called.
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        // Log a critical error to the server logs, but DO NOT crash the server.
        console.error('[API ERROR] CRITICAL: The BREVO_API_KEY environment variable is missing. Email cannot be sent.');
        // Return early to prevent a crash from the API client.
        return;
    }

    try {
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        const apiKeyAuth = apiInstance.authentications['apiKey'];
        apiKeyAuth.apiKey = brevoApiKey;
        
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

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

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Order confirmation email sent successfully to ${order.customerEmail} via Brevo.`);
    } catch (error) {
        // Log the detailed error from Brevo for better debugging but do not re-throw.
        console.error('CRITICAL: Error sending Brevo email:', JSON.stringify(error, null, 2));
    }
}