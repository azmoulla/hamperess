// FILE: api/cancel-order.js (Definitive Version)
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function verifyUserOrAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return { uid: null, isAdmin: false };
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(token);
        const isAdmin = decodedToken.admin === true;
        return { uid: decodedToken.uid, isAdmin };
    } catch (error) {
        console.error("Token verification failed:", error.message);
        return { uid: null, isAdmin: false };
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    const { uid, isAdmin } = await verifyUserOrAdmin(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId, itemsToCancel } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    try {
        const orderRef = db.collection('orders').doc(orderId);
        await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) throw new Error('Order not found.');
            
            const orderData = orderDoc.data();

            if (orderData.userId !== uid && !isAdmin) throw new Error('Forbidden');
            if (['Shipped', 'Cancelled', 'Dispatched'].includes(orderData.status)) throw new Error(`Cannot cancel order with status: ${orderData.status}.`);
            
            const isFullCancellation = !itemsToCancel || itemsToCancel.length === 0;
            const itemsToRestock = isFullCancellation ? orderData.items : itemsToCancel;

            if (itemsToRestock.length > 0) {
                 const productRefs = itemsToRestock
                    .filter(item => !item.isCustom)
                    .map(item => ({ ref: db.collection('products').doc(item.productId), quantity: item.quantity }));

                for (const prod of productRefs) {
                    transaction.update(prod.ref, { stock: admin.firestore.FieldValue.increment(prod.quantity) });
                }
            }

            // --- THIS IS THE FINAL, UNIFIED FIX ---
           // FILE: api/cancel-order.js

                if (isFullCancellation) {
                // For a full cancellation, we simply UPDATE the status field. This is safer.
                transaction.update(orderRef, { status: 'Cancelled' });
                } else {
                let newItems = [...orderData.items];
                let subtotalReduction = 0;
                let cancelledItemsLog = [];

                for (const itemToCancel of itemsToCancel) {
                    const itemIndex = newItems.findIndex(i => i.productId === itemToCancel.productId);
                    if (itemIndex > -1) {
                        const originalItem = newItems[itemIndex];
                        cancelledItemsLog.push(`"${originalItem.title}" (x${itemToCancel.quantity})`);
                        if (originalItem.quantity > itemToCancel.quantity) {
                            originalItem.quantity -= itemToCancel.quantity;
                        } else {
                            newItems.splice(itemIndex, 1);
                        }
                        subtotalReduction += originalItem.price * itemToCancel.quantity;
                    }
                }
                
                const note = `Cancelled by ${isAdmin ? 'Admin' : 'User'}: ${cancelledItemsLog.join(', ')}`;

              // FILE: api/cancel-order.js

    // UPDATE only the fields that have changed. This is the correct method.
    transaction.update(orderRef, {
        items: newItems,
        status: 'Partially Cancelled',
        itemsSubtotal: orderData.itemsSubtotal - subtotalReduction,
        totalAmount: orderData.totalAmount - subtotalReduction,
        notes: admin.firestore.FieldValue.arrayUnion(note)
    });
}
        });
        res.status(200).json({ success: true, message: 'Order has been successfully updated.' });
    } catch (error) {
        console.error(`Error cancelling order ${orderId}:`, error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}