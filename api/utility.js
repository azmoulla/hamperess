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
import { buildSitemapXml, renderSeoPage } from './_lib/seo-helper.js';

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

// SEO (2026-08-11): dynamic sitemap.xml, listing every static page, product,
// and category page for search engines. See api/_lib/seo-helper.js for the
// generation logic and vercel.json for the /sitemap.xml -> ?fn=sitemap rewrite.
async function handleSitemap(req, res) {
    try {
        const xml = await buildSitemapXml(req);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        // Cache at the edge for an hour -- the catalog/menu don't change
        // often enough to justify regenerating this on every crawl hit.
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
        return res.status(200).send(xml);
    } catch (error) {
        console.error('Sitemap generation error:', error);
        return res.status(500).send('Failed to generate sitemap.');
    }
}

// SEO (2026-08-11): server-side prerendering for crawlable HTML. This site
// is a client-rendered SPA -- every route serves the same static
// <title>Luxury Hampers</title> shell with no content until app.js runs, so
// non-JS crawlers (Bing, most social-share unfurl bots) and Google's
// render-budget-limited pass saw a near-blank page for every URL. This
// handler fetches the real per-page data (product, category, static
// content) server-side and injects a correct title/meta description/
// canonical/Open Graph/Twitter Card/JSON-LD block plus a genuine content
// snapshot into the page before it's served.
//
// Routing Middleware (middleware.js, project root) only routes requests here
// when the User-Agent matches a known bot/crawler pattern -- real visitors
// keep getting the plain static index.html directly, so there's no added
// latency/Firestore-read cost on normal human traffic. (This used to be a
// vercel.json `has` header-condition rewrite; switched to middleware.js
// 2026-08-12 because `has` conditions can't be tested in local `vercel dev`
// -- middleware can.) If that User-Agent match is ever wrong or unsupported
// in some environment, this handler still degrades gracefully: it just
// prerenders for everyone who reaches it, which is slower but not broken.
async function handleRender(req, res) {
    try {
        const path = req.query.p || '/';
        const html = await renderSeoPage(req, Array.isArray(path) ? path[0] : path);

        if (html) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1800');
            return res.status(200).send(html);
        }

        // Not an SEO-relevant route (or product/page not found) -- fall back
        // to the plain static shell exactly as if this rewrite didn't exist.
        const fallback = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/index.html`);
        const fallbackHtml = await fallback.text();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(fallback.status).send(fallbackHtml);
    } catch (error) {
        console.error('SSR render error:', error);
        // Never hard-fail a page load over a prerendering bug -- fall back
        // to the plain static shell so the site stays up either way.
        try {
            const fallback = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/index.html`);
            const fallbackHtml = await fallback.text();
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(fallbackHtml);
        } catch {
            return res.status(500).send('Internal Server Error');
        }
    }
}

export default async function handler(req, res) {
    const { fn } = req.query;

    switch (fn) {
        case 'newsletter':
            return handleNewsletter(req, res);
        case 'address-proxy':
            return handleAddressProxy(req, res);
        case 'sitemap':
            return handleSitemap(req, res);
        case 'render':
            return handleRender(req, res);
        default:
            return res.status(404).json({ error: 'Unknown utility function.' });
    }
}
