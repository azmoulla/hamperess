import { db } from './_lib/firebase-admin-helper.js';
import { promises as fs } from 'fs';
import path from 'path';

const DOC_PATH = 'siteContent/header_nav';
const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'Header_nav.json');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Try to get the menu from the Firestore database
        const docRef = db.doc(DOC_PATH);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            // 2. If it exists in the database, return it
            console.log("[API /api/get-menu] Serving menu from Firestore database.");
            res.status(200).json(docSnap.data());
        } else {
            // 3. If not in DB, read from the static Header_nav.json file as a fallback
            console.warn(`[API /api/get-menu] Document ${DOC_PATH} not found. Serving fallback from Header_nav.json.`);
            try {
                const fileContent = await fs.readFile(FILE_PATH, 'utf8');
                const jsonData = JSON.parse(fileContent);
                res.status(200).json(jsonData);
            } catch (fileError) {
                console.error("[API /api/get-menu] CRITICAL: Fallback Header_nav.json not found or unreadable.", fileError);
                res.status(500).json({ error: 'Failed to load menu data.' });
            }
        }
    } catch (error) {
        console.error("[API /api/get-menu] Error fetching menu:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
