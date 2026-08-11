// FILE: api/newsletter.js
// Persists newsletter sign-ups. Previously both newsletter forms in public/app.js
// were fake demo code that discarded the entered email entirely.
import { db } from './_lib/firebase-admin-helper.js';
import admin from 'firebase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { email, source } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }

    try {
        // Use the email itself as the doc ID so resubscribing is a no-op
        // rather than creating duplicate rows.
        const docId = encodeURIComponent(cleanEmail);
        const ref = db.collection('newsletterSubscribers').doc(docId);
        const existing = await ref.get();

        if (existing.exists) {
            return res.status(200).json({ success: true, message: 'Already subscribed.' });
        }

        await ref.set({
            email: cleanEmail,
            source: source || 'unknown',
            subscribedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, message: 'Subscribed.' });
    } catch (error) {
        console.error('newsletter subscribe Error:', error);
        return res.status(500).json({ error: 'Failed to subscribe.' });
    }
}
