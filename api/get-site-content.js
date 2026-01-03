// FILE: api/get-site-content.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- FIREBASE SETUP ---
if (!getApps().length) {
    // Ensure you have this environment variable set in Vercel
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

export default async function handler(req, res) {
    const { type } = req.query; // ?type=menu, ?type=settings, etc.

    try {
        let collectionName = '';
        let docId = '';

        // 1. Route the request based on 'type'
        switch (type) {
            case 'menu':  // <--- ADDED THIS FOR YOU
                collectionName = 'settings'; // Or 'menus' depending on your DB
                docId = 'main_menu';         // The ID of your menu document
                break;
            case 'site_settings':
                collectionName = 'settings';
                docId = 'site_config';
                break;
            case 'footer_info':
                collectionName = 'settings';
                docId = 'footer_info';
                break;
            case 'occasions':
                collectionName = 'occasions';
                break;
            case 'features':
                collectionName = 'features';
                break;
            case 'testimonials':
                collectionName = 'testimonials';
                break;
            default:
                return res.status(400).json({ error: 'Invalid type requested' });
        }

        // 2. Fetch Data
        if (docId) {
            // Fetch Single Document (Menu, Settings, Footer)
            const doc = await db.collection(collectionName).doc(docId).get();
            if (!doc.exists) {
                // If it's the menu, return an empty array to prevent crashing
                if (type === 'menu') return res.status(200).json([]);
                return res.status(404).json({ error: 'Not found' });
            }
            // If it's the menu, we usually expect an array, check your data structure
            const data = doc.data();
            // If your menu is stored inside a field called 'items', return that.
            return res.status(200).json(data.items || data);
        } else {
            // Fetch Entire Collection (Occasions, Features)
            const snapshot = await db.collection(collectionName).get();
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(items);
        }

    } catch (error) {
        console.error(`API Error (${type}):`, error);
        return res.status(500).json({ error: error.message });
    }
}