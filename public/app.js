// FILE: app.js
// This file has been reorganized into logical kits for better maintainability.

// ------------------------------------------------------------------ //
// -------------------- KIT: CORE SETUP & STATE -------------------- //
// ------------------------------------------------------------------ //

// --- PWA SERVICE WORKER REGISTRATION ---
console.log('app.js has started successfully!');


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        console.log('ServiceWorker registration attempt...');
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('ServiceWorker registration successful:', registration))
            .catch(error => console.log('ServiceWorker registration failed: ', error));
    });
}
const CLICK_HANDLERS = [

   
  

    // --- MODAL & OVERLAY HANDLERS (Consolidated) ---
    {
        selector: '#quick-view-close-btn, #quick-view-modal-overlay, #cart-close-btn, #cart-overlay, #mobile-nav-close, #mobile-nav-overlay',
        handler: (target, e) => {
            if (e.target !== target) return false; // Only trigger on direct overlay clicks
            closeQuickViewModal();
            closeCart();
            closeMobileMenu();
        }
    },

    {
    selector: '.product-card .wishlist-btn',
    handler: (target, e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop the click from navigating
        wishlist.toggleWishlist(target.dataset.productId);
        return true;
    }
},
    // --- QUICK VIEW MODAL BUTTONS ---
    {
        selector: '.quick-view-btn',
        handler: (target) => openQuickViewModal(target.dataset.productId)
    },
    {
        selector: '.view-full-details-link',
        handler: (target, e) => {
            e.preventDefault();
            closeQuickViewModal();
            showProductDetail(target.dataset.productId);
        }
    },

    // --- ADD TO BASKET (Upgraded to be Context-Aware) ---
   // STEP 3: REPLACE IT WITH THIS
{
    selector: '.add-to-basket-btn',
    handler: (target, e) => {
        // First, check if the button is on a product card.
        if (target.closest('.product-card')) {
            e.preventDefault();
            e.stopPropagation();
            addToCart(target.dataset.productId, 1);
            return true; // This is crucial to stop the navigation.
        }
        
        // If not, handle the logic for the quick-view modal as before.
        const quickViewModal = target.closest('#quick-view-modal');
        let quantity = 1;
        if (quickViewModal) {
            const qtyInput = quickViewModal.querySelector('#quick-view-quantity');
            if (qtyInput) quantity = parseInt(qtyInput.value, 10);
            closeQuickViewModal();
        }
        addToCart(target.dataset.productId, quantity);
    }
},
    {
        selector: '.add-to-basket-btn-detail',
        handler: (target) => {
            const qtyInput = document.querySelector('#page-detail .quantity-input');
            addToCart(target.dataset.productId, qtyInput ? parseInt(qtyInput.value, 10) : 1);
        }
    },

    // --- QUANTITY BUTTONS (Upgraded to be Context-Aware) ---
    {
        selector: '.decrease-qty',
        handler: (target) => {
            const quickViewModal = target.closest('#quick-view-modal');
            if (quickViewModal) {
                const qtyInput = quickViewModal.querySelector('#quick-view-quantity');
                if (qtyInput && parseInt(qtyInput.value, 10) > 1) {
                    qtyInput.value = parseInt(qtyInput.value, 10) - 1;
                }
            } else {
                changeQuantity(target.dataset.id, -1);
            }
        }
    },
    // THIS IS THE NEW CODE TO ADD
{
    selector: '.decrease-component-qty',
    handler: (target) => {
        changeComponentQuantity(target.dataset.cartItemId, target.dataset.componentId, -1);
    }
},
{
    selector: '.increase-component-qty',
    handler: (target) => {
        changeComponentQuantity(target.dataset.cartItemId, target.dataset.componentId, 1);
    }
},
    {
        selector: '.increase-qty',
        handler: (target) => {
            const quickViewModal = target.closest('#quick-view-modal');
            if (quickViewModal) {
                const qtyInput = quickViewModal.querySelector('#quick-view-quantity');
                if (qtyInput) {
                    const maxQty = parseInt(qtyInput.max, 10);
                    if (parseInt(qtyInput.value, 10) < maxQty) {
                        qtyInput.value = parseInt(qtyInput.value, 10) + 1;
                    }
                }
            } else {
                changeQuantity(target.dataset.id, 1);
            }
        }
    },

    // --- NAVIGATION & PAGE ACTIONS ---
    {
        selector: '.nav-links-desktop a, .mobile-nav-links a, .footer-column a',
        handler: (target, e) => {
            if (target.dataset.argument === undefined) return false;
            e.preventDefault();
            handleMenuClick({ argument: target.dataset.argument, target: target.dataset.target, title: target.textContent });
            closeMobileMenu();
            return true;
        }
    },
    {
        selector: 'a[data-target]',
        handler: (target, e) => {
            const pageTarget = target.dataset.target;
            if (pageTarget && pageTarget.startsWith('/') && pageTarget !== '/product-listing') {
                e.preventDefault();
                let pageName = pageTarget.replace('/', '').replace(/-/g, '_');
                if (pageName === 'terms_conditions') pageName = 'terms_and_conditions';
                fetchAndDisplayStaticPage(pageName);
                return true;
            }
            return false;
        }
    },
   
    { selector: '#header-title', handler: showAllProducts },
    { selector: '#hero-shop-now-btn', handler: () => document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' }) },
    { selector: '#secondary-hero-btn', handler: () => { selectedCustomItems = []; fetchCustomHamperItems(); } },
    {
        selector: '.occasion-card',
        handler: (target) => {
            currentCategoryFilter = target.dataset.navigationArgument;
            currentTagFilter = null;
            document.getElementById('search-input').value = '';
            showPage('list');
            updateProductView();
        }
    },

    // --- CART & CHECKOUT ACTIONS ---
    { selector: '.cart-icon-wrapper', handler: openCart },
    { selector: '.cart-item-remove-btn', handler: (target) => removeFromCart(target.dataset.id) },
   {
    selector: '#go-to-checkout-btn',
    handler: () => {
        closeCart();
        if (auth.isLoggedIn()) {
            router.navigate('/checkout');
        } else {
            // Remember where the user wants to go after logging in.
            postLoginRedirectPath = '/checkout';
            router.navigate('/login');
        }
    }
},
{
    selector: '.cancel-return-btn',
    handler: (target) => {
        const returnId = target.dataset.returnId;
        showConfirmationModal('Are you sure you want to cancel this return request?', async () => {
            try {
                // 1. Sends the correct PUT request to the back end
                await fetchWithAuth(`/api/returns?returnId=${returnId}`, {
                    method: 'PUT'
                });

                // 2. Finds the return in the local list and updates its status
                const returnToUpdate = userReturns.find(ret => ret.id === returnId);
                if (returnToUpdate) {
                    returnToUpdate.status = 'Cancelled';
                }
                
                // 3. Re-renders the page to show the new status immediately
                renderMyReturnsPage();
                showConfirmationModal('Your return request has been cancelled.');

            } catch (error) {
                console.error('Failed to cancel return:', error);
                showConfirmationModal(`Error: ${error.message}`);
            }
        });
    }
},
      {
        selector: '#place-order-btn',
        handler: (target, e) => {
            // Prevent the default button behavior
            e.preventDefault(); 
            // Now, call the placeOrder function to handle the order logic
            placeOrder();
        }
    },
    {
        selector: '#cart-discount-form, #checkout-discount-form',
        handler: (target, e) => {
            e.preventDefault();
            const source = target.id.startsWith('cart') ? 'cart' : 'checkout';
            const input = document.getElementById(`${source}-discount-code`);
            if (input.value) applyDiscount(input.value, source);
        }
    },

    // --- MY ACCOUNT & AUTH ---
    { selector: '.account-icon-wrapper, .mobile-account-link, #mobile-menu-account-link', handler: () => { renderAccountPage(); closeMobileMenu(); } },
   
    { selector: '#show-register', handler: (target, e) => { e.preventDefault(); renderRegisterPage(); } },
    { selector: '#show-login', handler: (target, e) => { e.preventDefault(); renderLoginPage(); } },
    { 
    selector: '#logout-btn', 
    handler: () => { 
        auth.logout(); 
        showAllProducts(); 
    } 
},
    // Replace the old handler with this one
{
    selector: '#orders-back-to-account, #addresses-back-to-account, #returns-back-to-account, #back-to-account, #wishlist-back-to-account',
    handler: () => router.navigate('/account')
},
    { selector: '.view-order-details', handler: (target) => renderOrderDetailPage(target.dataset.orderId) },
    { selector: '#back-to-orders', handler: renderMyOrdersPage },
    { selector: '#add-new-address-main', handler: () => { addressFormReturnPath = 'account'; renderAddressForm(); } },
    {
        selector: '#back-to-addresses',
        handler: () => {
            if (addressFormReturnPath === 'checkout') { displayCheckoutPage(); } else { renderMyAddressesPage(); }
            addressFormReturnPath = null;
        }
    },
    { selector: '.edit-address', handler: (target) => renderAddressForm(userAddresses.find(addr => addr.id === target.dataset.addressId)) },
    { 
        selector: '.delete-address', 
        handler: (target) => {
            const addressId = target.dataset.addressId;
            showConfirmationModal('Are you sure you want to delete this address?', async () => {
                try {
                    await fetchWithAuth(`/api/addresses?addressId=${addressId}`, { method: 'DELETE' });
                    // Refresh the list from the server after deleting
                    userAddresses = userAddresses.filter(addr => addr.id !== addressId);
                    renderMyAddressesPage();
                } catch (error) {
                    showConfirmationModal(`Error deleting address: ${error.message}`);
                }
            });
        }
    },
    { 
        selector: '.set-default-address', 
        handler: async (target) => {
            const addressId = target.dataset.addressId;
            const addressToUpdate = userAddresses.find(addr => addr.id === addressId);
            if (!addressToUpdate) return;
            
            try {
                // Set the isDefault flag to true and send the update
                await fetchWithAuth('/api/addresses', {
                    method: 'PUT',
                    body: JSON.stringify({ addressId, ...addressToUpdate, isDefault: true })
                });
                // Refresh the list from the server to get the updated states
                userAddresses = await fetchWithAuth('/api/addresses');
                renderMyAddressesPage();
            } catch (error) {
                showConfirmationModal(`Error setting default address: ${error.message}`);
            }
        }
    },


    // --- MISC & FALLBACKS ---
    { selector: '#mobile-menu-toggle', handler: openMobileMenu },
    { selector: '#clear-search-btn', handler: showAllProducts },
    { selector: '#back-to-list-detail', handler: showAllProducts },
    {
        selector: '.edit-hamper-btn',
        handler: (target) => {
            const cartItem = cart.find(item => item.id === target.dataset.id);
            if (cartItem?.isCustom) {
                closeCart();
                editingCartItemId = target.dataset.id;
                selectedCustomItems = [...cartItem.contents];
                displayCreateYourOwnPage();
            }
        }
    },
    {
        selector: '.wishlist-btn',
        handler: (target) => wishlist.toggleWishlist(target.dataset.productId)
    },
    
// THIS IS THE NEW, CORRECTED CODE
{
    selector: '.wishlist-toggle-btn',
    handler: (target) => {
        wishlist.toggleWishlist(target.dataset.productId);
    }
},


    // This is the handler for the image carousel inside the product card
    {
        selector: '.product-image-container .carousel-arrow, .product-image-container .dot',
        handler: (target, e) => {
            e.stopPropagation();
            const imageContainer = target.closest('.product-image-container');
            if (!imageContainer) return;
            updateCarousel(imageContainer, target.matches('.carousel-arrow')
                ? parseInt(imageContainer.dataset.currentIndex, 10) + parseInt(target.dataset.direction, 10)
                : parseInt(target.dataset.index, 10));
        }
    },
    // This is the handler for the image carousel inside the product detail page
    {
        selector: '.detail-image-container .carousel-arrow, .detail-image-container .dot',
        handler: (target, e) => {
            e.stopPropagation();
            const imageContainer = target.closest('.detail-image-container');
            let currentIndex = parseInt(imageContainer.dataset.currentIndex, 10);
            let newIndex = currentIndex;
            if (target.matches('.carousel-arrow')) {
                newIndex = currentIndex + parseInt(target.dataset.direction, 10);
            } else if (target.matches('.dot')) {
                newIndex = parseInt(target.dataset.index, 10);
            }
            updateCarousel(imageContainer, newIndex);
        }
    },
];
// --- GLOBAL STATE MANAGEMENT ---
// ... (your other variables)
// Add these with your other global variables
let addressFormReturnPath = null; // Add this line
let allDiscounts = [];
let appliedDiscount = null;
let checkoutStep = 1; // 1: Details, 2: Payment, 3: Review
let guestDetails = {}; // To store guest info between steps
let editingCartItemId = null; // Tracks the ID of the hamper being edited
let ribbonTimeout = null;     // Manages the timer for the confirmation ribbon
let allProducts = [], cart = [], customHamperItems = [], selectedCustomItems = [];
let userOrders = [], userAddresses = [], userReturns = [];
let appConfig = {};
let currentCarouselIndex = 0;
let currentlyDisplayedProducts = [];
let confirmCallback = null;
let currentCategoryFilter = 'all'; // New: To store the active category filter from menu/occasions
let currentTagFilter = null; // New: To store the active tag filter (e.g., 'BESTSELLER', 'SALE')
let lastScrollTop = 0; // For hide-on-scroll header
let isInitialAuthCheck = true; // This flag will help the app know when it's running for the very first time on a page load.
let postLoginRedirectPath = null;

// --- DOM ELEMENT CONSTANTS ---
const headerTitle = document.getElementById('header-title');
const navLinksContainer = document.getElementById('nav-links');
const headerIconsContainer = document.getElementById('header-icons');
const productsSectionTitle = document.getElementById('products-section-title');
const productGrid = document.getElementById('product-grid');
const occasionsGrid = document.getElementById('occasions-grid');
const viewAllBtn = document.getElementById('view-all-btn');
const footerContainer = document.getElementById('footer-container');
const footerBottomContainer = document.getElementById('footer-bottom');
const sideCart = document.getElementById('side-cart');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartItemsContainer = document.getElementById('cart-items');
const subtotalAmountElement = document.getElementById('subtotal-amount');
const goToCheckoutBtn = document.getElementById('go-to-checkout-btn');
const cartOverlay = document.getElementById('cart-overlay');
const addedToCartSheet = document.getElementById('added-to-cart-sheet');
const addedToCartOverlay = document.getElementById('added-to-cart-overlay');
const searchResultsInfo = document.getElementById('search-results-info');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
const mobileNavClose = document.getElementById('mobile-nav-close');
const mobileNavLinks = document.getElementById('mobile-nav-links');
const confirmationModalOverlay = document.getElementById('confirmation-modal-overlay');
const confirmationModal = document.getElementById('confirmation-modal');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const mainHeader = document.querySelector('.main-header');
const productsSection = document.getElementById('products-section');
const SHOW_LOW_STOCK_INDICATOR = true;
const LOW_STOCK_THRESHOLD = 10; // Shows message for stock of 10 or less


// --- PAGE CONTAINER CONSTANTS ---
const pageList = document.getElementById('page-list');
const pageDetail = document.getElementById('page-detail');
const pageCheckout = document.getElementById('page-checkout');
const pageCreate = document.getElementById('page-create');
const pageStatic = document.getElementById('page-static');
const pageLogin = document.getElementById('page-login');
const pageRegister = document.getElementById('page-register');
const pageAccount = document.getElementById('page-account');
const pageMyOrders = document.getElementById('page-my-orders');
const pageMyAddresses = document.getElementById('page-my-addresses');
const pageOrderDetail = document.getElementById('page-order-detail');
const pageAddressForm = document.getElementById('page-address-form');
const pageAccountSettings = document.getElementById('page-account-settings');
const pageMyReturns = document.getElementById('page-my-returns');
const pageReturnRequest = document.getElementById('page-return-request');
const pageReturnDetail = document.getElementById('page-return-detail');
const pageWishlist = document.getElementById('page-wishlist');
const quickViewModalOverlay = document.getElementById('quick-view-modal-overlay');
const quickViewContent = document.getElementById("quick-view-content");

// ADD THIS HELPER FUNCTION to your public/app.js file

function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = '';

    if (password.length >= 8) {
        strength++;
    }
    if (password.match(/[0-9]/)) { // Contains a number
        strength++;
    }
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) { // Contains both lowercase and uppercase
        strength++;
    }
    if (password.match(/[^A-Za-z0-9]/)) { // Contains a special character
        strength++;
    }

    switch (strength) {
        case 0:
        case 1:
            feedback = 'Weak';
            break;
        case 2:
            feedback = 'Medium';
            break;
        case 3:
        case 4:
            feedback = 'Strong';
            break;
        default:
            feedback = '';
    }
    return { score: strength, feedback: feedback };

    



}

// ----------------------------------------------------------------- //
// -------------------- KIT: ROUTER IMPLEMENTATION ----------------- //
// ----------------------------------------------------------------- //

// In app.js, replace your entire `router` object with this one.

// In app.js

const router = {
    routes: {},
    currentPath: '',
   init() {
    // Only listen for hash changes. The initial page render is now correctly
    // handled after the user data has been fetched.
    window.addEventListener('hashchange', () => this.handleRouteChange());
},
    addRoute(path, handler) { this.routes[path] = handler; },
    handleRouteChange() {
        const path = (window.location.hash.slice(1) || '/').split('?')[0];
        this.currentPath = path;
        this.loadRoute(path);
    },
    loadRoute(path) {
        // Dynamic route matching
        for (const routePath in this.routes) {
            if (routePath.includes(':')) {
                const routeParts = routePath.split('/');
                const pathParts = path.split('/');
                if (routeParts.length === pathParts.length) {
                    const params = {};
                    const isMatch = routeParts.every((part, i) => {
                        if (part.startsWith(':')) {
                            params[part.slice(1)] = decodeURIComponent(pathParts[i]);
                            return true;
                        }
                        return part === pathParts[i];
                    });
                    if (isMatch) {
                        this.routes[routePath](params);
                        return;
                    }
                }
            }
        }
        // Static route matching
        if (this.routes[path]) {
            this.routes[path]();
        } else {
            this.navigate('/');
        }
    },
    navigate(path) {
        if (window.location.hash.slice(1) !== path) window.location.hash = path;
    }
};

