// FILE: api/_lib/order-helper.js
import admin from 'firebase-admin';
import { db } from './firebase-admin-helper.js';

function generateOrderId() {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
}

/**
 * Read-only "quote": computes the authoritative total for a cart the same
 * way createOrderTransaction() does (server-side prices, stock check,
 * discount/credit validation) but without a Firestore transaction and
 * without writing anything. Used by the PayPal flow (api/paypal.js) to
 * know the correct amount to charge BEFORE payment happens -- the real,
 * transactional validation still happens again in createOrderTransaction()
 * at capture time, so this is only ever a quote, never the source of
 * truth. Deliberately duplicates the validation logic below rather than
 * sharing a transaction-bound helper, since transaction.get() and a plain
 * .get() aren't interchangeable.
 *
 * @param {Object} params
 * @param {Object} params.orderPayload
 * @param {string|null} params.uid
 * @returns {Promise<{totalAmount: number}>}
 */
export async function calculateOrderTotal({ orderPayload, uid }) {
    if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
        throw new Error('Order payload with items is required.');
    }

    const settingsDoc = await db.doc('settings/site_settings').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 50.00;
    const baseDeliveryCharge = settings.baseDeliveryCharge ?? 4.99;

    const standardItems = orderPayload.items.filter(item => !item.isCustom);
    const productRefs = standardItems.map(item => db.collection('products').doc(item.productId));
    const productDocs = productRefs.length > 0 ? await Promise.all(productRefs.map(ref => ref.get())) : [];

    let creditData = null;
    if (uid && orderPayload.appliedDiscount?.type === 'store_credit' && orderPayload.appliedDiscount.id) {
        const creditDoc = await db.collection('storeCredits').doc(orderPayload.appliedDiscount.id).get();
        if (!creditDoc.exists) throw new Error('Store credit voucher not found.');
        creditData = creditDoc.data();
    }

    let discountData = null;
    if (!creditData && ['percent', 'fixed', 'shipping'].includes(orderPayload.appliedDiscount?.type) && orderPayload.appliedDiscount.id) {
        const discountDoc = await db.collection('discounts').doc(orderPayload.appliedDiscount.id).get();
        if (!discountDoc.exists) throw new Error('Discount code not found.');
        discountData = discountDoc.data();
    }

    const itemsWithPrice = orderPayload.items.filter(item => item.isCustom);
    productDocs.forEach((doc, index) => {
        const requestedItem = standardItems[index];
        if (!doc.exists) throw new Error(`Product "${requestedItem.title}" is no longer available.`);
        const productData = doc.data();
        if (productData.stock < requestedItem.quantity) {
            throw new Error(`Out of stock: ${productData.title} (Only ${productData.stock} left).`);
        }
        itemsWithPrice.push({ ...requestedItem, price: productData.price });
    });

    const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < freeDeliveryThreshold ? baseDeliveryCharge : 0;
    const chargeableTotal = itemsSubtotal + deliveryChargeApplied;

    let discountApplied = 0;
    const customerEmailLower = (orderPayload.customerEmail || '').trim().toLowerCase();

    if (creditData) {
        if (creditData.isActive && creditData.remainingValue > 0) {
            discountApplied = Math.min(chargeableTotal, creditData.remainingValue);
        }
    } else if (discountData) {
        const now = new Date();
        if (!discountData.isActive) throw new Error('This discount code is no longer active.');
        if (discountData.startDate && now < new Date(discountData.startDate)) {
            throw new Error('This discount code is not active yet.');
        }
        if (discountData.endDate) {
            const end = new Date(discountData.endDate);
            end.setHours(23, 59, 59, 999);
            if (now > end) throw new Error('This discount code has expired.');
        }
        if (typeof discountData.maxUses === 'number' && discountData.maxUses !== null && (discountData.usageCount || 0) >= discountData.maxUses) {
            throw new Error('This discount code has reached its usage limit.');
        }
        if (typeof discountData.minOrderValue === 'number' && discountData.minOrderValue !== null && itemsSubtotal < discountData.minOrderValue) {
            throw new Error(`This code requires a minimum order of £${discountData.minOrderValue.toFixed(2)}.`);
        }
        if (discountData.oneRedemptionPerCustomer && customerEmailLower && (discountData.usedByEmails || []).includes(customerEmailLower)) {
            throw new Error('This discount code has already been used on your account.');
        }

        const applicableProductIds = discountData.applicableProductIds || [];
        const applicableCategories = discountData.applicableCategories || [];
        if (applicableProductIds.length > 0 || applicableCategories.length > 0) {
            const cartQualifies = standardItems.some((item, i) => {
                const pData = productDocs[i] && productDocs[i].exists ? productDocs[i].data() : null;
                const idMatch = applicableProductIds.includes(item.productId);
                const catMatch = pData && applicableCategories.includes(pData.category);
                return idMatch || catMatch;
            });
            if (!cartQualifies) throw new Error('This discount code is not valid for the items in your cart.');
        }

        if (discountData.type === 'percent') discountApplied = (itemsSubtotal * discountData.value) / 100;
        else if (discountData.type === 'fixed') discountApplied = discountData.value;
        else if (discountData.type === 'shipping') discountApplied = deliveryChargeApplied;
    }

    discountApplied = Math.min(chargeableTotal, discountApplied);
    const totalAmount = chargeableTotal - discountApplied;

    return { totalAmount };
}

