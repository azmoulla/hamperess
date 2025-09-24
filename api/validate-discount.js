// FILE: /api/validate-discount.js (This is the final, correct version)
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) { console.error('Firebase admin initialization error:', error.stack); }
}
const db = admin.firestore();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    try {
        const upperCaseCode = code.trim().toUpperCase();

        const discountSnap = await db.collection('discounts').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!discountSnap.empty) {
            return res.status(200).json(discountSnap.docs[0].data());
        }

        const creditSnap = await db.collection('storeCredits').where('code', '==', upperCaseCode).where('isActive', '==', true).limit(1).get();
        if (!creditSnap.empty) {
            const creditData = creditSnap.docs[0].data();
            if (creditData.remainingValue > 0) {
                return res.status(200).json({
                    type: 'store_credit',
                    value: creditData.remainingValue,
                    code: creditData.code,
                    usageHistory: creditData.usageHistory || [], // This line is crucial
                    description: `Store credit with £${creditData.remainingValue.toFixed(2)} remaining.`
                });
            }
        }
        
        return res.status(4404).json({ error: 'Invalid or expired code.' });

    } catch (error) {
        console.error('Error validating code:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};