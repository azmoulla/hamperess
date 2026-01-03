import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

const DOC_PATH = 'siteContent/delivery_info';

export default async function handler(req, res) {

    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        try {
            console.log(`[API GET /admin/delivery_info] Fetching content...`);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const data = docSnap.data();
                // Ensure sections exists and add iconName if missing (for backward compatibility)
                const sectionsArray = (Array.isArray(data.sections) ? data.sections : []).map(s => ({
                    title: s.title || '',
                    content: s.content || '',
                    iconName: s.iconName || '' // Add iconName, default to empty
                }));
                console.log(`[API GET /admin/delivery_info] Content found.`);
                res.status(200).json({
                    pageTitle: data.pageTitle || "Delivery Information",
                    sections: sectionsArray // Return sections with iconName
                 });
            } else {
                console.log(`[API GET /admin/delivery_info] No content found, returning default.`);
                res.status(200).json({
                    pageTitle: "Delivery Information",
                    // Include iconName in default
                    sections: [{ title: "Standard UK Delivery", content: "Enter details here...", iconName: "truckFast" }]
                 });
            }
        } catch (error) {
            console.error("[API GET /admin/delivery_info] Error fetching content:", error);
            res.status(500).json({ error: 'Failed to fetch delivery info.', details: error.message });
        }
        // --- End GET ---

    } else if (req.method === 'POST') {
        // --- Handle POST request (Requires Admin) ---
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }

        try {
            // Expecting pageTitle and sections array
            const { pageTitle, sections } = req.body;
            console.log(`[API POST /admin/delivery_info] Saving content...`);

            // Validation
            if (!pageTitle || !Array.isArray(sections)) {
               console.error(`[API POST /admin/delivery_info] Invalid data: Missing pageTitle or sections array.`, req.body);
               return res.status(400).json({ error: 'Invalid data format. Requires pageTitle and sections array.' });
            }
             if (sections.some(item => typeof item.title === 'undefined' || typeof item.content === 'undefined')) {
                console.error(`[API POST /admin/delivery_info] Invalid data: Missing title or content in a section.`, sections);
                return res.status(400).json({ error: 'Invalid data format. Each section must have a title and content.' });
            }

            // Save the data to the document
            await docRef.set({
                pageTitle: pageTitle,
                // Ensure only expected fields are saved
                sections: sections.map(s => ({
                    title: s.title,
                    content: s.content,
                    iconName: s.iconName
                 }))
            }, { merge: true });
            console.log(`[API POST /admin/delivery_info] Content saved successfully.`);
            res.status(204).end();
        } catch (error) {
            console.error("[API POST /admin/delivery_info] Error saving content:", error);
            res.status(500).json({ error: 'Failed to save delivery info.', details: error.message });
        }
        // --- End POST ---

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}