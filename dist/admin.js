// FILE: public/admin.js (Complete, Consolidated, and Corrected - Final Version)

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const db = firebase.firestore();

// --- HELPER FUNCTIONS ---
function formatDate(dateSource) {
    if (!dateSource) return 'N/A';
    const date = new Date(dateSource._seconds ? dateSource._seconds * 1000 : dateSource);
    return !isNaN(date.getTime()) ? date.toLocaleDateString() : 'N/A';
}

function showAdminNotification(message, isError = false) {
    const notificationElement = document.getElementById('admin-notification');
    const notificationMessage = document.getElementById('admin-notification-message');
    if (!notificationElement || !notificationMessage) return;

    clearTimeout(window.notificationTimeout);
    notificationMessage.textContent = message;
    notificationElement.className = 'p-4 rounded-md shadow-lg text-white text-sm font-semibold';
    notificationElement.classList.add(isError ? 'error' : 'success', 'show');
    window.notificationTimeout = setTimeout(() => { notificationElement.classList.remove('show'); }, 3000);
}

function showAdminConfirm(message, callback) {
    const confirmModal = document.getElementById('admin-confirm-modal');
    const confirmMessage = document.getElementById('admin-confirm-message');
    const confirmOkBtn = document.getElementById('admin-confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('admin-confirm-cancel-btn');

    if (!confirmMessage || !confirmModal || !confirmOkBtn || !confirmCancelBtn) return;
    confirmMessage.textContent = message;
    confirmOkBtn.onclick = () => { if (typeof callback === 'function') callback(); confirmModal.classList.add('hidden'); };
    confirmCancelBtn.onclick = () => { confirmModal.classList.add('hidden'); };
    confirmModal.classList.remove('hidden');
}
function addDeliveryInfoSectionInputs(container, sectionData = {}, index) {
    const sectionDiv = document.createElement('div');
    // Added mb-6 for spacing between sections
    sectionDiv.className = 'delivery-info-section form-section p-4 border rounded-md bg-gray-50 mb-6';
    sectionDiv.dataset.index = index;

    sectionDiv.innerHTML = `
        <h4 class="font-medium text-sm mb-3 text-gray-600">Section ${index + 1}</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-group">
                <label for="delivery-section-title-${index}" class="block text-xs font-medium text-gray-700">Section Title</label>
                <input type="text" id="delivery-section-title-${index}" value="${sectionData.title || ''}" required placeholder="e.g., Standard UK Delivery" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div class="form-group">
                <label for="delivery-section-icon-${index}" class="block text-xs font-medium text-gray-700">Icon Name (e.g., truckFast)</label>
                <input type="text" id="delivery-section-icon-${index}" value="${sectionData.iconName || ''}" placeholder="truckFast" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
        </div>
        <div class="form-group mt-4">
            <label for="delivery-section-content-${index}" class="block text-xs font-medium text-gray-700">Section Content</label>
            <textarea id="delivery-section-content-${index}" rows="5" required placeholder="Enter details..." class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">${sectionData.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-delivery-info-section-btn mt-3 text-xs">
            <i class="fa-solid fa-trash-can"></i> Remove Section
        </button>
    `;
    container.appendChild(sectionDiv);

    // Update count display
    const countEl = document.getElementById('delivery-section-count');
    if (countEl) countEl.textContent = container.querySelectorAll('.delivery-info-section').length;

    // Attach remove listener to the newly created button
    sectionDiv.querySelector('.remove-delivery-info-section-btn').addEventListener('click', () => {
        sectionDiv.remove();
        // Re-update count and labels after removal
        const remainingSections = container.querySelectorAll('.delivery-info-section');
        if (countEl) countEl.textContent = remainingSections.length;
        remainingSections.forEach((sec, newIndex) => {
             sec.dataset.index = newIndex;
             sec.querySelector('h4').textContent = `Section ${newIndex + 1}`;
             // Update IDs if necessary (less critical now with querySelectors based on parent)
             sec.querySelector('label[for^="delivery-section-title-"]').setAttribute('for', `delivery-section-title-${newIndex}`);
             sec.querySelector('input[id^="delivery-section-title-"]').id = `delivery-section-title-${newIndex}`;
             sec.querySelector('label[for^="delivery-section-icon-"]').setAttribute('for', `delivery-section-icon-${newIndex}`);
             sec.querySelector('input[id^="delivery-section-icon-"]').id = `delivery-section-icon-${newIndex}`;
             sec.querySelector('label[for^="delivery-section-content-"]').setAttribute('for', `delivery-section-content-${newIndex}`);
             sec.querySelector('textarea[id^="delivery-section-content-"]').id = `delivery-section-content-${newIndex}`;
        });
    });
}
// FILE: admin.js

async function renderAdminAboutUsPage() {
    console.log("--- renderAdminAboutUsPage STARTED ---");
    const form = document.getElementById('about-us-form');
    // Use the corrected ID based on the HTML file provided
    const titleInput = document.getElementById('about-us-title-input');
    const sectionsContainer = document.getElementById('about-us-sections-container');
    const addSectionBtn = document.getElementById('add-about-us-section-btn');
    const saveStatus = document.getElementById('about-us-save-status');
    const countSpan = null; // No count span defined for About Us sections in HTML

    // Ensure essential elements exist before proceeding
    if (!form || !titleInput || !sectionsContainer || !addSectionBtn || !saveStatus) {
        console.error("renderAdminAboutUsPage: Could not find one or more required form elements. Aborting.");
        // Optionally display an error message in the UI
        if (document.getElementById('page-admin-about-us')) {
             document.getElementById('page-admin-about-us').innerHTML = `<p class="text-red-500 p-4">Error: UI elements missing for About Us editor.</p>`;
        }
        return;
    }

    // Clear previous state and show loading
    sectionsContainer.innerHTML = '<p class="text-gray-500">Loading sections...</p>';
    saveStatus.textContent = '';
    titleInput.value = ''; // Clear title while loading

    // Fetch current content
    try {
        // Fetch data using the corrected API path
        const data = await fetchAdminAPI('/api/admin/about_us');
        titleInput.value = data.pageTitle || 'About Us';
        sectionsContainer.innerHTML = ''; // Clear loading message

        if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, index) => addSectionInputs(sectionsContainer, section, index));
        } else {
            // Add one default empty section if none exist
            addSectionInputs(sectionsContainer, { title: '', content: '' }, 0);
        }
        // No count update needed for About Us

    } catch (error) {
        console.error("Error loading About Us content:", error);
        sectionsContainer.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    // --- Event Listeners (using .onclick/.onsubmit for simplicity) ---

    // Add Section Button
    addSectionBtn.onclick = () => {
        // Use querySelectorAll on the container to get the current count reliably
        const newIndex = sectionsContainer.querySelectorAll('.about-us-section').length;
        addSectionInputs(sectionsContainer, { title: '', content: '' }, newIndex);
    };

    // Form Submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true); // Ensure setButtonLoading exists

        const sectionsData = [];
        const sectionDivs = sectionsContainer.querySelectorAll('.about-us-section');
        sectionDivs.forEach((div) => {
            const sectionTitleInput = div.querySelector(`input[id^="about-section-title-"]`);
            const sectionContentInput = div.querySelector(`textarea[id^="about-section-content-"]`);
            if (sectionTitleInput && sectionContentInput) {
                 const sectionTitle = sectionTitleInput.value.trim();
                 const sectionContent = sectionContentInput.value.trim();
                // Only save sections that have at least a title or content
                if (sectionTitle || sectionContent) {
                    sectionsData.push({ title: sectionTitle, content: sectionContent });
                }
            } else {
                console.warn("Could not find title or content input in an about-us-section div:", div);
            }
        });

         // Add a check for minimum content before saving
        if (sectionsData.length === 0 || !titleInput.value.trim()) {
             saveStatus.textContent = 'Error: Page Title and at least one section are required.';
             setButtonLoading(submitBtn, false);
             return;
        }

        try {
            // Use the corrected API path
            const response = await fetchAdminAPI('/api/admin/about_us', {
                method: 'POST',
                body: JSON.stringify({
                    pageTitle: titleInput.value,
                    sections: sectionsData
                })
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving About Us content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminAboutUsPage FINISHED ---");
}
// --- MAIN APPLICATION LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE ---
    let globalSearchTags = { dietary: [], occasion: [], contents: [] };
    let allProducts = [];
    let allComponents = [];
    let allReturns = [];
    let allVouchers = [];
    let newOrderItems = [];
    let currentHamperContents = [];
    let currentEditMode = 'product';
    let posAppliedDiscount = null;
    let currentOrderForCancellation = null;
    let replacementContext = null;
    window.currentOrders = [];

    // --- DOM ELEMENT CONSTANTS ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const adminSidebar = document.getElementById('admin-sidebar');
    const adminPages = document.querySelectorAll('.admin-page');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchTypeRadios = document.querySelectorAll('input[name="search-type"]');
    const resultsTable = document.getElementById('results-table');
    const resultsMessage = document.getElementById('results-message');
    const loader = document.getElementById('loader');
    const posProductGrid = document.getElementById('pos-product-grid');
    const orderItemsSummary = document.getElementById('order-items-summary');
    const cancelModal = document.getElementById('cancel-modal');
    const cancelModalTitle = document.getElementById('cancel-modal-title');
    const cancelModalBody = document.getElementById('cancel-modal-body');
    const cancellationForm = document.getElementById('cancellation-form');
    const closeCancelModalBtn = document.getElementById('close-cancel-modal-btn');
    const cancelSelectedBtn = document.getElementById('cancel-selected-btn');
    const cancelFullBtn = document.getElementById('cancel-full-btn');
    const cancelModalSpinner = document.getElementById('cancel-modal-spinner');
    const creditModal = document.getElementById('issue-credit-modal');
    const createOrderForm = document.getElementById('create-order-form');
    const standaloneForm = document.getElementById('create-standalone-voucher-form');
    const printBtn = document.getElementById('print-picking-list-btn');
    const pickingListFilterBtn = document.getElementById('picking-list-filter-btn');
    const fulfillmentPage = document.getElementById('page-fulfillment');
    const applyDiscountBtn = document.getElementById('apply-discount-btn');
    const confirmOkBtn = document.getElementById('admin-confirm-ok-btn');
    

    // --- AUTHENTICATION & INITIALIZATION ---
    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().isAdmin === true) {
                    loginSection.classList.add('hidden');
                    dashboardSection.classList.remove('hidden');
                    // Check for replacement context in sessionStorage on login
                    const storedContext = sessionStorage.getItem('replacementContext');
                    if (storedContext) {
                        replacementContext = JSON.parse(storedContext);
                        sessionStorage.removeItem('replacementContext');
                    }
                    await Promise.all([
                        populateProducts(),
                        populateComponents(),
                        fetchAllReturns(),
                        fetchAllVouchers(),
                        populateMenuEditor(),
                        (async () => {
        try {
            const settings = await fetchAdminAPI('/api/admin/site_settings');
            globalSearchTags.dietary = settings.tags_dietary || [];
            globalSearchTags.occasion = settings.tags_occasion || [];
            globalSearchTags.contents = settings.tags_contents || [];
        } catch(e) { console.error("Failed to load initial tags", e); }
    })()
                    ]);
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
    function validateMenuJSON() {
    const editorElement = document.getElementById('menu-json-editor');
    const saveBtn = document.getElementById('save-menu-btn');
    const errorEl = document.getElementById('menu-json-error');

    // Ensure CodeMirror instance exists before proceeding
    if (!editorElement || !editorElement.cmInstance || !saveBtn || !errorEl) return;

    const jsonString = editorElement.cmInstance.getValue(); // Get value from CodeMirror

    try {
        JSON.parse(jsonString);
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
        saveBtn.disabled = false;
        saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        saveBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    } catch (error) {
        errorEl.textContent = `⚠️ ${error.message}`;
        errorEl.classList.remove('hidden');
        saveBtn.disabled = true;
        saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        saveBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    }
}
    // --- DATA FETCHING FUNCTIONS ---
    async function populateProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Could not fetch products');
            allProducts = await response.json();
            if (posProductGrid) {
                posProductGrid.innerHTML = allProducts.map(p => `<div class="pos-product-card" data-product-id="${p.id}"><img src="${p.imageUrls ? p.imageUrls[0] : ''}" alt="${p.title}"><h4 class="pos-product-title">${p.title}</h4><p class="pos-product-price">£${p.price.toFixed(2)}</p></div>`).join('');
            }
        } catch (error) {
            showAdminNotification(error.message, true);
            if (posProductGrid) posProductGrid.innerHTML = '<p>Could not load products.</p>';
        }
    }
    async function renderSearchTagsPage() {
    console.log("--- renderSearchTagsPage STARTED ---");
    
    // 1. Fetch current settings (which will hold our tags)
    try {
        const settings = await fetchAdminAPI('/api/admin/site_settings');
        // Load into global variable, default to empty arrays if undefined
        globalSearchTags.dietary = settings.tags_dietary || [];
        globalSearchTags.occasion = settings.tags_occasion || [];
        globalSearchTags.contents = settings.tags_contents || [];
        
        renderTagLists();
    } catch (error) {
        showAdminNotification("Error loading tags: " + error.message, true);
    }
    
    // 2. Render the lists in the UI
    function renderTagLists() {
        ['dietary', 'occasion', 'contents'].forEach(category => {
            const listEl = document.getElementById(`list-tags-${category}`);
            listEl.innerHTML = globalSearchTags[category].map(tag => `
                <li class="flex justify-between items-center bg-white p-2 border rounded">
                    <span>${tag}</span>
                    <button class="text-red-500 hover:text-red-700 delete-tag-btn" data-category="${category}" data-tag="${tag}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </li>
            `).join('');
        });
    }

    // 3. Event Listeners for Adding
    document.querySelectorAll('.add-tag-btn').forEach(btn => {
        btn.onclick = () => {
            const category = btn.dataset.category;
            const input = document.getElementById(`new-tag-${category}`);
            const val = input.value.trim();
            if (val && !globalSearchTags[category].includes(val)) {
                globalSearchTags[category].push(val);
                input.value = '';
                renderTagLists();
            }
        };
    });

    // 4. Event Listeners for Deleting (Delegated)
    document.getElementById('tags-management-container').onclick = (e) => {
        const btn = e.target.closest('.delete-tag-btn');
        if (btn) {
            const { category, tag } = btn.dataset;
            globalSearchTags[category] = globalSearchTags[category].filter(t => t !== tag);
            renderTagLists();
        }
    };

    // 5. Save Button
    document.getElementById('save-tags-btn').onclick = async () => {
        const btn = document.getElementById('save-tags-btn');
        setButtonLoading(btn, true);
        try {
            // We save these into the existing site_settings endpoint
            // First get current settings to avoid overwriting other fields
            const currentSettings = await fetchAdminAPI('/api/admin/site_settings');
            
            const payload = {
                ...currentSettings,
                tags_dietary: globalSearchTags.dietary,
                tags_occasion: globalSearchTags.occasion,
                tags_contents: globalSearchTags.contents
            };

            await fetchAdminAPI('/api/admin/site_settings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showAdminNotification("Tags saved successfully!");
        } catch (error) {
            showAdminNotification("Error saving tags: " + error.message, true);
        } finally {
            setButtonLoading(btn, false);
        }
    };
}
    async function populateComponents() {
        try {
            const response = await fetch('/api/hamper-components');
            if (!response.ok) throw new Error('Could not fetch components');
            allComponents = await response.json();
        } catch (error) {
            showAdminNotification(error.message, true);
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

      // --- FULFILLMENT CENTER & NAVIGATION LOGIC (v2.0) ---
let fulfillmentDateRange = { startDate: '', endDate: '' };

async function showPickingList() {
    let apiUrl = '/api/picking-list';
    const params = new URLSearchParams();
    if (fulfillmentDateRange.startDate) params.append('startDate', fulfillmentDateRange.startDate);
    if (fulfillmentDateRange.endDate) params.append('endDate', fulfillmentDateRange.endDate);
    if (params.toString()) apiUrl += `?${params.toString()}`;
    try {
        const token = await fbAuth.currentUser.getIdToken();
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch picking list');
        const items = await response.json();
        renderPickingList(items);
    } catch (error) {
        showAdminNotification(error.message, true);
    }
}
// Add this helper function inside admin.js
function renderDynamicProductTags(product = null) {
    const container = document.getElementById('product-tags-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear previous

    // Ensure we have the latest tags (if page loaded directly to products)
    // If globalSearchTags is empty, we might need to fetch, but usually dashboard loads settings first.
    
    ['dietary', 'occasion', 'contents'].forEach(category => {
        const wrapper = document.createElement('div');
        wrapper.className = "bg-gray-50 p-3 rounded border";
        
        const title = category.charAt(0).toUpperCase() + category.slice(1);
        let html = `<h5 class="font-medium text-sm mb-2 text-gray-700">${title}</h5>`;
        html += `<div class="space-y-1 max-h-32 overflow-y-auto text-sm">`;
        
        const availableTags = globalSearchTags[category] || [];
        
        if (availableTags.length === 0) {
            html += `<p class="text-xs text-gray-400 italic">No tags created in settings.</p>`;
        } else {
            availableTags.forEach(tag => {
                // Check if the product already has this tag
                let isChecked = false;
                if (product) {
                    // Handle different naming conventions just in case (e.g. dietaryTags vs tags_dietary)
                    const productTags = product[`${category}Tags`] || [];
                    isChecked = productTags.includes(tag);
                }
                
                html += `
                    <label class="flex items-center">
                        <input type="checkbox" name="product-tag-${category}" value="${tag}" ${isChecked ? 'checked' : ''} class="mr-2"> 
                        ${tag}
                    </label>
                `;
            });
        }
        html += `</div>`;
        wrapper.innerHTML = html;
        container.appendChild(wrapper);
    });
}

// UPDATE your existing openProductModal function:
function openProductModal(item = null) {
    // ... existing setup code ...
    
    // CALL THE NEW FUNCTION HERE:
    renderDynamicProductTags(item);
    
    // ... rest of your existing code ...
}
async function showOrdersToPack() {
    const showAll = document.getElementById('pack-show-all-toggle')?.checked || false;
    let apiUrl = '/api/get-unshipped-orders';
    const params = new URLSearchParams();
    if (!showAll) {
        if (fulfillmentDateRange.startDate) params.append('startDate', fulfillmentDateRange.startDate);
        if (fulfillmentDateRange.endDate) params.append('endDate', fulfillmentDateRange.endDate);
    }
    if (params.toString()) apiUrl += `?${params.toString()}`;
    try {
        const token = await fbAuth.currentUser.getIdToken();
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch unshipped orders');
        const orders = await response.json();
        window.currentOrders = orders;
        renderOrdersToPack(orders);
    } catch (error) {
        showAdminNotification(error.message, true);
        renderOrdersToPack([]);
    }
}


// FILE: admin.js

// FILE: admin.js

if (adminSidebar) {
    adminSidebar.addEventListener('click', async (e) => {
        
        // --- NEW: Accordion Logic ---
        const parentLink = e.target.closest('.admin-nav-link-parent');
        if (parentLink) {
            e.preventDefault();
            e.stopPropagation();
            const submenu = parentLink.nextElementSibling;
            
            if (submenu && submenu.classList.contains('admin-submenu')) {
                submenu.classList.toggle('hidden');
                parentLink.classList.toggle('open');
            }
            return; // Stop here, don't try to navigate
        }
        
        // --- Existing Page Navigation Logic ---
        const link = e.target.closest('.admin-nav-link');
        if (link) {
            e.preventDefault();
            e.stopPropagation();
            const pageId = link.dataset.page;
            console.log(`[Sidebar Click] Clicked link for pageId: ${pageId}`);

            // This object now includes all your pages
            const pageRenderers = {
                'page-admin-about-us': renderAdminAboutUsPage,
                'page-admin-our-mission': renderAdminOurMissionPage,
                'page-admin-privacy-policy': renderAdminPrivacyPolicyPage,
                'page-admin-terms-conditions': renderAdminTermsConditionsPage,
                'page-admin-contact-us': renderAdminContactUsPage,
                'page-admin-settings': renderAdminSiteSettingsPage,
                'page-admin-faqs': renderAdminFaqsPage,
                'page-admin-delivery-info': renderAdminDeliveryInfoPage,
                'page-products': () => renderProductsTable(allProducts),
                'page-components': () => renderComponentsTable(allComponents),
                'page-vouchers': () => renderVouchersTable(allVouchers),
                'page-fulfillment': () => { showPickingList(); showOrdersToPack(); },
                'page-menu': populateMenuEditor, 
                'page-admin-footer': renderAdminFooterPage,
                'page-admin-tags': renderSearchTagsPage,
            };

            // --- Show Page Logic (No changes) ---
            console.log(`[Sidebar Click] Setting display style for all pages except: ${pageId}`);
            let targetFoundAndDisplayed = false;
            adminPages.forEach(page => {
                if (page.id === pageId) {
                    page.style.display = 'block';
                    targetFoundAndDisplayed = true;
                } else {
                    page.style.display = 'none';
                }
            });

            if (!targetFoundAndDisplayed) {
                console.error(`[Sidebar Click] CRITICAL ERROR: Could not find page div with ID '${pageId}' to display.`);
            } else {
                console.log("[Sidebar Click] Display styles set.");
            }
            
            // --- Update Active Link Logic (Modified) ---
            adminSidebar.querySelectorAll('.admin-nav-link').forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            console.log("[Sidebar Click] Active link updated.");

            // --- NEW: Also open parent accordion if child is clicked ---
            // and close other accordions
            adminSidebar.querySelectorAll('.admin-nav-link-parent').forEach(parent => {
                const submenu = parent.nextElementSibling;
                if (submenu && submenu.contains(link)) {
                    // This is the parent of the clicked link
                    parent.classList.add('open');
                    submenu.classList.remove('hidden');
                } else if (submenu) {
                    // This is a different accordion
                    parent.classList.remove('open');
                    submenu.classList.add('hidden');
                }
            });

            // --- Fetch Content Logic (No changes) ---
            const renderFunction = pageRenderers[pageId];
            if (renderFunction) {
                console.log(`[Sidebar Click] Attempting render function for ${pageId}...`);
                try {
                    await renderFunction(); 
                    console.log(`[Sidebar Click] Render function for ${pageId} finished.`);
                } catch (error) {
                    console.error(`[Sidebar Click] ERROR in render function for ${pageId}:`, error);
                    const targetPageDiv = document.getElementById(pageId);
                    if(targetPageDiv) targetPageDiv.innerHTML = `<p class="text-red-500 p-4">Error loading content: ${error.message}</p>`;
                }
            } else {
                console.log(`[Sidebar Click] No specific render function for ${pageId}.`);
            }
        }
    });
}

if (pickingListFilterBtn) {
    pickingListFilterBtn.addEventListener('click', () => {
        fulfillmentDateRange.startDate = document.getElementById('picking-list-start-date').value;
        fulfillmentDateRange.endDate = document.getElementById('picking-list-end-date').value;
        showPickingList();
        showOrdersToPack();
    });
}

const printPickingListBtn = document.getElementById('print-picking-list-btn');
if (printPickingListBtn) {
    printPickingListBtn.addEventListener('click', () => {
        window.print();
    });
}

const packingTab = document.getElementById('tab-content-packing');
if (packingTab) {
    // Check if the toggle already exists before adding it to prevent duplicates
    if (!document.getElementById('pack-show-all-toggle')) {
        const showAllToggle = document.createElement('div');
        showAllToggle.className = 'flex items-center mb-4';
        showAllToggle.innerHTML = `<input id="pack-show-all-toggle" type="checkbox" class="h-4 w-4 rounded"><label for="pack-show-all-toggle" class="ml-2 text-sm font-medium">Override date filter and show all unshipped orders</label>`;
        packingTab.insertBefore(showAllToggle, packingTab.children[1]);
        document.getElementById('pack-show-all-toggle').addEventListener('change', showOrdersToPack);
    }
}

if (fulfillmentPage) {
    fulfillmentPage.addEventListener('click', (e) => {
        if (e.target.matches('.fulfillment-tab')) {
            const tabId = e.target.dataset.tab;
            
            fulfillmentPage.querySelectorAll('.fulfillment-tab').forEach(tab => {
                tab.classList.remove('border-blue-500', 'text-blue-600');
                tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            e.target.classList.add('border-blue-500', 'text-blue-600');
            e.target.classList.remove('border-transparent', 'text-gray-500');

            fulfillmentPage.querySelectorAll('.fulfillment-tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== `tab-content-${tabId}`);
            });
        }
    });
}


    // --- UI RENDERING & PAGE DISPLAY FUNCTIONS ---
    function renderProductsTable(products) {
        const container = document.getElementById('products-table-container');
        if (!container) return;
        let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead><tbody class="divide-y divide-gray-200">`;
        products.forEach(p => {
            const status = p.isActive === false ? 'Disabled' : 'Active';
            const statusClass = p.isActive === false ? 'status-cancelled' : 'status-approved';
            const hamperBadge = p.isHamper === true ? '<span class="hamper-badge">Hamper</span>' : '';
            tableHtml += `<tr id="product-row-${p.id}"><td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="flex-shrink-0 h-10 w-10"><img class="h-10 w-10 rounded-full object-cover" src="${p.imageUrls ? p.imageUrls[0] : ''}" alt=""></div><div class="ml-4"><div class="text-sm font-medium text-gray-900">${p.title} ${hamperBadge}</div></div></div></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.category}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">£${p.price.toFixed(2)}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${p.stock}</td><td class="px-6 py-4 whitespace-nowrap"><span class="status-badge ${statusClass}">${status}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium"><button class="edit-product-btn text-blue-600 hover:text-blue-900 mr-4" data-product-id="${p.id}">Edit</button><button class="delete-product-btn text-red-600 hover:text-red-900" data-product-id="${p.id}">Delete</button></td></tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;
    }

    function renderComponentsTable(components) {
        const container = document.getElementById('components-table-container');
        if (!container) return;
        let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead><tbody class="divide-y divide-gray-200">`;
        components.forEach(c => {
            tableHtml += `<tr id="component-row-${c.id}"><td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="flex-shrink-0 h-10 w-10"><img class="h-10 w-10 rounded-full object-cover" src="${c.imageUrl1 || ''}" alt=""></div><div class="ml-4"><div class="text-sm font-medium text-gray-900">${c.name}</div></div></div></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">£${(c.price || 0).toFixed(2)}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium"><button class="edit-component-btn text-blue-600 hover:text-blue-900 mr-4" data-component-id="${c.id}">Edit</button><button class="delete-component-btn text-red-600 hover:text-red-900" data-component-id="${c.id}">Delete</button></td></tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;
    }

    // REPLACE THE ENTIRE renderVouchersTable FUNCTION WITH THIS:
function renderVouchersTable(vouchers) {
    console.log("--- STARTING DIAGNOSTIC RENDER ---");
    const container = document.getElementById('vouchers-table-container');
    if (!container) return;

    if (!Array.isArray(vouchers) || vouchers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm p-4">No vouchers found.</p>';
        return;
    }

    let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued To</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th></tr></thead><tbody class="divide-y divide-gray-200">`;

    vouchers.forEach((v, index) => {
        let currentValDisplay = "ERROR";
        let initialValDisplay = "ERROR";
        let status = "Unknown";
        let statusClass = "status-cancelled";

        try {
            // --- DEEP TEST LOGIC ---
            if (typeof v.remainingValue === 'undefined' || v.remainingValue === null) {
                console.error(`🚨 DATA CORRUPTION FOUND: Voucher at Index ${index} (Code: ${v.code || 'UNKNOWN'}) is missing 'remainingValue'.`, v);
                v.remainingValue = 0; // Temporary fix to allow render
            }
            if (typeof v.initialValue === 'undefined' || v.initialValue === null) {
                console.error(`🚨 DATA CORRUPTION FOUND: Voucher at Index ${index} (Code: ${v.code || 'UNKNOWN'}) is missing 'initialValue'.`, v);
                v.initialValue = 0; // Temporary fix to allow render
            }

            // Safe formatting
            currentValDisplay = Number(v.remainingValue).toFixed(2);
            initialValDisplay = Number(v.initialValue).toFixed(2);

            const isActive = v.isActive === true;
            status = isActive ? (v.remainingValue < v.initialValue ? 'Partially Used' : 'Active') : 'Fully Used';
            statusClass = isActive ? 'status-approved' : 'status-cancelled';

        } catch (err) {
            console.error(`💥 CRITICAL ERROR on Voucher ${v.code}:`, err);
        }

        tableHtml += `<tr>
            <td class="px-6 py-4 font-mono text-sm">${v.code || 'MISSING CODE'}</td>
            <td class="px-6 py-4 text-sm">£${currentValDisplay} / £${initialValDisplay}</td>
            <td class="px-6 py-4 text-sm">${v.customerEmail || 'No Email'}</td>
            <td class="px-6 py-4 text-sm">${formatDate(v.creationDate)}</td>
            <td class="px-6 py-4 text-sm"><span class="status-badge ${statusClass}">${status}</span></td>
            <td class="px-6 py-4 text-sm">${v.createdForReturnId || 'Stand-alone'}</td>
        </tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
    console.log("--- DIAGNOSTIC RENDER COMPLETE ---");
}

    function renderPickingList(items) {
    const container = document.getElementById('picking-list-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No items to pick for the selected criteria.</p>';
        return;
    }

    let tableHtml = `<div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-50"><tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Dates</th>
        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total to Pick</th>
        </tr></thead><tbody class="divide-y divide-gray-200">`;

    items.forEach(item => {
        const typeClass = item.type === 'Component' ? 'hamper-badge' : 'status-badge status-approved';
        
        // Convert ISO date strings back into Date objects for comparison
        const dateObjects = item.dates.map(d => new Date(d));
        const minDate = new Date(Math.min.apply(null, dateObjects));
        const maxDate = new Date(Math.max.apply(null, dateObjects));
        const dateString = minDate.toLocaleDateString() === maxDate.toLocaleDateString() 
            ? minDate.toLocaleDateString() 
            : `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

        tableHtml += `
            <tr>
                <td class="px-6 py-4 font-medium">${item.name || 'Unnamed Item'}</td>
                <td class="px-6 py-4"><span class="${typeClass}">${item.type}</span></td>
                <td class="px-6 py-4 text-sm text-gray-500">${dateString}</td>
                <td class="px-6 py-4 text-center text-xl font-bold">${item.totalQuantity}</td>
            </tr>`;
    });
    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

    function renderOrdersToPack(orders) {
    const container = document.getElementById('pack-orders-container');
    const countBadge = document.getElementById('pack-order-count');
    if (!container || !countBadge) return;
    countBadge.textContent = `${orders.length} Orders`;
    if (orders.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 py-8">No orders are currently waiting for packing.</p>'; return; }

    container.innerHTML = orders.map(order => {
        const subtotal = order.itemsSubtotal || order.totalAmount, discount = order.discountApplied || 0, totalCharged = order.totalAmount, hasDiscount = discount > 0;
        let priceHtml = `<p class="data-card-title">£${totalCharged.toFixed(2)}</p>`;
        if (hasDiscount) { priceHtml = `<div class="price-breakdown"><p class="price-subtotal">£${subtotal.toFixed(2)}</p><p class="price-discount">- £${discount.toFixed(2)}</p><p class="data-card-title price-total">£${totalCharged.toFixed(2)}</p></div>`; }

        // --- THIS IS THE UPGRADE ---
        const replacementBadge = order.isReplacement 
            ? `<p class="replacement-badge">↳ Replaces Return #${order.replacesReturnId} (from Order #${order.originalOrderId})</p>` 
            : '';

        return `<div class="data-card" id="pack-order-${order.docId}"><div class="data-card-header"><div><p class="data-card-title">Order #${order.id}</p><p class="data-card-subtitle">Customer: ${order.customerName}</p>${replacementBadge}</div><div class="text-right">${priceHtml}<span class="order-status status-${order.status.toLowerCase()}">${order.status}</span></div></div><div class="data-card-actions"><button class="packing-slip-btn text-blue-600 hover:text-blue-900 font-medium" data-order-id="${order.docId}">View Packing Slip</button><button class="mark-packed-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded" data-order-id="${order.docId}">Mark as Packed</button></div></div>`;
    }).join('');
}

    function openProductModal(item = null) {
        if (!productModal || !productForm) return;
        if (item) {
            currentEditMode = item.hasOwnProperty('stock') ? 'product' : 'component';
        }
        const isComponentMode = (currentEditMode === 'component');
        productForm.reset();
        document.getElementById('product-form-error').classList.add('hidden');
        document.getElementById('product-id-input').value = '';
        currentHamperContents = [];
        const productSpecificRequiredFields = ['product-stock-input', 'product-category-input'];
        const productFields = ['product-bullets-input', 'product-description-input', 'product-stock-input', 'product-category-input', 'product-tag-input', 'product-active-toggle', 'product-hamper-toggle'];
        productFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.parentElement) el.parentElement.style.display = isComponentMode ? 'none' : 'block';
                if (productSpecificRequiredFields.includes(id)) el.required = !isComponentMode;
            }
        });
        document.getElementById('hamper-contents-section').style.display = 'none';
        const hamperProductSelect = document.getElementById('hamper-product-select');
        if (hamperProductSelect) {
            hamperProductSelect.innerHTML = allComponents.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if (item) {
            document.getElementById('product-modal-title').textContent = isComponentMode ? 'Edit Component' : 'Edit Product';
            document.getElementById('product-id-input').value = item.id;
            document.getElementById('product-title-input').value = item.title || item.name || '';
            document.getElementById('product-price-input').value = item.price;
            document.getElementById('product-images-input').value = (item.imageUrls || [item.imageUrl1] || []).filter(Boolean).join(', ');
            if (!isComponentMode) {
                document.getElementById('product-active-toggle').checked = item.isActive !== false;
                document.getElementById('product-hamper-toggle').checked = item.isHamper === true;
                document.getElementById('product-stock-input').value = item.stock;
                document.getElementById('product-category-input').value = item.category || '';
                // --- REPLACEMENT: Populate New Tag Inputs ---
                // Note: We use 'product-tag' now instead of 'product-tag-input' to match your new HTML
                document.getElementById('product-tag').value = item.tag || ''; 
                
                document.getElementById('product-dietary-tags').value = (item.dietaryTags && Array.isArray(item.dietaryTags)) ? item.dietaryTags.join(', ') : '';
                document.getElementById('product-occasion-tags').value = (item.occasionTags && Array.isArray(item.occasionTags)) ? item.occasionTags.join(', ') : '';
                document.getElementById('product-contents-tags').value = (item.contentsTags && Array.isArray(item.contentsTags)) ? item.contentsTags.join(', ') : '';
                // --------------------------------------------
                let bulletsValue = '';
                if (item.description) bulletsValue = Array.isArray(item.description) ? item.description.join('\n') : item.description;
                document.getElementById('product-bullets-input').value = bulletsValue;
                document.getElementById('product-description-input').value = item.professionalDescription || '';

                document.getElementById('product-saleprice-input').value = item.salePrice || '';
                document.getElementById('product-rating-input').value = item.rating || '';
                document.getElementById('product-reviewcount-input').value = item.reviewCount || '';

                if (item.isHamper && Array.isArray(item.hamperContents)) {
                    currentHamperContents = item.hamperContents.map(contentItem => {
                        const componentData = allComponents.find(c => c.id === contentItem.productId);
                        return { ...contentItem, title: componentData ? componentData.name : 'Unknown Component' };
                    });
                }
            }
        } else {
            document.getElementById('product-modal-title').textContent = isComponentMode ? 'Create New Component' : 'Create New Product';
            if (!isComponentMode) document.getElementById('product-active-toggle').checked = true;
        }
        if (!isComponentMode) {
            const hamperSection = document.getElementById('hamper-contents-section');
            const isHamper = document.getElementById('product-hamper-toggle').checked;
            hamperSection.style.display = isHamper ? 'block' : 'none';
            renderHamperContentsList();
            // 🔴 ADD THIS LINE HERE:
        // This function (which we added to admin.js earlier) fills the HTML container 
        if (typeof renderDynamicProductTags === 'function') {
            renderDynamicProductTags(item);
        }
        }
        productModal.classList.remove('hidden');
    }

    function renderHamperContentsList() {
        const listContainer = document.getElementById('hamper-items-list');
        if (!listContainer) return;
        if (currentHamperContents.length === 0) {
            listContainer.innerHTML = '<p class="text-sm text-gray-500">No items added yet.</p>';
            return;
        }
        listContainer.innerHTML = currentHamperContents.map(item => `<div class="flex justify-between items-center p-2 bg-gray-100 rounded-md"><span>${item.title} (Qty: ${item.quantity})</span><button type="button" class="remove-hamper-item-btn text-red-500 hover:text-red-700" data-product-id="${item.productId}">Remove</button></div>`).join('');
    }

    // REPLACEMENT for renderResults function
    // REPLACEMENT for renderResults function
    function renderResults(orders) {
        if (!resultsTable || !resultsMessage) return;
        if (!orders || orders.length === 0) {
            resultsMessage.textContent = 'No orders found.';
            resultsTable.innerHTML = '';
            resultsTable.classList.add('hidden');
            resultsMessage.classList.remove('hidden');
            window.currentOrders = [];
            return;
        }
        window.currentOrders = orders;

        let resultsHtml = `<div class="order-card-list">`;
        orders.forEach(order => {
            const statusClass = (order.status || 'pending').toLowerCase().replace(/\s/g, '-');
            resultsHtml += `
                <div class="order-card" data-doc-id="${order.docId}" data-order-id="${order.id}">
                    <div class="order-card-header">
                        <div class="order-card-header-cell">
                            <p class="order-id">${order.id}</p>
                            <p class="order-date">${formatDate(order.orderDate)}</p>
                        </div>
                        <div class="order-card-header-cell">
                            <p>${order.customerName}</p>
                            <p class="text-sm text-gray-500">${order.customerEmail}</p>
                        </div>
                        <div class="order-card-header-cell">
                            <span class="status-badge status-${statusClass}">${order.status || 'Pending'}</span>
                        </div>
                        <div class="order-card-header-cell text-right">
                            <p class="font-semibold text-lg">£${(order.totalAmount || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="order-card-details">
                        <div class="text-center py-4"><div class="spinner"></div></div>
                    </div>
                </div>
            `;
        });
        resultsHtml += `</div>`;

        resultsTable.innerHTML = resultsHtml;
        resultsMessage.classList.add('hidden');
        resultsTable.classList.remove('hidden');
    }

    // FILE: public/admin.js

// Replace the old populateMenuEditor function with this one
// FILE: public/admin.js

// Replace the old populateMenuEditor function with this one
async function populateMenuEditor() {
    try {
        const response = await fetch('/data/Header_nav.json');
        if (!response.ok) throw new Error('Could not fetch menu data.');
        const menuData = await response.json();
        const editorElement = document.getElementById('menu-json-editor');

        if (editorElement) {
            // If the CodeMirror instance doesn't exist yet, create it.
            if (!editorElement.cmInstance) {
                const editor = CodeMirror.fromTextArea(editorElement, {
                    lineNumbers: true,         // <-- Adds line numbers
                    mode: "application/json",  // <-- Adds JSON syntax highlighting
                    theme: "default",
                    lineWrapping: true
                });
                editor.on('change', validateMenuJSON); // <-- Adds live validation on every change
                editorElement.cmInstance = editor; // Store instance on the element
            }

            // Set the value and perform initial validation
            editorElement.cmInstance.setValue(JSON.stringify(menuData, null, 2));
            validateMenuJSON();
        }
    } catch (error) {
        showAdminNotification(error.message, true);
    }
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
                // --- THIS IS THE FIX: Use ret.docId for the return ID ---
                const actionButtonData = `data-user-id="${ret.userId}" data-return-id="${ret.docId}" data-order-id="${ret.orderId}"`;

                if (ret.desiredOutcome === 'Replacement') {
                    actionButtons = `<button class="create-replacement-btn text-purple-600 hover:text-purple-900 text-sm font-medium mr-2" data-return-id="${ret.id}" data-return-path="${ret.returnPath}" data-value="${ret.refundAmount}" data-customer-name="${ret.customerName}" data-customer-email="${ret.customerEmail}">Create Replacement</button><button class="return-action-btn text-red-600 hover:text-red-900 text-sm font-medium" ${actionButtonData} data-action="Rejected">Reject</button>`;
                } else {
                    actionButtons = `<button class="return-action-btn text-green-600 hover:text-green-900 text-sm font-medium mr-2" ${actionButtonData} data-action="Approved">Approve</button><button class="issue-credit-btn text-blue-600 hover:text-blue-900 text-sm font-medium mr-2" data-return-id="${ret.id}" data-return-path="${ret.returnPath}" data-value="${ret.refundAmount}" data-customer-email="${ret.customerEmail}">Issue Credit</button><button class="return-action-btn text-red-600 hover:text-red-900 text-sm font-medium" ${actionButtonData} data-action="Rejected">Reject</button>`;
                }
            }
            tableHtml += `<tr id="return-row-${ret.docId}"><td class="px-6 py-4"><div class="font-medium text-gray-900">${ret.id}</div><div class="text-xs text-gray-500">Order: ${ret.orderId}</div></td><td class="px-6 py-4">${ret.customerName}<br><span class="text-xs text-gray-500">${ret.customerEmail}</span></td><td class="px-6 py-4"><div>Requested: ${formatDate(ret.requestDate)}</div></td><td class="px-6 py-4 font-semibold">£${(ret.refundAmount || 0).toFixed(2)}</td><td class="px-6 py-4">${ret.desiredOutcome || 'N/A'}</td><td class="px-6 py-4"><span class="status-badge status-${(ret.status || '').toLowerCase().replace(/\s/g, '-')}">${ret.status}</span></td><td class="px-6 py-4">${actionButtons}</td></tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        resultsTable.innerHTML = tableHtml;
        resultsMessage.classList.add('hidden');
        resultsTable.classList.remove('hidden');
    }

    async function showPackingSlip(orderId) {
    const modal = document.getElementById('packing-slip-modal');
    if (!modal) return;

    document.getElementById('slip-order-id').textContent = 'Loading...';
    modal.classList.remove('hidden');

    try {
        const token = await fbAuth.currentUser.getIdToken();
        const apiUrl = `/api/order-details?orderId=${orderId}`;
        
        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const order = await response.json();

        // Populate the slip with the fetched data
        document.getElementById('slip-order-id').textContent = order.id;
        document.getElementById('slip-order-date').textContent = formatDate(order.orderDate);
        document.getElementById('slip-customer-name').textContent = order.customerName;
        document.getElementById('slip-order-value').textContent = `£${order.totalAmount.toFixed(2)}`;
        
        const itemsTableBody = document.getElementById('slip-items-table');
        itemsTableBody.innerHTML = order.items.map(item => `
            <tr class="border-b">
                <td class="px-4 py-3">${item.title}</td>
                <td class="px-4 py-3 text-center font-bold text-lg">${item.quantity}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Packing slip fetch failed:', error);
        showAdminNotification(error.message, true);
        modal.classList.add('hidden');
    }
}

    function openCancellationModal(orderId) {
        currentOrderForCancellation = window.currentOrders.find(o => o.docId === orderId);
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
    
    // FILE: public/admin.js

async function performCancellation(payload) {
    if (cancelModalSpinner) cancelModalSpinner.classList.remove('hidden');
    try {
        const token = await fbAuth.currentUser.getIdToken();
        const response = await fetch('/api/cancel-order', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Cancellation failed.');

        // --- THIS IS THE FIX ---
        // Instead of looking for a table row, we now find the correct order card.
        const card = document.querySelector(`.order-card[data-doc-id="${payload.orderId}"]`);
        if (card) {
            const newStatus = (payload.itemsToCancel && payload.itemsToCancel.length > 0) ? 'Partially Cancelled' : 'Cancelled';
            const newStatusClass = newStatus.toLowerCase().replace(/\s/g, '-');
            
            // 1. Update the status badge in the card's header
            const headerBadge = card.querySelector('.order-card-header .status-badge');
            if (headerBadge) {
                headerBadge.textContent = newStatus;
                headerBadge.className = `status-badge status-${newStatusClass}`;
            }

            // 2. If the details are loaded, update the controls inside as well
            const details = card.querySelector('.order-card-details');
            if (details && details.dataset.loaded) {
                const statusSelect = details.querySelector('.order-status-select');
                if (statusSelect) {
                    statusSelect.value = newStatus;
                    statusSelect.disabled = true;
                }
                const cancelButton = details.querySelector('.cancel-order-btn');
                if (cancelButton) {
                    cancelButton.remove(); // Remove the button as it's no longer cancellable
                }
            }
        }
        
        showAdminNotification('Order updated successfully!');
        if (cancelModal) cancelModal.classList.add('hidden');
    } catch (error) {
        showAdminNotification(`Error: ${error.message}`, true);
    } finally {
        if (cancelModalSpinner) cancelModalSpinner.classList.add('hidden');
    }
}

    function validateCancellationButtons() {
        if (!currentOrderForCancellation || currentOrderForCancellation.items.length <= 1 || !cancellationForm || !cancelSelectedBtn) return;
        const hasSelection = cancellationForm.querySelectorAll('input:checked').length > 0;
        cancelSelectedBtn.disabled = !hasSelection;
    }

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
            orderItemsSummary.innerHTML = `<ul class="divide-y divide-gray-200">${newOrderItems.map((item, index) => `<li class="py-2 flex justify-between items-center"><div class="flex-grow"><span>${item.title}</span><div class="flex items-center mt-1"><button class="quantity-btn-pos decrease-pos-qty" data-product-id="${item.id}"><i class="fa-solid fa-minus"></i></button><span class="px-3 text-sm font-medium w-8 text-center">${item.quantity}</span><button class="quantity-btn-pos increase-pos-qty" data-product-id="${item.id}"><i class="fa-solid fa-plus"></i></button></div></div><span class="font-medium">£${(item.price * item.quantity).toFixed(2)}</span><button type="button" class="remove-item-btn" data-index="${index}" title="Remove item"><i class="fa-solid fa-trash-can"></i></button></li>`).join('')}</ul>`;
        }
    }

    // --- EVENT LISTENERS ---
    if (logoutBtn) logoutBtn.addEventListener('click', () => fbAuth.signOut());
    if (loginForm) loginForm.addEventListener('submit', async (e) => { e.preventDefault(); try { await fbAuth.signInWithEmailAndPassword(document.getElementById('email').value, document.getElementById('password').value); } catch (error) { if (loginError) loginError.textContent = 'Login failed.'; }});
    
    

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productFormSpinner = document.getElementById('product-form-spinner');
            const productFormError = document.getElementById('product-form-error');
            productFormSpinner.classList.remove('hidden');
            productFormError.classList.add('hidden');
            document.getElementById('product-save-btn').disabled = true;
            const id = document.getElementById('product-id-input').value;
            const isEditing = !!id;
            let payload = {};
            if (currentEditMode === 'component') {
                payload = { title: document.getElementById('product-title-input').value, price: parseFloat(document.getElementById('product-price-input').value), imageUrls: document.getElementById('product-images-input').value.split(',').map(url => url.trim()).filter(Boolean) };
            } else {
                const descriptionBullets = document.getElementById('product-bullets-input').value.split('\n').map(line => line.trim()).filter(Boolean);
                const isHamper = document.getElementById('product-hamper-toggle').checked;
                payload = { title: document.getElementById('product-title-input').value, description: descriptionBullets, professionalDescription: document.getElementById('product-description-input').value, price: parseFloat(document.getElementById('product-price-input').value), salePrice: parseFloat(document.getElementById('product-saleprice-input').value) || null, rating: parseFloat(document.getElementById('product-rating-input').value) || null, reviewCount: parseInt(document.getElementById('product-reviewcount-input').value, 10) || 0, stock: parseInt(document.getElementById('product-stock-input').value, 10), category: document.getElementById('product-category-input').value, tag: '', imageUrls: document.getElementById('product-images-input').value.split(',').map(url => url.trim()).filter(Boolean), isActive: document.getElementById('product-active-toggle').checked, isHamper: isHamper };
                if (isHamper) payload.hamperContents = currentHamperContents.map(({ productId, quantity }) => ({ productId, quantity }));
            }
           // --- NEW TAG PARSING LOGIC (Comma Separated) ---
                const parseTags = (val) => val ? val.split(',').map(t => t.trim()).filter(t => t !== '') : [];

                // Overwrite the 'tag' field from the payload because the ID changed in HTML
                payload.tag = document.getElementById('product-tag').value;

                // Add the 3 new arrays
                payload.dietaryTags = parseTags(document.getElementById('product-dietary-tags').value);
                payload.occasionTags = parseTags(document.getElementById('product-occasion-tags').value);
                payload.contentsTags = parseTags(document.getElementById('product-contents-tags').value);
                // -----------------------------------------------
                // -------------------------------------
            try {
                const token = await fbAuth.currentUser.getIdToken();
                const apiUrl = currentEditMode === 'component' ? `/api/hamper-components?id=${id}` : `/api/products?id=${id}`;
                const method = isEditing ? 'PUT' : 'POST';
                const response = await fetch(apiUrl, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to save.');
                if (currentEditMode === 'component') {
                    await populateComponents();
                    renderComponentsTable(allComponents);
                } else {
                    await populateProducts();
                    renderProductsTable(allProducts);
                }
                productModal.classList.add('hidden');
                showAdminNotification(`${currentEditMode === 'component' ? 'Component' : 'Product'} saved successfully!`);
            } catch (error) {
                productFormError.textContent = error.message;
                productFormError.classList.remove('hidden');
            } finally {
                productFormSpinner.classList.add('hidden');
                document.getElementById('product-save-btn').disabled = false;
            }
        });
    }

