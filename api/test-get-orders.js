// FILE: api/test-get-orders.js
import admin from 'firebase-admin';

// Boilerplate Firebase/Auth setup
if (!admin.apps.length) { try { const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY); admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); } catch (e) { console.error('Firebase admin init error'); } }
const db = admin.firestore();
const auth = admin.auth();
async function getVerifiedUid(req) { const header = req.headers.authorization; if (!header || !header.startsWith('Bearer ')) return null; const token = header.split('Bearer ')[1]; try { const decoded = await auth.verifyIdToken(token); return decoded.uid; } catch (e) { return null; } }

// Main Handler
export default async function handler(req, res) {
    const uid = await getVerifiedUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    console.log(`--- DEBUG (TEST FILE): Running basic query for userId: ${uid}`);

    try {
        const ordersRef = db.collection('orders');
        // The simplest possible query. No sorting, no other clauses.
        const snapshot = await ordersRef.where('userId', '==', uid).get();

        console.log(`--- DEBUG (TEST FILE): Basic query found ${snapshot.docs.length} documents.`);

        if (snapshot.empty) {
            return res.status(200).json({ message: "Query returned no results.", count: 0 });
        }

        const orders = snapshot.docs.map(doc => doc.data());
        res.status(200).json(orders);

    } catch (error) {
        console.error('--- DEBUG (TEST FILE): The query threw an error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}