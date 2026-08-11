// FILE: api/utility.js
// Consolidates two small, low-traffic endpoints (newsletter signup, address
// lookup proxy) into a single serverless function. This keeps the project
// under Vercel's Hobby-plan limit of 12 Serverless Functions per deployment
// (the project hit 13 once these were separate files and deploys started
// failing with "No more than 12 Serverless Functions...").
//
// Public URLs are unchanged for the frontend — vercel.json rewrites
// /api/newsletter and /api/address-proxy to /api/utility?fn=... under the
// hood, so public/app.js needed no changes.
import { db } from './_lib/firebase-admin-helper.js';
import admin from 'firebase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleNewsletter(req, res) {
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

async function handleAddressProxy(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).setHeader('Allow', 'GET').end('Method Not Allowed');
    }

    const { term, id } = req.query;
    const apiKey = process.env.GETADDRESS_API_KEY;

    // Safety Check: Ensure API key exists in Vercel Environment Variables
    if (!apiKey) {
        console.error("Address Proxy Error: GETADDRESS_API_KEY is missing.");
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        // ==========================================
        // CASE A: Autocomplete (Search by Term)
        // ==========================================
        if (term) {
            const apiUrl = `https://api.getAddress.io/autocomplete/${encodeURIComponent(term)}?api-key=${apiKey}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || `API Error: ${response.statusText}` });
            }
            // Return just the suggestions array, matching original logic
            return res.status(200).json(data.suggestions);
        }

        // ==========================================
        // CASE B: Get Details (Fetch by ID)
        // ==========================================
        if (id) {
            const apiUrl = `https://api.getAddress.io/get/${id}?api-key=${apiKey}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || `API Error: ${response.statusText}` });
            }
            // Return the full address object
            return res.status(200).json(data);
        }

        // ==========================================
        // Fallback: Missing Parameters
        // ==========================================
        return res.status(400).json({ error: 'Missing required parameters: Provide "term" for search or "id" for details.' });

    } catch (error) {
        console.error('Address Proxy API Error:', error);
        return res.status(500).json({ error: 'Failed to communicate with address service.' });
    }
}

export default async function handler(req, res) {
    const { fn } = req.query;

    switch (fn) {
        case 'newsletter':
            return handleNewsletter(req, res);
        case 'address-proxy':
            return handleAddressProxy(req, res);
        default:
            return res.status(404).json({ error: 'Unknown utility function.' });
    }
}
