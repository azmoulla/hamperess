// FILE: api/admin/contact_us.js (Corrected Admin Check)

import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js'; // Ensure path is correct

const DOC_PATH = 'siteContent/contact_us';

export default async function handler(req, res) {
    // Admin check removed from here

    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        // --- Handle GET request (NO ADMIN CHECK) ---
        try {
            console.log(`[API GET /admin/contact_us] Fetching content...`);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                console.log(`[API GET /admin/contact_us] Content found.`);
                res.status(200).json(docSnap.data());
            } else {
                console.log(`[API GET /admin/contact_us] No content found, returning default.`);
                res.status(200).json({
                    pageTitle: "Get in Touch",
                    pageSubtitle: "We'd love to hear from you!",
                    mapImagePath: "assets/images/map_placeholder.png", // Correct default map
                    contactDetails: [],
                    openingHours: { title: "Opening Hours", hours: [] }
                });
            }
        } catch (error) {
            console.error("[API GET /admin/contact_us] Error fetching content:", error);
            res.status(500).json({ error: 'Failed to fetch contact page content.', details: error.message });
        }
        // --- End GET ---

    } else if (req.method === 'POST') {
        // --- Handle POST request ---

        // --- FIX: Admin check MOVED inside POST block ---
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        // --- END FIX ---

        try {
            const { pageTitle, pageSubtitle, mapImagePath, contactDetails, openingHours } = req.body;
            console.log(`[API POST /admin/contact_us] Saving content...`);

            // Validation for Contact Us fields
            if (!pageTitle || !Array.isArray(contactDetails) || !openingHours) {
               console.error(`[API POST /admin/contact_us] Invalid data received:`, req.body);
               return res.status(400).json({ error: 'Invalid data format. Requires pageTitle, contactDetails array, and openingHours object.' });
            }
            // Add more specific validation if needed (e.g., check hours array, detail structure)

            await docRef.set({
                pageTitle,
                pageSubtitle,
                mapImagePath,
                contactDetails,
                openingHours
            }, { merge: true }); // Use merge to be safe

            console.log(`[API POST /admin/contact_us] Content saved successfully.`);
            res.status(200).json({ success: true, message: 'Contact Us page updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/contact_us] Error saving content:", error);
            res.status(500).json({ error: 'Failed to save contact page content.', details: error.message });
        }
        // --- End POST ---

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}