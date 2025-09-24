// FILE: public/admin.js (Definitive, Complete, Final, and Fully-Scrutinized Version)

const firebaseConfig = {
    apiKey: "AIzaSyBzU9YCpen0fJ12eGSnLeQGXsavSa9kX3w",
    authDomain: "luxury-hampers-app.firebaseapp.com",
    projectId: "luxury-hampers-app",
    storageBucket: "luxury-hampers-app.firebasestorage.app",
    messagingSenderId: "314612428903",
    appId: "1:314612428903:web:39c34c1d63e0aa818124c2"
};
firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const db = firebase.firestore();

function formatDate(dateSource) {
    if (!dateSource) return 'N/A';
    if (typeof dateSource === 'string') {
        const date = new Date(dateSource);
        if (!isNaN(date.getTime())) return date.toLocaleDateString();
    }
    if (typeof dateSource === 'object' && dateSource !== null && typeof dateSource._seconds === 'number') {
        return new Date(dateSource._seconds * 1000).toLocaleDateString();
    }
    const date = new Date(dateSource);
    return !isNaN(date.getTime()) ? date.toLocaleDateString() : 'N/A';
}

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE ---
    let allVouchers = [];
    let allProducts = [];
    let newOrderItems = [];
    let allReturns = [];
    let posAppliedDiscount = null;
    let currentOrderForCancellation = null;
    let confirmCallback = null;
    let notificationTimeout;
    window.currentOrders = [];

    // --- DOM ELEMENT CONSTANTS ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const adminSidebar = document.getElementById('admin-sidebar');
    const adminPages = document.querySelectorAll('.admin-page');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchTypeRadios = document.querySelectorAll('input[name="search-type"]');
    const resultsTable = document.getElementById('results-table');
    const resultsMessage = document.getElementById('results-message');
    const loader = document.getElementById('loader');
    const posProductGrid = document.getElementById('pos-product-grid');
    const orderItemsSummary = document.getElementById('order-items-summary');
    const notificationElement = document.getElementById('admin-notification');
    const notificationMessage = document.getElementById('admin-notification-message');
    const confirmModal = document.getElementById('admin-confirm-modal');
    const confirmMessage = document.getElementById('admin-confirm-message');
    const confirmOkBtn = document.getElementById('admin-confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('admin-confirm-cancel-btn');
    const cancelModal = document.getElementById('cancel-modal');
    const cancelModalTitle = document.getElementById('cancel-modal-title');
    const cancelModalBody = document.getElementById('cancel-modal-body');
    const cancellationForm = document.getElementById('cancellation-form');
    const closeCancelModalBtn = document.getElementById('close-cancel-modal-btn');
    const cancelSelectedBtn = document.getElementById('cancel-selected-btn');
    const cancelFullBtn = document.getElementById('cancel-full-btn');
    const cancelModalSpinner = document.getElementById('cancel-modal-spinner');
    const createOrderForm = document.getElementById('create-order-form');
    const creditModal = document.getElementById('issue-credit-modal');

    // --- AUTH LOGIC ---
    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().isAdmin === true) {
                    loginSection.classList.add('hidden');
                    dashboardSection.classList.remove('hidden');
                    populateProducts();
                    fetchAllReturns();
                    fetchAllVouchers();
                } else {
                    await fbAuth.signOut();
                    showAdminNotification('Access Denied. You do not have admin privileges.', true);
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                await fbAuth.signOut();
            }
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => fbAuth.signOut());
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fbAuth.signInWithEmailAndPassword(document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            if (loginError) loginError.textContent = 'Login failed. Please check your credentials.';
        }
    });

    // --- PAGE NAVIGATION LOGIC ---
    if (adminSidebar) adminSidebar.addEventListener('click', (e) => {
        if (e.target.matches('.admin-nav-link')) {
            e.preventDefault();
            const pageId = e.target.dataset.page;
            if (pageId === 'page-vouchers') {
            renderVouchersTable(allVouchers);
        }
            if (adminPages) adminPages.forEach(page => page.classList.toggle('hidden', page.id !== pageId));
            adminSidebar.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
            e.target.classList.add('active');
        }
    });

    // --- DATA FETCHING ---
    async function fetchAllVouchers() {
    if (!fbAuth.currentUser) return;
    try {
        const token = await fbAuth.currentUser.getIdToken();
        const response = await fetch('/api/get-all-vouchers', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch vouchers.');
        allVouchers = await response.json();
    } catch (error) {
        console.error("Failed to pre-fetch vouchers:", error);
    }
}

    async function fetchAllReturns() {
        if (!fbAuth.currentUser) return;
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/get-all-returns', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch returns.');
            allReturns = await response.json();
        } catch (error) {
            console.error("Failed to pre-fetch returns:", error);
            allReturns = [];
        }
    }

    async function populateProducts() {
        try {
            const response = await fetch('/api/products');
            allProducts = await response.json();
            if (posProductGrid) {
                posProductGrid.innerHTML = allProducts.map(p => `
                    <div class="pos-product-card" data-product-id="${p.id}">
                        <img src="${p.imageUrls ? p.imageUrls[0] : ''}" alt="${p.title}">
                        <h4 class="pos-product-title">${p.title}</h4>
                        <p class="pos-product-price">£${p.price.toFixed(2)}</p>
                    </div>`).join('');
            }
        } catch (error) {
            if (posProductGrid) posProductGrid.innerHTML = '<p>Could not load products.</p>';
        }
    }

    // --- SEARCH LOGIC ---
    if (searchTypeRadios) {
        searchTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (resultsTable) {
                    resultsTable.innerHTML = '';
                    resultsTable.classList.add('hidden');
                }
                if (searchInput) searchInput.value = '';
                if (resultsMessage) {
                    resultsMessage.textContent = 'Enter a search term to begin.';
                    resultsMessage.classList.remove('hidden');
                }
            });
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            const searchType = document.querySelector('input[name="search-type"]:checked').value;

            if (!query) {
                if (resultsMessage) resultsMessage.textContent = 'Please enter a search term.';
                return;
            }

            if (resultsMessage) resultsMessage.textContent = `Searching for ${searchType}...`;
            if (resultsTable) {
                resultsTable.innerHTML = '';
                resultsTable.classList.add('hidden');
            }
            if (loader) loader.classList.remove('hidden');

            try {
                if (!fbAuth.currentUser) throw new Error("Authentication error.");
                const token = await fbAuth.currentUser.getIdToken();

                if (searchType === 'orders') {
                    const isEmail = query.includes('@');
                    const searchParam = isEmail ? `email=${encodeURIComponent(query)}` : `orderId=${encodeURIComponent(query)}`;
                    const endpoint = `/api/find-order?${searchParam}`;
                    const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'API request failed.');
                    renderResults(data);
                } else {
                    const lowerCaseQuery = query.toLowerCase();
                    const filteredReturns = allReturns.filter(ret =>
                        (ret.id || '').toLowerCase().includes(lowerCaseQuery) ||
                        (ret.orderId || '').toLowerCase().includes(lowerCaseQuery) ||
                        (ret.customerEmail || '').toLowerCase().includes(lowerCaseQuery)
                    );
                    renderReturnsTable(filteredReturns);
                }
            } catch (error) {
                if (resultsMessage) resultsMessage.textContent = `Error: ${error.message}`;
            } finally {
                if (loader) loader.classList.add('hidden');
            }
        });
    }

    // --- LOGIC FOR VOUCHERS ---

    // This function builds the HTML table for the vouchers
