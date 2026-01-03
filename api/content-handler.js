// FILE: api/content-handler.js
// COMBINES: site_settings, about_us, contact_us, delivery_info, faqs, footer_info, 
// our_mission, pages, privacy_policy, terms_and_conditions, testimonials

import admin from 'firebase-admin';
import { promises as fs } from 'fs';
import path from 'path';

// --- 1. FIREBASE INITIALIZATION ---
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// --- 2. HELPER FUNCTIONS ---
async function getVerifiedUid(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) { return null; }
}

async function verifyAdmin(req) {
    const uid = await getVerifiedUid(req);
    return !!uid;
}

// --- 3. MAIN ROUTER ---
export default async function handler(req, res) {
    const { action } = req.query;

    try {
        switch (action) {
            case 'site_settings': return await handleSiteSettings(req, res);
            case 'about_us': return await handleAboutUs(req, res);
            case 'contact_us': return await handleContactUs(req, res);
            case 'delivery_info': return await handleDeliveryInfo(req, res);
            case 'faqs': return await handleFaqs(req, res);
            case 'footer_info': return await handleFooterInfo(req, res);
            case 'our_mission': return await handleOurMission(req, res);
            case 'pages': return await handlePages(req, res);
            case 'privacy_policy': return await handlePrivacyPolicy(req, res);
            case 'terms_and_conditions': return await handleTerms(req, res);
            case 'testimonials': return await handleTestimonials(req, res);
            default: return res.status(400).json({ error: 'Invalid content action requested' });
        }
    } catch (error) {
        console.error(`Content API Error (${action}):`, error);
        return res.status(500).json({ error: error.message });
    }
}

// --- 4. INDIVIDUAL CONTENT HANDLERS ---

async function handleSiteSettings(req, res) {
    const docRef = db.doc('siteContent/settings');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ 
            pageTitle: "Site Formatting & Theme", primaryColor: "#2c3e50", ctaColorGreen: "#047857",
            fontFamilyHeadings: "'Lora', serif", fontFamilyBody: "'Inter', sans-serif",
            showLowStockIndicator: true, lowStockThreshold: 10, freeDeliveryThreshold: 50.00,
            baseDeliveryCharge: 4.99, returnWindowInDays: 28, enableQuickView: true,
            baseCurrencySymbol: "£"
        });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handleAboutUs(req, res) {
    const docRef = db.doc('siteContent/about_us');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Our Story", sections: [] });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handleContactUs(req, res) {
    const docRef = db.doc('siteContent/contact_us');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Get in Touch", contactDetails: [], openingHours: { hours: [] } });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handleDeliveryInfo(req, res) {
    const docRef = db.doc('siteContent/delivery_info');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Delivery Information", sections: [] });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(204).end();
    }
}

async function handleFaqs(req, res) {
    const docRef = db.doc('siteContent/faqs');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        return res.status(200).json(docSnap.exists ? (docSnap.data().faqs || []) : []);
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set({ faqs: req.body.faqs });
        return res.status(200).json({ success: true });
    }
}

async function handleFooterInfo(req, res) {
    const docRef = db.doc('siteContent/footer_info');
    const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'footer_info.json');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        try {
            const fileContent = await fs.readFile(FILE_PATH, 'utf8');
            return res.status(200).json(JSON.parse(fileContent));
        } catch (e) { return res.status(500).json({ error: 'Failed to load footer.' }); }
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body);
        return res.status(200).json({ success: true });
    }
}

async function handleOurMission(req, res) {
    const docRef = db.doc('siteContent/our_mission');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Our Mission", sections: [] });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handlePages(req, res) {
    const COLLECTION_NAME = 'pages';
    const { slug } = req.query;

    if (req.method === 'GET') {
        if (slug) {
            const docRef = db.collection(COLLECTION_NAME).doc(slug);
            const docSnap = await docRef.get();
            if (!docSnap.exists) return res.status(404).json({ error: 'Page not found.' });
            return res.status(200).json({ id: docSnap.id, ...docSnap.data() });
        } else {
            const snapshot = await db.collection(COLLECTION_NAME).orderBy('title').get();
            const pages = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title, slug: doc.data().slug }));
            return res.status(200).json(pages);
        }
    }

    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'POST') {
        const { title, slug: newSlug, sections } = req.body;
        await db.collection(COLLECTION_NAME).doc(newSlug).set({ title, slug: newSlug, sections });
        return res.status(201).json({ success: true, id: newSlug });
    }
    if (req.method === 'PUT') {
        const { title, sections } = req.body;
        await db.collection(COLLECTION_NAME).doc(slug).update({ title, sections });
        return res.status(200).json({ success: true });
    }
    if (req.method === 'DELETE') {
        await db.collection(COLLECTION_NAME).doc(slug).delete();
        return res.status(200).json({ success: true });
    }
}

async function handlePrivacyPolicy(req, res) {
    const docRef = db.doc('siteContent/privacy_policy');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Privacy Policy", sections: [] });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handleTerms(req, res) {
    const docRef = db.doc('siteContent/terms_and_conditions');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data());
        return res.status(200).json({ pageTitle: "Terms & Conditions", sections: [] });
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set(req.body, { merge: true });
        return res.status(200).json({ success: true });
    }
}

async function handleTestimonials(req, res) {
    const docRef = db.doc('siteContent/testimonials');
    const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'testimonials.json');
    if (req.method === 'GET') {
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json(docSnap.data().items || []);
        try {
            const fileContent = await fs.readFile(FILE_PATH, 'utf8');
            return res.status(200).json(JSON.parse(fileContent));
        } catch (e) { return res.status(500).json({ error: 'Failed to load testimonials.' }); }
    }
    if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });
        await docRef.set({ items: req.body.items });
        return res.status(200).json({ success: true });
    }
}
