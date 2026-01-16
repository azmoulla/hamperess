// FILE: api/content-manager.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

// --- DEFAULTS ---
// These ensure your site works even if the database is empty.
// Extracted directly from your original 8 files.
const DEFAULTS = {
    faqs: [], //
    
    footer_info: { //
        companyInfo: { description: "Luxury Hampers", address: "London, UK" },
        quickLinks: [],
        legalLinks: []
    },
    
    contact_us: { //
        pageTitle: "Get in Touch",
        pageSubtitle: "We'd love to hear from you!",
        mapImagePath: "assets/images/map_placeholder.png",
        contactDetails: [],
        openingHours: { title: "Opening Hours", hours: [] }
    },
    
    about_us: { //
        pageTitle: "Our Story",
        sections: [{ title: "Our Mission", content: "Enter your content here..." }]
    },
    
    delivery_info: { //
        pageTitle: "Delivery Information",
        sections: [{ title: "Standard UK Delivery", content: "Enter details here...", iconName: "truckFast" }]
    },

    our_mission: { //
        pageTitle: "Our Mission",
        sections: [
            { title: "Our Mission", content: "Our mission is to elevate the art of gift-giving..." },
            { title: "Our Values", content: "• Quality\n• Curation\n• Presentation" }
        ]
    },

    privacy_policy: { //
        pageTitle: "Privacy Policy",
        sections: [
            { title: "1. Introduction", content: "Your privacy is important to us..." },
            { title: "2. Information We Collect", content: "We collect personal information..." }
        ]
    },

    terms_and_conditions: { //
        pageTitle: "Terms and Conditions",
        sections: [
            { title: "1. Introduction", content: "Welcome to LuxuryHampers..." },
            { title: "2. Intellectual Property", content: "Unless otherwise stated..." }
        ]
    }
};

export default async function handler(req, res) {
    const { page } = req.query; // e.g., 'about_us', 'faqs', 'contact_us'

    // Security: Whitelist allowed pages to prevent arbitrary DB access
    const ALLOWED_PAGES = Object.keys(DEFAULTS);
    if (!page || !ALLOWED_PAGES.includes(page)) {
        return res.status(400).json({ error: `Invalid or missing page parameter. Allowed: ${ALLOWED_PAGES.join(', ')}` });
    }

    const docPath = `siteContent/${page}`;
    const docRef = db.doc(docPath);

    try {
        // ==========================================
        // GET REQUESTS (Public Access)
        // ==========================================
        if (req.method === 'GET') {
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                // Special handling for legacy data structures
                if (page === 'delivery_info') {
                    const data = docSnap.data();
                    const sections = (Array.isArray(data.sections) ? data.sections : []).map(s => ({
                        title: s.title || '', content: s.content || '', iconName: s.iconName || ''
                    }));
                    return res.status(200).json({ pageTitle: data.pageTitle || "Delivery Info", sections });
                }
                return res.status(200).json(docSnap.data());
            } else {
                // Return the specific default object for this page
                return res.status(200).json(DEFAULTS[page]);
            }
        }

        // ==========================================
        // POST REQUESTS (Admin Only)
        // ==========================================
        if (req.method === 'POST') {
            if (!(await verifyAdmin(req))) {
                return res.status(403).json({ error: 'Forbidden: Admin access required.' });
            }

            const payload = req.body;

            // --- VALIDATION LOGIC ---
            if (page === 'faqs') {
                if (!Array.isArray(payload.faqs)) return res.status(400).json({ error: 'FAQs must be an array.' });
                // Wrap in object to match Firestore structure: { faqs: [...] }
                await docRef.set({ faqs: payload.faqs });
                return res.status(200).json({ success: true });
            }
            
            if (page === 'contact_us') {
                if (!payload.pageTitle || !Array.isArray(payload.contactDetails) || !payload.openingHours) {
                    return res.status(400).json({ error: 'Invalid Contact Us data structure.' });
                }
            }

            if (['about_us', 'delivery_info', 'our_mission', 'privacy_policy', 'terms_and_conditions'].includes(page)) {
                if (!payload.pageTitle || !Array.isArray(payload.sections)) {
                    return res.status(400).json({ error: 'Invalid data. Requires pageTitle and sections array.' });
                }
            }

            if (page === 'footer_info') {
                if (!payload.companyInfo || !payload.quickLinks) {
                    return res.status(400).json({ error: 'Invalid footer data.' });
                }
            }

            // Save to Firestore
            await docRef.set(payload, { merge: true });
            return res.status(200).json({ success: true, message: `${page} updated successfully.` });
        }

        return res.status(405).end();

    } catch (error) {
        console.error(`Content Manager Error (${page}):`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
