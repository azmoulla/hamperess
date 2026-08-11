// FILE: api/site-settings.js
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

// --- DEFAULTS ---
const DEFAULT_SETTINGS = {
    tags_dietary: [],
    tags_occasion: [],
    tags_contents: [],
    freeDeliveryThreshold: 50.00,
    baseDeliveryCharge: 4.99,
    showLowStockIndicator: true,
    lowStockThreshold: 10,
    enableQuickView: true,
    baseCurrencySymbol: "£",
    // ADDED (2026-08-11): homepage hero banner, previously hardcoded as a
    // CSS background-image in public/input.css (assets/images/hero_main_banner.jpg).
    // Default here points at that same file so existing sites see no visual
    // change until an admin actually edits it in Site Settings. 'video' mode
    // is only honored on the public site if heroVideoUrl is non-empty --
    // see applyHeroBanner() in public/app.js.
    heroMediaType: "image",
    heroImageUrl: "assets/images/hero_main_banner.jpg",
    heroVideoUrl: "",
    // ADDED (2026-08-11): the "Unboxing Experience" promo card that gets
    // injected into the product grid every 10th item, previously fully
    // hardcoded in public/app.js's displayProducts() (unboxingHtml block)
    // -- including a w3schools sample video as a permanent placeholder.
    // Defaults here match exactly what was hardcoded before, so existing
    // sites see no change until an admin edits it. See applyHeroBanner-
    // style rendering inline in displayProducts().
    unboxingEnabled: true,
    unboxingMediaType: "video",
    unboxingImageUrl: "",
    unboxingVideoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    unboxingPosterUrl: "https://placehold.co/800x400/111/333?text=Experience",
    unboxingTag: "The Unboxing Experience",
    unboxingTitle: "Hand-Packed with Silk & Soul",
    unboxingDescription: "Every gift includes a hand-written card and our signature gold-foil seal."
};

export default async function handler(req, res) {
    const { type } = req.query; // 'menu', 'settings', or 'discovery'
    
    // 1. Determine the Firestore path based on the type
    let docPath = '';
    if (type === 'menu') docPath = 'siteContent/header_nav';
    else if (type === 'settings') docPath = 'settings/site_settings';
    else if (type === 'discovery') docPath = 'config/discovery_engine'; // <--- NEW PATH
    else return res.status(400).json({ error: 'Valid type (menu, settings, or discovery) is required.' });

    const docRef = db.doc(docPath);

    try {
        // ==========================================
        // GET REQUESTS (Public Access)
        // ==========================================
        if (req.method === 'GET') {
            const docSnap = await docRef.get();

            if (type === 'menu') {
                return res.status(200).json(docSnap.exists ? docSnap.data() : []);
            }

            if (type === 'discovery') { // <--- NEW GET HANDLER
                return res.status(200).json(docSnap.exists ? docSnap.data() : { contexts: [], virtual_tags: {} });
            }

            if (type === 'settings') {
                if (!docSnap.exists) {
                    return res.status(200).json(DEFAULT_SETTINGS);
                }
                // FIX (2026-08-09): this used to hand-pick a fixed list of
                // fields into `publicSettings` (tags_*, freeDeliveryThreshold,
                // baseDeliveryCharge, showLowStockIndicator, lowStockThreshold,
                // enableQuickView, baseCurrencySymbol) and silently dropped
                // everything else -- including `returnWindowInDays`,
                // `cookieConsentMessage`, `primaryColor`, `ctaColorGreen`,
                // `fontFamilyHeadings`, `fontFamilyBody`, `cartPersistenceDays`,
                // and `showNewsletterPopup`, all of which the admin settings
                // form (public/admin.js) both reads AND writes via this exact
                // endpoint. The POST handler below was never filtered (writes
                // the full payload with `{merge: true}`), so every save of
                // one of those dropped fields "worked" in Firestore but then
                // silently reappeared as its hardcoded fallback default the
                // next time the form loaded -- confirmed live: saved
                // `returnWindowInDays: 21`, the very next GET response had no
                // `returnWindowInDays` key at all. Same bug affected the
                // public customer site's own read of this doc
                // (fetchSiteSettings() in public/app.js), so the "Need to
                // return an item?" 28-day window was always using the
                // client's own hardcoded `?? 28` fallback, never whatever an
                // admin actually configured. Fixed by returning the full
                // merged doc (defaults spread first, then whatever's
                // genuinely saved overrides them) instead of a manually
                // maintained field list that had drifted out of sync with
                // the settings form over time.
                const data = docSnap.data();
                const publicSettings = { ...DEFAULT_SETTINGS, ...data };
                return res.status(200).json(publicSettings);
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

            // Save to Firestore
            await docRef.set(payload, { merge: true });
            
            return res.status(200).json({ success: true, message: `${type} updated successfully.` });
        }

        return res.status(405).json({ error: 'Method not allowed.' });

    } catch (error) {
        console.error(`Site Settings API Error (${type}):`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