function defineRoutes() {
    router.addRoute('/', renderHomePage);
    router.addRoute('/category/:name', params => handleMenuClick({ argument: params.name }));
    router.addRoute('/create-your-own', () => handleMenuClick({ target: '/create-your-own' }));
    router.addRoute('/products/:slug', params => showProductDetail(params.slug));
    router.addRoute('/checkout', displayCheckoutPage);
    router.addRoute('/login', renderLoginPage);
    router.addRoute('/register', renderRegisterPage);
    router.addRoute('/account', renderAccountPage);
    router.addRoute('/account/orders', renderMyOrdersPage);
    router.addRoute('/account/orders/:id', params => renderOrderDetailPage(params.id));
    router.addRoute('/account/addresses', renderMyAddressesPage);
    router.addRoute('/account/addresses/new', () => { addressFormReturnPath = '/account/addresses'; renderAddressForm(); });
    router.addRoute('/account/addresses/edit/:id', params => {
        addressFormReturnPath = '/account/addresses';
        const address = userAddresses.find(a => a.id === params.id);
        renderAddressForm(address);
    });
    router.addRoute('/account/settings', renderAccountSettingsPage);
    router.addRoute('/account/wishlist', renderWishlistPage);
    router.addRoute('/account/returns', renderMyReturnsPage);
    router.addRoute('/contact-us', () => fetchAndDisplayStaticPage('contact_us'));
    // ... add other static routes as needed
}

// In app.js, near your other router functions

function createSlug(text) {
  if (!text) return '';
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/&/g, '-and-')         // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}
// -------------------------------------------------------------------- //
// -------------------- KIT: INITIALIZATION & EVENTS -------------------- //
// -------------------------------------------------------------------- //

// In app.js

// In app.js
document.addEventListener('DOMContentLoaded', async () => { // Make the function async
    console.log("DOM content loaded. Initializing app...");

    // 1. FIX: Fetch critical config first and wait for it
    await fetchConfig();

    // 2. Setup core UI and load cart (which can now safely use appConfig)
    setupEventListeners();
    updateHeaderIcons();
    loadCart();
    initializePushNotifications();

    // 3. Define all application routes FIRST
    defineRoutes();

    // 4. Initialize the router so it can handle the initial page load
    router.init();

    // 5. Start fetching all OTHER data in the background
    const startupTasks = [
        fetchProducts(), fetchDiscounts(), fetchMenu(), fetchFooterInfo(),
        fetchOccasions(), fetchFeatures(), fetchTestimonials() // Remove fetchConfig() from here
    ];
    Promise.allSettled(startupTasks).then(() => {
        console.log("Background data loading has completed.");
    });
});

// It updates all visible wishlist icons without reloading the page.
function updateAllWishlistIcons() {
    const wishlistedIds = wishlist.getAllItemIds();
    // Select all possible wishlist buttons on the page
    const allWishlistButtons = document.querySelectorAll('.wishlist-btn, .wishlist-toggle-btn');

    allWishlistButtons.forEach(button => {
        const productId = button.dataset.productId;
        const isWishlisted = wishlistedIds.includes(String(productId));

        // For the small heart icons on product cards (in the main list or related products)
        button.classList.toggle('favorited', isWishlisted);

        // Specifically for the main "Save/Saved" button on the product detail page
        if (button.classList.contains('wishlist-toggle-btn')) {
            const buttonTextSpan = button.querySelector('span');
            if (buttonTextSpan) {
                buttonTextSpan.textContent = isWishlisted ? 'Saved' : 'Save';
            }
        }
    });
}



// In app.js

async function handleAuthStateChange() {
    console.log("Authentication state changed.");
    updateHeaderIcons();

    if (auth.isLoggedIn()) {
        // --- THIS IS THE FIX ---
        // First, load the cart from localStorage. At this point, auth.js
        // has already restored the user's saved cart to localStorage.
        loadCart();
        // --- END FIX ---
        
        // Then, fetch other user-specific data like orders and addresses.
        await fetchInitialUserData();
    } else {
        // This part is for logging out, and it correctly loads the empty cart.
        userAddresses = [];
        userOrders = [];
        userReturns = [];
        loadCart(); 
    }
    
    router.handleRouteChange();
}
async function fetchConfig() {
    console.log("fetchConfig: Fetching app configuration.");
    try {
        const configData = await fetchData('data/config.json');
        if (configData) {
            appConfig = configData;
        } else {
            // This will log an error if the file is empty or malformed
            console.error("Failed to parse config.json. Please check the file for syntax errors (e.g., trailing commas).");
        }
    } catch (error) {
        console.error("Error fetching config.json:", error);
    }
}
function setupSwipeListeners(element) {
    let touchstartX = 0;
    let touchendX = 0;

    // This function remains the same
    function handleGesture(container, deltaX) {
        if (!container) return;
        if (Math.abs(deltaX) > 50) { // Minimum swipe distance
            let currentIndex = parseInt(container.dataset.currentIndex, 10);
            if (deltaX < 0) { // Swipe Left (Next)
                updateCarousel(container, currentIndex + 1);
            } else { // Swipe Right (Previous)
                updateCarousel(container, currentIndex - 1);
            }
        }
    }

    element.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    // The 'touchend' listener is updated to be smarter
    element.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        const container = e.target.closest('.product-image-container, .detail-image-container');
        const deltaX = touchendX - touchstartX;

        // If a significant swipe occurred, prevent the default action (like a click)
        if (container && Math.abs(deltaX) > 50) {
            e.preventDefault();
            handleGesture(container, deltaX);
        }
    });
}

function setupEventListeners() {
    console.log("setupEventListeners: Attaching event listeners.");
    window.addEventListener('resize', renderFooterLayout); // Add this line
    document.body.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', manageFilterLocation);
    window.addEventListener('authchange', handleAuthStateChange);
      pageAddressForm.addEventListener('submit', (e) => {
        // Check if the submission came from our specific form
        if (e.target && e.target.id === 'address-form') {
            handleSaveAddress(e);
        }
    });
// (Inside the setupEventListeners function in app.js)
// THIS IS THE NEW, CORRECTED CODE
window.addEventListener('wishlistChange', () => {
    // If on the main product list, re-render the grid.
    if (pageList.style.display !== 'none') {
        updateProductView();
    }
    // If on the product detail page, just update the icons without a disruptive re-render.
    if (pageDetail.style.display !== 'none') {
        updateAllWishlistIcons();
    }
    // If on the dedicated wishlist page, re-render it.
    if (document.getElementById('page-wishlist')?.style.display !== 'none') {
        renderWishlistPage();
    }
});
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('newsletter-email').value;
            showConfirmationModal(`Thank you for subscribing, ${email}! (This is a demo).`);
            newsletterForm.reset();
        });
        console.log("Event Listener: Newsletter form submission attached.");
    }

    document.getElementById('search-form')?.addEventListener('submit', handleSearch);
    document.getElementById('search-input')?.addEventListener('input', handleSearch);
    
    document.getElementById('sort-select')?.addEventListener('change', updateProductView);
    document.getElementById('filter-select')?.addEventListener('change', updateProductView);
    
    if(modalConfirmBtn) {
        modalConfirmBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            hideConfirmationModal();
        });
    }

    if(modalCancelBtn) {
        modalCancelBtn.addEventListener('click', hideConfirmationModal);
    }
    document.getElementById('added-to-cart-overlay')?.addEventListener('click', closeAddedToCartSheet);
}


