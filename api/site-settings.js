const admin = require('firebase-admin');

// Initialize Firebase Admin if it hasn't been initialized yet
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
}

const db = admin.firestore();

module.exports = async (req, res) => {
    try {
        // 1. Fetch the settings document
        const settingsDoc = await db.collection('settings').doc('site_settings').get();

        if (!settingsDoc.exists) {
            // If no settings exist yet, return empty arrays so the frontend doesn't crash
            return res.status(200).json({
                tags_dietary: [],
                tags_occasion: [],
                tags_contents: []
            });
        }

        const data = settingsDoc.data();

        // 2. Return ONLY the data needed for the public shop
        // We filter this to avoid sending sensitive admin settings if you have any.
        const publicSettings = {
            tags_dietary: data.tags_dietary || [],
            tags_occasion: data.tags_occasion || [],
            tags_contents: data.tags_contents || [],
            // You can add other public settings here if needed (e.g. freeDeliveryThreshold)
            freeDeliveryThreshold: data.freeDeliveryThreshold,
            baseDeliveryCharge: data.baseDeliveryCharge,
            showLowStockIndicator: data.showLowStockIndicator,
            lowStockThreshold: data.lowStockThreshold,
            enableQuickView: data.enableQuickView,
            baseCurrencySymbol: data.baseCurrencySymbol
        };

        // 3. Send success response
        res.status(200).json(publicSettings);

    } catch (error) {
        console.error("Error fetching site settings:", error);
        res.status(500).json({ error: "Failed to fetch site settings" });
    }
};
