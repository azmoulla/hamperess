// FILE: api/admin-handler.js
// COMBINES: get-menu, update-menu, order-details, picking-list, get-unshipped-orders,
// update-order-status, get-all-returns, generate-store-credit,
// PLUS: get-all-vouchers, rich-order-details, update-return-status

import admin from 'firebase-admin';
import { promises as fs } from 'fs';
import path from 'path';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';
import { sendVoucherEmail } from './_lib/email-helper.js'; 

// --- 1. HELPER FUNCTIONS ---

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

// --- 2. MAIN ROUTER ---

export default async function handler(req, res) {
    const { action } = req.query;

    try {
        switch (action) {
            case 'get_menu':
                return await handleGetMenu(req, res);
            case 'update_menu':
                return await handleUpdateMenu(req, res);
            case 'order_details':
                return await handleOrderDetails(req, res);
            case 'picking_list':
                return await handlePickingList(req, res);
            case 'get_unshipped_orders':
                return await handleGetUnshippedOrders(req, res);
            case 'update_order_status':
                return await handleUpdateOrderStatus(req, res);
            case 'get_all_returns':
                return await handleGetAllReturns(req, res);
            case 'generate_store_credit':
                return await handleGenerateStoreCredit(req, res);
            // --- NEW CASES ADDED BELOW ---
            case 'get_all_vouchers':
                return await handleGetAllVouchers(req, res);
            case 'rich_order_details':
                return await handleRichOrderDetails(req, res);
            case 'update_return_status':
                return await handleUpdateReturnStatus(req, res);
            default:
                return res.status(400).json({ error: 'Invalid admin action requested' });
        }
    } catch (error) {
        console.error(`Admin API Error (${action}):`, error);
        return res.status(500).json({ error: error.message });
    }
}

// --- 3. LOGIC HANDLERS ---

