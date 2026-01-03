// FILE: api/picking-list.js (Corrected)
import admin from 'firebase-admin';
import { db, verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
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
                    // Convert Firestore Timestamp to JS Date object immediately
                    const jsDate = orderDate.toDate(); 
                    const existing = itemQuantities.get(key) || { totalQuantity: 0, type, name, dates: [] };
                    existing.totalQuantity += qty;
                    existing.dates.push(jsDate); // Push the JS Date object
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
            totalQuantity: value.totalQuantity, // Correct field name
            // Convert dates to string format for JSON transport
            dates: value.dates.map(d => d.toISOString()), 
        }));

        res.status(200).json(pickingList.sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
        console.error('Error in picking list API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}