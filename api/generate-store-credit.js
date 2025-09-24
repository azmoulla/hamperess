// FILE: /api/generate-store-credit.js (This is the final version with a non-blocking email trigger)
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendVoucherEmail } from './_lib/email-helper.js'; // We still import the helper

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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!(await verifyAdmin(req))) return res.status(403).json({ error: 'Forbidden' });

    const { returnPath, value, customerEmail } = req.body;
    if (!value || !customerEmail) {
        return res.status(400).json({ error: 'Value and customer email are required.' });
    }

    try {
        const code = generateUniqueCode();
        const creditRef = db.collection('storeCredits').doc();
        const returnId = returnPath ? returnPath.split('/').pop() : null;

        await db.runTransaction(async (transaction) => {
            let returnDocRef = null;
            if (returnPath) {
                returnDocRef = db.doc(returnPath);
                const returnDoc = await transaction.get(returnDocRef);
                if (!returnDoc.exists) throw new Error('Return document not found.');
            }
            const creditData = {
                code,
                initialValue: Number(value),
                remainingValue: Number(value),
                isActive: true,
                isSingleUse: false,
                customerEmail,
                creationDate: admin.firestore.FieldValue.serverTimestamp(),
                usageHistory: []
            };
            if (returnId) {
                creditData.createdForReturnId = returnId;
            }
            transaction.set(creditRef, creditData);
            if (returnPath && returnDocRef) {
                transaction.update(returnDocRef, { status: `Completed (Credit: ${code})` });
            }
        });

        // --- THIS IS THE FIX ---
        // 1. Respond to the admin panel immediately so the UI is fast.
        res.status(200).json({ success: true, code, value });

        // 2. NOW, trigger the email in the background. We DO NOT use 'await'.
        // This is a "fire-and-forget" operation.
        sendVoucherEmail({
            email: customerEmail,
            name: 'Valued Customer', // We can enhance this later
            code: code,
            value: value
        });
        // The function ends here, without waiting for the email to send.

    } catch (error) {
        console.error('Error generating store credit:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}