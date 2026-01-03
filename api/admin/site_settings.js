import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

const DOC_PATH = 'siteContent/settings'; 

export default async function handler(req, res) {
    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        // --- THIS IS NOW PUBLIC ---
        // Anyone (like app.js) can read the settings.
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                res.status(200).json(docSnap.data());
            } else {
                // Return comprehensive default structure
                res.status(200).json({ 
                    pageTitle: "Site Formatting & Theme",
                    primaryColor: "#2c3e50",
                    ctaColorGreen: "#047857",
                    fontFamilyHeadings: "'Lora', serif",
                    fontFamilyBody: "'Inter', sans-serif",
                    showLowStockIndicator: true, 
                    lowStockThreshold: 10,
                    freeDeliveryThreshold: 50.00,
                    baseDeliveryCharge: 4.99,
                    returnWindowInDays: 28, 
                    enableQuickView: true,
                    showNewsletterPopup: false,
                    cartPersistenceDays: 30, 
                    baseCurrencySymbol: "£",
                    cookieConsentMessage: "We use cookies to ensure you get the best experience. By continuing, you agree to our policy.",
                });
            }
        } catch (error) {
            console.error("[API GET /admin/site_settings] Error fetching settings:", error);
            res.status(500).json({ error: 'Failed to fetch site settings.' });
        }

    } else if (req.method === 'POST') {
        // --- THIS IS STILL ADMIN-PROTECTED ---
        // Only an admin can save changes.
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        
        try {
            const payload = req.body;
            
            // Validation
            if (!payload.primaryColor || !payload.ctaColorGreen || 
                typeof payload.returnWindowInDays !== 'number' || 
                typeof payload.lowStockThreshold !== 'number') {
               return res.status(400).json({ error: 'Core colors, Return Days, and Stock Threshold are required and must be valid types.' }); 
            }
            
            await docRef.set(payload, { merge: true });

            res.status(200).json({ success: true, message: 'Site settings updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/site_settings] Error saving settings:", error);
            res.status(500).json({ error: 'Failed to save site settings.' });
        }

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}