/**
 * Creates a real order in Firestore: validates stock, re-validates any
 * applied store credit / discount code authoritatively (never trusting the
 * client-supplied value), decrements stock, updates credit/discount usage,
 * and writes the order document.
 *
 * Extracted out of api/orders.js's POST handler (2026-07-22) so the exact
 * same, already-tested logic can be reused by the PayPal capture flow
 * (api/paypal.js) instead of duplicating it. The existing (unpaid) "Card"
 * checkout path in api/orders.js calls this the same way it always did
 * (no paymentMethod/transactionId override), preserving prior behavior
 * exactly. PayPal only calls this AFTER a real payment capture has
 * succeeded, passing paymentMethod: 'PayPal' and the PayPal capture id as
 * transactionId, so the order is only written once money has actually
 * been collected.
 *
 * @param {Object} params
 * @param {Object} params.orderPayload - same shape the client sends today (customerEmail, items, deliveryAddress, appliedDiscount, etc.)
 * @param {string|null} params.uid - verified Firebase uid, or null for guest
 * @param {string} [params.paymentMethod] - if provided, stamped onto the order (overrides anything in orderPayload)
 * @param {string} [params.transactionId] - if provided, stamped onto the order (overrides anything in orderPayload)
 * @returns {Promise<{orderId: string, totalAmount: number}>}
 */