function handleScroll() {
    // Only apply hide-on-scroll for mobile view
    if (window.innerWidth >= 768) {
        document.body.classList.remove('hide-header');
        return;
    }
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    // Hide header only if scrolling down and past the header's height
    if (scrollTop > lastScrollTop && scrollTop > mainHeader.offsetHeight) {
        document.body.classList.add('hide-header');
    } else {
        document.body.classList.remove('hide-header');
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}

function manageFilterLocation() {
    const filterContainer = document.querySelector('.filter-sort-container');
    const mobileContainer = document.getElementById('mobile-filter-container');
    if (!filterContainer || !mobileContainer) return;

    const filterGroup = filterContainer.querySelector('.filter-group:first-child');
    const sortGroup = filterContainer.querySelector('.filter-group:last-child');
    if (!filterGroup || !sortGroup) return;

    // This function now ONLY moves the elements. It does not set style.display.
    if (window.innerWidth < 992) {
        if (filterGroup.parentElement !== mobileContainer) {
            mobileContainer.appendChild(filterGroup);
            mobileContainer.appendChild(sortGroup);
        }
    } else {
        if (filterGroup.parentElement !== filterContainer) {
            filterContainer.appendChild(filterGroup);
            filterContainer.appendChild(sortGroup);
        }
    }
}




// REPLACE your existing handleGlobalClick function with this.
// In app.js

function handleGlobalClick(e) {
    // --- STEP 1: Check for specific button clicks first ---
    // The CLICK_HANDLERS array will now contain special handlers for our buttons.
    // If a handler is found and it returns `true`, we stop everything.
    for (const action of CLICK_HANDLERS) {
        const target = e.target.closest(action.selector);
        if (target) {
            const result = action.handler(target, e);
            if (result !== false) return; // Stop if the handler was successful.
        }
    }

    // --- STEP 2: If no specific button was clicked, handle it as a router navigation ---
    const link = e.target.closest('a[href^="/#"]');
    if (link) {
        e.preventDefault();
        // This corrected path ensures the leading '/' is always present
       const path = link.hash.slice(1);
        router.navigate(path);
        if (document.getElementById('mobile-nav-overlay')?.classList.contains('active')) {
            closeMobileMenu();
        }
    }
}

// In app.js

function displayMenu(menuItems) {
    const navLinksContainer = document.getElementById('nav-links');
    const mobileNavLinks = document.getElementById('mobile-nav-links');
    if (!navLinksContainer || !mobileNavLinks) return;

    let mobileMenuHtml = `<a href="/#/account" class="mobile-nav-link-item account-link"><i class="fa-solid fa-user"></i> My Account / Log In</a>`;
    let desktopMenuHtml = '';

    menuItems.forEach(item => {
        let link = '';
        const saleClass = item.isSale ? 'sale-item' : '';

        // This is the fix: check for the special target
        if (item.target === '/create-your-own') {
            link = '/#/create-your-own';
        } else {
            // Otherwise, create the standard category link
            link = `/#/category/${item.argument}`;
        }

        desktopMenuHtml += `<a href="${link}" class="nav-links-desktop-item ${saleClass}">${item.title}</a>`;
        mobileMenuHtml += `<a href="${link}" class="mobile-nav-link-item ${saleClass}">${item.title}</a>`;
    });

    navLinksContainer.innerHTML = desktopMenuHtml;
    mobileNavLinks.innerHTML = mobileMenuHtml;
}

// ------------------------------------------------------------------ //
// -------------------- KIT: DATA FETCHING (API) -------------------- //
// ------------------------------------------------------------------ //



async function fetchWithAuth(url, options = {}) {
    const user = firebase.auth().currentUser;
    if (!user) {
        // If there's no user, we can't make an authenticated request.
        // Depending on the use case, you might want to throw an error
        // or return a specific status.
        return Promise.reject(new Error("User not logged in"));
    }

    const token = await user.getIdToken();

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const config = {
        ...options,
        headers: headers
    };

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        // If the response has no content (like for a DELETE request), return success
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return { success: true };
        }
        return response.json();
    } catch (error) {
        console.error(`Authenticated fetch failed for ${url}:`, error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}

// Add this with your other data fetching functions
async function fetchDiscounts() {
    console.log("fetchDiscounts: Fetching discount codes.");
    allDiscounts = await fetchData('data/discounts.json') || [];
}

async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Could not fetch data from ${url}:`, error);
        return null;
    }
}

// REPLACE this entire function in your public/app.js file

// REPLACE your entire existing fetchInitialUserData function with this one.

async function fetchInitialUserData() {
    if (auth.isLoggedIn()) {
        try {
            console.log("Fetching user data (addresses, orders, and returns)...");
            
            const results = await Promise.allSettled([
                fetchWithAuth('/api/addresses'),
                fetchWithAuth('/api/get-orders'),
                fetchWithAuth('/api/returns') // <-- ADDED: The call to fetch returns
            ]);

            const addressesResult = results[0];
            const ordersResult = results[1];
            const returnsResult = results[2]; // <-- ADDED: Get the result for the returns call

            if (addressesResult.status === 'fulfilled') {
                userAddresses = addressesResult.value;
                console.log("Successfully fetched addresses:", userAddresses.length);
            } else {
                console.error("Failed to fetch user addresses:", addressesResult.reason);
                userAddresses = [];
            }

            if (ordersResult.status === 'fulfilled') {
                userOrders = ordersResult.value;
                console.log("Successfully fetched orders:", userOrders.length);
            } else {
                console.error("Failed to fetch user orders:", ordersResult.reason);
                userOrders = [];
            }

            // --- ADDED: This block processes the result of the returns API call ---
            if (returnsResult.status === 'fulfilled') {
                userReturns = returnsResult.value;
                console.log("Successfully fetched returns:", userReturns.length);
            } else {
                console.error("Failed to fetch user returns:", returnsResult.reason);
                userReturns = [];
            }
            // --- END ADDED BLOCK ---
            
        } catch (error) {
            console.error("A critical error occurred during initial user data fetch:", error);
            userAddresses = [];
            userOrders = [];
            userReturns = []; // Ensure returns is also cleared on a critical error
        }
    } else {
        // Clear data for logged-out users
        userOrders = [];
        userAddresses = [];
        userReturns = [];
    }
    return Promise.resolve();
}


async function fetchProducts() {
    console.log("fetchProducts: Fetching products data from backend API.");
    // Instead of fetching a local JSON file, we now fetch from our Vercel serverless function.
    // When you deploy, this will be your live Vercel URL. For local testing,
    // you will use the Vercel CLI which provides a local URL.
    const productsData = await fetchData('/api/products'); // <-- THE ONLY CHANGE IS THIS URL
    if (productsData && !productsData.error) {
        allProducts = productsData.map(product => {
            const rawPrice = product.price;
            let parsedPrice = rawPrice;

            if (typeof rawPrice === 'string') {
                parsedPrice = parseFloat(rawPrice.replace(/[^\d.-]/g, ''));
            }

            if (typeof parsedPrice !== 'number' || isNaN(parsedPrice)) {
                console.warn(`[FETCH ERROR] Product ID ${product.id} has an invalid price: "${rawPrice}". Setting to 0.`);
                parsedPrice = 0;
            }

            return {
                ...product,
                price: parsedPrice
            };
        });
        currentlyDisplayedProducts = [...allProducts];
        updateProductView();
    } else {
        console.error("Failed to fetch products from /api/products:", productsData ? productsData.error : "No data returned");
        allProducts = [];
        currentlyDisplayedProducts = [];
        // Optionally, display an error to the user on the page
        const productGrid = document.getElementById('product-grid');
        if (productGrid) {
            productGrid.innerHTML = `<p style="color: red; text-align: center;">Error: Could not load products from the server. Please try again later.</p>`;
        }
    }
}

async function fetchOccasions() {
    console.log("fetchOccasions: Fetching occasions data.");
    const occasions = await fetchData('data/occasions.json');
    if (occasions) displayOccasions(occasions);
}

async function fetchMenu() {
    console.log("fetchMenu: Fetching menu data.");
    const menuItems = await fetchData('data/Header_nav.json');
    if (menuItems) displayMenu(menuItems);
}

async function fetchFooterInfo() {
    console.log("fetchFooterInfo: Fetching footer info.");
    const footerInfo = await fetchData('data/footer_info.json');
    if (footerInfo) displayFooter(footerInfo);
}

// In app.js, replace the entire function// In app.js, replace the entire function
// FILE: app.js
// Replace your old fetchCustomHamperItems function with this new version.

async function fetchCustomHamperItems() {
    console.log("fetchCustomHamperItems: Fetching components from backend API.");
    // This now fetches from our new Vercel serverless function instead of the local JSON file.
    const customHamperData = await fetchData('/api/custom-hamper-components');

    if (customHamperData && !customHamperData.error) {
        customHamperItems = customHamperData.map(item => {
            const rawPrice = item.price;
            let parsedPrice = 0;

            if (typeof rawPrice === 'string') {
                parsedPrice = parseFloat(rawPrice.replace(/[^\d.-]/g, ''));
            } else if (typeof rawPrice === 'number') {
                parsedPrice = rawPrice;
            }

            return {
                ...item,
                price: isNaN(parsedPrice) ? 0 : parsedPrice
            };
        });

        if (editingCartItemId === null) {
            selectedCustomItems = [];
        }
        displayCreateYourOwnPage();
    } else {
        console.error("Failed to fetch custom hamper items:", customHamperData ? customHamperData.error : "No data returned");
        customHamperItems = [];
        displayCreateYourOwnPage(); // Still render the page but it will be empty
    }
}

async function fetchFeatures() {
    console.log("fetchFeatures: Fetching features data.");
    const features = await fetchData('data/features.json');
    if (features) displayFeatures(features);
}

async function fetchTestimonials() {
    console.log("fetchTestimonials: Fetching testimonials data.");
    const testimonials = await fetchData('data/testimonials.json');
    if (testimonials) displayTestimonials(testimonials);
}

// ---------------------------------------------------------------- //
// -------------------- KIT: FOOTER ------------------------------- //
// ---------------------------------------------------------------- //

function displayFooter(footerInfo) {
    if (!footerInfo || !footerContainer || !footerBottomContainer) return;
    
    window.footerContent = {
        companyInfo: footerInfo.companyInfo,
        quickLinks: footerInfo.quickLinks,
        legalLinks: footerInfo.legalLinks,
        contactInfo: footerInfo.contactInfo,
        weAccept: footerInfo.weAccept,
    };

    renderFooterLayout();
    
    footerBottomContainer.innerHTML = `<p>&copy; ${new Date().getFullYear()} LuxuryHampers. All Rights Reserved.</p>`;
}
function renderHomePage() {
    console.log("Router is rendering the homepage.");
    showAllProducts();
}
function renderFooterLayout() {
    if (!window.footerContent) return;

    const { companyInfo, quickLinks, legalLinks, contactInfo, weAccept } = window.footerContent;
    const createLinks = (links) => links.map(link => `<li><a href="#" data-target="${link.routeName || ''}">${link.text || ''}</a></li>`).join('');

    const companyInfoHtml = `<div class="footer-column footer-col-about"><h4>${companyInfo.title}</h4><p>${companyInfo.description}</p><div class="social-links">${companyInfo.socialLinks.map(link => `<a href="${link.url}" target="_blank"><i class="fab ${getSocialIconClass(link.iconName)}"></i></a>`).join('')}</div></div>`;
    const quickLinksHtml = `<div class="footer-column footer-col-quicklinks"><h4>${quickLinks.title}</h4><ul>${createLinks(quickLinks.links)}</ul></div>`;
    const legalLinksHtml = `<div class="footer-column footer-col-legal"><h4>${legalLinks.title}</h4><ul>${createLinks(legalLinks.links)}</ul></div>`;
    const contactInfoHtml = `<div class="footer-column footer-col-contact"><h4>${contactInfo.title}</h4><p><i class="fas fa-phone"></i> ${contactInfo.phone}</p><p><i class="fas fa-envelope"></i> ${contactInfo.email}</p><h4>Opening Hours</h4>${contactInfo.openingHours.map(line => `<p>${line}</p>`).join('')}</div>`;
    const weAcceptHtml = `<div class="footer-column footer-col-payment"><h4>${weAccept.title}</h4><div class="payment-icons"><i class="fab fa-cc-visa"></i><i class="fab fa-cc-mastercard"></i><i class="fab fa-cc-paypal"></i><i class="fab fa-cc-amex"></i></div></div>`;

    if (window.innerWidth >= 1024) {
        // For large screens, build a 5-column structure
        footerContainer.innerHTML = `
            ${companyInfoHtml}
            ${quickLinksHtml}
            ${legalLinksHtml}
            ${contactInfoHtml}
            ${weAcceptHtml}
        `;
    } else {
        // For small screens, build the 2-column structure with "We Accept" on the left
        footerContainer.innerHTML = `
            <div class="footer-left-column">
                ${companyInfoHtml}
                ${legalLinksHtml}
                ${weAcceptHtml} 
            </div>
            <div class="footer-right-column">
                ${quickLinksHtml}
                ${contactInfoHtml}
            </div>
        `;
    }
}
function getSocialIconClass(iconName) {
    switch (iconName ? iconName.toLowerCase() : '') {
        case 'facebook-f': return 'fa-facebook-f';
        case 'x-twitter': return 'fa-x-twitter';
        case 'pinterest-p': return 'fa-pinterest-p';
        case 'instagram': return 'fa-instagram';
        case 'youtube': return 'fa-youtube';
        default: return `fa-globe`;
    }
}function getContactIconClass(iconName) {
    const map = {
        phonealt: 'fa-solid fa-phone-alt',
        solidenvelope: 'fa-solid fa-envelope',
        mapmarkeralt: 'fa-solid fa-map-marker-alt'
    };
    return map[iconName.toLowerCase()] || 'fa-solid fa-question-circle';
}
// -------------------------------------------------------------------- //
// -------------------- KIT: PRODUCT DISPLAY & FILTERS -------------------- //
// -------------------------------------------------------------------- //

function showBestsellersAsHomepage() {
    console.log("showBestsellersAsHomepage: Setting initial view to Bestsellers.");
    currentTagFilter = 'BESTSELLER';
    currentCategoryFilter = 'all';

    const filterSelect = document.getElementById('filter-select');
    const sortSelect = document.getElementById('sort-select');
    if(filterSelect) filterSelect.value = 'all';
    if(sortSelect) sortSelect.value = 'default';

    document.querySelectorAll('.nav-links-desktop a, .mobile-nav-links a').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('a[data-argument="Bestsellers"]').forEach(l => l.classList.add('active'));

    updateProductView();
}
// In app.js
function updateProductView() {
    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const priceFilterValue = document.getElementById('filter-select')?.value || 'all';
    const sortValue = document.getElementById('sort-select')?.value || 'default';
    const productsSection = document.getElementById('products-section');
    const productsSectionTitle = document.getElementById('products-section-title'); // Get the title element

    // --- LOGIC TO TRIGGER SEARCH MODE ---
    if (searchTerm && window.innerWidth < 768) {
        productsSection.classList.add('search-active');
    } else {
        productsSection.classList.remove('search-active');
    }

    let productsToDisplay = [...allProducts];
    let currentTitle = "All Hampers"; // Default title

    // --- Filter and Sort Logic ---
    if (currentTagFilter) {
        productsToDisplay = productsToDisplay.filter(p => p.tag === currentTagFilter);
        currentTitle = currentTagFilter === 'BESTSELLER' ? 'Bestsellers' : 'Special Sale Items';
    } else if (currentCategoryFilter !== 'all') {
        productsToDisplay = productsToDisplay.filter(p => p.category === currentCategoryFilter);
        currentTitle = currentCategoryFilter;
    }
    // (The rest of your filtering and sorting logic remains the same)
    if (priceFilterValue.startsWith('price-')) {
        const range = priceFilterValue.replace('price-', '').split('-');
        const min = Number(range[0]);
        const max = range.length > 1 ? Number(range[1]) : Infinity;
        productsToDisplay = productsToDisplay.filter(p => p.price >= min && p.price < max);
    }
    if (searchTerm) {
        productsToDisplay = productsToDisplay.filter(p => p.title.toLowerCase().includes(searchTerm) || p.category.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm));
        currentTitle = `Search Results for "${searchTerm}"`;
    }
    switch (sortValue) {
        case 'price-asc': productsToDisplay.sort((a, b) => a.price - b.price); break;
        case 'price-desc': productsToDisplay.sort((a, b) => b.price - a.price); break;
        case 'name-asc': productsToDisplay.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'name-desc': productsToDisplay.sort((a, b) => b.title.localeCompare(a.title)); break;
    }
    
    // --- THIS IS THE FIX ---
    // Update the title on the page
    if(productsSectionTitle) {
        productsSectionTitle.textContent = currentTitle;
    }
    
    currentlyDisplayedProducts = productsToDisplay;
    displayProducts(currentlyDisplayedProducts);
}

function getProductImageUrls(product) {
    if (product && product.imageUrls && product.imageUrls.length > 0) return product.imageUrls;
    if (product && product.imageUrl) return [product.imageUrl];
    return ['https://placehold.co/600x400/f3f4f6/9ca3af?text=No+Image'];
}

// In app.js

// In app.js
function updateCarousel(containerElement, newIndex) {
    if (!containerElement) return;

    const images = (containerElement.dataset.images || '').split(',');
    if (images.length <= 1) return;

    const imgElement = containerElement.querySelector('.product-image, .detail-image');
    
    // Ensure the new index is valid and loops correctly
    const newSafeIndex = (newIndex + images.length) % images.length;

    if (imgElement) {
        imgElement.src = images[newSafeIndex];
    }
    containerElement.dataset.currentIndex = newSafeIndex;

    containerElement.querySelectorAll('.dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === newSafeIndex);
    });
}

function displayProducts(products, gridElement = productGrid) {
    if (!gridElement) return;
    gridElement.innerHTML = products.length === 0
        ? '<p>No products found matching your criteria.</p>'
        : products.map(product => {
            const isOutOfStock = product.stock <= 0;
            const imageUrls = getProductImageUrls(product);
            const primaryImageUrl = imageUrls[0];
            const isWishlisted = wishlist.isWishlisted(product.id);
            const hasCarousel = imageUrls.length > 1;

            const isLowStock = SHOW_LOW_STOCK_INDICATOR && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
            let stockInfoHtml = '<div class="stock-placeholder"></div>';
            if (isOutOfStock) {
                stockInfoHtml = '<p class="out-of-stock-message">Out of Stock</p>';
            } else if (isLowStock) {
                stockInfoHtml = `<p class="low-stock-message">Only ${product.stock} left!</p>`;
            }

            const dotsHtml = hasCarousel
                ? `<div class="carousel-dots">${imageUrls.map((_, index) => `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}</div>`
                : '';

            const descriptionHtml = product.professionalDescription
                ? `<p class="product-description">${product.professionalDescription}</p>`
                : '';

            return `
               <a href="/#/products/${product.slug}" class="product-card">
                    <div class="product-image-container"
                         data-product-id="${product.id}"
                         data-images="${imageUrls.join(',')}"
                         data-current-index="0">

                        <img src="${primaryImageUrl}" alt="${product.title}" class="product-image" loading="lazy">
                        
                        <button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>

                        <button class="wishlist-btn ${isWishlisted ? 'favorited' : ''}" data-product-id="${product.id}" aria-label="Toggle Wishlist">
                            <i class="fa-solid fa-heart"></i>
                        </button>

                        ${product.tag ? `<div class="product-tag">${product.tag}</div>` : ''}

                        ${hasCarousel ? `
                            <button class="carousel-arrow prev" data-direction="-1" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="carousel-arrow next" data-direction="1" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
                            ${dotsHtml}
                        ` : ''}
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.title}</h3>
                        ${descriptionHtml}
                        ${stockInfoHtml}

                        <div class="product-footer">
                            <p class="product-price">£${product.price.toFixed(2)}</p>
                            <button class="btn btn-primary btn-sm add-to-basket-btn" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
                                ${isOutOfStock ? 'Out of Stock' : 'Add'}
                            </button>
                        </div>
                    </div>
                </a>`;
        }).join('');
}
function renderRelatedProducts(currentProduct) {
    if (!currentProduct) return;

    // Filter products to find related ones
    const relatedProducts = allProducts.filter(product => 
        product.category === currentProduct.category && product.id !== currentProduct.id
    ).slice(0, 10); // Take up to 10 related products

    // If there are no related products, do nothing
    if (relatedProducts.length === 0) {
        return;
    }

    // Create the HTML for the section
    const section = document.createElement('section');
    section.id = 'related-products-section';
    section.className = 'related-products-section';

    section.innerHTML = `
        <div class="container">
            <h2 class="section-title">You Might Also Like</h2>
            <div class="related-products-carousel-wrapper">
                <button class="related-products-arrow prev" data-direction="-1" aria-label="Scroll left"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="related-products-list-container">
                    <div id="related-products-grid" class="related-products-grid">
                        </div>
                </div>
                <button class="related-products-arrow next" data-direction="1" aria-label="Scroll right"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
    `;

    // Append the new section to the product detail page
    pageDetail.appendChild(section);

    // Use the existing displayProducts function to render the cards
    const relatedGrid = document.getElementById('related-products-grid');
    displayProducts(relatedProducts, relatedGrid);
}



function setupImageZoom(container) {
    // Exit on small screens
    if (window.innerWidth < 800) {
        return;
    }

    // Clone the container to remove any old, lingering event listeners from previous products
    const cleanContainer = container.cloneNode(true);
    container.parentNode.replaceChild(cleanContainer, container);

    const img = cleanContainer.querySelector('.detail-image');
    const result = document.getElementById('image-zoom-result');

    if (!img || !result) return;

    // This function runs once the product image has fully loaded
    const initializeZoom = () => {
        // Create the lens element but keep it hidden for now
        const lens = document.createElement('div');
        lens.setAttribute("class", "image-zoom-lens");
        lens.style.display = 'none'; // Ensure it starts hidden
        img.parentElement.insertBefore(lens, img);

        // --- THIS IS THE FIX ---
        // Declare the zoom ratio variables here, but don't calculate them yet.
        let cx, cy;

        // This function calculates the lens position and updates the zoom
        function moveLens(e) {
            e.preventDefault();
            const pos = getCursorPos(e);
            let x = pos.x - (lens.offsetWidth / 2);
            let y = pos.y - (lens.offsetHeight / 2);

            // Prevent lens from going outside the image bounds
            if (x > img.width - lens.offsetWidth) { x = img.width - lens.offsetWidth; }
            if (x < 0) { x = 0; }
            if (y > img.height - lens.offsetHeight) { y = img.height - lens.offsetHeight; }
            if (y < 0) { y = 0; }

            // Update the lens position and the background position of the result pane
            lens.style.left = x + "px";
            lens.style.top = y + "px";
            result.style.backgroundPosition = "-" + (x * cx) + "px -" + (y * cy) + "px";
        }

        function getCursorPos(e) {
            const a = img.getBoundingClientRect();
            return {
                x: e.pageX - a.left - window.scrollX,
                y: e.pageY - a.top - window.scrollY
            };
        }

        // --- EVENT LISTENER LOGIC ---

        cleanContainer.addEventListener("mouseenter", () => {
            // When the mouse enters, make the lens and result pane visible
            result.style.display = 'block';
            lens.style.display = 'block';

            // --- THIS IS THE CRITICAL FIX ---
            // Calculate the zoom ratio HERE, now that the result pane is visible and has dimensions.
            cx = result.offsetWidth / lens.offsetWidth;
            cy = result.offsetHeight / lens.offsetHeight;

            // Set the background image and size for the result pane
            result.style.backgroundImage = "url('" + img.src + "')";
            result.style.backgroundSize = (img.width * cx) + "px " + (img.height * cy) + "px";

            // Attach the mousemove listener only AFTER everything is visible and calculated
            cleanContainer.addEventListener("mousemove", moveLens);
        });

        cleanContainer.addEventListener("mouseleave", () => {
            // When the mouse leaves, hide everything and remove the mousemove listener
            result.style.display = 'none';
            lens.style.display = 'none';
            cleanContainer.removeEventListener("mousemove", moveLens);
        });
    };

    // Standard check to ensure the image is loaded before we try to initialize the zoom
    if (img.complete) {
        initializeZoom();
    } else {
        img.addEventListener('load', initializeZoom);
    }
}

// In app.js, replace your existing showProductDetail function with this one.

