// FILE: /api/_lib/email-helper.js (Final Production Version)

export async function sendVoucherEmail({ email, name, code, value }) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error("Brevo API key is not configured.");
        return; // Silently fail if key is missing, don't crash the app
    }

    const emailData = {
        sender: {
            name: "Luxury Hampers",
            email: "noreply@your-confirmed-domain.com" // IMPORTANT: Replace with your confirmed Brevo sender email
        },
        to: [{ email, name }],
        subject: `Your Store Credit from Luxury Hampers: ${code}`,
        htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto; }
                    .header { font-size: 24px; font-weight: bold; color: #1e3a8a; }
                    .code { font-size: 20px; font-weight: bold; color: #1d4ed8; background-color: #eff6ff; padding: 10px; border-radius: 4px; text-align: center; }
                    .footer { font-size: 12px; color: #888; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <p class="header">Here is your Store Credit!</p>
                    <p>Hello ${name},</p>
                    <p>As requested, here is your store credit voucher. You can use the code below at checkout on any future purchase.</p>
                    <p class="code">${code}</p>
                    <p><strong>Value:</strong> £${Number(value).toFixed(2)}</p>
                    <p>Thank you for shopping with us!</p>
                    <p><em>- The Luxury Hampers Team</em></p>
                </div>
                <p class="footer">This is an automated message. Please do not reply to this email.</p>
            </body>
            </html>
        `
    };

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            // Log the error on the server, but don't crash the main process
            console.error(`Brevo API Error: ${errorBody.message || JSON.stringify(errorBody)}`);
        } else {
            console.log(`Brevo accepted the email request for ${email}.`);
        }
    } catch (error) {
        // Log any network-level errors
        console.error('Error in sendVoucherEmail helper:', error);
    }
}