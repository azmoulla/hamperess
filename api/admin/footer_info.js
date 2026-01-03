import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';
import { promises as fs } from 'fs';
import path from 'path';

const DOC_PATH = 'siteContent/footer_info';
const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'footer_info.json');

export default async function handler(req, res) {
    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        // --- GET (Public) ---
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                console.log("[API GET /footer_info] Serving footer from Firestore.");
                res.status(200).json(docSnap.data());
            } else {
                // Fallback to static file if not in DB
                console.warn(`[API GET /footer_info] Document not found. Serving from ${FILE_PATH}`);
                try {
                    const fileContent = await fs.readFile(FILE_PATH, 'utf8');
                    res.status(200).json(JSON.parse(fileContent));
                } catch (fileError) {
                    res.status(500).json({ error: 'Failed to load fallback footer data.' });
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
            const payload = req.body;
            // Add basic validation
            if (!payload.companyInfo || !payload.quickLinks || !payload.legalLinks) {
                return res.status(400).json({ error: 'Invalid data. Missing required footer sections.' });
            }
            await docRef.set(payload);
            res.status(200).json({ success: true, message: 'Footer content updated successfully.' });
        } catch (error) {
            console.error("[API POST /footer_info] Error saving content:", error);
            res.status(500).json({ error: 'Failed to save content.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}