async function showProductDetail(slug) {
    console.log("--- DEBUGGING showProductDetail ---");
    console.log("1. Router called with slug:", slug);

    // Let's inspect the first product to see if it has a slug field.
    if (allProducts && allProducts.length > 0) {
        console.log("2. Checking the first product in the data array:", allProducts[0]);
    } else {
        console.log("2. ERROR: The 'allProducts' array is empty.");
        return;
    }

    const product = allProducts.find(p => createSlug(p.slug) === createSlug(slug));

    if (!product) {
        console.error("3. FAILED to find a matching product.");
        console.log("   - URL slug being searched for:", createSlug(slug));
        console.log("   - Slugs available in data:", allProducts.slice(0, 5).map(p => p.slug)); // Shows first 5 slugs
        console.log("--- END DEBUGGING ---");
        return; // This is where the function is stopping.
    }

    console.log("3. SUCCESS! Found product:", product);
    console.log("4. Now attempting to show the detail page...");
    console.log("--- END DEBUGGING ---");

    // --- Original function continues from here ---
    pageDetail.innerHTML = '';
    showPage('detail');

    const deliveryInfoData = await fetchData('data/pages/delivery_info.json');
    let deliveryReturnsContent = '<p>Delivery information could not be loaded.</p>';
    if (deliveryInfoData && Array.isArray(deliveryInfoData) && deliveryInfoData.length > 0) {
        const deliverySummary = deliveryInfoData[0].content;
        deliveryReturnsContent = `
            <p>${deliverySummary.replace(/\n/g, '</p><p>')}</p>
            <p style="margin-top: 1rem;">For full details, please view our complete policy.</p>
            <a href="#" class="btn-link" data-target="/delivery-info">View Full Delivery & Returns Policy</a>
        `;
    }

    const imageUrls = getProductImageUrls(product);
    const hasCarousel = imageUrls.length > 1;
    const isWishlisted = wishlist.isWishlisted(product.id);
    const isOutOfStock = product.stock <= 0;
    const isLowStock = SHOW_LOW_STOCK_INDICATOR && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;

    let stockIndicatorHtml = '';
    if (isLowStock) {
        stockIndicatorHtml = `<div class="low-stock-indicator"><i class="fa-solid fa-fire"></i><span>Hurry, only ${product.stock} left in stock!</span></div>`;
    }

    const descriptionContent = product.professionalDescription || "No additional description available for this product.";
    const contentsHtml = (product.contents && product.contents.length > 0)
        ? `<ul>${product.contents.map(item => `<li>${item}</li>`).join('')}</ul>`
        : '<p>Contents for this hamper are not listed.</p>';

    const dotsHtml = hasCarousel ? `<div class="carousel-dots">${imageUrls.map((_, index) => `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}</div>` : '';
    const carouselControlsHtml = hasCarousel ? `<button class="carousel-arrow prev" data-direction="-1"><i class="fa-solid fa-chevron-left"></i></button><button class="carousel-arrow next" data-direction="1"><i class="fa-solid fa-chevron-right"></i></button>${dotsHtml}` : '';
    const actionButtonsHtml = `<div class="quantity-selector"><button class="quantity-btn" data-action="decrease">-</button><input type="number" class="quantity-input" value="1" min="1" max="${product.stock}"><button class="quantity-btn" data-action="increase">+</button></div><button class="btn btn-primary add-to-basket-btn-detail" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}><span>${isOutOfStock ? 'Out of Stock' : 'Add to Basket'}</span></button><button class="btn btn-outline wishlist-toggle-btn" data-product-id="${product.id}"><span>${isWishlisted ? 'Saved' : 'Save'}</span></button>`;

    pageDetail.innerHTML = `
        <div class="page-header"><button class="btn btn-secondary" id="back-to-list-detail">&larr; Back to Products</button></div>
        <div class="detail-grid">
            
            <div class="image-zoom-container">
                <div class="detail-image-container" data-images="${imageUrls.join(',')}" data-current-index="0">
                    <img src="${imageUrls[0]}" alt="${product.title}" class="detail-image">
                    ${carouselControlsHtml}
                </div>
                <div id="image-zoom-result" class="image-zoom-result"></div>
            </div>

            <div class="detail-info">
                <p class="category">${product.category}</p>
                <h1 class="title">${product.title}</h1>
                <p class="price">£${product.price.toFixed(2)}</p>
                ${stockIndicatorHtml}
                <div class="product-tabs-container">
                    <div class="tab-nav">
                        <button class="tab-link active" data-tab="description">Description</button>
                        <button class="tab-link" data-tab="contents">Hamper Contents</button>
                        <button class="tab-link" data-tab="delivery">Delivery & Returns</button>
                    </div>
                    <div class="tab-content-container">
                        <div class="tab-content active" id="description-tab">${descriptionContent}</div>
                        <div class="tab-content" id="contents-tab">${contentsHtml}</div>
                        <div class="tab-content" id="delivery-tab">${deliveryReturnsContent}</div>
                    </div>
                </div>
                <div class="detail-actions">${actionButtonsHtml}</div>
            </div>
        </div>`;
    
    setTimeout(() => {
        renderRelatedProducts(product);
        const imageZoomContainer = document.querySelector('.image-zoom-container');
        if (imageZoomContainer) {
            setupImageZoom(imageZoomContainer);
        }
        
        const tabContainer = pageDetail.querySelector('.product-tabs-container');
        if (tabContainer) {
            tabContainer.querySelectorAll('.tab-link').forEach(link => {
                link.addEventListener('click', () => {
                    const tabId = link.dataset.tab;
                    tabContainer.querySelectorAll('.tab-link').forEach(tl => tl.classList.remove('active'));
                    link.classList.add('active');
                    tabContainer.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `${tabId}-tab`));
                });
            });
        }

        const qtyInput = pageDetail.querySelector('.quantity-input');
        if (qtyInput) {
            pageDetail.querySelector('[data-action="decrease"]').addEventListener('click', () => {
                let val = parseInt(qtyInput.value, 10);
                if (val > 1) qtyInput.value = val - 1;
            });
            pageDetail.querySelector('[data-action="increase"]').addEventListener('click', () => {
                let val = parseInt(qtyInput.value, 10);
                const max = parseInt(qtyInput.max, 10);
                if (val < max) qtyInput.value = val + 1;
            });
        }
    }, 0);
}
function showAllProducts() {
    console.log("showAllProducts: Resetting all filters and UI elements.");
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.value = '';
    document.getElementById('filter-select').value = 'all';
    document.getElementById('sort-select').value = 'default';

    currentCategoryFilter = 'all';
    currentTagFilter = null;

    showPage('list');
    updateProductView();
}

function displayOccasions(occasions) {
    if (!occasionsGrid || !occasions) {
        console.error("Occasions grid or data not found.");
        return;
    }
    occasionsGrid.innerHTML = '';
    occasions.forEach(occasion => {
        const card = document.createElement('div');
        card.className = 'occasion-card';
        card.dataset.navigationArgument = occasion.navigationArgument;
        card.innerHTML = `<img src="${occasion.imageUrl}" alt="${occasion.title}" class="occasion-image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/f3f4f6/9ca3af?text=No+Image';"><h3 class="occasion-name">${occasion.title}</h3>`;
        occasionsGrid.appendChild(card);
    });
}
function displayFeatures(features) {
    const featuresBar = document.getElementById('features-bar');
    if (!featuresBar || !features) return;
    featuresBar.innerHTML = features.map(feature => `
        <div class="feature-item">
            <i class="fa-solid ${feature.icon} ${feature.icon === 'fa-star' ? 'fa-star' : ''}"></i>
            <h3>${feature.title}</h3>
            <p>${feature.subtitle}</p>
        </div>
    `).join('');
}

function displayTestimonials(testimonials) {
    const testimonialsGrid = document.getElementById('testimonials-grid');
    if (!testimonialsGrid || !testimonials) return;

    // This function now generates star icons based on the rating
    const createStarRating = (rating) => {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            // Uses solid stars for filled, regular for empty, matching the Flutter logic
            const starClass = i <= rating ? 'fa-solid fa-star' : 'fa-regular fa-star';
            starsHtml += `<i class="${starClass}"></i>`;
        }
        return `<div class="testimonial-stars">${starsHtml}</div>`;
    };

    testimonialsGrid.innerHTML = testimonials.map(t => `
        <div class="testimonial-card">
            ${createStarRating(t.rating)}
            <div class="testimonial-quote-icon">
                <i class="fa-solid fa-quote-left"></i>
            </div>
            <p class="testimonial-quote">${t.quote}</p>
            <p class="testimonial-author">— ${t.author}</p>
        </div>
    `).join('');
}

// ----------------------------------------------------------------- //
// -------------------- KIT: MENU & NAVIGATION -------------------- //
// ----------------------------------------------------------------- //

// REPLACE this entire function in app.js

// REPLACE this entire function in app.js

function renderWishlistPage() {
     console.log('BUG: The INCORRECT renderWishlistPage function was called.'); // ADD THIS LINE
    const wishlistedIds = wishlist.getAllItemIds();
    const wishlistProducts = allProducts.filter(p => wishlistedIds.includes(p.id));

    const wishlistPage = document.getElementById('page-wishlist');
    if (!wishlistPage) return;

    let contentHtml = `<div class="page-header"><h2>My Wishlist</h2><button class="btn btn-secondary" id="wishlist-back-to-account">Back to Account</button></div>`;

    if (wishlistProducts.length === 0) {
        contentHtml += `
            <div class="empty-wishlist-container">
                <i class="fa-regular fa-heart"></i>
                <h3>Your Wishlist is Empty</h3>
                <p>Tap the heart on any product to save it here for later.</p>
            </div>
        `;
    } else {
        contentHtml += `<div id="wishlist-product-grid"></div>`;
    }

    wishlistPage.innerHTML = contentHtml;

    if (wishlistProducts.length > 0) {
        displayProducts(wishlistProducts, document.getElementById('wishlist-product-grid'));
    }

    // The redundant listener that was here has been removed.

    showPage('wishlist');
}



function handleMenuClick(menuItem) {
    console.log("handleMenuClick triggered with:", menuItem);
    if (!menuItem || (menuItem.argument === undefined && menuItem.target === undefined)) return;

    document.querySelectorAll('.nav-links-desktop-item, .mobile-nav-link-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`a[data-argument="${menuItem.argument}"]`).forEach(l => l.classList.add('active'));

    document.getElementById('search-input').value = '';
    document.getElementById('filter-select').value = 'all';
    document.getElementById('sort-select').value = 'default';

    if (menuItem.target === "/create-your-own") {
        currentCategoryFilter = 'all';
        currentTagFilter = null;
        selectedCustomItems = []; // <-- THIS IS THE FIX
        fetchCustomHamperItems();
        return;
    }
    
    const argument = menuItem.argument;

    if (argument === '__ALL_PRODUCTS_TRIGGER__') {
        showAllProducts();
    } else if (argument === 'Bestsellers' || argument === 'Special Sale Items') {
        currentTagFilter = argument === 'Bestsellers' ? 'BESTSELLER' : 'SALE';
        currentCategoryFilter = 'all';
        showPage('list');
        updateProductView();
    } else {
        currentCategoryFilter = argument;
        currentTagFilter = null;
        showPage('list');
        updateProductView();
    }
}

function handleSearch(e) {
    e.preventDefault();
    updateProductView();
}

// REPLACE this entire function in app.js

function showPage(pageId) {
    console.log("showPage: Attempting to show page:", pageId);

    if (pageId === 'list') {
        document.body.classList.add('product-list-active');
    } else {
        document.body.classList.remove('product-list-active');
    }

    // THIS ARRAY IS THE FIX. pageWishlist has been added to the end.
    const pages = [
        pageList, pageDetail, pageCheckout, pageCreate, pageStatic, 
        pageLogin, pageRegister, pageAccount, pageMyOrders, pageMyAddresses, 
        pageOrderDetail, pageAddressForm, pageAccountSettings, pageMyReturns, 
        pageReturnRequest, pageReturnDetail, pageWishlist 
    ];
    
    pages.forEach(page => {
        if (page) page.style.display = 'none';
    });

    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        if (pageId === 'list') {
            targetPage.style.display = 'flex';
        } else {
            targetPage.style.display = 'block';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function openMobileMenu() {
    mobileNavOverlay.classList.add('active');
}

function closeMobileMenu() {
    mobileNavOverlay.classList.remove('active');
}

// REPLACE this function in your public/app.js file

// In app.js

function updateHeaderIcons() {
    if (!headerIconsContainer) return;
    const isLoggedIn = auth.isLoggedIn();
    let displayName = 'Login';

    if (isLoggedIn) {
        const fullName = auth.getUserName();
        displayName = fullName ? fullName.split(' ')[0] : 'Account';
    }

    // --- THIS IS THE FIX ---
    // The account icon is now wrapped in a proper router link
    headerIconsContainer.innerHTML = `
        <a href="/#/account" class="account-link-wrapper" aria-label="My Account">
            <div class="account-icon-wrapper">
                <i class="fa-solid fa-user"></i>
                <span class="account-text">${displayName}</span>
            </div>
        </a>
        <div class="cart-icon-wrapper">
            <i class="fa-solid fa-basket-shopping"></i>
            <span class="cart-count">0</span>
        </div>
    `;
    updateCartCount();
}
function showConfirmationModal(message, callback) {
    if (!confirmationModalOverlay || !confirmationModal || !modalMessage) return;

    modalMessage.textContent = message;
    confirmCallback = callback;
    
    // This shows BOTH the overlay and the modal box
    confirmationModalOverlay.style.display = 'flex';
    confirmationModal.style.display = 'block';

    if (modalCancelBtn) modalCancelBtn.style.display = callback ? 'inline-block' : 'none';
    if (modalConfirmBtn) modalConfirmBtn.textContent = callback ? 'Confirm' : 'OK';
}
function hideConfirmationModal() {
    // This now hides BOTH the overlay and the modal box
    if (confirmationModalOverlay) confirmationModalOverlay.style.display = 'none';
    if (confirmationModal) confirmationModal.style.display = 'none';
    confirmCallback = null;
}


// 1. The main function, now acting as a router
async function fetchAndDisplayStaticPage(pageName) {
    console.log("Fetching static page:", pageName);
    const pageContent = await fetchData(`data/pages/${pageName}.json`);

    if (pageContent) {
        // Route to the correct rendering function based on the page name
        if (pageName === 'faqs') {
            renderFaqPage(pageContent);
        } else if (pageName === 'delivery_info') {
            renderDeliveryInfoPage(pageContent);
        } else if (pageName === 'contact_us') {
            renderContactPage(pageContent); // Added route for the contact page
        } else {
            renderGenericStaticPage(pageContent, pageName);
        }
    } else {
        pageStatic.innerHTML = `<div class="static-content-container"><h2>Page Not Found</h2><p>The content for this page could not be loaded.</p></div>`;
        showPage('static');
    }
}

// 2. Add this new function to render pages like About Us, Terms & Conditions, etc.
function renderGenericStaticPage(pageContent, pageName) {
    const mainTitle = pageContent.sections[0]?.title || pageName.replace(/_/g, ' ');
    pageStatic.innerHTML = `
        <div class="static-content-container">
            <div class="page-header"><h2>${mainTitle}</h2><button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button></div>
            <div class="static-content-body">${pageContent.sections.map(section => `
                <section>
                    ${section.title !== mainTitle ? `<h3>${section.title}</h3>` : ''}
                    <div class="static-content">${section.content}</div>
                </section>`).join('')}
            </div>
        </div>`;
    pageStatic.querySelector('#back-to-home-btn').addEventListener('click', showAllProducts);
    showPage('static');
}

function renderContactPage(data) {
    pageStatic.innerHTML = `
        <div class="contact-page-container">
            <div class="page-header">
                <h2>${data.pageTitle}</h2>
                <button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button>
            </div>
            <p class="page-subtitle">${data.pageSubtitle}</p>

            <div class="contact-grid">
                <div class="contact-info-panel">
                    <div class="contact-details-list">
                        ${data.contactDetails.map(item => `
                            <div class="contact-detail-item">
                                <i class="${getContactIconClass(item.iconName)}"></i>
                                <div>
                                    <h4>${item.title}</h4>
                                    <p>${item.link ? `<a href="${item.link}">${item.subtitle}</a>` : item.subtitle}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="opening-hours">
                        <h3>${data.openingHours.title}</h3>
                        ${data.openingHours.hours.map(line => `<p>${line}</p>`).join('')}
                    </div>
                </div>

                <div class="contact-map-panel">
                    <img src="${data.mapImagePath}" alt="Map of our location">
                </div>
            </div>
        </div>`;

    pageStatic.querySelector('#back-to-home-btn').addEventListener('click', showAllProducts);
    showPage('static');
}
// 3. Add this new function specifically for rendering the FAQs page
function renderFaqPage(faqData) {
    pageStatic.innerHTML = `
        <div class="static-content-container">
            <div class="page-header"><h2>Frequently Asked Questions</h2><button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button></div>
            <div class="faq-list">${faqData.map(item => `
                <details class="faq-item">
                    <summary class="faq-question">${item.question}</summary>
                    <p class="faq-answer">${item.answer}</p>
                </details>`).join('')}
            </div>
        </div>`;
    pageStatic.querySelector('#back-to-home-btn').addEventListener('click', showAllProducts);
    showPage('static');
}

// 4. Add this new function specifically for rendering the Delivery Info page
function renderDeliveryInfoPage(deliveryData) {
    pageStatic.innerHTML = `
        <div class="static-content-container">
            <div class="page-header"><h2>Delivery Information</h2><button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button></div>
            <div class="delivery-info-list">${deliveryData.map(item => `
                <div class="delivery-section">
                    <h3>${item.title}</h3>
                    <p>${item.content}</p>
                </div>`).join('')}
            </div>
        </div>`;
    pageStatic.querySelector('#back-to-home-btn').addEventListener('click', showAllProducts);
    showPage('static');
}

// ----------------------------------------------------------------- //
// -------------------- KIT: AUTHENTICATION -------------------- //
// ----------------------------------------------------------------- //

// REPLACE this entire function in app.js

// REPLACE this entire function in app.js

// REPLACE the renderLoginPage function in your app.js file with this CORRECT version.

// REPLACE your entire renderLoginPage function with this one
function renderLoginPage() {
    // Hide guest checkout button if the cart is empty.
    const guestCheckoutHtml = cart.length > 0
        ? `<button id="guest-checkout-btn" class="btn btn-secondary btn-full-width">Checkout as a Guest</button>`
        : '';

    pageLogin.innerHTML = `
        <div class="auth-container">
            <h2 class="auth-title">Welcome Back!</h2>
            <p class="auth-subtitle">Sign in or create an account.</p>

            <div class="social-login-container">
                <button class="btn btn-social btn-google"><i class="fab fa-google"></i> Continue with Google</button>
                <button class="btn btn-social btn-facebook"><i class="fab fa-facebook-f"></i> Continue with Facebook</button>
            </div>

            ${guestCheckoutHtml}

            <div class="separator"><span>OR</span></div>

            <form id="login-form">
                <div class="form-group">
                    <div class="input-wrapper">
                        <input type="email" id="login-email" placeholder="Email Address" required>
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-wrapper">
                        <input type="password" id="login-password" placeholder="Password" required>
                        <button type="button" class="suffix-icon-btn" id="password-toggle" aria-label="Toggle password visibility">
                            <i class="fa-solid fa-eye-slash"></i>
                        </button>
                    </div>
                </div>
                <div class="form-group-extra">
                    <a href="#" id="forgot-password-link" class="forgot-password">Forgot Password?</a>
                </div>
                <button type="submit" id="login-btn" class="btn btn-primary btn-full-width">
                    <span class="btn-text">Login</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </form>
            <p class="auth-switch">Don't have an account? <a href="#" id="show-register">Register</a></p>
        </div>`;

    showPage('login');

    // Add the listener ONLY if the button exists.
    const guestCheckoutBtn = document.getElementById('guest-checkout-btn');
    if (guestCheckoutBtn) {
        guestCheckoutBtn.addEventListener('click', displayCheckoutPage);
    }

    document.getElementById('password-toggle').addEventListener('click', (e) => {
        const passwordInput = document.getElementById('login-password');
        const icon = e.currentTarget.querySelector('i');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const loginBtn = document.getElementById('login-btn');
        const btnText = loginBtn.querySelector('.btn-text');
        const spinner = loginBtn.querySelector('.spinner');

        loginBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';

        const result = await auth.login(email, password);

       if (result.success) {
            if (postLoginRedirectPath) {
                router.navigate(postLoginRedirectPath);
                postLoginRedirectPath = null;
            } else {
                router.navigate('/');
            }
        } else {
            showConfirmationModal(result.message);
            loginBtn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
        }
    });

    document.querySelectorAll('.btn-social').forEach(btn => {
        btn.addEventListener('click', () => showConfirmationModal('Social login is a demo feature.'));
    });
}

// REPLACE this function in your public/app.js file
function renderRegisterPage() {
    pageRegister.innerHTML = `
        <div class="auth-container">
            <h2 class="auth-title">Create Your Account</h2>
            <p class="auth-subtitle">Join us to discover exquisite hampers for every occasion.</p>
            <form id="register-form">
                <div class="form-group">
                    <input type="text" id="register-name" placeholder="Full Name" required>
                </div>
                <div class="form-group">
                    <input type="email" id="register-email" placeholder="Email Address" required>
                </div>
                <div class="form-group">
                    <input type="password" id="register-password" placeholder="Password" required>
                    <!-- New Password Strength Meter -->
                    <div class="password-strength-container">
                        <div id="register-strength-bar" class="strength-bar"></div>
                    </div>
                    <div id="register-strength-text" class="password-strength-text"></div>
                </div>
                <div class="form-group">
                    <input type="password" id="register-confirm-password" placeholder="Confirm Password" required>
                </div>
                <button type="submit" id="register-btn" class="btn btn-primary btn-full-width">
                    <span class="btn-text">Create Account</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </form>
            <p class="auth-switch">Already have an account? <a href="#" id="show-login">Login</a></p>
        </div>`;
    
    showPage('register');
    
    const passwordInput = document.getElementById('register-password');
    const strengthBar = document.getElementById('register-strength-bar');
    const strengthText = document.getElementById('register-strength-text');

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        const { score, feedback } = checkPasswordStrength(password);
        
        strengthBar.className = 'strength-bar'; // Reset classes
        if (password.length > 0) {
            if (score <= 1) strengthBar.classList.add('weak');
            else if (score === 2) strengthBar.classList.add('medium');
            else strengthBar.classList.add('strong');
        }
        strengthText.textContent = password.length > 0 ? feedback : '';
    });
    
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password.length < 8 || !password.match(/[0-9]/)) {
            showConfirmationModal("Password must be at least 8 characters long and contain at least one number.");
            return;
        }
        if (password !== confirmPassword) {
            showConfirmationModal("Passwords do not match. Please try again.");
            return;
        }

        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const registerBtn = document.getElementById('register-btn');
        const btnText = registerBtn.querySelector('.btn-text');
        const spinner = registerBtn.querySelector('.spinner');

        registerBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';

        const result = await auth.register(name, email, password);

        if (result.success) {
    // If the user was trying to checkout, send them there. Otherwise, homepage.
    if (postLoginRedirectPath) {
        router.navigate(postLoginRedirectPath);
        postLoginRedirectPath = null; // Clear the path so it's only used once
    } else {
        router.navigate('/');
    }
} else {
            showConfirmationModal(result.message);
            registerBtn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
        }
    });
}


