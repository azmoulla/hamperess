import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

// 1. UPDATED: Document path in Firestore
const DOC_PATH = 'siteContent/our_mission'; 

export default async function handler(req, res) {
    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                res.status(200).json(docSnap.data());
            } else {
                // 2. UPDATED: Default content to match your JSON
                res.status(200).json({ 
                    pageTitle: "Our Mission",
                    sections: [
                        {
                            title: "Our Mission",
                            content: "Our mission is to elevate the art of gift-giving by providing exquisitely curated hampers that create unforgettable moments of joy and connection. We are committed to sourcing the highest quality artisanal products, presenting them with elegance and care, and delivering an exceptional customer experience from start to finish."
                        },
                        {
                            title: "Our Values",
                            content: "• Quality: We believe in sourcing only the finest products from trusted artisans and producers.\n• Curation: Every item is thoughtfully selected to create a harmonious and luxurious experience.\n• Presentation: We are dedicated to beautiful, sustainable packaging that delights from the very first glance."
                        }
                    ]
                });
            }
        } catch (error) {
            console.error("[API GET /admin/our_mission] Error:", error);
            res.status(500).json({ error: 'Failed to fetch content.' });
        }
    } else if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        
        try {
            const { pageTitle, sections } = req.body;
            if (!pageTitle || !Array.isArray(sections)) {
                return res.status(400).json({ error: 'Invalid data. "pageTitle" and "sections" array are required.' });
            }
            await docRef.set({ pageTitle, sections }, { merge: true });
            res.status(200).json({ success: true, message: 'Content updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/our_mission] Error:", error);
            res.status(500).json({ error: 'Failed to save content.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}