// Logic from get-menu.js
async function handleGetMenu(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const DOC_PATH = 'siteContent/header_nav';
    const FILE_PATH = path.join(process.cwd(), 'public', 'data', 'Header_nav.json');

    try {
        const docRef = db.doc(DOC_PATH);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            console.log("[API /api/get-menu] Serving menu from Firestore database.");
            return res.status(200).json(docSnap.data());
        } else {
            console.warn(`[API /api/get-menu] Document ${DOC_PATH} not found. Serving fallback from Header_nav.json.`);
            try {
                const fileContent = await fs.readFile(FILE_PATH, 'utf8');
                const jsonData = JSON.parse(fileContent);
                return res.status(200).json(jsonData);
            } catch (fileError) {
                console.error("[API /api/get-menu] CRITICAL: Fallback Header_nav.json not found or unreadable.", fileError);
                return res.status(500).json({ error: 'Failed to load menu data.' });
            }
        }
    } catch (error) {
        console.error("[API /api/get-menu] Error fetching menu:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from update-menu.js
async function handleUpdateMenu(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const newMenuData = req.body;
        JSON.parse(JSON.stringify(newMenuData)); 
        const filePath = path.join(process.cwd(), 'public', 'data', 'Header_nav.json');
        await fs.writeFile(filePath, JSON.stringify(newMenuData, null, 2));
        return res.status(200).json({ success: true, message: 'Menu updated successfully.' });
    } catch (error) {
        console.error('Error updating menu file:', error);
        if (error instanceof SyntaxError) {
            return res.status(400).json({ error: 'Invalid JSON format provided.' });
        }
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}

// Logic from order-details.js (Admin Version)
async function handleOrderDetails(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: 'Order document ID is required.' });

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Order not found in database.' });
        }
        
        const data = doc.data();
        const orderData = {
            docId: doc.id,
            ...data,
            orderDate: data.orderDate.toDate().toISOString()
        };

        return res.status(200).json(orderData);
    } catch (error) {
        console.error('Error in order-details API:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from picking-list.js
async function handlePickingList(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { startDate, endDate } = req.query;
        let query = db.collection('orders').where('status', 'in', ['Pending', 'Processing']);

        if (startDate) query = query.where('orderDate', '>=', new Date(startDate));
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.where('orderDate', '<=', endOfDay);
        }

        const snapshot = await query.get();
        if (snapshot.empty) return res.status(200).json([]);

        const itemQuantities = new Map();
        snapshot.forEach(doc => {
            const order = doc.data();
            if (!order.items || !Array.isArray(order.items)) return;
            order.items.forEach(item => {
                if (!item || !item.quantity) return;
                
                const processItem = (id, name, qty, type, orderDate) => {
                    const key = `${type}_${id}`;
                    const jsDate = orderDate.toDate(); 
                    const existing = itemQuantities.get(key) || { totalQuantity: 0, type, name, dates: [] };
                    existing.totalQuantity += qty;
                    existing.dates.push(jsDate); 
                    itemQuantities.set(key, existing);
                };

                if (item.isCustom && Array.isArray(item.contents)) {
                    item.contents.forEach(c => processItem(c.id, c.name, item.quantity * c.quantity, 'Component', order.orderDate));
                } else if (item.isHamper && Array.isArray(item.hamperContents)) {
                    item.hamperContents.forEach(c => processItem(c.productId, c.title, item.quantity * c.quantity, 'Component', order.orderDate));
                }
                if (item.productId) {
                    processItem(item.productId, item.title, item.quantity, 'Product', order.orderDate);
                }
            });
        });
        
        const pickingList = Array.from(itemQuantities.values()).map(value => ({
            name: value.name,
            type: value.type,
            totalQuantity: value.totalQuantity,
            dates: value.dates.map(d => d.toISOString()), 
        }));

        return res.status(200).json(pickingList.sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
        console.error('Error in picking list API:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from get-unshipped-orders.js
async function handleGetUnshippedOrders(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { startDate, endDate } = req.query;
        let query = db.collection('orders').where('status', 'in', ['Pending', 'Processing']);

        if (startDate) query = query.where('orderDate', '>=', new Date(startDate));
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.where('orderDate', '<=', endOfDay);
        }

        const snapshot = await query.get();
        if (snapshot.empty) return res.status(200).json([]);

        const unshippedOrders = snapshot.docs.map(doc => ({
            docId: doc.id,
            ...doc.data()
        }));
        
        unshippedOrders.sort((a, b) => a.orderDate.seconds - b.orderDate.seconds);
        return res.status(200).json(unshippedOrders);
    } catch (error) {
        console.error('Error fetching unshipped orders:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from update-order-status.js
async function handleUpdateOrderStatus(req, res) {
    if (req.method !== 'PUT') return res.status(405).end();
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId, newStatus, trackingNumber, courier } = req.body;
        if (!orderId || !newStatus) {
            return res.status(400).json({ error: 'Order ID and new status are required.' });
        }

        const orderRef = db.collection('orders').doc(orderId);
        
        const updateData = { status: newStatus };

        if (trackingNumber && courier) {
            updateData.trackingNumber = trackingNumber.trim().toUpperCase();
            updateData.courier = courier;
            const courierUrls = {
                'Royal Mail': 'https://www.royalmail.com/track-your-item#/track/',
                'DPD': 'https://www.dpd.co.uk/service/tracking?match=',
                'Evri': 'https://www.evri.com/track/parcel/'
            };
            updateData.courierUrl = courierUrls[courier] || null;
        }

        await orderRef.update(updateData);
        return res.status(200).json({ success: true, message: `Order ${orderId} updated to ${newStatus}.` });

    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from get-all-returns.js
async function handleGetAllReturns(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const returnsSnapshot = await db.collectionGroup('returns').orderBy('requestDate', 'desc').get();
        
        const returns = [];
        for (const doc of returnsSnapshot.docs) {
            const returnData = doc.data();
            const userRef = doc.ref.parent.parent;
            const userDoc = await userRef.get();

            if (returnData.requestDate && typeof returnData.requestDate.toDate === 'function') {
                returnData.requestDate = returnData.requestDate.toDate().toISOString();
            }

            returns.push({
                docId: doc.id,
                returnPath: doc.ref.path,
                userId: userRef.id,
                customerName: userDoc.data()?.name || 'N/A',
                customerEmail: userDoc.data()?.email || 'N/A',
                ...returnData
            });
        }
        
        return res.status(200).json(returns);
    } catch (error) {
        console.error('Error fetching all returns:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from generate-store-credit.js
async function handleGenerateStoreCredit(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

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

        res.status(200).json({ success: true, code, value });

        sendVoucherEmail({
            email: customerEmail,
            name: 'Valued Customer',
            code: code,
            value: value
        });

    } catch (error) {
        console.error('Error generating store credit:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}

// Logic from get-all-vouchers.js
async function handleGetAllVouchers(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const snapshot = await db.collection('storeCredits').orderBy('creationDate', 'desc').get();
        const vouchers = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.creationDate && typeof data.creationDate.toDate === 'function') {
                data.creationDate = data.creationDate.toDate().toISOString();
            }
            return { id: doc.id, ...data };
        });
        return res.status(200).json(vouchers);
    } catch (error) {
        console.error('Error fetching vouchers:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from rich-order-details.js
async function handleRichOrderDetails(req, res) {
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { orderId } = req.query; 
        if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

        const ordersRef = db.collection('orders');
        const orderQuery = await ordersRef.where('id', '==', orderId).limit(1).get();

        if (orderQuery.empty) {
            return res.status(404).json({ error: `Order #${orderId} not found.` });
        }

        const orderDoc = orderQuery.docs[0];
        const orderData = { docId: orderDoc.id, ...orderDoc.data() };

        const returnsRef = db.collectionGroup('returns').where('orderId', '==', orderId);
        const returnsSnapshot = await returnsRef.get();
        const associatedReturns = returnsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        const replacementOrders = [];
        if (associatedReturns.length > 0) {
            const returnIds = associatedReturns.map(r => r.id);
            const replacementsQuery = await ordersRef.where('replacesReturnId', 'in', returnIds).get();
            replacementsQuery.forEach(doc => {
                replacementOrders.push({id: doc.data().id, status: doc.data().status});
            });
        }
        
        const approvedReturnedItems = associatedReturns
            .filter(r => r.status === 'Approved')
            .flatMap(r => r.items);
        
        orderData.items.forEach(item => {
            const qtyReturned = approvedReturnedItems
                .filter(ri => ri.productId === item.productId)
                .reduce((sum, ri) => sum + ri.quantity, 0);
            item.quantityReturned = qtyReturned;
            item.quantityActive = item.quantity - qtyReturned;
        });

        const richOrder = {
            ...orderData,
            associatedReturns: associatedReturns,
            replacementOrders: replacementOrders
        };

        return res.status(200).json(richOrder);

    } catch (error) {
        console.error(`Error fetching rich details for order ${req.query.orderId}:`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logic from update-return-status.js
async function handleUpdateReturnStatus(req, res) {
    if (req.method !== 'PUT') return res.status(405).end();
    if (!await verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { returnId, newStatus, orderId, userId } = req.body;
        if (!returnId || !newStatus || !orderId || !userId) {
            return res.status(400).json({ error: 'All IDs and a new status are required.' });
        }

        const returnRef = db.collection('users').doc(userId).collection('returns').doc(returnId);
        const orderQuery = db.collection('orders').where('id', '==', orderId).limit(1);

        await db.runTransaction(async (transaction) => {
            const returnDoc = await transaction.get(returnRef);
            if (!returnDoc.exists) throw new Error('Return request not found.');
            
            transaction.update(returnRef, { status: newStatus });

            if (newStatus === 'Approved') {
                const orderSnapshot = await transaction.get(orderQuery);
                if (orderSnapshot.empty) throw new Error('Original order not found.');
                
                const orderDoc = orderSnapshot.docs[0];
                const orderData = orderDoc.data();
                const returnData = returnDoc.data();

                const orderItemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
                const returnedItemCount = returnData.items.reduce((sum, item) => sum + item.quantity, 0);
                const isFullAction = returnedItemCount >= orderItemCount;

                let finalOrderStatus = orderData.status;

                if (['Pending', 'Processing'].includes(orderData.status)) {
                    const orderDate = orderData.orderDate.toDate();
                    const ageInHours = (new Date() - orderDate) / (1000 * 60 * 60);

                    if (ageInHours < 48) {
                        finalOrderStatus = isFullAction ? 'Cancelled' : 'Partially Cancelled';
                    } else {
                        finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                    }
                } else if (['Shipped', 'Completed', 'Dispatched'].includes(orderData.status)) {
                    finalOrderStatus = isFullAction ? 'Returned' : 'Partially Returned';
                }

                if (finalOrderStatus !== orderData.status) {
                    transaction.update(orderDoc.ref, { status: finalOrderStatus });
                }
            }
        });

        return res.status(200).json({ success: true, message: 'Return and associated order have been updated.' });

    } catch (error) {
        console.error('Error updating return status:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