// ------------------------------------------------------------------ //
// -------------------- KIT: CART & CHECKOUT ------------------------ //
// ------------------------------------------------------------------ //

// ADD this block of code to app.js



function openQuickViewModal(productId) {
    const product = allProducts.find(p => p.id.toString() === productId.toString());
    if (!product) return;

    const imageUrls = getProductImageUrls(product);
    const hasCarousel = imageUrls.length > 1;
    const isOutOfStock = product.stock <= 0;

    const dotsHtml = hasCarousel ? `<div class="carousel-dots">${imageUrls.map((_, index) => `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}</div>` : '';
    const carouselControlsHtml = hasCarousel ? `<button class="carousel-arrow prev" data-direction="-1"><i class="fa-solid fa-chevron-left"></i></button><button class="carousel-arrow next" data-direction="1"><i class="fa-solid fa-chevron-right"></i></button>${dotsHtml}` : '';
    
    quickViewContent.innerHTML = `
        <div class="quick-view-grid">
            <div class="product-image-container" data-images="${imageUrls.join(',')}" data-current-index="0">
                <img src="${imageUrls[0]}" alt="${product.title}" class="product-image">
                ${carouselControlsHtml}
            </div>
            <div class="quick-view-details">
                <h2 class="quick-view-title">${product.title}</h2>
                <p class="quick-view-price">£${product.price.toFixed(2)}</p>
                <p class="quick-view-description">${product.professionalDescription || ''}</p>
                <div class="detail-actions">
                    <div class="quantity-selector">
                        <button class="quantity-btn decrease-qty" data-id="${product.id}">-</button>
                        <input type="number" class="quantity-input" id="quick-view-quantity" value="1" min="1" max="${product.stock}">
                        <button class="quantity-btn increase-qty" data-id="${product.id}">+</button>
                    </div>
                    <button class="btn btn-primary add-to-basket-btn" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
                        ${isOutOfStock ? 'Out of Stock' : 'Add to Basket'}
                    </button>
                </div>
                <a href="#" class="view-full-details-link" data-product-id="${product.id}">View full details</a>
            </div>
        </div>
    `;

    if (quickViewModalOverlay) quickViewModalOverlay.style.display = 'flex';

     

}

function closeQuickViewModal() {
    if (quickViewModalOverlay) quickViewModalOverlay.style.display = 'none';
    quickViewContent.innerHTML = ''; // Clear content to stop videos/gifs
}

async function saveCart() {
    localStorage.setItem('luxuryHampersCart', JSON.stringify(cart));
    // If the user is logged in, also save the cart to the backend.
    if (auth.isLoggedIn()) {
        try {
            await fetchWithAuth('/api/cart', {
                method: 'POST',
                body: JSON.stringify({ cart: cart })
            });
        } catch (error) {
            console.error("Could not sync cart to backend:", error);
            // Optionally, show a subtle "could not sync" message to the user.
        }
    }
}

function loadCart() {
    // This function now only loads from localStorage.
    // The new logic in auth.js handles fetching the backend cart upon login.
    cart = JSON.parse(localStorage.getItem('luxuryHampersCart')) || [];
    updateCart();
}


// This is the correct and complete version of the function.
function addToCart(productId, quantity = 1, isCustom = false, customItems = [], customPrice = 0) {
    if (isCustom) {
        const hamperContents = customItems.map(item => ({ ...item, quantity: 1 }));
        const customHamper = {
            id: `custom_${new Date().getTime()}`,
            title: "My Custom Hamper",
            price: customPrice,
            quantity: 1,
            contents: hamperContents,
            imageUrls: ['assets/images/custom_hamper_placeholder.jpg'],
            isCustom: true,
        };
        cart.push(customHamper);
    } else {
        const product = allProducts.find(p => p.id.toString() === productId.toString());
        if (!product) return;
        const existingItem = cart.find(item => item.id.toString() === productId.toString());
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ ...product, quantity: quantity, isCustom: false });
        }
    }
    updateCart();
    if (window.innerWidth < 768) {
        const addedItem = isCustom ? cart[cart.length - 1] : cart.find(item => item.id.toString() === productId.toString());
        showAddedToCartSheet(addedItem);
    } else {
        openCart();
    }
}

// REPLACE this function

function removeFromCart(productId) { cart = cart.filter(item => item.id.toString() !== productId.toString()); updateCart(); }
function changeQuantity(productId, amount) {
    const item = cart.find(item => item.id.toString() === productId.toString());
    if (item) {
        item.quantity += amount;
        if (item.quantity <= 0) { removeFromCart(productId); } else { updateCart(); }
    }
}
function updateCart() { renderCartItems(); updateCartCount(); updateCartTotals(); saveCart(); }
function openCart() { sideCart.classList.add('active'); cartOverlay.classList.add('active'); }
function closeCart() { sideCart.classList.remove('active'); cartOverlay.classList.remove('active'); }

function renderCartItems() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>Your basket is empty.</p>';
        goToCheckoutBtn.disabled = true;
        return;
    }
    goToCheckoutBtn.disabled = false;
    cartItemsContainer.innerHTML = cart.map(item => {
        // If the item is a custom hamper, render the detailed view
        if (item.isCustom) {
            const componentsHtml = item.contents.map(component => `
                <li class="component-item">
                    <span class="component-name">&#8226; ${component.name}</span>
                    <div class="quantity-selector component-quantity-selector">
                        <button class="quantity-btn decrease-component-qty" data-cart-item-id="${item.id}" data-component-id="${component.id}">-</button>
                        <span class="quantity-value">${component.quantity}</span>
                        <button class="quantity-btn increase-component-qty" data-cart-item-id="${item.id}" data-component-id="${component.id}">+</button>
                    </div>
                </li>
            `).join('');

            return `
                <div class="cart-item custom-hamper">
                    <div class="custom-hamper-header">
                        <img src="${getProductImageUrls(item)[0]}" alt="${item.title}" class="cart-item-image">
                        <div class="cart-item-info">
                            <p class="cart-item-title">${item.title}</p>
                        </div>
                        <button class="cart-item-remove-btn" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    <div class="custom-hamper-details">
                        <p class="includes-title">Includes:</p>
                        <ul class="component-list">
                            ${componentsHtml}
                        </ul>
                    </div>
                    <div class="custom-hamper-footer">
                         <div class="quantity-selector">
                            <button class="quantity-btn decrease-qty" data-id="${item.id}">-</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn increase-qty" data-id="${item.id}">+</button>
                        </div>
                        <button class="btn btn-secondary btn-sm edit-hamper-btn" data-id="${item.id}">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Hamper
                        </button>
                        <span class="cart-item-price">£${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
        // Otherwise, render the standard cart item
        else {
            const primaryImageUrl = getProductImageUrls(item)[0];
            return `
                <div class="cart-item">
                    <img src="${primaryImageUrl}" alt="${item.title}" class="cart-item-image">
                    <div class="cart-item-info">
                        <p class="cart-item-title">${item.title}</p>
                        <p class="cart-item-price">£${item.price.toFixed(2)}</p>
                        <div class="quantity-selector">
                            <button class="quantity-btn decrease-qty" data-id="${item.id}">-</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn increase-qty" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button class="cart-item-remove-btn" data-id="${item.id}">Remove</button>
                </div>`;
        }
    }).join('');
}


function updateCartCount() {
    const cartCountElement = document.querySelector('.cart-icon-wrapper .cart-count');
    if (!cartCountElement) return;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountElement.textContent = totalItems;
    cartCountElement.style.display = totalItems > 0 ? 'flex' : 'none';
}

// REPLACE this entire function in app.js

// REPLACE this entire function in app.js

function applyDiscount(code, source = 'checkout') {
    const messageEl = document.getElementById(`${source}-discount-message`);
    const inputEl = document.getElementById(`${source}-discount-code`);
    const trimmedCode = code.trim();

    // If the user submits an empty code, clear the current discount.
    if (!trimmedCode) {
        if (appliedDiscount) { // Only show message if a discount was actually removed
            messageEl.textContent = 'Discount removed.';
        } else {
            messageEl.textContent = '';
        }
        appliedDiscount = null;
        messageEl.className = 'discount-message';
        if (inputEl) inputEl.value = '';
        updateCartTotals();
        return;
    }

    const discount = allDiscounts.find(d => d.code.toUpperCase() === trimmedCode.toUpperCase());

    if (discount) {
        // A valid code was entered.
        if (appliedDiscount && appliedDiscount.code !== discount.code) {
            messageEl.textContent = `Discount "${appliedDiscount.code}" replaced with "${discount.code}".`;
        } else {
            messageEl.textContent = `Success! "${discount.code}" applied.`;
        }
        appliedDiscount = discount;
        messageEl.className = 'discount-message success';
    } else {
        // An invalid code was entered. Show an error but DO NOT remove an existing discount.
        messageEl.textContent = 'Invalid discount code.';
        messageEl.className = 'discount-message error';
    }
    
    // Clear the input field after every attempt.
    if (inputEl) inputEl.value = '';
    
    updateCartTotals();
}

function updateCartTotals() {
    // This function now uses the central calculateTotals helper
    const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();

    // Update Side Cart
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartDeliveryEl = document.getElementById('cart-delivery');
    const cartTotalEl = document.getElementById('cart-total');
    if(cartSubtotalEl) cartSubtotalEl.textContent = `£${itemsSubtotal.toFixed(2)}`;
    if(cartDeliveryEl) cartDeliveryEl.textContent = `£${deliveryChargeApplied.toFixed(2)}`;
    if(cartTotalEl) cartTotalEl.textContent = `£${Math.max(0, totalAmount).toFixed(2)}`;
    
    const cartDiscountRow = document.querySelector('#side-cart .discount-row');
    if (cartDiscountRow) {
        cartDiscountRow.style.display = appliedDiscount ? 'flex' : 'none';
        document.getElementById('cart-discount').textContent = `-£${discountApplied.toFixed(2)}`;
    }

    // Update Checkout Page
    const checkoutTotalEl = document.getElementById('checkout-total');
    if (checkoutTotalEl) {
        document.getElementById('checkout-subtotal').textContent = `£${itemsSubtotal.toFixed(2)}`;
        document.getElementById('checkout-delivery').textContent = `£${deliveryChargeApplied.toFixed(2)}`;
        checkoutTotalEl.textContent = `£${Math.max(0, totalAmount).toFixed(2)}`;
        const checkoutDiscountRow = document.querySelector('#page-checkout .discount-row');
        if (checkoutDiscountRow) {
            checkoutDiscountRow.style.display = appliedDiscount ? 'flex' : 'none';
            document.getElementById('checkout-discount').textContent = `-£${discountApplied.toFixed(2)}`;
        }
    }
}


function showAddedToCartSheet(addedItem) {
    if (!addedItem) return;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    // ...
addedToCartSheet.innerHTML = `<div class="added-to-cart-header"><h3>Added to Basket</h3></div><div class="mini-cart-item"><img src="${getProductImageUrls(addedItem)[0]}" alt="${addedItem.title}" class="cart-item-image"><div class="cart-item-info"><p class="cart-item-title">${addedItem.title}</p><p>Qty: ${addedItem.quantity}</p></div><p class="cart-item-price">£${(addedItem.price * addedItem.quantity).toFixed(2)}</p></div><div class="added-to-cart-footer"><button id="sheet-view-basket" class="btn btn-secondary">View Basket (${totalItems})</button><button id="sheet-checkout" class="btn btn-primary">Checkout</button></div>`;

    addedToCartSheet.classList.add('active');
    addedToCartOverlay.classList.add('active');
    
    document.getElementById('sheet-view-basket').addEventListener('click', () => { closeAddedToCartSheet(); openCart(); });
    document.getElementById('sheet-checkout').addEventListener('click', () => { closeAddedToCartSheet(); displayCheckoutPage(); });
}

function closeAddedToCartSheet() { addedToCartSheet.classList.remove('active'); addedToCartOverlay.classList.remove('active'); }



// REPLACE the existing displayCheckoutPage function in app.js

// REPLACE this entire function in app.js