// Listeners for the Packing Slip Modal buttons
const closePackingSlipBtn = document.getElementById('close-packing-slip-modal-btn');
const printPackingSlipBtn = document.getElementById('print-packing-slip-btn');

if (closePackingSlipBtn) {
    closePackingSlipBtn.addEventListener('click', () => {
        const modal = document.getElementById('packing-slip-modal');
        if (modal) modal.classList.add('hidden');
    });
}

if (printPackingSlipBtn) {
    printPackingSlipBtn.addEventListener('click', () => {
        window.print();
    });
}

    document.getElementById('product-modal-cancel-btn')?.addEventListener('click', () => { if (productModal) productModal.classList.add('hidden'); });
    const hamperToggle = document.getElementById('product-hamper-toggle');
    const hamperSection = document.getElementById('hamper-contents-section');
    if (hamperToggle && hamperSection) { hamperToggle.addEventListener('change', () => { hamperSection.style.display = hamperToggle.checked ? 'block' : 'none'; }); }
    const addHamperItemBtn = document.getElementById('add-hamper-item-btn');
    if (addHamperItemBtn) { addHamperItemBtn.addEventListener('click', () => { const productSelect = document.getElementById('hamper-product-select'); const quantityInput = document.getElementById('hamper-quantity-input'); const componentId = productSelect.value; const componentData = allComponents.find(c => c.id === componentId); const title = componentData ? componentData.name : 'Unknown'; const quantity = parseInt(quantityInput.value, 10); if (!componentId || !title || isNaN(quantity) || quantity < 1) return showAdminNotification('Invalid component or quantity.', true); const existingItem = currentHamperContents.find(item => item.productId === componentId); if (existingItem) { existingItem.quantity += quantity; } else { currentHamperContents.push({ productId: componentId, title: title, quantity: quantity }); } renderHamperContentsList(); quantityInput.value = 1; }); }
    const hamperItemsList = document.getElementById('hamper-items-list');
    if (hamperItemsList) { hamperItemsList.addEventListener('click', (e) => { if (e.target.classList.contains('remove-hamper-item-btn')) { const productIdToRemove = e.target.dataset.productId; currentHamperContents = currentHamperContents.filter(item => item.productId !== productIdToRemove); renderHamperContentsList(); } }); }

    if (dashboardSection) {
        dashboardSection.addEventListener('click', async (e) => {
            const createProductBtn = e.target.closest('#create-product-btn');
            if (createProductBtn) { currentEditMode = 'product'; openProductModal(); return; }
            const editProductBtn = e.target.closest('.edit-product-btn');
            if (editProductBtn) { currentEditMode = 'product'; const product = allProducts.find(p => p.id === editProductBtn.dataset.productId); openProductModal(product); return; }
            const deleteProductBtn = e.target.closest('.delete-product-btn');
            if (deleteProductBtn) { const productId = deleteProductBtn.dataset.productId; const product = allProducts.find(p => p.id === productId); if (!product) return; showAdminConfirm(`Are you sure you want to archive "${product.title}"?`, async () => { const token = await fbAuth.currentUser.getIdToken(); await fetch(`/api/products?id=${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); await populateProducts(); renderProductsTable(allProducts); showAdminNotification('Product archived successfully!'); }); return; }
            const createComponentBtn = e.target.closest('#create-component-btn');
            if (createComponentBtn) { currentEditMode = 'component'; openProductModal(); return; }
            const editComponentBtn = e.target.closest('.edit-component-btn');
            if (editComponentBtn) { currentEditMode = 'component'; const component = allComponents.find(c => c.id === editComponentBtn.dataset.componentId); openProductModal(component); return; }
            const deleteComponentBtn = e.target.closest('.delete-component-btn');
            // FINAL, INTEGRATED REPLACEMENT for the order card click handler
// FILE: public/admin.js

const orderCardHeader = e.target.closest('.order-card-header');
if (orderCardHeader) {
    const card = orderCardHeader.closest('.order-card');
    const details = card.querySelector('.order-card-details');
    const isExpanded = card.classList.contains('expanded');

    card.classList.toggle('expanded');

    if (!isExpanded && !details.dataset.loaded) {
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const orderDocId = card.dataset.docId;
            const orderShortId = card.dataset.orderId;

            const response = await fetch(`/api/rich-order-details?orderId=${orderShortId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch rich order details.');

            const richOrder = await response.json();

            // --- All your logic below is correct ---
            const statuses = ['Pending', 'Processing', 'Packed', 'Dispatched', 'Shipped', 'Completed', 'Cancelled', 'Partially Cancelled', 'Returned'];
            const isTerminalState = ['Cancelled', 'Returned', 'Completed', 'Partially Cancelled', 'Shipped'].includes(richOrder.status);
            const isCancellable = !isTerminalState && richOrder.status !== 'Dispatched';
            
            let replacementBannerHtml = '';
            if (richOrder.isReplacement && richOrder.originalOrderId) {
                replacementBannerHtml = `
                    <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-semibold p-3 rounded-md mb-6">
                        <i class="fas fa-info-circle mr-2"></i>
                        This is a replacement for order #${richOrder.originalOrderId} (Return #${richOrder.replacesReturnId}).
                    </div>
                `;
            }

            let replacementsIssuedHtml = '';
            if (richOrder.replacementOrders && richOrder.replacementOrders.length > 0) {
                const replacementLinks = richOrder.replacementOrders.map(o => `<li>Replacement Order #${o.id}</li>`).join('');
                replacementsIssuedHtml = `
                    <div class="detail-section">
                        <h4>Replacements Issued</h4>
                        <ul class="detail-item-list">${replacementLinks}</ul>
                    </div>
                `;
            }

            const adminActionsHtml = `
                <div class="detail-section">
                    <h4>Admin Actions</h4>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Fulfillment Status</label>
                            <select class="order-status-select p-2 border border-gray-300 rounded-md w-full" data-order-id="${orderDocId}" ${isTerminalState ? 'disabled' : ''}>
                                ${statuses.map(s => `<option value="${s}" ${richOrder.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                            <div id="tracking-form-${orderDocId}" class="mt-2 space-y-2 ${richOrder.status === 'Shipped' ? '' : 'hidden'}">
                                <select class="tracking-courier w-full p-2 border rounded-md">
                                    <option ${richOrder.courier === 'Royal Mail' ? 'selected' : ''}>Royal Mail</option>
                                    <option ${richOrder.courier === 'DPD' ? 'selected' : ''}>DPD</option>
                                    <option ${richOrder.courier === 'Evri' ? 'selected' : ''}>Evri</option>
                                </select>
                                <input type="text" class="tracking-number w-full p-2 border rounded-md" placeholder="Tracking Number" value="${richOrder.trackingNumber || ''}">
                                <button class="save-tracking-btn text-white bg-blue-600 hover:bg-blue-700 text-xs font-medium px-3 py-1 rounded-md" data-order-id="${orderDocId}">Save Tracking</button>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="packing-slip-btn text-green-600 hover:text-green-900 text-sm font-medium" data-order-id="${orderDocId}">View Packing Slip</button>
                            ${isCancellable ? `<button class="cancel-order-btn text-red-600 hover:text-red-900 text-sm font-medium" data-order-id="${orderDocId}">Request Cancellation</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            const address = richOrder.deliveryAddress || {};
            const addressHtml = `<p class="font-semibold">${address.fullName||'N/A'}</p><p>${address.addressLine1||''}</p>${address.addressLine2 ? `<p>${address.addressLine2}</p>`:''}<p>${address.city||''}, ${address.postcode||''}</p><p>${address.country||''}</p>`;
            const itemsHtml = richOrder.items.map(item => {
                const returnedInfo = item.quantityReturned > 0 ? `<span class="returned-item-indicator">(Returned: ${item.quantityReturned})</span>` : '';
                return `<li><span>${item.title} (x${item.quantity}) ${returnedInfo}</span> <span>£${(item.price * item.quantity).toFixed(2)}</span></li>`;
            }).join('');
            const associatedReturns = richOrder.associatedReturns || [];
            const totalRefunded = associatedReturns.filter(r=>r.status.includes('Completed')||r.status==='Approved').reduce((sum,r)=>sum + (r.refundAmount||0),0);
            const refundHtml = associatedReturns.length > 0 ? associatedReturns.map(r=>`<li>Return #${r.id} (${r.status}) <span>£${(r.refundAmount||0).toFixed(2)}</span></li>`).join('') : '<li>None</li>';

            details.innerHTML = `
              ${replacementBannerHtml} 
                <div class="detail-grid">
                    ${adminActionsHtml}
                    <div class="detail-section">
                        <h4>Delivery Address</h4>
                        <div class="text-sm">${addressHtml}</div>
                    </div>
                    <div class="detail-section">
                        <h4>Payment & Totals</h4>
                        <ul class="detail-item-list">
                            <li><span>Payment Method:</span> <strong>${richOrder.paymentMethod || 'N/A'}</strong></li>
                            <li><span>Subtotal:</span> <span>£${(richOrder.itemsSubtotal||0).toFixed(2)}</span></li>
                            <li><span>Delivery:</span> <span>£${(richOrder.deliveryChargeApplied||0).toFixed(2)}</span></li>
                            ${richOrder.discountApplied > 0 ? `<li><span>Discount:</span> <span>-£${(richOrder.discountApplied).toFixed(2)}</span></li>` : ''}
                            <li class="font-bold border-t mt-2 pt-2"><span>Order Total:</span> <span>£${(richOrder.totalAmount).toFixed(2)}</span></li>
                            ${totalRefunded > 0 ? `<li class="font-bold text-red-600"><span>Total Refunded:</span> <span>-£${totalRefunded.toFixed(2)}</span></li>` : ''}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h4>Order Contents</h4>
                        <ul class="detail-item-list">${itemsHtml}</ul>
                    </div>
                    <div class="detail-section">
                        <h4>Associated Refunds</h4>
                        <ul class="detail-item-list">${refundHtml}</ul>
                    </div>
                    ${replacementsIssuedHtml}
                </div>
            `;
            details.dataset.loaded = 'true';
        } catch (error) {
            console.error("Error loading rich details:", error);
            details.innerHTML = `<p class="text-red-500">Could not load details: ${error.message}</p>`;
        }
    }
    return;
}
            if (deleteComponentBtn) { const componentId = deleteComponentBtn.dataset.componentId; const component = allComponents.find(c => c.id === componentId); if (!component) return; showAdminConfirm(`Permanently delete "${component.name}"? This cannot be undone.`, async () => { const token = await fbAuth.currentUser.getIdToken(); await fetch(`/api/hamper-components?id=${componentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); await populateComponents(); renderComponentsTable(allComponents); showAdminNotification('Component deleted.'); }); return; }
            const packingSlipBtn = e.target.closest('.packing-slip-btn');
            if (packingSlipBtn) { showPackingSlip(packingSlipBtn.dataset.orderId); return; }
            const markPackedBtn = e.target.closest('.mark-packed-btn');
            if (markPackedBtn) { const orderId = markPackedBtn.dataset.orderId; markPackedBtn.disabled = true; markPackedBtn.textContent = 'Packing...'; try { await updateOrderStatus(orderId, { newStatus: 'Packed' }); markPackedBtn.textContent = 'Packed ✓'; markPackedBtn.classList.remove('bg-green-500', 'hover:bg-green-600'); markPackedBtn.classList.add('bg-gray-400', 'cursor-not-allowed'); const card = markPackedBtn.closest('.data-card'); if (card) { const statusBadge = card.querySelector('.order-status'); if(statusBadge) { statusBadge.textContent = 'Packed'; statusBadge.className = 'order-status status-packed'; } } showAdminNotification('Order marked as packed!'); } catch (error) { markPackedBtn.disabled = false; markPackedBtn.textContent = 'Mark as Packed'; showAdminNotification(error.message, true); } return; }
            
            const returnActionTarget = e.target.closest('.return-action-btn');
if (returnActionTarget) {
    const target = returnActionTarget;
    // --- THE FIX: Use docId from the button's dataset ---
    const { userId, returnId: returnDocId, orderId, action } = target.dataset; 
    
    showAdminConfirm(`Are you sure you want to '${action}' this return?`, async () => {
        target.disabled = true;
        target.textContent = 'Processing...';

        try {
            const token = await fbAuth.currentUser.getIdToken();
            await fetch('/api/update-return-status', { 
                method: 'PUT', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                // --- THE FIX: Send the correct docId to the API ---
                body: JSON.stringify({ returnId: returnDocId, newStatus: action, orderId, userId }) 
            });
            
            showAdminNotification('Return status updated successfully!');
            
            // --- THE FIX: Reliably refresh the table view ---
            await fetchAllReturns();
            searchForm.dispatchEvent(new Event('submit'));

        } catch (error) {
            showAdminNotification(`Error: ${error.message}`, true);
            target.disabled = false;
            target.textContent = action;
        }
    });
    return;
}

            const cancelOrderTarget = e.target.closest('.cancel-order-btn');
            if (cancelOrderTarget) { openCancellationModal(cancelOrderTarget.dataset.orderId); return; }
            const saveTrackingTarget = e.target.closest('.save-tracking-btn');
            if (saveTrackingTarget) { const orderId = saveTrackingTarget.dataset.orderId; const row = document.getElementById(`order-row-${orderId}`); if (row) { const courier = row.querySelector('.tracking-courier').value; const trackingNumber = row.querySelector('.tracking-number').value; if (trackingNumber) { await updateOrderStatus(orderId, { newStatus: 'Shipped', trackingNumber, courier }); row.querySelector('.order-status-select').value = 'Shipped'; row.querySelector(`#tracking-form-${orderId}`).classList.add('hidden'); } else { showAdminNotification('Please enter a tracking number.', true); } } return; }
            const issueCreditTarget = e.target.closest('.issue-credit-btn');
            if (issueCreditTarget) { const { returnId, returnPath, value, customerEmail } = issueCreditTarget.dataset; document.getElementById('modal-return-id').textContent = returnId; document.getElementById('modal-customer-email').textContent = customerEmail; document.getElementById('credit-value-input').value = parseFloat(value).toFixed(2); document.getElementById('modal-hidden-return-path').value = returnPath; document.getElementById('modal-hidden-customer-email').value = customerEmail; if (creditModal) creditModal.classList.remove('hidden'); return; }
            const createReplacementTarget = e.target.closest('.create-replacement-btn');
if (createReplacementTarget) {
    const { returnId, returnPath, customerName, customerEmail, value } = createReplacementTarget.dataset;

    const originalReturn = allReturns.find(r => r.id === returnId);
    if (!originalReturn) {
        return showAdminNotification('Error: Could not find the original return data.', true);
    }

    showAdminConfirm(`This will generate a voucher for £${parseFloat(value).toFixed(2)} and apply it to a new order. Proceed?`, async () => {
        try {
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/generate-store-credit', {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ returnPath, value, customerEmail })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || result.details);

            // --- THE FIX: Reliably refresh the table view in the background ---
            await fetchAllReturns();
            searchForm.dispatchEvent(new Event('submit'));

            sessionStorage.setItem('replacementContext', JSON.stringify({ 
                returnId: returnId,
                originalOrderId: originalReturn.orderId 
            }));

            document.querySelector('.admin-nav-link[data-page="page-pos"]').click();
            document.getElementById('customer-name').value = customerName;
            document.getElementById('customer-email').value = customerEmail;
            document.getElementById('pos-discount-input').value = result.code;
            document.getElementById('apply-discount-btn').click();
            showAdminNotification(`Add items. Credit of £${parseFloat(value).toFixed(2)} has been applied.`);
        } catch (error) {
            showAdminNotification(`Failed to process replacement: ${error.message}`, true);
        }
    });
    return;
}
        });

        dashboardSection.addEventListener('change', (e) => {
        if (e.target.matches('.order-status-select')) {
            const orderId = e.target.dataset.orderId;
            const newStatus = e.target.value;
            const originalStatus = window.currentOrders.find(o => o.docId === orderId)?.status;
            const trackingForm = document.getElementById(`tracking-form-${orderId}`);

            if (newStatus === 'Shipped') {
                if(trackingForm) trackingForm.classList.remove('hidden');
                showAdminNotification('Add tracking details now and click "Save Tracking".');
                e.target.value = originalStatus; // Revert dropdown until tracking is saved
                return;
            } 
            // Hide the tracking form for any other status
            else {
                if(trackingForm) trackingForm.classList.add('hidden');
            }

            if (newStatus === 'Cancelled' || newStatus === 'Partially Cancelled') {
                const isCancellable = !['Shipped', 'Cancelled', 'Dispatched', 'Returned', 'Completed', 'Packed'].includes(originalStatus);
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
    
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            const searchType = document.querySelector('input[name="search-type"]:checked').value;
            if (!query) { if (resultsMessage) resultsMessage.textContent = 'Please enter a search term.'; return; }
            if (resultsMessage) resultsMessage.textContent = `Searching for ${searchType}...`;
            if (resultsTable) { resultsTable.innerHTML = ''; resultsTable.classList.add('hidden'); }
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
                    const filteredReturns = allReturns.filter(ret => (ret.id || '').toLowerCase().includes(lowerCaseQuery) || (ret.orderId || '').toLowerCase().includes(lowerCaseQuery) || (ret.customerEmail || '').toLowerCase().includes(lowerCaseQuery));
                    renderReturnsTable(filteredReturns);
                }
            } catch (error) {
                if (resultsMessage) resultsMessage.textContent = `Error: ${error.message}`;
            } finally {
                if (loader) loader.classList.add('hidden');
            }
        });
    }
    if (searchTypeRadios) { searchTypeRadios.forEach(radio => { radio.addEventListener('change', () => { if (resultsTable) { resultsTable.innerHTML = ''; resultsTable.classList.add('hidden'); } if (searchInput) searchInput.value = ''; if (resultsMessage) { resultsMessage.textContent = 'Enter a search term to begin.'; resultsMessage.classList.remove('hidden'); } }); }); }

    if (posProductGrid) { posProductGrid.addEventListener('click', (e) => { const card = e.target.closest('.pos-product-card'); if (card) { const product = allProducts.find(p => p.id === card.dataset.productId); if (product) { const existingItem = newOrderItems.find(item => item.id === product.id); if (existingItem) existingItem.quantity++; else newOrderItems.push({ ...product, quantity: 1 }); updateOrderSummary(); } } }); }
    if (orderItemsSummary) { orderItemsSummary.addEventListener('click', (e) => { const decreaseBtn = e.target.closest('.decrease-pos-qty'); const increaseBtn = e.target.closest('.increase-pos-qty'); const removeBtn = e.target.closest('.remove-item-btn'); if (decreaseBtn || increaseBtn) { const productId = decreaseBtn ? decreaseBtn.dataset.productId : increaseBtn.dataset.productId; const item = newOrderItems.find(i => i.id === productId); if (item) { if (decreaseBtn) { item.quantity--; if (item.quantity === 0) { newOrderItems = newOrderItems.filter(i => i.id !== productId); } } else if (increaseBtn) { item.quantity++; } updateOrderSummary(); } } else if (removeBtn) { newOrderItems.splice(removeBtn.dataset.index, 1); updateOrderSummary(); } }); }
    if (createOrderForm) {
    createOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (newOrderItems.length === 0) return showAdminNotification('Please add at least one item to the order.', true);

        // --- THIS IS THE FIX: Add spinner logic ---
        const submitBtn = createOrderForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<div class="spinner mx-auto"></div>`;

        try {
            const payload = { 
                customerDetails: { name: document.getElementById('customer-name').value, email: document.getElementById('customer-email').value }, 
                deliveryAddress: { fullName: document.getElementById('customer-name').value, addressLine1: document.getElementById('delivery-address').value, postcode: document.getElementById('delivery-postcode').value, city: '', country: 'UK' }, 
                items: newOrderItems, 
                paymentMethod: document.getElementById('payment-type').value, 
                appliedDiscount: posAppliedDiscount, 
                transactionId: document.getElementById('transaction-id').value.trim()
            };
            const replacementContextJSON = sessionStorage.getItem('replacementContext');
            if (replacementContextJSON) {
                const replacementContext = JSON.parse(replacementContextJSON);
                payload.isReplacement = true;
                payload.replacesReturnId = replacementContext.returnId;
                payload.originalOrderId = replacementContext.originalOrderId;
            }
            
            const token = await fbAuth.currentUser.getIdToken();
            const response = await fetch('/api/create-admin-order', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            showAdminNotification(result.message);
            await fetchAllReturns();
            if (searchForm.offsetParent !== null) {
                 searchForm.dispatchEvent(new Event('submit'));
            }
            createOrderForm.reset();
            document.getElementById('pos-discount-input').value = '';
            newOrderItems = [];
            posAppliedDiscount = null;
            sessionStorage.removeItem('replacementContext');
            updateOrderSummary();
            await showOrdersToPack();
        } catch (error) {
            showAdminNotification(`Error: ${error.message}`, true);
        } finally {
            // --- THIS IS THE FIX: Always restore the button ---
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}
    
    if (applyDiscountBtn) { applyDiscountBtn.addEventListener('click', async () => { const codeInput = document.getElementById('pos-discount-input'); const messageEl = document.getElementById('pos-discount-message'); const code = codeInput.value.trim(); if (!code) { posAppliedDiscount = null; if (messageEl) messageEl.textContent = ''; updateOrderSummary(); return; } try { const response = await fetch(`/api/validate-discount?code=${code}`); const result = await response.json(); if (!response.ok) throw new Error(result.error); posAppliedDiscount = result; if (messageEl) { messageEl.textContent = `Success: "${result.description}" applied!`; messageEl.style.color = 'green'; } } catch (error) { posAppliedDiscount = null; if (messageEl) { messageEl.textContent = `Error: ${error.message}`; messageEl.style.color = 'red'; } } updateOrderSummary(); }); }

    if (creditModal) { creditModal.addEventListener('click', async (e) => { const generateBtn = e.target.closest('#modal-generate-btn'); const cancelBtn = e.target.closest('#modal-cancel-btn'); if (cancelBtn) creditModal.classList.add('hidden'); if (generateBtn) { const returnPath = document.getElementById('modal-hidden-return-path').value; const customerEmail = document.getElementById('modal-hidden-customer-email').value; const value = document.getElementById('credit-value-input').value; if (!returnPath || !value || !customerEmail) return showAdminNotification('Data is missing. Please close and retry.', true); const spinner = document.getElementById('credit-modal-spinner'); if (spinner) spinner.classList.remove('hidden'); if (generateBtn) generateBtn.disabled = true; try { const token = await fbAuth.currentUser.getIdToken(); const response = await fetch('/api/generate-store-credit', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ returnPath, value, customerEmail }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || result.details || 'API error'); creditModal.classList.add('hidden'); showAdminNotification(`Success! Send this code to the customer: ${result.code}`); await fetchAllReturns(); if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); } catch (error) { showAdminNotification(`Error: ${error.message}`, true); } finally { if (spinner) spinner.classList.add('hidden'); if (generateBtn) generateBtn.disabled = false; } } }); }
    if (cancelSelectedBtn) { cancelSelectedBtn.addEventListener('click', () => { const selectedItems = Array.from(cancellationForm.querySelectorAll('input:checked')).map(cb => ({ productId: cb.value, quantity: parseInt(cb.dataset.quantity, 10) })); if (selectedItems.length > 0) performCancellation({ orderId: currentOrderForCancellation.docId, itemsToCancel: selectedItems }); }); }
    if (cancelFullBtn) { cancelFullBtn.addEventListener('click', () => { showAdminConfirm('Are you sure you want to cancel the entire order?', () => { performCancellation({ orderId: currentOrderForCancellation.docId, itemsToCancel: [] }); }); }); }
    if (closeCancelModalBtn) { closeCancelModalBtn.addEventListener('click', () => { if(cancelModal) cancelModal.classList.add('hidden'); currentOrderForCancellation = null; }); }
    
    if(standaloneForm) { standaloneForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = document.getElementById('standalone-email').value; const value = document.getElementById('standalone-value').value; showAdminConfirm(`Generate a voucher for £${value} for ${email}?`, async () => { try { const token = await fbAuth.currentUser.getIdToken(); const response = await fetch('/api/generate-store-credit', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: email, value: value }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); showAdminNotification(`Success! Code ${result.code} created.`); standaloneForm.reset(); await fetchAllVouchers(); renderVouchersTable(allVouchers); } catch(error) { showAdminNotification(`Error: ${error.message}`, true); } }); }); }

    const menuForm = document.getElementById('menu-form');
if (menuForm) {
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editorElement = document.getElementById('menu-json-editor');
        const editor = editorElement ? editorElement.cmInstance : null;

        if (!editor) {
            showAdminNotification('Error: Editor not found.', true);
            return;
        }

        const jsonString = editor.getValue(); // Get value from CodeMirror
        let menuData;

        try {
            menuData = JSON.parse(jsonString);
        } catch (error) {
            showAdminNotification('Error: Invalid JSON format. Please check your syntax.', true);
            return;
        }

        showAdminConfirm('Are you sure you want to save these changes to the main navigation menu?', async () => {
            try {
                const token = await fbAuth.currentUser.getIdToken();
                const response = await fetch('/api/update-menu', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(menuData)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error);

                showAdminNotification('Menu saved successfully!');

            } catch (error) {
                showAdminNotification(`Save failed: ${error.message}`, true);
            }
        });
    });
}
}); 
function setButtonLoading(button, isLoading) {
    if (!button) return;
    // NOTE: Requires a CSS class 'spinner' for the animation, which exists in admin.css
    const spinnerHtml = '<div class="spinner mx-auto"></div>'; 
    const originalText = button.dataset.originalText || button.textContent;
    
    if (isLoading) {
        button.dataset.originalText = originalText;
        button.disabled = true;
        button.innerHTML = spinnerHtml;
    } else {
        // Only restore if the text was saved
        if (button.dataset.originalText) {
            button.disabled = false;
            button.innerHTML = originalText;
            delete button.dataset.originalText;
        }
    }
}
async function renderAdminDeliveryInfoPage() {
    console.log("--- renderAdminDeliveryInfoPage STARTED ---");
    const form = document.getElementById('delivery-info-form');
    const titleInput = document.getElementById('delivery-info-title');
    const sectionsContainer = document.getElementById('delivery-info-sections-container');
    const addSectionBtn = document.getElementById('add-delivery-info-section-btn');
    const saveStatus = document.getElementById('delivery-info-save-status');
    const countSpan = document.getElementById('delivery-section-count');

    // --- NEW: Get elements for live data display ---
    const liveChargeEl = document.getElementById('delivery-live-charge');
    const liveThresholdEl = document.getElementById('delivery-live-threshold');

    // Clear previous state and show loading
    sectionsContainer.innerHTML = '<p class="text-gray-500">Loading sections...</p>';
    saveStatus.textContent = '';
    if (titleInput) titleInput.value = ''; // Check if element exists
    if (countSpan) countSpan.textContent = '0';
    // --- NEW: Set loading text for live data ---
    if (liveChargeEl) liveChargeEl.textContent = 'Loading...';
    if (liveThresholdEl) liveThresholdEl.textContent = 'Loading...';


    try {
        // --- Fetch 1: Delivery Info Content (No Change) ---
        const data = await fetchAdminAPI('/api/admin/delivery_info');

        // --- Fetch 2: Site Settings for live values (NEW) ---
        try {
            const settingsData = await fetchAdminAPI('/api/admin/site_settings');
            if (liveChargeEl) liveChargeEl.textContent = `£${(settingsData.baseDeliveryCharge || 0).toFixed(2)}`;
            if (liveThresholdEl) liveThresholdEl.textContent = `£${(settingsData.freeDeliveryThreshold || 0).toFixed(2)}`;
        } catch (settingsError) {
            console.error("Error loading site settings for display:", settingsError);
            if (liveChargeEl) liveChargeEl.textContent = 'Error';
            if (liveThresholdEl) liveThresholdEl.textContent = 'Error';
        }
        // --- End NEW Block ---


        if (titleInput) titleInput.value = data.pageTitle || 'Delivery Information';
        sectionsContainer.innerHTML = ''; // Clear loading message

        if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, index) => addDeliveryInfoSectionInputs(sectionsContainer, section, index));
        } else {
            // Add one empty section if none exist in the fetched data
            addDeliveryInfoSectionInputs(sectionsContainer, { title: '', content: '', iconName: '' }, 0);
        }
        // Update count after adding sections
        if (countSpan) countSpan.textContent = sectionsContainer.querySelectorAll('.delivery-info-section').length;

    } catch (error) {
        console.error("Error loading Delivery Info content:", error);
        sectionsContainer.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    // --- Event Listeners (No Change from your file) ---
    // Ensure Add Section button exists before adding listener
    if (addSectionBtn) {
        addSectionBtn.onclick = () => { // Use onclick for simplicity or manage listeners carefully
            const newIndex = sectionsContainer.querySelectorAll('.delivery-info-section').length;
            addDeliveryInfoSectionInputs(sectionsContainer, { title: '', content: '', iconName: '' }, newIndex);
        };
    } else {
        console.error("Add Section button not found!");
    }


    // Ensure form exists before adding listener
    if (form) {
        form.onsubmit = async (e) => { // Use onsubmit for simplicity
            e.preventDefault();
            if (saveStatus) saveStatus.textContent = 'Saving...';
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true); // Ensure this helper exists

            const sectionsData = [];
            sectionsContainer.querySelectorAll('.delivery-info-section').forEach(div => {
                const sectionTitleInput = div.querySelector(`input[id^="delivery-section-title-"]`);
                const sectionIconInput = div.querySelector(`input[id^="delivery-section-icon-"]`); // Get icon input
                const sectionContentInput = div.querySelector(`textarea[id^="delivery-section-content-"]`);

                if (sectionTitleInput && sectionIconInput && sectionContentInput) {
                    const sectionTitle = sectionTitleInput.value.trim();
                    const sectionIcon = sectionIconInput.value.trim(); // Get icon value
                    const sectionContent = sectionContentInput.value.trim();
                    // Include iconName in the data, allow empty icon name
                    if (sectionTitle || sectionContent) { // Save if title or content exists
                        sectionsData.push({
                            title: sectionTitle,
                            iconName: sectionIcon, // Add iconName
                            content: sectionContent
                        });
                    }
                } else {
                     console.warn("Could not find all inputs in a delivery info section div:", div);
                }
            });

            const currentPageTitle = titleInput ? titleInput.value.trim() : ''; // Get current title
            if (sectionsData.length === 0 || !currentPageTitle) {
                 if (saveStatus) saveStatus.textContent = 'Error: Page Title and at least one section are required.';
                 setButtonLoading(submitBtn, false);
                 return;
            }

            try {
                const response = await fetchAdminAPI('/api/admin/delivery_info', {
                    method: 'POST',
                    body: JSON.stringify({
                        pageTitle: currentPageTitle, // Send current title
                        sections: sectionsData
                    })
                });
                if (saveStatus) saveStatus.textContent = response.message || 'Saved successfully!';
                setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 3000);

            } catch (error) {
                console.error("Error saving Delivery Info:", error);
                if (saveStatus) saveStatus.textContent = `Error saving: ${error.message}`;
            } finally {
                setButtonLoading(submitBtn, false);
            }
        };
    } else {
        console.error("Delivery Info form not found!");
    }
    console.log("--- renderAdminDeliveryInfoPage FINISHED ---");
}

// Helper function to add/render section inputs

async function fetchAdminAPI(url, options = {}) {
    console.log(`[fetchAdminAPI] Requesting: ${options.method || 'GET'} ${url}`); // Log request
    if (!fbAuth.currentUser) {
        console.error("[fetchAdminAPI] Error: Current user not available for authentication.");
        throw new Error("Authentication error. Please log in again.");
    }

    try {
        const token = await fbAuth.currentUser.getIdToken();
        // console.log("[fetchAdminAPI] Got ID token."); // Optional: log token success

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            // Only set Content-Type if there's a body being sent
            ...(options.body && { 'Content-Type': 'application/json' })
        };

        const config = {
            ...options,
            headers: headers
        };

        // console.log("[fetchAdminAPI] Config:", config); // Optional: log full config

        const response = await fetch(url, config);
        console.log(`[fetchAdminAPI] Response status for ${url}: ${response.status}`); // Log status

        // Try to parse JSON regardless of status, but handle errors
        let responseData;
        try {
             // Handle potential empty responses (like 204 No Content)
             if (response.status === 204 || response.headers.get("content-length") === "0") {
                 responseData = { success: true }; // Assume success for empty responses
             } else {
                 responseData = await response.json();
             }
        } catch (e) {
             // If JSON parsing fails, use the status text as the error message
             console.error(`[fetchAdminAPI] Failed to parse JSON response for ${url}. Status: ${response.status}`);
             // Throw an error based on status if parsing failed
             if (!response.ok) {
                throw new Error(response.statusText || `HTTP error ${response.status}`);
             } else {
                 // If status was OK but parsing failed (unlikely but possible), return success
                 responseData = { success: true, message: "Response received, but content parsing failed." };
             }
        }


        if (!response.ok) {
            console.error(`[fetchAdminAPI] Error response for ${url}:`, responseData);
            // Use the error message from the JSON if available, otherwise use status text
            throw new Error(responseData.error || responseData.message || response.statusText || `HTTP error ${response.status}`);
        }

        console.log(`[fetchAdminAPI] Success for ${url}. Returning data.`); // Log success
        return responseData; // Return the parsed JSON or the success object

    } catch (error) {
        console.error(`[fetchAdminAPI] CATCH block error for ${url}:`, error);
        // Add more specific error messages if needed
        if (error.message.includes("Failed to fetch")) {
             throw new Error("Network error. Could not connect to the server.");
        }
        throw error; // Re-throw the error to be caught by the calling function
    }
}


// Helper function to add/render section inputs
function addSectionInputs(container, sectionData, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'about-us-section form-section'; // Added form-section for consistent styling
    sectionDiv.dataset.index = index;

    // Use placeholder text for better UX
    sectionDiv.innerHTML = `
        <div class="form-group">
            <label for="about-section-title-${index}">Section Title ${index + 1}</label>
            <input type="text" id="about-section-title-${index}" value="${sectionData.title || ''}" placeholder="e.g., Our Mission" required>
        </div>
        <div class="form-group">
            <label for="about-section-content-${index}">Section Content</label>
            <textarea id="about-section-content-${index}" rows="8" placeholder="Enter the text content for this section..." required>${sectionData.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-about-us-section-btn" title="Remove this section">
            <i class="fa-solid fa-trash-can"></i> Remove Section
        </button>
        <hr style="margin-top: 1rem; border-color: #e5e7eb;">
    `;

    // Add listener for the remove button
    const removeBtn = sectionDiv.querySelector('.remove-about-us-section-btn');
    removeBtn.addEventListener('click', () => {
        sectionDiv.remove();
        // Optional: Update labels if needed after removal (e.g., "Section Title 2" becomes "Section Title 1")
         const remainingSections = container.querySelectorAll('.about-us-section');
         remainingSections.forEach((sec, newIndex) => {
            sec.dataset.index = newIndex;
            sec.querySelector('label[for^="about-section-title-"]').textContent = `Section Title ${newIndex + 1}`;
            // Update input IDs if necessary, though usually not required if just reading values on submit
         });
    });

    container.appendChild(sectionDiv);
}
//---CONTACT US----

// --- ADD this function for Contact Us Page ---
async function renderAdminContactUsPage() {
    console.log("--- renderAdminContactUsPage STARTED ---");
    const form = document.getElementById('contact-us-form');
    const container = document.getElementById('contact-details-container');
    const addBtn = document.getElementById('add-contact-detail-btn');
    const saveStatus = document.getElementById('contact-us-save-status');
    const detailCountSpan = document.getElementById('contact-detail-count');

    // Clear previous state and show loading
    container.innerHTML = '<p class="text-gray-500">Loading contact details...</p>';
    saveStatus.textContent = '';
    if(detailCountSpan) detailCountSpan.textContent = '0';
     // Clear other fields maybe?
    document.getElementById('contact-us-title').value = '';
    document.getElementById('contact-us-subtitle').value = '';
    document.getElementById('contact-us-map-path').value = '';
    document.getElementById('opening-hours-title').value = '';
    document.getElementById('opening-hours-list').value = '';


    try {
        const data = await fetchAdminAPI('/api/admin/contact_us'); // Fetch data

        // Populate fields
        document.getElementById('contact-us-title').value = data.pageTitle || 'Get in Touch';
        document.getElementById('contact-us-subtitle').value = data.pageSubtitle || '';
        document.getElementById('contact-us-map-path').value = data.mapImagePath || '';
        document.getElementById('opening-hours-title').value = data.openingHours?.title || 'Opening Hours';
        document.getElementById('opening-hours-list').value = data.openingHours?.hours?.join('\n') || '';

        container.innerHTML = ''; // Clear loading
        const contactDetails = data.contactDetails || [];

        contactDetails.forEach((detail, index) => addContactDetailInputs(container, detail, index));
        if (contactDetails.length === 0) {
            addContactDetailInputs(container, {}, 0); // Add one empty if none exist
        }
        if(detailCountSpan) detailCountSpan.textContent = contactDetails.length || container.children.length;


    } catch (error) {
        console.error("Error loading Contact Us content:", error);
        container.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    // --- Event Listeners ---
    addBtn.onclick = () => {
         const newIndex = container.querySelectorAll('.contact-us-detail-item').length;
         addContactDetailInputs(container, {}, newIndex);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const detailsData = [];
        container.querySelectorAll('.contact-us-detail-item').forEach(div => {
            const inputs = div.querySelectorAll('input[data-field]'); // Select only inputs with data-field
            const detail = {};
            inputs.forEach(input => {
                detail[input.dataset.field] = input.value.trim();
            });
            // Only add if essential fields are present
            if (detail.title && detail.subtitle && detail.iconName) {
                detailsData.push(detail);
            }
        });

        const payload = {
            pageTitle: document.getElementById('contact-us-title').value,
            pageSubtitle: document.getElementById('contact-us-subtitle').value,
            mapImagePath: document.getElementById('contact-us-map-path').value,
            contactDetails: detailsData, // Ensure this matches backend expectation
            openingHours: {
                title: document.getElementById('opening-hours-title').value,
                hours: document.getElementById('opening-hours-list').value.split('\n').map(h => h.trim()).filter(h => h)
            }
        };

        if (detailsData.length === 0 || !payload.pageTitle.trim()) {
            saveStatus.textContent = 'Error: Page Title and at least one contact detail are required.';
            setButtonLoading(submitBtn, false);
            return;
        }

        try {
            const response = await fetchAdminAPI('/api/admin/contact_us', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Contact Us content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminContactUsPage FINISHED ---");
}


// --- ADD this helper for Contact Us details ---
function addContactDetailInputs(container, detail = {}, index) {
    const detailDiv = document.createElement('div');
    detailDiv.className = 'contact-us-detail-item form-section p-4 border rounded-md bg-gray-50 mb-4'; // Add styling
    detailDiv.dataset.index = index;

    // Use placeholder text and ensure values are properly escaped if needed (though unlikely here)
    detailDiv.innerHTML = `
        <h4 class="font-medium text-sm mb-3 text-gray-600">Detail Item ${index + 1}</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="form-group">
                <label for="contact-title-${index}" class="block text-xs font-medium text-gray-700">Title</label>
                <input type="text" id="contact-title-${index}" data-field="title" value="${detail.title || ''}" required placeholder="e.g., Phone" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
            </div>
            <div class="form-group">
                <label for="contact-subtitle-${index}" class="block text-xs font-medium text-gray-700">Subtitle/Value</label>
                <input type="text" id="contact-subtitle-${index}" data-field="subtitle" value="${detail.subtitle || ''}" required placeholder="e.g., 01234 567890" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
            </div>
            <div class="form-group">
                <label for="contact-icon-${index}" class="block text-xs font-medium text-gray-700">Icon Name (Font Awesome)</label>
                <input type="text" id="contact-icon-${index}" data-field="iconName" value="${detail.iconName || ''}" required placeholder="e.g., phoneAlt / solidEnvelope" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
            </div>
            <div class="form-group">
                <label for="contact-link-${index}" class="block text-xs font-medium text-gray-700">Link URL (Optional)</label>
                <input type="text" id="contact-link-${index}" data-field="link" value="${detail.link || ''}" placeholder="e.g., tel:+44... or mailto:..." class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
            </div>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-contact-detail-btn mt-3 text-xs">
            <i class="fa-solid fa-trash-can"></i> Remove Detail
        </button>
        <input type="hidden" data-field="type" value="${detail.type || 'detail'}">
        <input type="hidden" data-field="id" value="${detail.id || `cd${Date.now()}${index}`}">
    `;
    container.appendChild(detailDiv);

    // Update count display
    const countEl = document.getElementById('contact-detail-count');
    if (countEl) countEl.textContent = container.querySelectorAll('.contact-us-detail-item').length;

    // Attach remove listener to the newly created button
    detailDiv.querySelector('.remove-contact-detail-btn').addEventListener('click', () => {
        detailDiv.remove();
        // Re-update count after removal
        if (countEl) countEl.textContent = container.querySelectorAll('.contact-us-detail-item').length;
         // Optional: Renumber labels if desired
         const remainingDetails = container.querySelectorAll('.contact-us-detail-item');
         remainingDetails.forEach((det, newIndex) => {
             det.dataset.index = newIndex;
             det.querySelector('h4').textContent = `Detail Item ${newIndex + 1}`;
         });
    });
}

// --- ADD this function for FAQs Page ---
async function renderAdminFaqsPage() {
    console.log("--- renderAdminFaqsPage STARTED ---");
    const form = document.getElementById('faqs-form');
    const container = document.getElementById('faq-items-container');
    const addBtn = document.getElementById('add-faq-item-btn');
    const saveStatus = document.getElementById('faqs-save-status');
    const countSpan = document.getElementById('faq-item-count');

    // Clear previous state and show loading
    container.innerHTML = '<p class="text-gray-500">Loading FAQs...</p>';
    saveStatus.textContent = '';
    if (countSpan) countSpan.textContent = '0';

    try {
        // Fetch the array of FAQs
        const faqsArray = await fetchAdminAPI('/api/admin/faqs'); // Fetch data
        container.innerHTML = ''; // Clear loading

        if (faqsArray && faqsArray.length > 0) {
            faqsArray.forEach((faq, index) => addFaqInputs(container, faq, index));
        } else {
            addFaqInputs(container, { question: '', answer: '' }, 0); // Add one empty if none exist
        }
        if (countSpan) countSpan.textContent = container.querySelectorAll('.faq-item-section').length;

    } catch (error) {
        console.error("Error loading FAQs:", error);
        container.innerHTML = '<p style="color: red;">Error loading FAQs content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    // --- Event Listeners ---
    addBtn.onclick = () => {
        const newIndex = container.querySelectorAll('.faq-item-section').length;
        addFaqInputs(container, { question: '', answer: '' }, newIndex);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const faqsData = [];
        container.querySelectorAll('.faq-item-section').forEach(div => {
            const questionInput = div.querySelector('input[id^="faq-question-"]');
            const answerInput = div.querySelector('textarea[id^="faq-answer-"]');
            if (questionInput && answerInput) {
                const question = questionInput.value.trim();
                const answer = answerInput.value.trim();
                // Only save if both question and answer have content
                if (question && answer) {
                    faqsData.push({ question: question, answer: answer });
                }
            }
        });

        if (faqsData.length === 0) {
            // Allow saving an empty list if desired, or add validation
             console.log("Saving empty FAQ list.");
             // If you require at least one FAQ, uncomment below:
             // saveStatus.textContent = 'Error: At least one FAQ item is required.';
             // setButtonLoading(submitBtn, false);
             // return;
        }

        try {
            const response = await fetchAdminAPI('/api/admin/faqs', {
                method: 'POST',
                // Send the data wrapped in an object with the 'faqs' key
                body: JSON.stringify({ faqs: faqsData })
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving FAQs:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminFaqsPage FINISHED ---");
}

// --- ADD this helper for FAQ inputs ---
function addFaqInputs(container, faqData = {}, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'faq-item-section form-section p-4 border rounded-md bg-gray-50 mb-4';
    sectionDiv.dataset.index = index;

    sectionDiv.innerHTML = `
        <h4 class="font-medium text-sm mb-3 text-gray-600">FAQ Item ${index + 1}</h4>
        <div class="form-group mb-4">
            <label for="faq-question-${index}" class="block text-xs font-medium text-gray-700">Question</label>
            <input type="text" id="faq-question-${index}" value="${faqData.question || ''}" required placeholder="Enter the question" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
        </div>
        <div class="form-group">
            <label for="faq-answer-${index}" class="block text-xs font-medium text-gray-700">Answer</label>
            <textarea id="faq-answer-${index}" rows="4" required placeholder="Enter the answer" class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">${faqData.answer || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-faq-item-btn mt-3 text-xs">
            <i class="fa-solid fa-trash-can"></i> Remove FAQ
        </button>
    `;
    container.appendChild(sectionDiv);

    // Update count display
    const countEl = document.getElementById('faq-item-count');
    if (countEl) countEl.textContent = container.querySelectorAll('.faq-item-section').length;

    // Attach remove listener
    sectionDiv.querySelector('.remove-faq-item-btn').addEventListener('click', () => {
        sectionDiv.remove();
        // Re-update count and labels
        const remainingItems = container.querySelectorAll('.faq-item-section');
        if (countEl) countEl.textContent = remainingItems.length;
        remainingItems.forEach((item, newIndex) => {
             item.dataset.index = newIndex;
             item.querySelector('h4').textContent = `FAQ Item ${newIndex + 1}`;
             // Update IDs/labels if necessary (usually not required just for saving)
        });
    });
}

// --- ADMIN SITE SETTINGS---
async function renderAdminSiteSettingsPage() {
    console.log("--- renderAdminSiteSettingsPage STARTED ---");
    const form = document.getElementById('site-settings-form');
    const saveStatus = document.getElementById('site-settings-save-status');

    saveStatus.textContent = 'Loading...';
    
    try {
        const data = await fetchAdminAPI('/api/admin/site_settings');
        
        // --- Populate form fields (All Fields) ---
        // Theming
        document.getElementById('setting-primary-color').value = data.primaryColor || '#2c3e50';
        document.getElementById('setting-cta-color').value = data.ctaColorGreen || '#047857';
        document.getElementById('setting-font-headings').value = data.fontFamilyHeadings || "'Lora', serif";
        document.getElementById('setting-font-body').value = data.fontFamilyBody || "'Inter', sans-serif";
        
        // UX & Stock
        document.getElementById('setting-enable-quickview').checked = data.enableQuickView || false;
        document.getElementById('setting-show-low-stock').checked = data.showLowStockIndicator || false;
        document.getElementById('setting-low-stock-threshold').value = data.lowStockThreshold || 10;
        document.getElementById('setting-show-newsletter-popup').checked = data.showNewsletterPopup || false;
        
        // --- THIS IS THE NEW LINE TO LOAD THE VALUE ---
        document.getElementById('setting-cart-persistence-days').value = data.cartPersistenceDays || 30;

        // Delivery & Legal
        document.getElementById('setting-free-delivery-threshold').value = data.freeDeliveryThreshold || 50.00;
        document.getElementById('setting-base-delivery-charge').value = data.baseDeliveryCharge || 4.99;
        document.getElementById('setting-return-window-days').value = data.returnWindowInDays || 28;
        document.getElementById('setting-currency-symbol').value = data.baseCurrencySymbol || "£";
        document.getElementById('setting-cookie-message').value = data.cookieConsentMessage || "We use cookies to ensure you get the best experience.";

        saveStatus.textContent = '';
        applyCssVariables(data); // Apply current settings immediately upon page load
    } catch (error) {
        console.error("Error loading Site Settings:", error);
        saveStatus.textContent = `Error loading settings: ${error.message}`;
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        // --- Build Payload (All Fields) ---
        const payload = {
            // Theming
            primaryColor: document.getElementById('setting-primary-color').value,
            ctaColorGreen: document.getElementById('setting-cta-color').value,
            fontFamilyHeadings: document.getElementById('setting-font-headings').value,
            fontFamilyBody: document.getElementById('setting-font-body').value,
            
            // UX & Stock
            enableQuickView: document.getElementById('setting-enable-quickview').checked,
            showLowStockIndicator: document.getElementById('setting-show-low-stock').checked,
            lowStockThreshold: parseFloat(document.getElementById('setting-low-stock-threshold').value),
            showNewsletterPopup: document.getElementById('setting-show-newsletter-popup').checked,

            // --- THIS IS THE NEW LINE TO SAVE THE VALUE ---
            cartPersistenceDays: parseInt(document.getElementById('setting-cart-persistence-days').value, 10),

            // Delivery & Legal
            freeDeliveryThreshold: parseFloat(document.getElementById('setting-free-delivery-threshold').value),
            baseDeliveryCharge: parseFloat(document.getElementById('setting-base-delivery-charge').value),
            returnWindowInDays: parseInt(document.getElementById('setting-return-window-days').value, 10),
            baseCurrencySymbol: document.getElementById('setting-currency-symbol').value,
            cookieConsentMessage: document.getElementById('setting-cookie-message').value,
        };
        
        try {
            const response = await fetchAdminAPI('/api/admin/site_settings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            
            applyCssVariables(payload); // Apply the saved changes instantly
            
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Site Settings:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminSiteSettingsPage FINISHED ---");
}

// CRITICAL: New function to apply saved settings to the user's view (both admin and public site)
function applyCssVariables(settings) {
    const root = document.documentElement;
    if (settings.primaryColor) root.style.setProperty('--primary-color', settings.primaryColor);
    if (settings.ctaColorGreen) root.style.setProperty('--cta-color-green', settings.ctaColorGreen);
    if (settings.fontFamilyHeadings) root.style.setProperty('--font-family-headings', settings.fontFamilyHeadings);
    if (settings.fontFamilyBody) root.style.setProperty('--font-family-body', settings.fontFamilyBody);
}
function addMissionSectionInputs(container, sectionData, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'our-mission-section form-section p-4 border rounded-md bg-gray-50 mb-4'; // Added styling
    sectionDiv.dataset.index = index;

    sectionDiv.innerHTML = `
        <div class="form-group">
            <label for="our-mission-section-title-${index}" class="block text-xs font-medium text-gray-700">Section Title ${index + 1}</label>
            <input type="text" id="our-mission-section-title-${index}" value="${sectionData.title || ''}" placeholder="e.g., Our Mission" required 
                   class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div class="form-group mt-4">
            <label for="our-mission-section-content-${index}" class="block text-xs font-medium text-gray-700">Section Content</label>
            <textarea id="our-mission-section-content-${index}" rows="5" placeholder="Enter the text content for this section..." required 
                      class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">${sectionData.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-our-mission-section-btn mt-3 text-xs" title="Remove this section">
            <i class="fa-solid fa-trash-can"></i> Remove Section
        </button>
        <hr style="margin-top: 1rem; border-color: #e5e7eb;">
    `;
    
    const removeBtn = sectionDiv.querySelector('.remove-our-mission-section-btn');
    removeBtn.addEventListener('click', () => {
        sectionDiv.remove();
        const remainingSections = container.querySelectorAll('.our-mission-section');
        remainingSections.forEach((sec, newIndex) => {
            sec.dataset.index = newIndex;
            sec.querySelector('label[for^="our-mission-section-title-"]').textContent = `Section Title ${newIndex + 1}`;
        });
    });
    container.appendChild(sectionDiv);
}
async function renderAdminOurMissionPage() {
    console.log("--- renderAdminOurMissionPage STARTED ---");
    const form = document.getElementById('our-mission-form');
    const titleInput = document.getElementById('our-mission-title-input');
    const sectionsContainer = document.getElementById('our-mission-sections-container');
    const addSectionBtn = document.getElementById('add-our-mission-section-btn');
    const saveStatus = document.getElementById('our-mission-save-status');

    if (!form || !titleInput || !sectionsContainer || !addSectionBtn || !saveStatus) {
        console.error("renderAdminOurMissionPage: Missing required form elements.");
        return;
    }

    sectionsContainer.innerHTML = '<p class="text-gray-500">Loading sections...</p>';
    saveStatus.textContent = '';
    titleInput.value = '';

    try {
        const data = await fetchAdminAPI('/api/admin/our_mission');
        titleInput.value = data.pageTitle || 'Our Mission';
        sectionsContainer.innerHTML = ''; 

        if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, index) => addMissionSectionInputs(sectionsContainer, section, index));
        } else {
            addMissionSectionInputs(sectionsContainer, { title: '', content: '' }, 0);
        }
    } catch (error) {
        console.error("Error loading Our Mission content:", error);
        sectionsContainer.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    addSectionBtn.onclick = () => {
        const newIndex = sectionsContainer.querySelectorAll('.our-mission-section').length;
        addMissionSectionInputs(sectionsContainer, { title: '', content: '' }, newIndex);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const sectionsData = [];
        sectionsContainer.querySelectorAll('.our-mission-section').forEach((div) => {
            const sectionTitleInput = div.querySelector(`input[id^="our-mission-section-title-"]`);
            const sectionContentInput = div.querySelector(`textarea[id^="our-mission-section-content-"]`);
            if (sectionTitleInput && sectionContentInput) {
                const sectionTitle = sectionTitleInput.value.trim();
                const sectionContent = sectionContentInput.value.trim();
                if (sectionTitle || sectionContent) {
                    sectionsData.push({ title: sectionTitle, content: sectionContent });
                }
            }
        });

        if (sectionsData.length === 0 || !titleInput.value.trim()) {
            saveStatus.textContent = 'Error: Page Title and at least one section are required.';
            setButtonLoading(submitBtn, false);
            return;
        }

        try {
            const response = await fetchAdminAPI('/api/admin/our_mission', {
                method: 'POST',
                body: JSON.stringify({
                    pageTitle: titleInput.value,
                    sections: sectionsData
                })
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Our Mission content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminOurMissionPage FINISHED ---");
}

function addPrivacyPolicySectionInputs(container, sectionData, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'privacy-policy-section form-section p-4 border rounded-md bg-gray-50 mb-4'; // Added styling
    sectionDiv.dataset.index = index;

    sectionDiv.innerHTML = `
        <div class="form-group">
            <label for="privacy-policy-section-title-${index}" class="block text-xs font-medium text-gray-700">Section Title ${index + 1}</label>
            <input type="text" id="privacy-policy-section-title-${index}" value="${sectionData.title || ''}" placeholder="e.g., 1. Introduction" required 
                   class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div class="form-group mt-4">
            <label for="privacy-policy-section-content-${index}" class="block text-xs font-medium text-gray-700">Section Content</label>
            <textarea id="privacy-policy-section-content-${index}" rows="5" placeholder="Enter the text content for this section..." required 
                      class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">${sectionData.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-privacy-policy-section-btn mt-3 text-xs" title="Remove this section">
            <i class="fa-solid fa-trash-can"></i> Remove Section
        </button>
        <hr style="margin-top: 1rem; border-color: #e5e7eb;">
    `;
    
    const removeBtn = sectionDiv.querySelector('.remove-privacy-policy-section-btn');
    removeBtn.addEventListener('click', () => {
        sectionDiv.remove();
        const remainingSections = container.querySelectorAll('.privacy-policy-section');
        remainingSections.forEach((sec, newIndex) => {
            sec.dataset.index = newIndex;
            sec.querySelector('label[for^="privacy-policy-section-title-"]').textContent = `Section Title ${newIndex + 1}`;
        });
    });
    container.appendChild(sectionDiv);
}
async function renderAdminPrivacyPolicyPage() {
    console.log("--- renderAdminPrivacyPolicyPage STARTED ---");
    const form = document.getElementById('privacy-policy-form');
    const titleInput = document.getElementById('privacy-policy-title-input');
    const sectionsContainer = document.getElementById('privacy-policy-sections-container');
    const addSectionBtn = document.getElementById('add-privacy-policy-section-btn');
    const saveStatus = document.getElementById('privacy-policy-save-status');

    if (!form || !titleInput || !sectionsContainer || !addSectionBtn || !saveStatus) {
        console.error("renderAdminPrivacyPolicyPage: Missing required form elements.");
        return;
    }

    sectionsContainer.innerHTML = '<p class="text-gray-500">Loading sections...</p>';
    saveStatus.textContent = '';
    titleInput.value = '';

    try {
        const data = await fetchAdminAPI('/api/admin/privacy_policy');
        titleInput.value = data.pageTitle || 'Privacy Policy';
        sectionsContainer.innerHTML = ''; 

        if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, index) => addPrivacyPolicySectionInputs(sectionsContainer, section, index));
        } else {
            addPrivacyPolicySectionInputs(sectionsContainer, { title: '', content: '' }, 0);
        }
    } catch (error) {
        console.error("Error loading Privacy Policy content:", error);
        sectionsContainer.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    addSectionBtn.onclick = () => {
        const newIndex = sectionsContainer.querySelectorAll('.privacy-policy-section').length;
        addPrivacyPolicySectionInputs(sectionsContainer, { title: '', content: '' }, newIndex);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const sectionsData = [];
        sectionsContainer.querySelectorAll('.privacy-policy-section').forEach((div) => {
            const sectionTitleInput = div.querySelector(`input[id^="privacy-policy-section-title-"]`);
            const sectionContentInput = div.querySelector(`textarea[id^="privacy-policy-section-content-"]`);
            if (sectionTitleInput && sectionContentInput) {
                const sectionTitle = sectionTitleInput.value.trim();
                const sectionContent = sectionContentInput.value.trim();
                if (sectionTitle || sectionContent) {
                    sectionsData.push({ title: sectionTitle, content: sectionContent });
                }
            }
        });

        if (sectionsData.length === 0 || !titleInput.value.trim()) {
            saveStatus.textContent = 'Error: Page Title and at least one section are required.';
            setButtonLoading(submitBtn, false);
            return;
        }

        try {
            const response = await fetchAdminAPI('/api/admin/privacy_policy', {
                method: 'POST',
                body: JSON.stringify({
                    pageTitle: titleInput.value,
                    sections: sectionsData
                })
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Privacy Policy content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminPrivacyPolicyPage FINISHED ---");

}
function addTermsConditionsSectionInputs(container, sectionData, index) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'terms-conditions-section form-section p-4 border rounded-md bg-gray-50 mb-4';
    sectionDiv.dataset.index = index;

    sectionDiv.innerHTML = `
        <div class="form-group">
            <label for="terms-conditions-section-title-${index}" class="block text-xs font-medium text-gray-700">Section Title ${index + 1}</label>
            <input type="text" id="terms-conditions-section-title-${index}" value="${sectionData.title || ''}" placeholder="e.g., 1. Introduction" required 
                   class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div class="form-group mt-4">
            <label for="terms-conditions-section-content-${index}" class="block text-xs font-medium text-gray-700">Section Content</label>
            <textarea id="terms-conditions-section-content-${index}" rows="5" placeholder="Enter the text content for this section..." required 
                      class="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500">${sectionData.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-terms-conditions-section-btn mt-3 text-xs" title="Remove this section">
            <i class="fa-solid fa-trash-can"></i> Remove Section
        </button>
        <hr style="margin-top: 1rem; border-color: #e5e7eb;">
    `;
    
    const removeBtn = sectionDiv.querySelector('.remove-terms-conditions-section-btn');
    removeBtn.addEventListener('click', () => {
        sectionDiv.remove();
        const remainingSections = container.querySelectorAll('.terms-conditions-section');
        remainingSections.forEach((sec, newIndex) => {
            sec.dataset.index = newIndex;
            sec.querySelector('label[for^="terms-conditions-section-title-"]').textContent = `Section Title ${newIndex + 1}`;
        });
    });
    container.appendChild(sectionDiv);
}
async function renderAdminTermsConditionsPage() {
    console.log("--- renderAdminTermsConditionsPage STARTED ---");
    const form = document.getElementById('terms-conditions-form');
    const titleInput = document.getElementById('terms-conditions-title-input');
    const sectionsContainer = document.getElementById('terms-conditions-sections-container');
    const addSectionBtn = document.getElementById('add-terms-conditions-section-btn');
    const saveStatus = document.getElementById('terms-conditions-save-status');

    if (!form || !titleInput || !sectionsContainer || !addSectionBtn || !saveStatus) {
        console.error("renderAdminTermsConditionsPage: Missing required form elements.");
        return;
    }

    sectionsContainer.innerHTML = '<p class="text-gray-500">Loading sections...</p>';
    saveStatus.textContent = '';
    titleInput.value = '';

    try {
        const data = await fetchAdminAPI('/api/admin/terms_and_conditions');
        titleInput.value = data.pageTitle || 'Terms and Conditions';
        sectionsContainer.innerHTML = ''; 

        if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, index) => addTermsConditionsSectionInputs(sectionsContainer, section, index));
        } else {
            addTermsConditionsSectionInputs(sectionsContainer, { title: '', content: '' }, 0);
        }
    } catch (error) {
        console.error("Error loading Terms & Conditions content:", error);
        sectionsContainer.innerHTML = '<p style="color: red;">Error loading content.</p>';
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    addSectionBtn.onclick = () => {
        const newIndex = sectionsContainer.querySelectorAll('.terms-conditions-section').length;
        addTermsConditionsSectionInputs(sectionsContainer, { title: '', content: '' }, newIndex);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        const sectionsData = [];
        sectionsContainer.querySelectorAll('.terms-conditions-section').forEach((div) => {
            const sectionTitleInput = div.querySelector(`input[id^="terms-conditions-section-title-"]`);
            const sectionContentInput = div.querySelector(`textarea[id^="terms-conditions-section-content-"]`);
            if (sectionTitleInput && sectionContentInput) {
                const sectionTitle = sectionTitleInput.value.trim();
                const sectionContent = sectionContentInput.value.trim();
                if (sectionTitle || sectionContent) {
                    sectionsData.push({ title: sectionTitle, content: sectionContent });
                }
            }
        });

        if (sectionsData.length === 0 || !titleInput.value.trim()) {
            saveStatus.textContent = 'Error: Page Title and at least one section are required.';
            setButtonLoading(submitBtn, false);
            return;
        }

        try {
            const response = await fetchAdminAPI('/api/admin/terms_and_conditions', {
                method: 'POST',
                body: JSON.stringify({
                    pageTitle: titleInput.value,
                    sections: sectionsData
                })
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Terms & Conditions content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminTermsConditionsPage FINISHED ---");
}
//---FOOTER---//
function addFooterLinkInputs(containerId, link = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'grid grid-cols-3 gap-3 p-2 border rounded-md bg-gray-50';
    div.innerHTML = `
        <input type="text" value="${link.text || ''}" placeholder="Link Text (e.g., About Us)" 
               class="footer-link-text w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
        <input type="text" value="${link.routeName || ''}" placeholder="Route (e.g., /about-us)" 
               class="footer-link-route w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
        <button type="button" class="btn btn-danger btn-sm remove-footer-link-btn text-xs">Remove</button>
    `;
    div.querySelector('.remove-footer-link-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

// --- ADD THIS HELPER FUNCTION ---
function addFooterSocialInputs(containerId, link = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'grid grid-cols-3 gap-3 p-2 border rounded-md bg-gray-50';
    div.innerHTML = `
        <input type="text" value="${link.iconName || ''}" placeholder="Icon (e.g., facebook-f)" 
               class="footer-social-icon w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
        <input type="text" value="${link.url || ''}" placeholder="Full URL (e.g., https://...)" 
               class="footer-social-url w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
        <button type="button" class="btn btn-danger btn-sm remove-footer-link-btn text-xs">Remove</button>
    `;
    div.querySelector('.remove-footer-link-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);
}
async function renderAdminFooterPage() {
    console.log("--- renderAdminFooterPage STARTED ---");
    const form = document.getElementById('footer-editor-form');
    const saveStatus = document.getElementById('footer-editor-save-status');
    
    // Containers for dynamic links
    const socialContainer = document.getElementById('footer-social-links-container');
    const quickLinksContainer = document.getElementById('footer-quicklinks-container');
    const legalLinksContainer = document.getElementById('footer-legal-links-container');

    saveStatus.textContent = 'Loading...';
    form.reset();
    socialContainer.innerHTML = '';
    quickLinksContainer.innerHTML = '';
    legalLinksContainer.innerHTML = '';

    try {
        const data = await fetchAdminAPI('/api/admin/footer_info');

        // Populate Company Info
        document.getElementById('footer-company-title').value = data.companyInfo.title;
        document.getElementById('footer-company-desc').value = data.companyInfo.description;
        data.companyInfo.socialLinks.forEach(link => addFooterSocialInputs('footer-social-links-container', link));

        // Populate Quick Links
        document.getElementById('footer-quicklinks-title').value = data.quickLinks.title;
        data.quickLinks.links.forEach(link => addFooterLinkInputs('footer-quicklinks-container', link));

        // Populate Legal Links
        document.getElementById('footer-legal-title').value = data.legalLinks.title;
        data.legalLinks.links.forEach(link => addFooterLinkInputs('footer-legal-links-container', link));

        // Populate Contact Info
        document.getElementById('footer-contact-title').value = data.contactInfo.title;
        document.getElementById('footer-contact-phone').value = data.contactInfo.phone;
        document.getElementById('footer-contact-email').value = data.contactInfo.email;
        document.getElementById('footer-contact-hours').value = data.contactInfo.openingHours.join('\n');

        // Populate We Accept
        document.getElementById('footer-accept-title').value = data.weAccept.title;
        document.getElementById('footer-accept-images').value = data.weAccept.imageUrls.join('\n');
        
        saveStatus.textContent = '';
    } catch (error) {
        console.error("Error loading Footer content:", error);
        saveStatus.textContent = `Error loading: ${error.message}`;
    }

    // --- Event Listeners ---
    document.getElementById('add-footer-social-link-btn').onclick = () => addFooterSocialInputs('footer-social-links-container');
    document.getElementById('add-footer-quicklink-btn').onclick = () => addFooterLinkInputs('footer-quicklinks-container');
    document.getElementById('add-footer-legal-link-btn').onclick = () => addFooterLinkInputs('footer-legal-links-container');

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveStatus.textContent = 'Saving...';
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        // Helper to read link inputs
        const readLinks = (containerId, type) => {
            const container = document.getElementById(containerId);
            return Array.from(container.children).map(div => {
                if (type === 'social') {
                    return {
                        iconName: div.querySelector('.footer-social-icon').value,
                        url: div.querySelector('.footer-social-url').value
                    };
                } else {
                    return {
                        text: div.querySelector('.footer-link-text').value,
                        routeName: div.querySelector('.footer-link-route').value
                    };
                }
            }).filter(link => (link.text && link.routeName) || (link.iconName && link.url));
        };

        const payload = {
            companyInfo: {
                title: document.getElementById('footer-company-title').value,
                description: document.getElementById('footer-company-desc').value,
                socialLinks: readLinks('footer-social-links-container', 'social')
            },
            quickLinks: {
                title: document.getElementById('footer-quicklinks-title').value,
                links: readLinks('footer-quicklinks-container', 'links')
            },
            legalLinks: {
                title: document.getElementById('footer-legal-title').value,
                links: readLinks('footer-legal-links-container', 'links')
            },
            contactInfo: {
                title: document.getElementById('footer-contact-title').value,
                phone: document.getElementById('footer-contact-phone').value,
                email: document.getElementById('footer-contact-email').value,
                openingHours: document.getElementById('footer-contact-hours').value.split('\n').filter(Boolean)
            },
            weAccept: {
                title: document.getElementById('footer-accept-title').value,
                imageUrls: document.getElementById('footer-accept-images').value.split('\n').filter(Boolean)
            }
        };

        try {
            const response = await fetchAdminAPI('/api/admin/footer_info', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            saveStatus.textContent = response.message || 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 3000);
        } catch (error) {
            console.error("Error saving Footer content:", error);
            saveStatus.textContent = `Error saving: ${error.message}`;
        } finally {
            setButtonLoading(submitBtn, false);
        }
    };
    console.log("--- renderAdminFooterPage FINISHED ---");
}