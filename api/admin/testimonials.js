// FILE: api/admin/testimonials.js
// (Create this new file)

import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';
import { promises as fs } from 'fs';
import path from 'path';

const DOC_PATH = 'siteContent/testimonials';
const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'testimonials.json');

export default async function handler(req, res) {
    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        // --- GET (Public) ---
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                console.log("[API GET /testimonials] Serving testimonials from Firestore.");
                // Data is stored as an object { items: [...] }
                res.status(200).json(docSnap.data().items || []);
            } else {
                // Fallback to static file
                console.warn(`[API GET /testimonials] Document not found. Serving from ${FILE_PATH}`);
                try {
                    const fileContent = await fs.readFile(FILE_PATH, 'utf8');
                    res.status(200).json(JSON.parse(fileContent)); // The file is just an array
                } catch (fileError) {
                    res.status(500).json({ error: 'Failed to load fallback testimonials.' });
                }
            }
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }

    } else if (req.method === 'POST') {
        // --- POST (Admin-Only) ---
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        
        try {
            const { items } = req.body; // Expect an object { items: [...] }
            if (!Array.isArray(items)) {
                return res.status(400).json({ error: 'Invalid data. "items" array is required.' });
            }
            // Save the data in the expected object format
            await docRef.set({ items: items });
            res.status(200).json({ success: true, message: 'Testimonials updated successfully.' });
        } catch (error) {
            console.error("[API POST /testimonials] Error saving content:", error);
            res.status(500).json({ error: 'Failed to save content.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}
