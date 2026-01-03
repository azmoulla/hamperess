// FILE: api/admin/faqs.js

import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js'; // Ensure path is correct

const DOC_PATH = 'siteContent/faqs';

export default async function handler(req, res) {

    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        // --- Handle GET request (NO ADMIN CHECK) ---
        try {
            console.log(`[API GET /admin/faqs] Fetching FAQs...`);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const data = docSnap.data();
                // Ensure 'faqs' field exists and is an array
                const faqsArray = Array.isArray(data.faqs) ? data.faqs : [];
                console.log(`[API GET /admin/faqs] FAQs found.`);
                res.status(200).json(faqsArray); // Return just the array
            } else {
                console.log(`[API GET /admin/faqs] No FAQs found, returning empty array.`);
                res.status(200).json([]); // Return empty array if document doesn't exist
            }
        } catch (error) {
            console.error("[API GET /admin/faqs] Error fetching FAQs:", error);
            res.status(500).json({ error: 'Failed to fetch FAQs.', details: error.message });
        }
        // --- End GET ---

    } else if (req.method === 'POST') {
        // --- Handle POST request (Requires Admin) ---
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }

        try {
            const { faqs } = req.body; // Expect an array named 'faqs'
            console.log(`[API POST /admin/faqs] Saving FAQs...`);

            // Validation
            if (!Array.isArray(faqs)) {
               console.error(`[API POST /admin/faqs] Invalid data: 'faqs' is not an array.`, req.body);
               return res.status(400).json({ error: 'Invalid data format. Requires a "faqs" array.' });
            }
            // Ensure each item has question and answer
            if (faqs.some(item => typeof item.question === 'undefined' || typeof item.answer === 'undefined')) {
                console.error(`[API POST /admin/faqs] Invalid data: Missing question or answer in an item.`, faqs);
                return res.status(400).json({ error: 'Invalid data format. Each FAQ must have a question and answer.' });
            }

            // Save the entire array under the 'faqs' field in the document
            await docRef.set({
                faqs: faqs
            }); // Overwrite the existing array completely

            console.log(`[API POST /admin/faqs] FAQs saved successfully.`);
            res.status(200).json({ success: true, message: 'FAQs updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/faqs] Error saving FAQs:", error);
            res.status(500).json({ error: 'Failed to save FAQs.', details: error.message });
        }
        // --- End POST ---

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}