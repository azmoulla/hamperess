// FILE: api/admin/about_us.js (CORRECT handler logic for the About Us page)

import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

// CRITICAL FIX: The document path must point to the 'about_us' document.
const DOC_PATH = 'siteContent/about_us'; 

export default async function handler(req, res) {
    

    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                res.status(200).json(docSnap.data());
            } else {
                // Return default structure if document is empty
                res.status(200).json({ 
                    pageTitle: "Our Story", // Use correct default title
                    sections: [{ title: "Our Mission", content: "Enter your content here..." }]
                });
            }
        } catch (error) {
            console.error("[API GET /admin/about_us] Error fetching content:", error);
            res.status(500).json({ error: 'Failed to fetch about us page content.' });
        }

    } else if (req.method === 'POST') {if (!(await verifyAdmin(req))) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
        try {
            const { pageTitle, sections } = req.body; // Only expecting pageTitle and sections

            // CRITICAL FIX: Validation must check for 'sections' array
            if (!pageTitle || !Array.isArray(sections)) { 
               return res.status(400).json({ error: 'Invalid data format. Requires pageTitle and sections array.' }); 
            }

            await docRef.set({
                pageTitle,
                sections // Only save the fields related to this page
            }, { merge: true });

            res.status(200).json({ success: true, message: 'About Us page updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/about_us] Error saving content:", error);
            res.status(500).json({ error: 'Failed to save about us page content.' });
        }

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}