function renderVouchersTable(vouchers) {
    const container = document.getElementById('vouchers-table-container');
    if (!container) return;

    let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued To</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
        </tr></thead><tbody class="divide-y divide-gray-200">`;

    vouchers.forEach(v => {
        const status = v.isActive ? (v.remainingValue < v.initialValue ? 'Partially Used' : 'Active') : 'Fully Used';
        const statusClass = v.isActive ? 'status-approved' : 'status-cancelled';
        tableHtml += `
            <tr>
                <td class="px-6 py-4 font-mono text-sm">${v.code}</td>
                <td class="px-6 py-4 text-sm">£${v.remainingValue.toFixed(2)} / £${v.initialValue.toFixed(2)}</td>
                <td class="px-6 py-4 text-sm">${v.customerEmail}</td>
                <td class="px-6 py-4 text-sm">${formatDate(v.creationDate)}</td>
                <td class="px-6 py-4 text-sm"><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="px-6 py-4 text-sm">${v.createdForReturnId || 'Stand-alone'}</td>
            </tr>`;
    });
    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

// This handles the new form for creating stand-alone vouchers
const standaloneForm = document.getElementById('create-standalone-voucher-form');
if(standaloneForm) {
    standaloneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('standalone-email').value;
        const value = document.getElementById('standalone-value').value;
        
        showAdminConfirm(`Generate a voucher for £${value} for ${email}?`, async () => {
            try {
                const token = await fbAuth.currentUser.getIdToken();
                const response = await fetch('/api/generate-store-credit', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerEmail: email, value: value }) // Note: no returnPath
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                showAdminNotification(`Success! Code ${result.code} created.`);
                standaloneForm.reset();
                await fetchAllVouchers(); // Refresh the data
                renderVouchersTable(allVouchers); // Re-render the table
            } catch(error) {
                showAdminNotification(`Error: ${error.message}`, true);
            }
        });
    });
}

    // --- MAIN EVENT LISTENER FOR DASHBOARD ACTIONS ---
    if (dashboardSection) {
        dashboardSection.addEventListener('click', async (e) => {
            const returnActionTarget = e.target.closest('.return-action-btn');
            const cancelOrderTarget = e.target.closest('.cancel-order-btn');
            const toggleTrackingTarget = e.target.closest('.toggle-tracking-btn');
            const saveTrackingTarget = e.target.closest('.save-tracking-btn');
            const issueCreditTarget = e.target.closest('.issue-credit-btn');
            const createReplacementTarget = e.target.closest('.create-replacement-btn');

            if (createReplacementTarget) {
                const { returnPath, customerName, customerEmail, returnId, value } = createReplacementTarget.dataset;

                showAdminConfirm(`This will generate a temporary, single-use voucher for £${parseFloat(value).toFixed(2)} and apply it to a new order. Proceed?`, async () => {
                    try {
            // STEP 1: Generate the unique, fixed-value voucher first.
                        const token = await fbAuth.currentUser.getIdToken();
                        const response = await fetch('/api/generate-store-credit', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ returnPath, value, customerEmail })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || result.details);
                        
                        const newVoucherCode = result.code; // The unique code for this replacement

                        // STEP 2: Now navigate to the POS and apply the new code.
                        document.querySelector('.admin-nav-link[data-page="page-pos"]').click();
                        document.getElementById('customer-name').value = customerName;
                        document.getElementById('customer-email').value = customerEmail;
                        
                        const discountInput = document.getElementById('pos-discount-input');
                        if (discountInput) {
                            discountInput.value = newVoucherCode;
                            document.getElementById('apply-discount-btn').click();
                        }

                        showAdminNotification(`Add replacement items. A credit of £${parseFloat(value).toFixed(2)} has been applied.`);
                        
                        // Refresh the main returns list in the background
                        await fetchAllReturns();
                        if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

                    } catch (error) {
                        showAdminNotification(`Failed to process replacement: ${error.message}`, true);
                    }
                });
                return;
            }

            if (issueCreditTarget) {
                const { returnId, returnPath, value, customerEmail } = issueCreditTarget.dataset;
                document.getElementById('modal-return-id').textContent = returnId;
                document.getElementById('modal-customer-email').textContent = customerEmail;
                document.getElementById('credit-value-input').value = parseFloat(value).toFixed(2);
                document.getElementById('modal-hidden-return-id').value = returnId;
                document.getElementById('modal-hidden-return-path').value = returnPath;
                document.getElementById('modal-hidden-customer-email').value = customerEmail;
                if (creditModal) creditModal.classList.remove('hidden');
                return;
            }

            if (returnActionTarget) {
                const target = returnActionTarget;
                target.disabled = true;
                if (target.parentElement) target.parentElement.querySelectorAll('button').forEach(btn => btn.disabled = true);
                target.textContent = 'Processing...';
                const { userId, returnId, orderId, action } = target.dataset;
                try {
                    const token = await fbAuth.currentUser.getIdToken();
                    await fetch('/api/update-return-status', { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ returnId, newStatus: action, orderId, userId }) });
                    const row = document.getElementById(`return-row-${returnId}`);
                    if (row) {
                        row.querySelector('.status-badge').textContent = action;
                        row.querySelector('td:last-child').innerHTML = `<span>${action}</span>`;
                    }
                    showAdminNotification('Return status updated successfully!');
                } catch (error) {
                    showAdminNotification(`Error: ${error.message}`, true);
                    target.disabled = false;
                    if (target.parentElement) target.parentElement.querySelectorAll('button').forEach(btn => btn.disabled = false);
                    target.textContent = action;
                }
                return;
            }

            if (cancelOrderTarget) {
                openCancellationModal(cancelOrderTarget.dataset.orderId);
                return;
            }

            if (toggleTrackingTarget) {
                const trackingForm = document.getElementById(`tracking-form-${toggleTrackingTarget.dataset.orderId}`);
                if (trackingForm) trackingForm.classList.toggle('hidden');
                return;
            }

            if (saveTrackingTarget) {
                const orderId = saveTrackingTarget.dataset.orderId;
                const row = document.getElementById(`order-row-${orderId}`);
                if (row) {
                    const courier = row.querySelector('.tracking-courier').value;
                    const trackingNumber = row.querySelector('.tracking-number').value;
                    if (trackingNumber) {
                        await updateOrderStatus(orderId, { newStatus: 'Shipped', trackingNumber, courier });
                        row.querySelector('.order-status-select').value = 'Shipped';
                        row.querySelector(`#tracking-form-${orderId}`).classList.add('hidden');
                    } else {
                        showAdminNotification('Please enter a tracking number.', true);
                    }
                }
                return;
            }
        });

        dashboardSection.addEventListener('change', (e) => {
            if (e.target.matches('.order-status-select')) {
                const orderId = e.target.dataset.orderId;
                const newStatus = e.target.value;
                const originalStatus = window.currentOrders.find(o => o.id === orderId)?.status;

                if (newStatus === 'Shipped') {
                    document.getElementById(`tracking-form-${orderId}`).classList.remove('hidden');
                    showAdminNotification('Add tracking details now and click "Save Tracking".');
                    e.target.value = originalStatus;
                    return;
                }

                if (newStatus === 'Cancelled' || newStatus === 'Partially Cancelled') {
                    const isCancellable = !['Shipped', 'Cancelled', 'Dispatched', 'Returned', 'Completed'].includes(originalStatus);
                    if (isCancellable) {
                        openCancellationModal(orderId);
                    } else {
                        showAdminNotification(`This order cannot be cancelled.`, true);
                    }
                    e.target.value = originalStatus;
                    return;
                }

                showAdminConfirm(`Change order status to "${newStatus}"?`,
                    () => updateOrderStatus(orderId, { newStatus }),
                    () => { e.target.value = originalStatus; }
                );
            }
        });
    }

    // --- VOUCHER MODAL LISTENER ---
    if (creditModal) creditModal.addEventListener('click', async (e) => {
        const generateBtn = e.target.closest('#modal-generate-btn');
        const cancelBtn = e.target.closest('#modal-cancel-btn');

        if (cancelBtn) {
            creditModal.classList.add('hidden');
        }

        if (generateBtn) {
            const returnPath = document.getElementById('modal-hidden-return-path').value;
            const customerEmail = document.getElementById('modal-hidden-customer-email').value;
            const value = document.getElementById('credit-value-input').value;

            if (!returnPath || !value || !customerEmail) {
                showAdminNotification('Data is missing. Please close and retry.', true);
                return;
            }

            const spinner = document.getElementById('credit-modal-spinner');
            if (spinner) spinner.classList.remove('hidden');
            if (generateBtn) generateBtn.disabled = true;

            try {
                const token = await fbAuth.currentUser.getIdToken();
                const response = await fetch('/api/generate-store-credit', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ returnPath, value, customerEmail })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || result.details || 'API error');

                creditModal.classList.add('hidden');
                showAdminNotification(`Success! Send this code to the customer: ${result.code}`);

                await fetchAllReturns();
                if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

            } catch (error) {
                showAdminNotification(`Error: ${error.message}`, true);
            } finally {
                if (spinner) spinner.classList.add('hidden');
                if (generateBtn) generateBtn.disabled = false;
            }
        }
    });

    // --- RENDER FUNCTIONS ---
    function renderResults(orders) {
    if (!resultsTable || !resultsMessage) return;

    if (!orders || orders.length === 0) {
        resultsMessage.textContent = 'No orders found.';
        resultsTable.classList.add('hidden');
        resultsMessage.classList.remove('hidden');
        window.currentOrders = [];
        return;
    }

    window.currentOrders = orders;
    const statuses = ['Pending', 'Processing', 'Dispatched', 'Shipped', 'Completed', 'Cancelled', 'Partially Cancelled', 'Returned'];
    
    let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Details</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fulfillment Status</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
        </tr></thead><tbody class="divide-y divide-gray-200">`;

    orders.forEach(order => {
        const isTerminalState = ['Cancelled', 'Returned', 'Completed', 'Partially Cancelled'].includes(order.status);
        const isCancellable = !isTerminalState && order.status !== 'Shipped' && order.status !== 'Dispatched';
        const isShippable = !isTerminalState;
        
        tableHtml += `
            <tr id="order-row-${order.id}">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${order.id}</div>
                    <div class="text-sm text-gray-500">${formatDate(order.orderDate)} - £${(order.totalAmount || 0).toFixed(2)}</div>
                    ${order.transactionId ? `<div class="text-xs text-gray-400 mt-1 font-mono">Trans. ID: ${order.transactionId}</div>` : ''}
                </td>
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${order.customerName}</div>
                    <div class="text-sm text-gray-500">${order.customerEmail}</div>
                </td>
                <td class="px-6 py-4">
                    <select class="order-status-select p-2 border border-gray-300 rounded-md w-full" data-order-id="${order.id}" ${isTerminalState ? 'disabled' : ''}>
                        ${statuses.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <div id="tracking-form-${order.id}" class="mt-2 space-y-2 hidden">
                        <select class="tracking-courier w-full p-2 border rounded-md"><option>Royal Mail</option><option>DPD</option><option>Evri</option></select>
                        <input type="text" class="tracking-number w-full p-2 border rounded-md" placeholder="Tracking Number">
                        <button class="save-tracking-btn text-white bg-blue-600 hover:bg-blue-700 text-xs font-medium px-3 py-1 rounded-md" data-order-id="${order.id}">Save Tracking</button>
                    </div>
                </td>
                <td class="px-6 py-4 space-x-4">
                    ${isShippable ? `<button class="toggle-tracking-btn text-blue-600 hover:text-blue-900 text-sm font-medium" data-order-id="${order.id}">Tracking</button>` : ''}
                    ${isCancellable ? `<button class="cancel-order-btn text-red-600 hover:text-red-900 text-sm font-medium" data-order-id="${order.id}">Cancel</button>` : ''}
                </td>
            </tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    resultsTable.innerHTML = tableHtml;
    resultsMessage.classList.add('hidden');
    resultsTable.classList.remove('hidden');
}

    function renderReturnsTable(returns) {
        if (!resultsTable || !resultsMessage) return;
        if (!returns || returns.length === 0) {
            resultsMessage.textContent = 'No return requests found.';
            resultsMessage.classList.remove('hidden');
            resultsTable.classList.add('hidden');
            return;
        }
        let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return & Order ID</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead><tbody class="divide-y divide-gray-200">`;
        returns.forEach(ret => {
            let actionButtons;
            if (ret.status !== 'Pending') {
                actionButtons = `<span>${ret.status}</span>`;
            } else {
                if (ret.desiredOutcome === 'Replacement') {
                    actionButtons = `
                        <button class="create-replacement-btn text-purple-600 hover:text-purple-900 text-sm font-medium mr-2" data-return-id="${ret.id}" data-return-path="${ret.returnPath}" data-value="${ret.refundAmount}" data-customer-name="${ret.customerName}" data-customer-email="${ret.customerEmail}">Create Replacement</button>
                        <button class="return-action-btn text-red-600 hover:text-red-900 text-sm font-medium" data-user-id="${ret.userId}" data-return-id="${ret.returnId}" data-order-id="${ret.orderId}" data-action="Rejected">Reject</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="return-action-btn text-green-600 hover:text-green-900 text-sm font-medium mr-2" data-user-id="${ret.userId}" data-return-id="${ret.returnId}" data-order-id="${ret.orderId}" data-action="Approved">Approve Direct Refund</button>
                        <button class="issue-credit-btn text-blue-600 hover:text-blue-900 text-sm font-medium mr-2" data-return-id="${ret.id}" data-return-path="${ret.returnPath}" data-value="${ret.refundAmount}" data-customer-email="${ret.customerEmail}">Issue Store Credit</button>
                        <button class="return-action-btn text-red-600 hover:text-red-900 text-sm font-medium" data-user-id="${ret.userId}" data-return-id="${ret.returnId}" data-order-id="${ret.orderId}" data-action="Rejected">Reject</button>
                    `;
                }
            }
            tableHtml += `
                <tr id="return-row-${ret.id}">
                    <td class="px-6 py-4"><div class="font-medium text-gray-900">${ret.id}</div><div class="text-xs text-gray-500">Order: ${ret.orderId}</div></td>
                    <td class="px-6 py-4">${ret.customerName}<br><span class="text-xs text-gray-500">${ret.customerEmail}</span></td>
                    <td class="px-6 py-4"><div>Requested: ${formatDate(ret.requestDate)}</div></td>
                    <td class="px-6 py-4 font-semibold">£${(ret.refundAmount || 0).toFixed(2)}</td>
                    <td class="px-6 py-4">${ret.desiredOutcome || 'N/A'}</td>
                    <td class="px-6 py-4"><span class="status-badge status-${(ret.status || '').toLowerCase().replace(/\s/g, '-')}">${ret.status}</span></td>
                    <td class="px-6 py-4">${actionButtons}</td>
                </tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        resultsTable.innerHTML = tableHtml;
        resultsMessage.classList.add('hidden');
        resultsTable.classList.remove('hidden');
    }

    // --- POS LOGIC ---
    if (posProductGrid) {
        posProductGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.pos-product-card');
            if (card) {
                const product = allProducts.find(p => p.id === card.dataset.productId);
                if (product) {
                    const existingItem = newOrderItems.find(item => item.id === product.id);
                    if (existingItem) existingItem.quantity++; else newOrderItems.push({ ...product, quantity: 1 });
                    updateOrderSummary();
                }
            }
        });
    }

    if (orderItemsSummary) {
        orderItemsSummary.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                newOrderItems.splice(e.target.dataset.index, 1);
                updateOrderSummary();
            }
        });
    }
    // ADD this entire block to admin.js