export async function createOrderTransaction({ orderPayload, uid, paymentMethod, transactionId }) {
    if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
        throw new Error('Order payload with items is required.');
    }

    // --- Fetch Admin Settings for Dynamic Delivery Logic ---
    const settingsDoc = await db.doc('settings/site_settings').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 50.00;
    const baseDeliveryCharge = settings.baseDeliveryCharge ?? 4.99;

    const newOrderId = generateOrderId();
    const newOrderRef = db.collection('orders').doc(newOrderId);
    let totalAmountResult = 0;

    await db.runTransaction(async (transaction) => {
        // A. READ PHASE
        const standardItems = orderPayload.items.filter(item => !item.isCustom);
        const productRefs = standardItems.map(item => db.collection('products').doc(item.productId));
        const productDocs = productRefs.length > 0 ? await transaction.getAll(...productRefs) : [];

        // Check Store Credit (Only if registered)
        let creditDoc = null;
        if (uid && orderPayload.appliedDiscount?.type === 'store_credit' && orderPayload.appliedDiscount.id) {
            const creditRef = db.collection('storeCredits').doc(orderPayload.appliedDiscount.id);
            creditDoc = await transaction.get(creditRef);
            if (!creditDoc.exists) throw new Error('Store credit voucher not found.');
        }

        // Discount codes (percent/fixed/shipping) -- re-fetch fresh from
        // Firestore inside the transaction rather than trusting the
        // client-supplied value/type.
        let discountDoc = null;
        if (!creditDoc && ['percent', 'fixed', 'shipping'].includes(orderPayload.appliedDiscount?.type) && orderPayload.appliedDiscount.id) {
            const discountRef = db.collection('discounts').doc(orderPayload.appliedDiscount.id);
            discountDoc = await transaction.get(discountRef);
            if (!discountDoc.exists) throw new Error('Discount code not found.');
        }

        // B. VALIDATION PHASE
        const itemsWithPrice = orderPayload.items.filter(item => item.isCustom); // Start with custom items

        // Validate Stock for Standard Items
        productDocs.forEach((doc, index) => {
            const requestedItem = standardItems[index];
            if (!doc.exists) throw new Error(`Product "${requestedItem.title}" is no longer available.`);

            const productData = doc.data();
            if (productData.stock < requestedItem.quantity) {
                throw new Error(`Out of stock: ${productData.title} (Only ${productData.stock} left).`);
            }
            // Ensure price security (use server price, not client price)
            itemsWithPrice.push({ ...requestedItem, price: productData.price });
        });

        // C. CALCULATION PHASE
        const itemsSubtotal = itemsWithPrice.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < freeDeliveryThreshold ? baseDeliveryCharge : 0;
        const chargeableTotal = itemsSubtotal + deliveryChargeApplied;

        let discountApplied = 0;
        const customerEmailLower = (orderPayload.customerEmail || '').trim().toLowerCase();

        // Handle Credit Logic
        if (creditDoc) {
            const creditData = creditDoc.data();
            if (creditData.isActive && creditData.remainingValue > 0) {
                discountApplied = Math.min(chargeableTotal, creditData.remainingValue);
            }
        } else if (discountDoc) {
            // Authoritative discount-code validation. Every check here
            // re-reads from `discountData` (fresh from Firestore), never
            // from the client-supplied orderPayload.appliedDiscount.
            const discountData = discountDoc.data();
            const now = new Date();

            if (!discountData.isActive) throw new Error('This discount code is no longer active.');
            if (discountData.startDate && now < new Date(discountData.startDate)) {
                throw new Error('This discount code is not active yet.');
            }
            if (discountData.endDate) {
                const end = new Date(discountData.endDate);
                end.setHours(23, 59, 59, 999);
                if (now > end) throw new Error('This discount code has expired.');
            }
            if (typeof discountData.maxUses === 'number' && discountData.maxUses !== null && (discountData.usageCount || 0) >= discountData.maxUses) {
                throw new Error('This discount code has reached its usage limit.');
            }
            if (typeof discountData.minOrderValue === 'number' && discountData.minOrderValue !== null && itemsSubtotal < discountData.minOrderValue) {
                throw new Error(`This code requires a minimum order of £${discountData.minOrderValue.toFixed(2)}.`);
            }
            if (discountData.oneRedemptionPerCustomer && customerEmailLower && (discountData.usedByEmails || []).includes(customerEmailLower)) {
                throw new Error('This discount code has already been used on your account.');
            }

            const applicableProductIds = discountData.applicableProductIds || [];
            const applicableCategories = discountData.applicableCategories || [];
            if (applicableProductIds.length > 0 || applicableCategories.length > 0) {
                const cartQualifies = standardItems.some((item, i) => {
                    const pData = productDocs[i] && productDocs[i].exists ? productDocs[i].data() : null;
                    const idMatch = applicableProductIds.includes(item.productId);
                    const catMatch = pData && applicableCategories.includes(pData.category);
                    return idMatch || catMatch;
                });
                if (!cartQualifies) throw new Error('This discount code is not valid for the items in your cart.');
            }

            if (discountData.type === 'percent') discountApplied = (itemsSubtotal * discountData.value) / 100;
            else if (discountData.type === 'fixed') discountApplied = discountData.value;
            else if (discountData.type === 'shipping') discountApplied = deliveryChargeApplied;
        }

        discountApplied = Math.min(chargeableTotal, discountApplied);
        const totalAmount = chargeableTotal - discountApplied;
        totalAmountResult = totalAmount;

        // D. WRITE PHASE
        // Decrement Stock
        productRefs.forEach((ref, i) => {
            transaction.update(ref, { stock: admin.firestore.FieldValue.increment(-standardItems[i].quantity) });
        });

        // Update Credit (if used)
        if (creditDoc) {
            const newRemaining = creditDoc.data().remainingValue - discountApplied;
            transaction.update(creditDoc.ref, {
                remainingValue: newRemaining,
                isActive: newRemaining > 0,
                usageHistory: admin.firestore.FieldValue.arrayUnion({
                    orderId: newOrderId,
                    amountUsed: discountApplied,
                    date: new Date()
                })
            });
        }

        // Update Discount Code usage (if used)
        if (discountDoc) {
            const discountUpdate = { usageCount: admin.firestore.FieldValue.increment(1) };
            if (customerEmailLower) {
                discountUpdate.usedByEmails = admin.firestore.FieldValue.arrayUnion(customerEmailLower);
            }
            transaction.update(discountDoc.ref, discountUpdate);
        }

        // Save Order
        transaction.set(newOrderRef, {
            ...orderPayload,
            id: newOrderId,
            userId: uid || null, // null = Guest
            isGuestOrder: !uid,
            items: itemsWithPrice,
            itemsSubtotal,
            deliveryChargeApplied,
            discountApplied,
            totalAmount,
            status: 'Pending',
            ...(paymentMethod ? { paymentMethod } : {}),
            ...(transactionId ? { transactionId } : {}),
            orderDate: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return { orderId: newOrderId, totalAmount: totalAmountResult };
}
