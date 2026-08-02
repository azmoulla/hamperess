// FILE: scripts/test-brevo.js
//
// Standalone connectivity/sanity check for the Brevo integration, since the
// dev sandbox this was written in has no network egress to api.brevo.com
// (proxy blocks it -- same limitation hit earlier with PayPal live tests).
// Run this locally, where you have real internet access:
//
//   node scripts/test-brevo.js                        -> read-only check: confirms BREVO_API_KEY
//                                                          is valid by fetching your account info.
//   node scripts/test-brevo.js send you@example.com   -> also sends one real
//                                                          test transactional email to that address.
import 'dotenv/config';
import Brevo from '@getbrevo/brevo';

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
    console.error('FAIL: BREVO_API_KEY is missing from .env.');
    process.exit(1);
}
console.log(`Found BREVO_API_KEY (length ${apiKey.length}, prefix "${apiKey.slice(0, 8)}...").`);

async function checkAccount() {
    const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': apiKey, 'Accept': 'application/json' }
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
        console.error(`FAIL: Brevo rejected the API key. HTTP ${res.status}:`, JSON.stringify(body, null, 2));
        process.exit(1);
    }

    console.log('PASS: API key is valid.');
    console.log(`  Account: ${body.email || '(unknown)'}`);
    console.log(`  Plan: ${JSON.stringify(body.plan) || '(unknown)'}`);
    return body;
}

async function sendTestEmail(toEmail) {
    // @getbrevo/brevo 2.0.0-beta.4 has no Brevo.ApiClient export -- auth is
    // set per-API-instance via setApiKey(), not a shared singleton.
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = 'Brevo test email — Luxury Hampers';
    sendSmtpEmail.sender = { name: 'Luxury Hampers', email: 'az.moulla@gmail.com' };
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.htmlContent = `<p>This is a one-off test send from <code>scripts/test-brevo.js</code>, sent at ${new Date().toISOString()}.</p>`;

    console.log(`Sending test email to ${toEmail}...`);
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('PASS: Brevo accepted the send request.');
    console.log('  Response:', JSON.stringify(data, null, 2));
    console.log('  Check the inbox (and spam folder) to confirm real delivery.');
}

(async () => {
    try {
        await checkAccount();

        const [, , mode, target] = process.argv;
        if (mode === 'send') {
            if (!target) {
                console.error('Usage: node scripts/test-brevo.js send you@example.com');
                process.exit(1);
            }
            await sendTestEmail(target);
        } else {
            console.log('\nAccount check only (no email sent). Run "node scripts/test-brevo.js send you@example.com" to send a real test email.');
        }
    } catch (error) {
        console.error('FAIL:', error.message || error);
        process.exit(1);
    }
})();