function displayCheckoutPage() {
    // First, perform triage. Is there anything in the cart?
    if (cart.length === 0) {
        // If the cart is empty, show a clear message and stop everything.
        showConfirmationModal("Your shopping basket is empty. Please add items before proceeding to checkout.");
        // Optional but recommended: guide the user back to the main page.
        router.navigate('/');
        return; // Halt the function immediately.
    }
    const isLoggedIn = auth.isLoggedIn();
    
    // Auto-select the default address when checkout starts
    if (isLoggedIn && checkoutStep === 1 && userAddresses.length > 0) {
        const defaultAddress = userAddresses.find(addr => addr.isDefault);
        selectedCheckoutAddressId = defaultAddress ? defaultAddress.id : userAddresses[0].id;
    }
    
    if (isLoggedIn && userAddresses.length === 0) {
        pageCheckout.innerHTML = `
            <div class="page-header"><h2>Checkout</h2></div>
            <div class="checkout-grid">
                <div class="checkout-form">
                    <h3>1. Shipping Details</h3>
                    <p>Welcome, ${auth.getUserName()}! Please add a delivery address to continue.</p>
                    <button id="checkout-add-first-address-btn" class="btn btn-primary btn-full-width">Add New Address</button>
                </div>
                <div class="order-summary">
                    <h3>Order Summary</h3>
                    <div id="checkout-items">${cart.map(item => `<div class="summary-row"><span>${item.title} (x${item.quantity})</span><span>£${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}</div>
                    <div class="summary-container">
                        <div class="summary-row"><span>Subtotal</span><span id="checkout-subtotal">£0.00</span></div>
                        <div class="summary-row discount-row" style="display: none;"><span>Discount</span><span id="checkout-discount">£0.00</span></div>
                        <div class="summary-row"><span>Delivery</span><span id="checkout-delivery">£0.00</span></div>
                        <div class="summary-row total"><span>Total</span><span id="checkout-total">£0.00</span></div>
                    </div>
                </div>
            </div>`;

        showPage('checkout');
        updateCartTotals();
        document.getElementById('checkout-add-first-address-btn').addEventListener('click', () => {
            addressFormReturnPath = 'checkout';
            renderAddressForm();
        });
        return;
    }

    let stepContentHtml = '';
    let actionButtonHtml = '';

    const storeGuestDetails = () => {
        guestDetails.name = document.getElementById('checkout-name')?.value || guestDetails.name;
        guestDetails.email = document.getElementById('checkout-email')?.value || guestDetails.email;
        guestDetails.addressLine1 = document.getElementById('checkout-address1')?.value || guestDetails.addressLine1;
        guestDetails.city = document.getElementById('checkout-city')?.value || guestDetails.city;
        guestDetails.postcode = document.getElementById('checkout-postcode')?.value || guestDetails.postcode;
        guestDetails.phone = document.getElementById('checkout-phone')?.value || guestDetails.phone;
    };

    switch (checkoutStep) {
        case 1:
            if (isLoggedIn) {
                const userName = auth.getUserName();
                const addressOptions = userAddresses.map(addr => `<option value="${addr.id}" ${addr.id === selectedCheckoutAddressId ? 'selected' : ''}>${addr.fullName}, ${addr.addressLine1}, ${addr.postcode}</option>`).join('');
                stepContentHtml = `<h3>1. Shipping Details</h3><p>Welcome back, ${userName}!</p><form id="checkout-details-form"><div class="form-group"><label for="address-select">Select your delivery address:</label><select id="address-select" name="address-select">${addressOptions}</select></div><p class="text-center small-text">or <a href="#" id="add-new-address-checkout">add a new address</a>.</p></form>`;
            } else {
                stepContentHtml = `<h3>1. Shipping Details</h3><p>Please provide your details for delivery.</p><form id="checkout-details-form"><div class="form-group"><label for="checkout-name">Full Name</label><input type="text" id="checkout-name" value="${guestDetails.name || ''}" required></div><div class="form-group"><label for="checkout-email">Email Address</label><input type="email" id="checkout-email" value="${guestDetails.email || ''}" required></div><div class="form-group"><label for="checkout-address1">Address Line 1</label><input type="text" id="checkout-address1" value="${guestDetails.addressLine1 || ''}" required></div><div class="form-group"><label for="checkout-city">Town / City</label><input type="text" id="checkout-city" value="${guestDetails.city || ''}" required></div><div class="form-group"><label for="checkout-postcode">Postcode</label><input type="text" id="checkout-postcode" value="${guestDetails.postcode || ''}" required></div><div class="form-group"><label for="checkout-phone">Phone Number (Optional)</label><input type="tel" id="checkout-phone" value="${guestDetails.phone || ''}"></div></form>`;
            }
            actionButtonHtml = `<button id="checkout-step1-btn" class="btn btn-primary btn-full-width">Continue to Payment</button>`;
            break;
        case 2:
            stepContentHtml = `<h3>2. Payment Details</h3><p>This is a demo payment form.</p><form id="checkout-payment-form"><div class="form-group"><label for="card-name">Name on Card</label><input type="text" id="card-name" placeholder="John M. Doe" required></div><div class="form-group"><label for="card-number">Card Number</label><input type="text" id="card-number" placeholder="1111-2222-3333-4444" required></div><div class="form-group-row"><div class="form-group"><label for="card-expiry">Expiry</label><input type="text" id="card-expiry" placeholder="MM/YY" required></div><div class="form-group"><label for="card-cvc">CVC</label><input type="text" id="card-cvc" placeholder="123" required></div></div></form>`;
            actionButtonHtml = `<button id="checkout-step2-btn" class="btn btn-primary btn-full-width">Continue to Review</button><a href="#" id="checkout-back-btn" class="back-link">Go Back</a>`;
            break;
        case 3:
            const finalAddress = isLoggedIn ? userAddresses.find(a => a.id === selectedCheckoutAddressId) : { fullName: guestDetails.name, addressLine1: guestDetails.addressLine1, city: guestDetails.city, postcode: guestDetails.postcode };
            stepContentHtml = `<h3>3. Review Order</h3><div class="review-section"><h4>Shipping to:</h4><p>${finalAddress.fullName}<br>${finalAddress.addressLine1}<br>${finalAddress.city}, ${finalAddress.postcode}</p></div><div class="review-section"><h4>Payment Method:</h4><p>Card ending in 4444 (Demo)</p></div>`;
            actionButtonHtml = `
        <button id="place-order-btn" class="btn btn-primary btn-full-width">
            <span class="btn-text">Place Order</span>
            <div class="spinner" style="display: none;"></div>
        </button>
        <a href="#" id="checkout-back-btn" class="back-link">Go Back</a>`;
            break;
    }

    pageCheckout.innerHTML = `<div class="page-header"><h2>Checkout</h2></div><div class="checkout-progress-bar"><div class="step ${checkoutStep >= 1 ? 'active' : ''}">1. Details</div><div class="step ${checkoutStep >= 2 ? 'active' : ''}">2. Payment</div><div class="step ${checkoutStep >= 3 ? 'active' : ''}">3. Review</div></div><div class="checkout-grid"><div class="checkout-form">${stepContentHtml}${actionButtonHtml}</div><div class="order-summary"><h3>Order Summary</h3><div id="checkout-items">${cart.map(item => `<div class="summary-row"><span>${item.title} (x${item.quantity})</span><span>£${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}</div><div class="summary-container"><div class="summary-row"><span>Subtotal</span><span id="checkout-subtotal">£0.00</span></div><div class="summary-row discount-row" style="display: none;"><span>Discount</span><span id="checkout-discount">£0.00</span></div><div class="summary-row"><span>Delivery</span><span id="checkout-delivery">£0.00</span></div><div class="summary-row total"><span>Total</span><span id="checkout-total">£0.00</span></div></div><div class="discount-form-container"><form id="checkout-discount-form"><input type="text" id="checkout-discount-code" placeholder="Enter discount code"><button type="submit" class="btn btn-secondary btn-sm">Apply</button></form><p id="checkout-discount-message" class="discount-message"></p></div></div></div>`;
    
    showPage('checkout');
    updateCartTotals();

    document.getElementById('checkout-step1-btn')?.addEventListener('click', () => {
        if (isLoggedIn) {
            const addressSelect = document.getElementById('address-select');
            if (addressSelect) selectedCheckoutAddressId = addressSelect.value;
        } else {
            storeGuestDetails();
        }
        checkoutStep = 2;
        displayCheckoutPage();
    });
    document.getElementById('checkout-step2-btn')?.addEventListener('click', () => { checkoutStep = 3; displayCheckoutPage(); });
    document.getElementById('checkout-back-btn')?.addEventListener('click', (e) => { e.preventDefault(); if (checkoutStep > 1) { checkoutStep--; displayCheckoutPage(); } });
    
    const addNewAddressLink = document.getElementById('add-new-address-checkout');
    if (addNewAddressLink) addNewAddressLink.addEventListener('click', (e) => { e.preventDefault(); addressFormReturnPath = 'checkout'; renderAddressForm(); });
    
}



// REPLACE your existing placeOrder function
async function placeOrder() {
    const placeOrderBtn = document.getElementById('place-order-btn');
    const btnText = placeOrderBtn.querySelector('.btn-text');
    const spinner = placeOrderBtn.querySelector('.spinner');

    placeOrderBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
        if (auth.isLoggedIn() && !auth.isVerified()) {
            throw new Error("Please check your inbox and verify your email address before placing an order.");
        }
        if (cart.length === 0) throw new Error('Your cart is empty.');
        
        const isLoggedIn = auth.isLoggedIn();
        if (!isLoggedIn) {
            // This is a safeguard; this function should only be called for logged-in users now.
            return placeGuestOrder(); 
        }

        const currentUser = auth.getCurrentUser();
        const selectedAddress = userAddresses.find(addr => addr.id === selectedCheckoutAddressId);
        if (!selectedAddress) throw new Error('Please select a delivery address.');
        
        const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();

        const orderPayload = {
            userId: currentUser.uid,
            customerName: selectedAddress.fullName,
            customerEmail: currentUser.email,
            deliveryAddress: selectedAddress,
            items: cart.map(item => {
                const orderItem = {
                    productId: item.id, title: item.title, quantity: item.quantity, price: item.price, isCustom: item.isCustom || false,
                };
                if (item.isCustom) orderItem.contents = item.contents;
                return orderItem;
            }),
            itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount
        };

        const result = await fetchWithAuth('/api/create-order', {
            method: 'POST', body: JSON.stringify({ orderPayload })
        });
        
        userOrders = await fetchWithAuth('/api/get-orders');
        
        pageCheckout.innerHTML = `<div class="order-confirmation"><h2>Thank You, ${selectedAddress.fullName.split(' ')[0]}!</h2><p>Your order #${result.orderId} has been placed successfully.</p><button id="back-to-home-btn" class="btn btn-primary btn-full-width">Continue Shopping</button></div>`;
        document.getElementById('back-to-home-btn').addEventListener('click', showAllProducts);
        
        cart = []; appliedDiscount = null; selectedCheckoutAddressId = null; checkoutStep = 1;
        updateCart();

    } catch (error) {
        console.error("CRITICAL ERROR in placeOrder:", error);
        showConfirmationModal(`Order Failed: ${error.message}`);
        // Re-enable the button on failure
        placeOrderBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Add this entire new function to app.js
function calculateTotals() {
    const itemsSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    let deliveryChargeApplied = 0;
    let discountApplied = 0;

    // Use optional chaining and provide default fallback values
    const freeDeliveryThreshold = appConfig?.delivery?.freeDeliveryThreshold ?? 50;
    const baseCharge = appConfig?.delivery?.baseCharge ?? 4.99;
    const additionalItemCharge = appConfig?.delivery?.additionalItemCharge ?? 1.00;

    if (totalItems > 0 && itemsSubtotal < freeDeliveryThreshold) {
        deliveryChargeApplied = baseCharge;
        if (totalItems > 1) {
            deliveryChargeApplied += (totalItems - 1) * additionalItemCharge;
        }
    }

    if (appliedDiscount) {
        if (appliedDiscount.type === 'percent') {
            discountApplied = (itemsSubtotal * appliedDiscount.value) / 100;
        } else if (appliedDiscount.type === 'fixed') {
            discountApplied = appliedDiscount.value;
        } else if (appliedDiscount.type === 'shipping') {
            // In a shipping discount, the discount amount is the delivery charge itself
            discountApplied = deliveryChargeApplied;
            deliveryChargeApplied = 0;
        }
    }

    const totalAmount = itemsSubtotal + deliveryChargeApplied - discountApplied;
    
    return { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount };
}

// REPLACE your existing placeGuestOrder function
async function placeGuestOrder() {
    const placeOrderBtn = document.getElementById('place-order-btn');
    const btnText = placeOrderBtn.querySelector('.btn-text');
    const spinner = placeOrderBtn.querySelector('.spinner');

    placeOrderBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
        const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();
        const orderPayload = {
            customerName: guestDetails.name,
            customerEmail: guestDetails.email,
            deliveryAddress: {
                fullName: guestDetails.name, addressLine1: guestDetails.addressLine1,
                city: guestDetails.city, postcode: guestDetails.postcode
            },
            items: cart.map(item => ({
                productId: item.id, title: item.title, quantity: item.quantity,
                price: item.price, isCustom: item.isCustom || false
            })),
            itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount
        };

        const response = await fetch('/api/create-guest-order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderPayload })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Guest order submission failed.');
        }
        const result = await response.json();

        pageCheckout.innerHTML = `<div class="order-confirmation"><h2>Thank You, ${guestDetails.name.split(' ')[0]}!</h2><p>Your order #${result.orderId} has been placed successfully.</p><button id="back-to-home-btn" class="btn btn-primary btn-full-width">Continue Shopping</button></div>`;
        document.getElementById('back-to-home-btn').addEventListener('click', showAllProducts);
        
        cart = []; guestDetails = {}; appliedDiscount = null; checkoutStep = 1;
        updateCart();

    } catch (error) {
        console.error("CRITICAL ERROR in placeGuestOrder:", error);
        showConfirmationModal(`Order Failed: ${error.message}`);
        // Re-enable the button on failure
        placeOrderBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

async function placeGuestOrder() {
    try {
        // Prepare the order payload using the stored guest details
        const orderPayload = {
            customerName: guestDetails.name,
            customerEmail: guestDetails.email, // It's good practice to store the guest email
            deliveryAddress: {
                fullName: guestDetails.name,
                addressLine1: guestDetails.addressLine1,
                city: guestDetails.city,
                postcode: guestDetails.postcode
            },
            items: cart.map(item => ({
                productId: item.id,
                title: item.title,
                quantity: item.quantity,
                price: item.price,
                isCustom: item.isCustom || false
            })),
            // Recalculate totals to be safe
            itemsSubtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            // ... add delivery and discount logic if you want it for guests ...
            totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) // Simplified total for now
        };

        // IMPORTANT: This uses the standard 'fetch', NOT 'fetchWithAuth'
        const response = await fetch('/api/create-guest-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderPayload })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Guest order submission failed.');
        }

        const result = await response.json();

        // Show confirmation and clear the cart, similar to the original function
        pageCheckout.innerHTML = `<div class="order-confirmation"><h2>Thank You, ${guestDetails.name.split(' ')[0]}!</h2><p>Your order #${result.orderId} has been placed successfully.</p><button id="back-to-home-btn" class="btn btn-primary btn-full-width">Continue Shopping</button></div>`;
        document.getElementById('back-to-home-btn').addEventListener('click', showAllProducts);
        
        cart = [];
        guestDetails = {};
        appliedDiscount = null;
        checkoutStep = 1;
        updateCart();

    } catch (error) {
        console.error("CRITICAL ERROR in placeGuestOrder:", error);
        showConfirmationModal(`Order Failed: ${error.message}`);
    }
}

// ----------------------------------------------------------------- //
// -------------------- KIT: MY ACCOUNT --------------------------- //
// ----------------------------------------------------------------- //

// REPLACE this entire function in your public/app.js file
// Add this entire function to your app.js file

// In app.js
// REPLACE your entire existing showReturnRequestPage function with this one.

function showReturnRequestPage(order) {
    const triggerContainer = document.getElementById('return-trigger-container');
    if (triggerContainer) triggerContainer.style.display = 'none';

    // First, calculate which items are available for return
    const returnedQuantities = {};
    userReturns
        .filter(r => r.orderId === order.id && r.status !== 'Cancelled' && r.status !== 'Rejected')
        .flatMap(r => r.items)
        .forEach(item => {
            returnedQuantities[item.productId] = (returnedQuantities[item.productId] || 0) + item.quantity;
        });

    const returnFormHtml = `
        <form id="direct-return-form" class="detail-card">
            <h4>Request a Return</h4>
            <p>Select the items and quantities you wish to return.</p>
            <div class="form-group">
            ${order.items.map(item => {
                const alreadyReturned = returnedQuantities[item.productId] || 0;
                const returnableQty = item.quantity - alreadyReturned;

                if (returnableQty <= 0) {
                    return `<div class="return-item-control disabled"><p>✓ <em>${item.title} (Already Returned)</em></p></div>`;
                }
                return `
                <div class="return-item-control">
                    <div class="form-group-checkbox">
                        <input type="checkbox" name="return-item" id="return-item-${item.productId}" value="${item.productId}">
                        <label for="return-item-${item.productId}">${item.title}</label>
                    </div>
                    <div class="quantity-selector-inline" style="display: none;">
                        <button type="button" class="quantity-btn decrease-return-qty" data-product-id="${item.productId}">-</button>
                        <input type="number" class="quantity-input-return" id="return-qty-${item.productId}" value="1" min="1" max="${returnableQty}" readonly>
                        <button type="button" class="quantity-btn increase-return-qty" data-product-id="${item.productId}">+</button>
                    </div>
                    <p class="return-price">£${item.price.toFixed(2)} ea</p>
                </div>`;
            }).join('')}
            </div>
            <div class="form-group" id="return-reason-group" style="display: none;">
                <label for="return-reason">Reason for return:</label>
                <textarea id="return-reason" rows="6" required></textarea>
            </div>
            <div id="return-subtotal-display" class="order-summary-total" style="display: none; border-top: 1px solid var(--border-color); margin-top:0; padding-top:0.5rem;">
                <span>Refund Subtotal</span><span id="refund-amount">£0.00</span>
            </div>
            <div style="text-align: right; margin-top: 1rem;">
                <button type="submit" id="submit-return-btn" class="btn btn-primary" disabled>
                    <span class="btn-text">Submit Return Request</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </div>
        </form>`;
    
    const oldForm = document.getElementById('direct-return-form');
    if (oldForm) oldForm.remove();
    const itemsContainer = document.getElementById('order-items-container');
    itemsContainer.insertAdjacentHTML('afterend', returnFormHtml);

    const returnForm = document.getElementById('direct-return-form');
    const reasonGroup = document.getElementById('return-reason-group');
    const submitBtn = document.getElementById('submit-return-btn');
    const subtotalDisplay = document.getElementById('return-subtotal-display');
    const refundAmountEl = document.getElementById('refund-amount');

    const validateReturnForm = () => {
        let refundSubtotal = 0;
        let anyChecked = false;
        const returnItemControls = returnForm.querySelectorAll('.return-item-control');

        returnItemControls.forEach(control => {
            const checkbox = control.querySelector('input[name="return-item"]');
            if (!checkbox) return;
            const quantitySelector = control.querySelector('.quantity-selector-inline');
            const productId = checkbox.value;
            const quantityInput = document.getElementById(`return-qty-${productId}`);

            if (checkbox.checked) {
                anyChecked = true;
                quantitySelector.style.display = 'flex';
                const item = order.items.find(i => i.productId === productId);
                if (item && quantityInput) {
                    refundSubtotal += item.price * parseInt(quantityInput.value, 10);
                }
            } else {
                if (quantitySelector) quantitySelector.style.display = 'none';
            }
        });

        reasonGroup.style.display = anyChecked ? 'block' : 'none';
        subtotalDisplay.style.display = anyChecked ? 'flex' : 'none';
        if (anyChecked) refundAmountEl.textContent = `£${refundSubtotal.toFixed(2)}`;
        submitBtn.disabled = !anyChecked;
    };

    returnForm.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.return-item-control')) {
            if (target.matches('label')) {
                const checkbox = document.getElementById(target.getAttribute('for'));
                if (checkbox) checkbox.checked = !checkbox.checked;
            }
            validateReturnForm();
        }
        
        if (target.matches('.decrease-return-qty, .increase-return-qty')) {
            const productId = target.dataset.productId;
            const quantityInput = document.getElementById(`return-qty-${productId}`);
            let val = parseInt(quantityInput.value, 10);
            const max = parseInt(quantityInput.max, 10);

            if (target.matches('.decrease-return-qty') && val > 1) quantityInput.value = val - 1;
            else if (target.matches('.increase-return-qty') && val < max) quantityInput.value = val + 1;
            
            validateReturnForm();
        }
    });
    
    returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.spinner');

        submitBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';
        
        const reason = document.getElementById('return-reason').value;
        const checkedBoxes = returnForm.querySelectorAll('input[name="return-item"]:checked');
        
        if (checkedBoxes.length === 0 || reason.trim() === '') {
            showConfirmationModal('Please select items and provide a reason.');
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
            return;
        }

        const selectedItems = Array.from(checkedBoxes).map(cb => {
            const item = order.items.find(i => i.productId === cb.value);
            const quantity = parseInt(document.getElementById(`return-qty-${cb.value}`).value, 10);
            return { ...item, quantity };
        });

        const refundAmount = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const returnRequestPayload = { orderId: order.id, reason, items: selectedItems, refundAmount };

        try {
            await fetchWithAuth('/api/returns', {
                method: 'POST',
                body: JSON.stringify({ returnRequest: returnRequestPayload })
            });
            await fetchInitialUserData();
            router.navigate('/account/returns');
            showConfirmationModal(`Your return request has been submitted.`);
        } catch (error) {
            console.error("Failed to submit return request:", error);
            showConfirmationModal(`Error: ${error.message}`);
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
        }
    });
}
function renderAndAttachReturnForm(order) {
    // Hide the 'Request a Return' link that was just clicked
    const triggerContainer = document.getElementById('return-trigger-container');
    if (triggerContainer) triggerContainer.style.display = 'none';

    // This is the same HTML for the form you had before
    const returnFormHtml = `
        <form id="direct-return-form" class="detail-card">
            <h4>Request a Return</h4>
            <p>Please select the items you wish to return and provide a reason.</p>
            <div class="form-group">
            ${order.items.map(item => `
                <div class="return-item-control">
                    <div class="form-group-checkbox">
                        <input type="checkbox" name="return-item" id="return-item-${item.productId}" value="${item.productId}">
                        <label for="return-item-${item.productId}">${item.title}</label>
                    </div>
                    <div class="quantity-selector-inline" style="display: none;">
                        <button type="button" class="quantity-btn decrease-return-qty" data-product-id="${item.productId}">-</button>
                        <input type="number" class="quantity-input-return" id="return-qty-${item.productId}" value="1" min="1" max="${item.quantity}" readonly>
                        <button type="button" class="quantity-btn increase-return-qty" data-product-id="${item.productId}">+</button>
                    </div>
                    <p class="return-price">£${item.price.toFixed(2)} ea</p>
                </div>
            `).join('')}
            </div>
            <div class="form-group" id="return-reason-group" style="display: none;">
                <label for="return-reason">Reason for return:</label>
                <textarea id="return-reason" rows="10" required></textarea>
            </div>
            <div id="return-subtotal-display" class="order-summary-total" style="display: none; border-top: 1px solid var(--border-color); margin-top:0; padding-top:0.5rem;">
                <span>Refund Subtotal</span><span id="refund-amount">£0.00</span>
            </div>
            <div style="text-align: right; margin-top: 1rem;">
                <button type="submit" id="submit-return-btn" class="btn btn-primary" disabled>
    <span class="btn-text">Submit Return Request</span>
    <div class="spinner" style="display: none;"></div>
</button>
            </div>
        </form>`;
    
    // Inject the form into the page
    const itemsContainer = document.getElementById('order-items-container');
    itemsContainer.insertAdjacentHTML('afterend', returnFormHtml);

    // --- ALL THE LISTENER LOGIC IS NOW CORRECTLY PLACED HERE ---
    const returnForm = document.getElementById('direct-return-form');
    const reasonGroup = document.getElementById('return-reason-group');
    const submitBtn = document.getElementById('submit-return-btn');
    const subtotalDisplay = document.getElementById('return-subtotal-display');
    const refundAmountEl = document.getElementById('refund-amount');

    const validateReturnForm = () => {
        let refundSubtotal = 0;
        let anyChecked = false;
        const returnItemControls = returnForm.querySelectorAll('.return-item-control');

        returnItemControls.forEach(control => {
            const checkbox = control.querySelector('input[name="return-item"]');
            const quantitySelector = control.querySelector('.quantity-selector-inline');
            const productId = checkbox.value;
            const quantityInput = document.getElementById(`return-qty-${productId}`);

            if (checkbox.checked) {
                anyChecked = true;
                quantitySelector.style.display = 'flex';
                const item = order.items.find(i => i.productId === productId);
                if (item && quantityInput) {
                    refundSubtotal += item.price * parseInt(quantityInput.value, 10);
                }
            } else {
                quantitySelector.style.display = 'none';
            }
        });

        reasonGroup.style.display = anyChecked ? 'block' : 'none';
        subtotalDisplay.style.display = anyChecked ? 'flex' : 'none';
        if(anyChecked) refundAmountEl.textContent = `£${refundSubtotal.toFixed(2)}`;
        submitBtn.disabled = !anyChecked;
    };

    returnForm.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.return-item-control')) {
            // Handle checkbox clicks (including label clicks)
            if (target.matches('label')) {
                const checkbox = document.getElementById(target.getAttribute('for'));
                if (checkbox) checkbox.checked = !checkbox.checked;
            }
            validateReturnForm();
        }
        
        // Handle quantity button clicks
        if (target.matches('.decrease-return-qty, .increase-return-qty')) {
            const productId = target.dataset.productId;
            const quantityInput = document.getElementById(`return-qty-${productId}`);
            let val = parseInt(quantityInput.value, 10);
            const max = parseInt(quantityInput.max, 10);

            if (target.matches('.decrease-return-qty') && val > 1) quantityInput.value = val - 1;
            else if (target.matches('.increase-return-qty') && val < max) quantityInput.value = val + 1;
            
            validateReturnForm();
        }
    });
    
    returnForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // --- ADD THIS BLOCK TO MANAGE THE BUTTON STATE ---
    const submitBtn = document.getElementById('submit-return-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    submitBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    // --- END OF BLOCK ---
        const reason = document.getElementById('return-reason').value;
        const checkedBoxes = returnForm.querySelectorAll('input[name="return-item"]:checked');
        if (checkedBoxes.length === 0) return showConfirmationModal('Please select at least one item.');
        if (reason.trim() === '') return showConfirmationModal('Please provide a reason for the return.');

        const selectedItems = Array.from(checkedBoxes).map(cb => {
            const item = order.items.find(i => i.productId === cb.value);
            const quantity = parseInt(document.getElementById(`return-qty-${cb.value}`).value, 10);
            return { ...item, quantity };
        });

        const refundAmount = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const newReturn = {
            id: `RET-${Date.now()}`,
            orderId: order.id,
            requestDate: new Date().toISOString(),
            status: "Pending",
            reason: reason,
            items: selectedItems.map(item => `"${item.title}" (x${item.quantity})`),
            refundAmount: refundAmount
        };
        userReturns.unshift(newReturn);
        showConfirmationModal(`Your return request for £${refundAmount.toFixed(2)} has been submitted.`, () => renderMyReturnsPage(true));
    });
}

