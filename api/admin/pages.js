import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

const COLLECTION_NAME = 'pages';

export default async function handler(req, res) {
    if (!(await verifyAdmin(req))) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    const { slug } = req.query;

    try {
        if (req.method === 'GET') {
            // --- GET (List all pages or get one by slug) ---
            if (slug) {
                // Get a single page by its slug (which is its document ID)
                const docRef = db.collection(COLLECTION_NAME).doc(slug);
                const docSnap = await docRef.get();
                if (!docSnap.exists) {
                    return res.status(404).json({ error: 'Page not found.' });
                }
                res.status(200).json({ id: docSnap.id, ...docSnap.data() });
            } else {
                // List all pages
                const snapshot = await db.collection(COLLECTION_NAME).orderBy('title').get();
                const pages = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title, slug: doc.data().slug }));
                res.status(200).json(pages);
            }
        } else if (req.method === 'POST') {
            // --- CREATE (New Page) ---
            const { title, slug, sections } = req.body;
            if (!title || !slug || !Array.isArray(sections)) {
                return res.status(400).json({ error: 'Title, slug, and sections array are required.' });
            }
            const docRef = db.collection(COLLECTION_NAME).doc(slug);
            await docRef.set({ title, slug, sections });
            res.status(201).json({ success: true, id: docRef.id });

        } else if (req.method === 'PUT') {
            // --- UPDATE (Existing Page) ---
            if (!slug) return res.status(400).json({ error: 'Slug is required in query param for PUT.' });
            const { title, sections } = req.body;
            if (!title || !Array.isArray(sections)) {
                return res.status(400).json({ error: 'Title and sections array are required.' });
            }
            const docRef = db.collection(COLLECTION_NAME).doc(slug);
            await docRef.update({ title, sections });
            res.status(200).json({ success: true, message: 'Page updated.' });

        } else if (req.method === 'DELETE') {
            // --- DELETE (Page) ---
            if (!slug) return res.status(400).json({ error: 'Slug is required in query param for DELETE.' });
            const docRef = db.collection(COLLECTION_NAME).doc(slug);
            await docRef.delete();
            res.status(200).json({ success: true, message: 'Page deleted.' });

        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error(`[API /api/admin/pages] Error:`, error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
