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
    baseCurrencySymbol: "£"
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
                const data = docSnap.data();
                const publicSettings = {
                    ...DEFAULT_SETTINGS, 
                    tags_dietary: data.tags_dietary || [],
                    tags_occasion: data.tags_occasion || [],
                    tags_contents: data.tags_contents || [],
                    freeDeliveryThreshold: data.freeDeliveryThreshold,
                    baseDeliveryCharge: data.baseDeliveryCharge,
                    showLowStockIndicator: data.showLowStockIndicator,
                    lowStockThreshold: data.lowStockThreshold,
                    enableQuickView: data.enableQuickView,
                    baseCurrencySymbol: data.baseCurrencySymbol,
                };
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