function renderAccountPage() {
    if (!auth.isLoggedIn()) {
       router.navigate('/login');
        return;
    }
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
        auth.logout();
        renderLoginPage();
        return;
    }
    const userName = currentUser.name || 'Valued Customer';
    pageAccount.innerHTML = `
        <div class="account-container">
            <h2 class="account-title">Welcome, ${userName}!</h2>
           <div class="account-menu">
    <a href="/#/account/orders" class="account-menu-item"><i class="fa-solid fa-box-archive"></i> My Orders</a>
    <a href="/#/account/wishlist" class="account-menu-item"><i class="fa-solid fa-heart"></i> My Wishlist</a>
    <a href="/#/account/returns" class="account-menu-item"><i class="fa-solid fa-undo"></i> My Returns</a>
    <a href="/#/account/addresses" class="account-menu-item"><i class="fa-solid fa-map-location-dot"></i> My Addresses</a>
    <a href="/#/account/settings" class="account-menu-item"><i class="fa-solid fa-cog"></i> Account Settings</a>
</div>
            <button id="logout-btn" class="btn btn-secondary btn-full-width">Logout</button>
        </div>`;
    showPage('account');
}

function handleAccountMenuClicks(e) {
    console.log('--- Menu click detected. Attempting to navigate to page:', e.target.closest('.account-menu-item').dataset.page);
    e.preventDefault();
    const target = e.target.closest('.account-menu-item');
    if (!target) return;

    const page = target.dataset.page;

    // This object now correctly includes the 'my-wishlist' entry
    const pageRenderers = {
        'my-orders': renderMyOrdersPage,
        'my-wishlist': renderWishlistPage, // This was missing
        'my-addresses': renderMyAddressesPage,
        'account-settings': renderAccountSettingsPage,
        'my-returns': renderMyReturnsPage
    };

    const renderFunction = pageRenderers[page];
    if (renderFunction) {
        renderFunction();
    } else {
        console.error(`No render function found for page: ${page}`);
    }
}

// Add this missing function to the "MY ACCOUNT" section in app.js
// REPLACE this entire function in your app.js file

// REPLACE this entire function in your app.js file

function renderMyReturnsPage() {
    // --- DIAGNOSTIC LOG ---
    // This will show us the exact data in the userReturns array before the page is built.
    console.log("Rendering 'My Returns' page with this data:", JSON.parse(JSON.stringify(userReturns)));
    // --------------------

    updateReturnStatuses();

    let contentHtml = `<div class="page-header"><h2>My Returns</h2><button class="btn btn-secondary" id="returns-back-to-account">Back to Account</button></div>`;
    
    if (userReturns.length === 0) {
        contentHtml += `
            <div class="empty-state-container">
                <p>You have not requested any returns.</p>
                <button class="btn btn-primary" onclick="renderMyOrdersPage()">View My Orders</button>
            </div>
        `;
    } else {
        contentHtml += `
            <p class="returns-info-message">If you decide you no longer want to return an item, simply keep it. No action is required from you, and your request will automatically expire.</p>
            <div class="returns-list">
            ${userReturns.map(ret => {
                const itemsListHtml = ret.items.map(item => {
                    const product = allProducts.find(p => p.id === item.productId);
                    const imageUrl = product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A';
                    const displayText = `${item.title} (x${item.quantity})`;

                    return `
                    <li class="returned-item">
                        <img src="${imageUrl}" alt="${item.title}" class="returned-item-image">
                        <span>${displayText}</span>
                    </li>`;
                }).join('');

                const cancelButtonHtml = ret.status === 'Pending'
                    ? `<button class="btn btn-danger btn-sm cancel-return-btn" data-return-id="${ret.id}">Cancel Request</button>`
                    : '';

                return `
                <div class="data-card return-card">
                    <div class="data-card-header">
                        <div>
                            <p class="data-card-title">Return #${ret.id}</p>
                            <p class="data-card-subtitle">Order: #${ret.orderId}</p>
                        </div>
                        <div>
                            <p class="data-card-title">£${ret.refundAmount.toFixed(2)}</p>
                            <span class="return-status ${ret.status.toLowerCase()}">${ret.status}</span>
                        </div>
                    </div>
                    <div class="data-card-body">
                        <div class="return-details-group">
                            <p class="return-detail-label">Request Date:</p>
                            <p class="return-detail-value">${new Date(ret.requestDate.seconds * 1000).toLocaleDateString()}</p>
                        </div>
                        <div class="return-details-group">
                            <p class="return-detail-label">Reason:</p>
                            <p class="return-detail-value">${ret.reason}</p>
                        </div>
                        <div class="return-items-list-container">
                            <p class="return-detail-label">Items Returned:</p>
                            <ul class="returned-items-list">${itemsListHtml}</ul>
                        </div>
                    </div>
                    <div class="data-card-actions">
                        ${cancelButtonHtml}
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }
    pageMyReturns.innerHTML = contentHtml;
    showPage('my-returns');
}

// REPLACE this entire function in app.js

