// FILE: api/vouchers.js
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendVoucherEmail } from './_lib/email-helper.js';

// --- HELPERS ---
function generateUniqueCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RET-';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 2) code += '-';
    }
    return code;
}

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    const { code } = req.query;

    try {
        // ==========================================
        // GET REQUESTS
        // ==========================================
        if (req.method === 'GET') {
            
            // --- CASE A: Validate Discount (Public) ---
            // (Replaces validate-discount.js)
            if (code) {
                const upperCaseCode = code.trim().toUpperCase();

                // 1. Check Standard Discounts
                const discountSnap = await db.collection('discounts')
                    .where('code', '==', upperCaseCode)
                    .where('isActive', '==', true)
                    .limit(1).get();

                if (!discountSnap.empty) {
                    const doc = discountSnap.docs[0];
                    return res.status(200).json({ id: doc.id, ...doc.data() });
                }

                // 2. Check Store Credits
                const creditSnap = await db.collection('storeCredits')
                    .where('code', '==', upperCaseCode)
                    .where('isActive', '==', true)
                    .limit(1).get();

                if (!creditSnap.empty) {
                    const creditDoc = creditSnap.docs[0];
                    const creditData = creditDoc.data();
                    
                    if (creditData.remainingValue > 0) {
                        return res.status(200).json({
                            id: creditDoc.id, // Crucial for order processing
                            type: 'store_credit',
                            value: creditData.remainingValue,
                            code: creditData.code,
                            usageHistory: creditData.usageHistory || [],
                            description: `Store credit with £${creditData.remainingValue.toFixed(2)} remaining.`
                        });
                    }
                }
                
                return res.status(404).json({ error: 'Invalid or expired code.' });
            }

            // --- CASE B: Get All Vouchers (Admin Only) ---
            // (Replaces get-all-vouchers.js)
            if (await verifyAdmin(req)) {
                const snapshot = await db.collection('storeCredits').orderBy('creationDate', 'desc').get();
                const vouchers = snapshot.docs.map(doc => {
                    const data = doc.data();
                    if (data.creationDate && typeof data.creationDate.toDate === 'function') {
                        data.creationDate = data.creationDate.toDate().toISOString();
                    }
                    return { id: doc.id, ...data };
                });
                return res.status(200).json(vouchers);
            }
            
            return res.status(403).json({ error: 'Forbidden' });
        }

        // ==========================================
        // POST REQUESTS
        // ==========================================
        // (Replaces generate-store-credit.js)
        if (req.method === 'POST') {
            if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

            const { returnPath, value, customerEmail } = req.body;
            if (!value || !customerEmail) {
                return res.status(400).json({ error: 'Value and customer email are required.' });
            }

            const newCode = generateUniqueCode();
            const creditRef = db.collection('storeCredits').doc();
            const returnId = returnPath ? returnPath.split('/').pop() : null;

            await db.runTransaction(async (transaction) => {
                let returnDocRef = null;
                
                // If linked to a return, verify it exists first
                if (returnPath) {
                    returnDocRef = db.doc(returnPath);
                    const returnDoc = await transaction.get(returnDocRef);
                    if (!returnDoc.exists) throw new Error('Return document not found.');
                }

                const creditData = {
                    code: newCode,
                    initialValue: Number(value),
                    remainingValue: Number(value),
                    isActive: true,
                    isSingleUse: false,
                    customerEmail,
                    creationDate: admin.firestore.FieldValue.serverTimestamp(),
                    usageHistory: []
                };

                if (returnId) creditData.createdForReturnId = returnId;

                transaction.set(creditRef, creditData);

                // Update the return status if linked
                if (returnPath && returnDocRef) {
                    transaction.update(returnDocRef, { status: `Completed (Credit: ${newCode})` });
                }
            });

            // 1. Fast Response for UI
            res.status(200).json({ success: true, code: newCode, value });

            // 2. Fire-and-Forget Email
            sendVoucherEmail({
                email: customerEmail,
                name: 'Valued Customer',
                code: newCode,
                value: value
            });
            return; // Function ends
        }

    } catch (error) {
        console.error('Vouchers API Error:', error);
        // If headers aren't sent yet, send 500
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    }

    return res.status(405).end();
}
