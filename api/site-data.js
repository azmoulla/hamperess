import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

// --- DEFAULTS FROM SITE-SETTINGS ---
const DEFAULT_SITE_SETTINGS = {
    tags_dietary: [], tags_occasion: [], tags_contents: [],
    freeDeliveryThreshold: 50.00, baseDeliveryCharge: 4.99,
    showLowStockIndicator: true, lowStockThreshold: 10,
    enableQuickView: true, baseCurrencySymbol: "£"
};

// --- DEFAULTS FROM CONTENT-MANAGER ---
const CONTENT_DEFAULTS = {
    faqs: [],
    footer_info: { companyInfo: { description: "Luxury Hampers", address: "London, UK" }, quickLinks: [], legalLinks: [] },
    contact_us: { pageTitle: "Get in Touch", pageSubtitle: "We'd love to hear from you!", mapImagePath: "assets/images/map_placeholder.png", contactDetails: [], openingHours: { title: "Opening Hours", hours: [] } },
    about_us: { pageTitle: "Our Story", sections: [{ title: "Our Mission", content: "Enter your content here..." }] },
    delivery_info: { pageTitle: "Delivery Information", sections: [{ title: "Standard UK Delivery", content: "Enter details here...", iconName: "truckFast" }] },
    our_mission: { pageTitle: "Our Mission", sections: [{ title: "Our Mission", content: "..." }, { title: "Our Values", content: "..." }] },
    privacy_policy: { pageTitle: "Privacy Policy", sections: [{ title: "1. Introduction", content: "..." }] },
    terms_and_conditions: { pageTitle: "Terms and Conditions", sections: [{ title: "1. Introduction", content: "..." }] }
};

export default async function handler(req, res) {
    const { action, type, page } = req.query; 

    try {
        // ================================================================
        // 1. SITE SETTINGS & MENU LOGIC (Formerly site-settings.js)
        // ================================================================
        if (action === 'settings') {
            const docPath = type === 'menu' ? 'siteContent/header_nav' : 'settings/site_settings';
            const docRef = db.doc(docPath);

            if (req.method === 'GET') {
                const docSnap = await docRef.get();
                if (type === 'menu') return res.status(200).json(docSnap.exists ? docSnap.data() : []);
                
                const data = docSnap.exists ? docSnap.data() : {};
                return res.status(200).json({ ...DEFAULT_SITE_SETTINGS, ...data });
            }

            if (req.method === 'POST') {
                if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Admin required' });
                await docRef.set(req.body, { merge: true });
                return res.status(200).json({ success: true });
            }
        }

        // ================================================================
        // 2. CONTENT MANAGER LOGIC (Formerly content-manager.js)
        // ================================================================
        if (action === 'content') {
            const ALLOWED_PAGES = Object.keys(CONTENT_DEFAULTS);
            if (!page || !ALLOWED_PAGES.includes(page)) return res.status(400).json({ error: 'Invalid page' });

            const docRef = db.doc(`siteContent/${page}`);

            if (req.method === 'GET') {
                const docSnap = await docRef.get();
                if (!docSnap.exists) return res.status(200).json(CONTENT_DEFAULTS[page]);
                
                // Legacy delivery_info check
                if (page === 'delivery_info') {
                    const data = docSnap.data();
                    const sections = (Array.isArray(data.sections) ? data.sections : []).map(s => ({
                        title: s.title || '', content: s.content || '', iconName: s.iconName || ''
                    }));
                    return res.status(200).json({ pageTitle: data.pageTitle || "Delivery Info", sections });
                }
                return res.status(200).json(docSnap.data());
            }

            if (req.method === 'POST') {
                if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Admin required' });
                // Validation (faqs, contact_us, etc.)
                if (page === 'faqs' && !Array.isArray(req.body.faqs)) return res.status(400).json({ error: 'Invalid FAQs' });
                
                await docRef.set(req.body, { merge: true });
                return res.status(200).json({ success: true });
            }
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error("Consolidated API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