function renderMyOrdersPage() {
    // This function no longer needs to fetch. It just displays the userOrders array
    // which is now populated on login by fetchInitialUserData.
    let contentHtml = `<div class="page-header"><h2>My Orders</h2><button class="btn btn-secondary" id="orders-back-to-account">Back to Account</button></div>`;
    if (userOrders.length === 0) {
        contentHtml += `<p>You haven't placed any orders yet.</p>`;
    } else {
        contentHtml += `<div class="order-list">${userOrders.map(order => `
            <div class="data-card">
                <div class="data-card-header">
                    <div>
                        <p class="data-card-title">Order #${order.id}</p>
                        <p class="data-card-subtitle">Date: ${new Date(order.orderDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <p class="data-card-title">£${order.totalAmount.toFixed(2)}</p>
                        <span class="order-status ${order.status.toLowerCase()}">${order.status}</span>
                    </div>
                </div>
                <div class="data-card-actions">
                    <button class="btn btn-primary btn-sm view-order-details" data-order-id="${order.id}">View Details</button>
                </div>
            </div>`).join('')}</div>`;
    }
    pageMyOrders.innerHTML = contentHtml;
    showPage('my-orders');
}

function updateReturnStatuses() {
    const returnWindowInDays = 7;
    const now = new Date();

    userReturns.forEach(ret => {
        if (ret.status === "Pending") {
            const requestDate = new Date(ret.requestDate);
            const daysSinceRequest = (now - requestDate) / (1000 * 60 * 60 * 24);

            if (daysSinceRequest > returnWindowInDays) {
                ret.status = "Expired";
            }
        }
    });
}

function receiveReturnItem(returnId) {
    const returnRequest = userReturns.find(ret => ret.id === returnId);

    if (returnRequest) {
        // Find the index and replace the item in the array
        const index = userReturns.findIndex(ret => ret.id === returnId);
        if (index !== -1) {
            // Update the status and add a received date
            userReturns[index].status = "Approved";
            userReturns[index].receivedDate = new Date().toISOString();
        }
        
        // Re-render the returns page to show the updated status
        renderMyReturnsPage(); 
        showConfirmationModal(`Return #${returnId} has been marked as received and approved. The refund will be processed.`);
    } else {
        showConfirmationModal(`Error: Return ID #${returnId} not found.`);
    }
}

// REPLACE this entire function in your public/app.js file

// In app.js
function renderOrderDetailPage(orderId) {
    const order = userOrders.find(o => o.id === orderId);
    if (!order) {
        renderMyOrdersPage();
        return;
    }

    const trackingLinkHtml = order.trackingNumber && order.courierUrl
        ? `<p><strong>Tracking:</strong> <a href="${order.courierUrl}${order.trackingNumber}" target="_blank">${order.trackingNumber}</a></p>`
        : '';
        
    let contentHtml = `
        <div class="page-header"><h2>Order Details</h2><button class="btn btn-secondary" id="back-to-orders">Back to My Orders</button></div>
        <div class="detail-card">
            <div class="order-detail-summary">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Order Date:</strong> ${new Date(order.orderDate.seconds ? order.orderDate.seconds * 1000 : order.orderDate).toLocaleString()}</p>
                <p><strong>Status:</strong> <span class="order-status ${order.status.toLowerCase()}">${order.status}</span></p>
                ${trackingLinkHtml}
            </div>
        </div>
        <div class="detail-card" id="order-items-container"><h3>Items in this Order</h3><div class="order-detail-items">
            ${order.items.map(item => {
                const product = allProducts.find(p => p.id === item.productId);
                const imageUrl = item.isCustom ? 'assets/images/custom_hamper_placeholder.jpg' : (product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A');
                const componentsHtml = (item.isCustom && item.contents)
                    ? `<ul class="order-detail-components">${item.contents.map(c => `<li>- ${c.name} (x${c.quantity})</li>`).join('')}</ul>`
                    : '';
                return `
                    <div class="order-summary-item">
                        <img src="${imageUrl}" alt="${item.title}" class="cart-item-image">
                        <div class="cart-item-info">
                            <p class="cart-item-title">${item.title}</p>
                            <p>Qty: ${item.quantity}</p>
                            ${componentsHtml}
                        </div>
                        <span class="cart-item-price">£${(item.price * item.quantity).toFixed(2)}</span>
                    </div>`;
            }).join('')}
        </div></div>
        <div class="order-summary detail-card">
            <div class="order-summary-item"><span>Items Subtotal</span><span>£${order.itemsSubtotal.toFixed(2)}</span></div>
            <div class="order-summary-item"><span>Delivery</span><span>£${order.deliveryChargeApplied.toFixed(2)}</span></div>
            <div class="order-summary-total"><span>Total</span><span>£${order.totalAmount.toFixed(2)}</span></div>
        </div>
    `;
    
    const returnWindow = appConfig?.returns?.returnWindowInDays ?? 28;

    // --- THIS IS THE FIX ---
    // We now correctly convert the Firestore Timestamp to a JavaScript Date.
    const orderDate = order.orderDate.seconds ? new Date(order.orderDate.seconds * 1000) : new Date(order.orderDate);
    const daysSinceOrder = (new Date() - orderDate) / (1000 * 3600 * 24);

    const hasReturnableItems = order.items.some(orderItem => {
        const returnedQty = userReturns
            .filter(r => r.orderId === order.id)
            .flatMap(r => r.items)
            .filter(item => item.productId === orderItem.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
        return returnedQty < orderItem.quantity;
    });

    if (daysSinceOrder <= returnWindow && hasReturnableItems) {
        contentHtml += `
            <div id="return-trigger-container" class="detail-card" style="padding: 1rem 1.5rem;">
                <div style="text-align: right;">
                    <a href="#" id="show-return-form-btn" class="btn-link">Need to return an item?</a>
                </div>
            </div>`;
    } else if (daysSinceOrder > returnWindow) {
        contentHtml += `
            <div class="return-ineligible-note detail-card">
                <h4>Return Window Closed</h4>
                <p>This order was placed more than ${returnWindow} days ago and is no longer eligible for return.</p>
            </div>`;
    }

    pageOrderDetail.innerHTML = contentHtml;
    showPage('order-detail');

    const showReturnBtn = document.getElementById('show-return-form-btn');
    if (showReturnBtn) {
        showReturnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showReturnRequestPage(order);
        }, { once: true });
    }
}

function renderMyAddressesPage() {
    let contentHtml = `<div class="page-header"><h2>My Addresses</h2><button class="btn btn-secondary" id="addresses-back-to-account">Back to Account</button></div>`;
    contentHtml += `<div class="page-actions"><button class="btn btn-primary" id="add-new-address-main">Add New Address</button></div>`;
    
    if (userAddresses.length === 0) {
        contentHtml += `<p>You have no saved addresses.</p>`;
    } else {
        contentHtml += `<div class="address-list">${userAddresses.map(address => `
            <div class="data-card">
                ${address.isDefault ? '<span class="badge">Default</span>' : ''}
                <div class="data-card-body">
                    <p><strong>${address.fullName}</strong></p>
                    <p>${address.addressLine1}</p>
                    ${address.addressLine2 ? `<p>${address.addressLine2}</p>` : ''}
                    <p>${address.city}, ${address.postcode}</p>
                    <p>${address.country}</p>
                </div>
                <div class="data-card-actions">
                    ${!address.isDefault ? `<button class="btn btn-secondary btn-sm set-default-address" data-address-id="${address.id}">Set as Default</button>` : ''}
                    <button class="btn btn-secondary btn-sm edit-address" data-address-id="${address.id}">Edit</button>
                    <button class="btn btn-danger btn-sm delete-address" data-address-id="${address.id}">Delete</button>
                </div>
            </div>`).join('')}</div>`;
    }
    pageMyAddresses.innerHTML = contentHtml;
    showPage('my-addresses');
}

function renderAddressForm(addressToEdit) {
    const isEditing = !!addressToEdit;
    pageAddressForm.innerHTML = `
        <div class="page-header"><h2>${isEditing ? 'Edit Address' : 'Add New Address'}</h2><button class="btn btn-secondary" id="back-to-addresses">Cancel</button></div>
        <div class="form-container">
            <form id="address-form">
                <input type="hidden" id="addressId" value="${isEditing ? addressToEdit.id : ''}">
                <div class="form-group"><label for="fullName">Full Name</label><input type="text" id="fullName" value="${isEditing ? addressToEdit.fullName : ''}" required></div>
                <div class="form-group"><label for="addressLine1">Address Line 1</label><input type="text" id="addressLine1" value="${isEditing ? addressToEdit.addressLine1 : ''}" required></div>
                <div class="form-group"><label for="addressLine2">Address Line 2 (Optional)</label><input type="text" id="addressLine2" value="${isEditing && addressToEdit.addressLine2 ? addressToEdit.addressLine2 : ''}"></div>
                <div class="form-group"><label for="city">Town / City</label><input type="text" id="city" value="${isEditing ? addressToEdit.city : ''}" required></div>
                <div class="form-group"><label for="postcode">Postcode</label><input type="text" id="postcode" value="${isEditing ? addressToEdit.postcode : ''}" required></div>
                <div class="form-group"><label for="country">Country</label><input type="text" id="country" value="${isEditing ? addressToEdit.country : 'UK'}" required></div>
                <div class="form-group form-group-checkbox"><input type="checkbox" id="isDefault" ${isEditing && addressToEdit.isDefault ? 'checked' : ''}><label for="isDefault">Set as default</label></div>
                <button type="submit" id="save-address-btn" class="btn btn-primary btn-full-width">
    <span class="btn-text">Save Address</span>
    <div class="spinner" style="display: none;"></div>
</button>
            </form>
        </div>`;
    showPage('address-form');
}


async function handleSaveAddress(e) {
    e.preventDefault();

    // --- THIS IS THE FIX ---
    const saveBtn = document.getElementById('save-address-btn');
    const btnText = saveBtn.querySelector('.btn-text');
    const spinner = saveBtn.querySelector('.spinner');

    saveBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    // --- END OF FIX ---

    const addressId = document.getElementById('addressId').value;
    const isEditing = !!addressId;

    const newAddressData = {
        fullName: document.getElementById('fullName').value,
        addressLine1: document.getElementById('addressLine1').value,
        addressLine2: document.getElementById('addressLine2').value,
        city: document.getElementById('city').value,
        postcode: document.getElementById('postcode').value,
        country: document.getElementById('country').value,
        isDefault: document.getElementById('isDefault').checked
    };

    try {
        if (isEditing) {
            await fetchWithAuth('/api/addresses', {
                method: 'PUT',
                body: JSON.stringify({ addressId, ...newAddressData })
            });
        } else {
            await fetchWithAuth('/api/addresses', {
                method: 'POST',
                body: JSON.stringify(newAddressData)
            });
        }
        
        userAddresses = await fetchWithAuth('/api/addresses');
        
        if (addressFormReturnPath === 'checkout') {
            const savedAddress = userAddresses.find(addr => addr.fullName === newAddressData.fullName && addr.addressLine1 === newAddressData.addressLine1);
            if (savedAddress) selectedCheckoutAddressId = savedAddress.id;
            displayCheckoutPage();
        } else {
            renderMyAddressesPage();
        }
        addressFormReturnPath = null;

    } catch (error) {
        console.error("Failed to save address:", error);
        showConfirmationModal(`Error saving address: ${error.message}`);
        
        // --- ADD THIS on error ---
        // Re-enable the button so the user can try again
        saveBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        // --- END ADDED BLOCK ---
    }
}

// REPLACE this function in your public/app.js file

// REPLACE this function in your public/app.js file

// REPLACE this entire function in your public/app.js file

// REPLACE this entire function in your public/app.js file

function renderAccountSettingsPage() {
    if (!auth.isLoggedIn()) { renderLoginPage(); return; }
    const currentUser = auth.getCurrentUser();
    if (!currentUser) { auth.logout(); renderLoginPage(); return; }

    const userName = currentUser.name || '';
    const userEmail = currentUser.email || '';

    pageAccountSettings.innerHTML = `
        <div class="page-header"><h2>Account Settings</h2><button class="btn btn-secondary" id="back-to-account">Back to Account</button></div>
        <div class="form-container">
            <form id="account-settings-form">
                <h3>Update Your Details</h3>
                <div class="form-group">
                    <label for="account-name">Full Name</label>
                    <input type="text" id="account-name" value="${userName}" required>
                </div>
                <div class="form-group">
                    <label for="account-email">Email Address</label>
                    <input type="email" id="account-email" value="${userEmail}" readonly>
                    <small>Email address cannot be changed.</small>
                </div>
                <hr style="margin: 2rem 0;">
                <h3>Change Password</h3>
                <div class="form-group">
                    <label for="current-password">Current Password</label>
                    
                    <input type="password" id="current-password" placeholder="Enter your current password" autocomplete="current-password" readonly>
                
                </div>
                <div class="form-group">
                    <label for="new-password">New Password</label>
                    <input type="password" id="new-password" placeholder="Enter a new password" autocomplete="new-password">
                    <div class="password-strength-container">
                        <div id="change-strength-bar" class="strength-bar"></div>
                    </div>
                    <div id="change-strength-text" class="password-strength-text"></div>
                </div>
                 <div class="form-group">
                    <label for="confirm-new-password">Confirm New Password</label>
                    <input type="password" id="confirm-new-password" placeholder="Re-type the new password" autocomplete="new-password">
                </div>
                <button type="submit" id="update-settings-btn" class="btn btn-primary btn-full-width">
                    <span class="btn-text">Update Settings</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </form>
        </div>`;

    showPage('account-settings');

    // --- CHANGE 2: ADD THIS SCRIPT TO REMOVE 'readonly' ON FOCUS ---
    const currentPasswordInput = document.getElementById('current-password');
    if (currentPasswordInput) {
        // As soon as the user focuses on the input, make it editable.
        currentPasswordInput.addEventListener('focus', () => {
            currentPasswordInput.removeAttribute('readonly');
        }, { once: true }); // { once: true } makes the listener remove itself after running.
    }
    // -----------------------------------------------------------------

    const newPasswordInput = document.getElementById('new-password');
    const strengthBar = document.getElementById('change-strength-bar');
    const strengthText = document.getElementById('change-strength-text');

    newPasswordInput.addEventListener('input', () => {
        const password = newPasswordInput.value;
        const { score, feedback } = checkPasswordStrength(password);
        
        strengthBar.className = 'strength-bar';
        if (password.length > 0) {
            if (score <= 1) strengthBar.classList.add('weak');
            else if (score === 2) strengthBar.classList.add('medium');
            else strengthBar.classList.add('strong');
        }
        strengthText.textContent = password.length > 0 ? feedback : '';
    });

    document.getElementById('account-settings-form').addEventListener('submit', handleUpdateAccount);
}


async function handleUpdateAccount(e) {
    e.preventDefault();
    const name = document.getElementById('account-name').value;
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    const updateBtn = document.getElementById('update-settings-btn');
    const btnText = updateBtn.querySelector('.btn-text');
    const spinner = updateBtn.querySelector('.spinner');

    updateBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    // --- SIMPLIFIED LOGIC START ---
    let successMessages = [];
    let errorMessages = [];
    let changesMade = false;
    // --- SIMPLIFIED LOGIC END ---

    // 1. Handle Name Update
    const currentUser = auth.getCurrentUser();
    if (name && name.trim() !== '' && name !== currentUser.name) {
        const nameResult = await auth.updateUser({ name });
        if (nameResult.success) {
            successMessages.push("Name updated successfully.");
            changesMade = true;
        } else {
            errorMessages.push(`Failed to update name: ${nameResult.message}`);
        }
    }

    // 2. Handle Password Change
    if (currentPassword || newPassword || confirmNewPassword) {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            errorMessages.push("To change your password, you must fill in all three password fields.");
        } else if (newPassword.length < 8 || !newPassword.match(/[0-9]/)) {
            errorMessages.push("New password must be at least 8 characters long and contain at least one number.");
        } else if (newPassword !== confirmNewPassword) {
            errorMessages.push("The new passwords do not match.");
        } else {
            const passwordResult = await auth.changePassword(currentPassword, newPassword);
            if (passwordResult.success) {
                successMessages.push("Password changed successfully.");
                changesMade = true;
                // Clear password fields for security
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-new-password').value = '';
                // Manually clear the strength bar
                const strengthBar = document.getElementById('change-strength-bar');
                if (strengthBar) strengthBar.className = 'strength-bar';
            } else {
                errorMessages.push(`Password change failed: ${passwordResult.message}`);
            }
        }
    }

    // 3. Reset the UI
    updateBtn.disabled = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';

    // 4. Provide Clear and Accurate Feedback
    if (errorMessages.length > 0) {
        showConfirmationModal(errorMessages.join('\n'));
    } else if (changesMade) {
        showConfirmationModal(successMessages.join('\n'));
    } else {
        showConfirmationModal("No changes were made.");
    }
}
// --------------------------------------------------------------------- //
// -------------------- KIT: CREATE YOUR OWN HAMPER ----------------- //
// --------------------------------------------------------------------- //

function displayCreateYourOwnPage() {
    showPage('create');
    
    const isEditing = !!editingCartItemId;

    pageCreate.innerHTML = `
        <div class="create-hamper-container">
            <div class="create-hamper-header">
                <h2>${isEditing ? 'Edit Your Hamper' : 'Create Your Own Hamper'}</h2>
                <p>Select your desired items below to craft a unique gift. Click an item to add or remove it.</p>
            </div>
            <div id="item-selection-grid" class="item-selection-grid"></div>
        </div>
        <div id="custom-hamper-summary-bar" class="custom-hamper-summary-bar">
            <div class="summary-total">
                <span class="summary-label">Hamper Total:</span>
                <span id="custom-hamper-price" class="summary-price">£0.00</span>
            </div>
            <button id="add-custom-hamper-btn" class="btn btn-primary">
                <i class="fa-solid ${isEditing ? 'fa-check-circle' : 'fa-basket-shopping'}"></i>
                <span>${isEditing ? 'Update Hamper' : 'Add to Basket'}</span>
            </button>
        </div>
    `;

    const itemGrid = document.getElementById('item-selection-grid');
    itemGrid.innerHTML = customHamperItems.map(item => {
        const isSelected = selectedCustomItems.some(selected => selected.id === item.id);
        return `
        <div class="selectable-item-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
            <div class="item-image-container">
                <img src="${item.imageUrl}" alt="${item.name}" class="item-image" onerror="this.onerror=null;this.src='https://placehold.co/300x200/f3f4f6/9ca3af?text=No+Image';">
                <div class="selection-indicator"><i class="fa-solid fa-check"></i></div>
            </div>
            <div class="item-info">
                <p class="item-name">${item.name}</p>
                <p class="item-price">£${item.price.toFixed(2)}</p>
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.selectable-item-card').forEach(card => {
        card.addEventListener('click', () => toggleCustomItem(card.dataset.itemId));
    });
    document.getElementById('add-custom-hamper-btn').addEventListener('click', addCustomHamperToCart);
    
    updateCustomHamperSummary();
}

function toggleCustomItem(itemId) {
    const itemIndex = selectedCustomItems.findIndex(item => item.id === itemId);
    const card = document.querySelector(`.selectable-item-card[data-item-id="${itemId}"]`);

    if (itemIndex > -1) {
        selectedCustomItems.splice(itemIndex, 1);
        card.classList.remove('selected');
    } else {
        const item = customHamperItems.find(i => i.id === itemId);
        if (item) {
            selectedCustomItems.push(item);
            card.classList.add('selected');
        }
    }
    updateCustomHamperSummary();
}

function updateCustomHamperSummary() {
    const totalPriceElement = document.getElementById('custom-hamper-price');
    const addBtn = document.getElementById('add-custom-hamper-btn');
    
    const totalPrice = selectedCustomItems.reduce((total, item) => total + item.price, 0);
    totalPriceElement.textContent = `£${totalPrice.toFixed(2)}`;

    addBtn.disabled = selectedCustomItems.length === 0;
}

function addCustomHamperToCart() {
    if (selectedCustomItems.length === 0) return;

    // Correctly initialize each item with a quantity of 1 for calculation
    const itemsWithQuantity = selectedCustomItems.map(item => ({ ...item, quantity: 1 }));

    // Recalculate the total price based on the components
    const totalPrice = itemsWithQuantity.reduce((total, item) => total + (item.price * item.quantity), 0);

    if (editingCartItemId) {
        // --- UPDATE EXISTING HAMPER ---
        const cartItem = cart.find(item => item.id === editingCartItemId);
        if (cartItem) {
            cartItem.contents = itemsWithQuantity;
            cartItem.price = totalPrice;
        }
        showConfirmationRibbon('Custom Hamper updated!');
    } else {
        // --- ADD NEW HAMPER ---
        // Pass the correctly formatted components and price to addToCart
        addToCart(null, 1, true, itemsWithQuantity, totalPrice);
        showConfirmationRibbon('Custom Hamper added to basket!', true);
    }
    
    // Reset the state for the next creation
    selectedCustomItems = [];
    editingCartItemId = null;
    
    updateCart();
    displayCreateYourOwnPage();
}
function changeComponentQuantity(cartItemId, componentId, amount) {
    const hamperItem = cart.find(item => item.id === cartItemId);
    if (!hamperItem || !hamperItem.isCustom) return;

    const component = hamperItem.contents.find(c => c.id === componentId);
    if (component) {
        component.quantity = (component.quantity || 1) + amount;
        if (component.quantity <= 0) {
            // Remove the component if its quantity drops to 0 or less
            hamperItem.contents = hamperItem.contents.filter(c => c.id !== componentId);
        }
    }

    // If all components are removed, remove the hamper itself
    if (hamperItem.contents.length === 0) {
        removeFromCart(cartItemId);
    } else {
        // Recalculate the hamper's total price based on its components
        hamperItem.price = hamperItem.contents.reduce((total, c) => total + (c.price * c.quantity), 0);
        updateCart(); // Re-render the cart with the new price and component list
    }
}
function showConfirmationRibbon(message, showViewBasketBtn = false) {
    const ribbon = document.getElementById('confirmation-ribbon');
    const messageEl = document.getElementById('ribbon-message');
    const viewBasketBtn = document.getElementById('ribbon-view-basket-btn');

    if (!ribbon || !messageEl || !viewBasketBtn) return;

    // Clear any existing timer to prevent the ribbon from hiding early
    if (ribbonTimeout) {
        clearTimeout(ribbonTimeout);
    }

    messageEl.textContent = message;
    viewBasketBtn.style.display = showViewBasketBtn ? 'inline-block' : 'none';

    ribbon.classList.add('active');

    // Set a timer to hide the ribbon after 3 seconds
    ribbonTimeout = setTimeout(() => {
        ribbon.classList.remove('active');
    }, 3000);
}
//Brevo backend
// Add this new function to app.js
function initializePushNotifications() {
    (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = "https://sdk.brevo.com/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
    }(document, "script", "brevo-sdk"));

    window.brevo_q = window.brevo_q || [];
    window.brevo_q.push(["init", {
        publicKey: "YOUR_PUBLIC_VAPID_KEY_HERE", // <-- IMPORTANT: PASTE YOUR KEY HERE
        serviceWorkerUrl: "/brevo-service-worker.js",
    }]);
    
    window.brevo_q.push(["subscribe"]);
    
    console.log("Brevo Push Notifications initialized.");
}