if (orderItemsSummary) {
    orderItemsSummary.addEventListener('click', (e) => {
        const decreaseBtn = e.target.closest('.decrease-pos-qty');
        const increaseBtn = e.target.closest('.increase-pos-qty');
        
        if (decreaseBtn || increaseBtn) {
            const productId = decreaseBtn ? decreaseBtn.dataset.productId : increaseBtn.dataset.productId;
            const item = newOrderItems.find(i => i.id === productId);

            if (item) {
                if (decreaseBtn) {
                    item.quantity--;
                    if (item.quantity === 0) {
                        newOrderItems = newOrderItems.filter(i => i.id !== productId);
                    }
                } else if (increaseBtn) {
                    item.quantity++;
                }
                updateOrderSummary();
            }
        }
    });
}
  // REPLACE your entire updateOrderSummary function in admin.js



  function updateOrderSummary() {
        if (!orderItemsSummary) return;
        const itemsSubtotal = newOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let deliveryChargeApplied = itemsSubtotal > 0 && itemsSubtotal < 50 ? 4.99 : 0;
        if (posAppliedDiscount && posAppliedDiscount.code && posAppliedDiscount.code.startsWith('RET-')) {
            if (Array.isArray(posAppliedDiscount.usageHistory) && posAppliedDiscount.usageHistory.length === 0) {
                deliveryChargeApplied = 0;
            }
        }
        let discountAmount = 0;
        const warningMessageEl = document.getElementById('pos-warning-message');
        if (warningMessageEl) warningMessageEl.classList.add('hidden');
        const chargeableTotal = itemsSubtotal + deliveryChargeApplied;
        if (posAppliedDiscount) {
            if (posAppliedDiscount.type === 'percent') {
                discountAmount = (chargeableTotal * posAppliedDiscount.value) / 100;
            } else if (posAppliedDiscount.type === 'fixed' || posAppliedDiscount.type === 'store_credit') {
                discountAmount = Math.min(chargeableTotal, posAppliedDiscount.value);
            }
            document.getElementById('pos-discount-row').classList.remove('hidden');
            document.getElementById('pos-discount-code').textContent = posAppliedDiscount.code;
            document.getElementById('pos-discount-amount').textContent = `-£${discountAmount.toFixed(2)}`;
            if (posAppliedDiscount.type === 'store_credit' && chargeableTotal > posAppliedDiscount.value) {
                if (warningMessageEl) {
                    const balanceDue = chargeableTotal - posAppliedDiscount.value;
                    warningMessageEl.textContent = `Order exceeds voucher value. Balance of £${balanceDue.toFixed(2)} will be due.`;
                    warningMessageEl.classList.remove('hidden');
                }
            }
        } else {
            document.getElementById('pos-discount-row').classList.add('hidden');
        }
        const finalTotal = chargeableTotal - discountAmount;
        document.getElementById('order-subtotal').textContent = `£${itemsSubtotal.toFixed(2)}`;
        document.getElementById('order-delivery').textContent = `£${deliveryChargeApplied.toFixed(2)}`;
        document.getElementById('order-total').textContent = `£${finalTotal.toFixed(2)}`;
        const createOrderBtn = document.querySelector('#create-order-form button[type="submit"]');
        if (createOrderBtn) {
            if (finalTotal > 0) {
                createOrderBtn.textContent = `Charge £${finalTotal.toFixed(2)} & Create Order`;
                createOrderBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                createOrderBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            } else {
                createOrderBtn.textContent = 'Create Order';
                createOrderBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                createOrderBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }
        }
        if (newOrderItems.length === 0) {
            orderItemsSummary.innerHTML = '<p class="text-gray-500">Click a product to add it to the order.</p>';
        } else {
            orderItemsSummary.innerHTML = `<ul class="divide-y divide-gray-200">${newOrderItems.map((item, index) => `
                <li class="py-2 flex justify-between items-center">
                    <div class="flex-grow">
                        <span>${item.title}</span>
                        <div class="flex items-center mt-1">
                            <button class="quantity-btn-pos decrease-pos-qty" data-product-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                            <span class="px-3 text-sm font-medium w-8 text-center">${item.quantity}</span>
                            <button class="quantity-btn-pos increase-pos-qty" data-product-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <span class="font-medium">£${(item.price * item.quantity).toFixed(2)}</span>
                    <button type="button" class="remove-item-btn" data-index="${index}" title="Remove item"><i class="fa-solid fa-trash-can"></i></button>
                </li>`).join('')}</ul>`;
        }
    }


    const applyDiscountBtn = document.getElementById('apply-discount-btn');
    if (applyDiscountBtn) {
        applyDiscountBtn.addEventListener('click', async () => {
            const codeInput = document.getElementById('pos-discount-input');
            const messageEl = document.getElementById('pos-discount-message');
            const code = codeInput.value.trim();
            if (!code) {
                posAppliedDiscount = null;
                if (messageEl) messageEl.textContent = '';
                updateOrderSummary();
                return;
            }
            try {
                const response = await fetch(`/api/validate-discount?code=${code}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                posAppliedDiscount = result;
                if (messageEl) {
                    messageEl.textContent = `Success: "${result.description}" applied!`;
                    messageEl.style.color = 'green';
                }
            } catch (error) {
                posAppliedDiscount = null;
                if (messageEl) {
                    messageEl.textContent = `Error: ${error.message}`;
                    messageEl.style.color = 'red';
                }
            }
            updateOrderSummary();
        });
    }

    if (createOrderForm) {
    createOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (newOrderItems.length === 0) {
            return showAdminNotification('Please add at least one item to the order.', true);
        }

        const paymentMethod = document.getElementById('payment-type').value;
        const transactionId = document.getElementById('transaction-id').value.trim();
        const totalAmountText = document.getElementById('order-total').textContent;
        const totalAmount = parseFloat(totalAmountText.replace('£', ''));

        // --- NEW VALIDATION LOGIC ---
        if (totalAmount > 0 && (paymentMethod === 'External Card Reader' || paymentMethod === 'Card (Phone Payment)')) {
            if (!transactionId || transactionId.length < 5) {
                return showAdminNotification('For card payments with a balance due, a valid Transaction ID is required.', true);
            }
        }
        // --- END OF NEW LOGIC ---

        const payload = {
            customerDetails: { name: document.getElementById('customer-name').value, email: document.getElementById('customer-email').value },
            deliveryAddress: { fullName: document.getElementById('customer-name').value, addressLine1: document.getElementById('delivery-address').value, postcode: document.getElementById('delivery-postcode').value, city: '', country: 'UK' },
            items: newOrderItems,
            paymentMethod: paymentMethod,
            appliedDiscount: posAppliedDiscount,
            transactionId: transactionId // We added this field to the payload
        };
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/create-admin-order', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showAdminNotification(result.message);
            createOrderForm.reset();
            document.getElementById('transaction-id').value = ''; // Also clear the new field
            newOrderItems = [];
            posAppliedDiscount = null;
            updateOrderSummary();
        } catch (error) {
            showAdminNotification(`Error: ${error.message}`, true);
        }
    });
}

    // --- CANCELLATION & OTHER MODALS ---
    function openCancellationModal(orderId) {
        currentOrderForCancellation = window.currentOrders.find(o => o.id === orderId);
        if (currentOrderForCancellation && cancelModal) {
            cancelModalTitle.textContent = `Cancel Order #${currentOrderForCancellation.id}`;
            const modalPrompt = cancelModalBody.querySelector('p');
            if (currentOrderForCancellation.items.length === 1) {
                modalPrompt.textContent = 'This order only contains one item.';
                cancellationForm.innerHTML = '';
                cancelSelectedBtn.style.display = 'none';
                cancelFullBtn.style.display = 'inline-block';
            } else {
                modalPrompt.textContent = 'Select items for a partial cancellation.';
                cancellationForm.innerHTML = currentOrderForCancellation.items.map(item => `<div class="flex items-center mb-2"><input id="item-${item.productId}" type="checkbox" value="${item.productId}" data-quantity="${item.quantity}" class="h-4 w-4"><label for="item-${item.productId}" class="ml-2">${item.title} (Qty: ${item.quantity})</label></div>`).join('');
                cancelSelectedBtn.style.display = 'inline-block';
                cancelFullBtn.style.display = 'inline-block';
                validateCancellationButtons();
            }
            cancelModal.classList.remove('hidden');
        }
    }

    function validateCancellationButtons() {
        if (!currentOrderForCancellation || currentOrderForCancellation.items.length <= 1 || !cancellationForm || !cancelSelectedBtn) return;
        const hasSelection = cancellationForm.querySelectorAll('input:checked').length > 0;
        cancelSelectedBtn.disabled = !hasSelection;
    }

    async function performCancellation(payload) {
        if (cancelModalSpinner) cancelModalSpinner.classList.remove('hidden');
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/cancel-order', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Cancellation failed.');
            const row = document.getElementById(`order-row-${payload.orderId}`);
            if(row) {
                const statusSelect = row.querySelector('.order-status-select');
                const actionCell = row.querySelector('td:last-child');
                const newStatus = (payload.itemsToCancel && payload.itemsToCancel.length > 0) ? 'Partially Cancelled' : 'Cancelled';
                if (statusSelect) {
                    statusSelect.value = newStatus;
                    statusSelect.disabled = true;
                }
                if (actionCell) actionCell.innerHTML = `<span class="text-gray-400">—</span>`;
            }
            showAdminNotification('Order updated successfully!');
            if(cancelModal) cancelModal.classList.add('hidden');
        } catch (error) {
            showAdminNotification(`Error: ${error.message}`, true);
        } finally {
            if (cancelModalSpinner) cancelModalSpinner.classList.add('hidden');
        }
    }

    if(confirmOkBtn) confirmOkBtn.addEventListener('click', () => { if (typeof confirmCallback === 'function') confirmCallback(); if(confirmModal) confirmModal.classList.add('hidden'); });
    if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => { if (confirmCancelBtn.onclick) confirmCancelBtn.onclick(); if(confirmModal) confirmModal.classList.add('hidden'); });
    if(closeCancelModalBtn) closeCancelModalBtn.addEventListener('click', () => { if(cancelModal) cancelModal.classList.add('hidden'); currentOrderForCancellation = null; });
    if(cancelSelectedBtn) cancelSelectedBtn.addEventListener('click', () => {
        const selectedItems = Array.from(cancellationForm.querySelectorAll('input:checked')).map(cb => ({ productId: cb.value, quantity: parseInt(cb.dataset.quantity, 10) }));
        if (selectedItems.length > 0) performCancellation({ orderId: currentOrderForCancellation.id, itemsToCancel: selectedItems });
    });
    if(cancelFullBtn) cancelFullBtn.addEventListener('click', () => showAdminConfirm('Are you sure you want to cancel the entire order?', () => performCancellation({ orderId: currentOrderForCancellation.id, itemsToCancel: [] })));
    if(cancellationForm) cancellationForm.addEventListener('change', validateCancellationButtons);

    function showAdminNotification(message, isError = false) {
        if (!notificationElement || !notificationMessage) return;
        clearTimeout(notificationTimeout);
        notificationMessage.textContent = message;
        notificationElement.className = 'p-4 rounded-md shadow-lg text-white text-sm font-semibold';
        notificationElement.classList.add(isError ? 'error' : 'success', 'show');
        notificationTimeout = setTimeout(() => { notificationElement.classList.remove('show'); }, 3000);
    }

    function showAdminConfirm(message, callback, cancelCallback = null) {
        if (!confirmMessage || !confirmModal || !confirmCancelBtn) return;
        confirmMessage.textContent = message;
        confirmCallback = callback;
        confirmModal.classList.remove('hidden');
        confirmCancelBtn.onclick = () => { if (typeof cancelCallback === 'function') cancelCallback(); confirmModal.classList.add('hidden'); };
    }
    
    async function updateOrderStatus(orderId, updatePayload) {
        if (!fbAuth.currentUser) return;
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/update-order-status', { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, ...updatePayload }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showAdminNotification(result.message);
        } catch (error) {
            showAdminNotification(`Error: ${error.message}`, true);
        }
    }
});