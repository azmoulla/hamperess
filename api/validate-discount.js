// FILE: /api/validate-discount.js (Corrected to include the document ID)
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    console.error('CRITICAL: Firebase admin initialization failed in validate-discount.js:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    try {
        const upperCaseCode = code.trim().toUpperCase();

        const discountSnap = await db.collection('discounts').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!discountSnap.empty) {
            const doc = discountSnap.docs[0];
            // Include the document ID for standard discounts as well
            return res.status(200).json({ id: doc.id, ...doc.data() });
        }

        const creditSnap = await db.collection('storeCredits').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!creditSnap.empty) {
            const creditDoc = creditSnap.docs[0];
            const creditData = creditDoc.data();
            if (creditData.remainingValue > 0) {
                return res.status(200).json({
                    // --- THIS IS THE FIX: Add the document ID to the response ---
                    id: creditDoc.id,
                    type: 'store_credit',
                    value: creditData.remainingValue,
                    code: creditData.code,
                    usageHistory: creditData.usageHistory || [],
                    description: `Store credit with £${creditData.remainingValue.toFixed(2)} remaining.`
                });
            }
        }
        
        return res.status(404).json({ error: 'Invalid or expired code.' });

    } catch (error) {
        console.error('Error validating code:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};