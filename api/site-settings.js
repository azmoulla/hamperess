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
    const { type } = req.query; // 'menu' or 'settings'
    
    // Determine the Firestore path based on the type
    const docPath = type === 'menu' ? 'siteContent/header_nav' : 'settings/site_settings';
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

            if (type === 'settings') {
                if (!docSnap.exists) {
                    return res.status(200).json(DEFAULT_SETTINGS);
                }
                const data = docSnap.data();
                const publicSettings = {
                    ...DEFAULT_SETTINGS, // Merge with defaults
                    tags_dietary: data.tags_dietary,
                    tags_occasion: data.tags_occasion,
                    tags_contents: data.tags_contents,
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

            // Simple validation
            if (type === 'menu' && !Array.isArray(payload)) {
                return res.status(400).json({ error: 'Menu must be an array.' });
            }

            // Save to Firestore
            await docRef.set(payload, { merge: true });
            
            return res.status(200).json({ success: true, message: `${type} updated successfully.` });
        }

        return res.status(400).json({ error: 'Invalid type parameter or method.' });

    } catch (error) {
        console.error(`Site Settings API Error (${type}):`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
