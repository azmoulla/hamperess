// FILE: app.js
// This file has been reorganized into logical kits for better maintainability.
// Import the handlers (ensure file paths are correct relative to app.js)
//import aboutUsHandler from './api/content-handler?action=about_us.js';
//import contactUsHandler from './api/content-handler?action=contact_us.js';

// ... inside your Express application setup ...

// Register the handlers
// The app.all method allows both GET (fetching) and POST (saving) to use the same handler
//app.all('/api/content-handler?action=about_us', aboutUsHandler);      // <-- THIS WAS MISSING/CRASHING BEFORE
//app.all('/api/content-handler?action=contact_us', contactUsHandler);  // <-- THIS IS THE NEW MISSING ROUTE
// ------------------------------------------------------------------ //
// -------------------- KIT: CORE SETUP & STATE -------------------- //
// ------------------------------------------------------------------ //
// TEST - IF THIS COMMENT DISAPPEARS, THE FILE IS BEING OVERWRITTEN.
const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
const searchIndex = searchClient.initIndex('products');
//import siteSettingsHandler from './api/content-handler?action=site_settings.js';
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
    { selector: '.remove-discount-btn', handler: removeDiscount },
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
    { selector: '.save-for-later-btn', handler: (target) => saveItemForLater(target.dataset.id) },
    { selector: '.move-to-basket-btn', handler: (target) => moveItemToCart(target.dataset.id) },
    { selector: '.write-review-btn', handler: (target) => router.navigate(`/account/orders/${target.dataset.orderId}/review`) },
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
                await fetchWithAuth(`→ /api/user-handler?action=returns?returnId=${returnId}`, {
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
                    await fetchWithAuth(`/api/user-handler?action=addresses?addressId=${addressId}`, { method: 'DELETE' });
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
                await fetchWithAuth('/api/user-handler?action=addresses', {
                    method: 'PUT',
                    body: JSON.stringify({ addressId, ...addressToUpdate, isDefault: true })
                });
                // Refresh the list from the server to get the updated states
                userAddresses = await fetchWithAuth('/api/user-handler?action=addresses');
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

     

    // This is the handler for the image carousel inside the product card
   
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
        e.preventDefault();  // This stops the page from navigating
        e.stopPropagation(); // This stops the click from affecting other elements
        const imageContainer = target.closest('.product-image-container');
        if (!imageContainer) return;
        updateCarousel(imageContainer, target.matches('.carousel-arrow')
            ? parseInt(imageContainer.dataset.currentIndex, 10) + parseInt(target.dataset.direction, 10)
            : parseInt(target.dataset.index, 10));
        return true; // Confirms the event is handled
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
    {
        selector: '.carousel-arrow',
        handler: (target, e) => {
            const container = target.parentElement.querySelector('.carousel-container');
            if (container) {
                const scrollAmount = container.clientWidth * 0.8; // Scroll by 80% of the visible width
                container.scrollBy({
                    left: scrollAmount * parseInt(target.dataset.direction, 10),
                    behavior: 'smooth'
                });
            }
        }
    },
    {
    selector: '.quick-view-btn',
    handler: (target, e) => {
        e.preventDefault(); // This is the crucial line: it stops the link from navigating.
        e.stopPropagation();
        openQuickViewModal(target.dataset.productId);
        return true;
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
let allProducts = [], cart = [], customHamperItems = [], selectedCustomItems = [];savedForLater = [];
let userOrders = [], userAddresses = [], userReturns = [];
let selectedCheckoutAddressId = null;
let appConfig = {};
let currentCarouselIndex = 0;
let currentlyDisplayedProducts = [];
let confirmCallback = null;
let currentCategoryFilter = 'all'; // New: To store the active category filter from menu/occasions
let currentTagFilter = null; // New: To store the active tag filter (e.g., 'BESTSELLER', 'SALE')
let lastScrollTop = 0; // For hide-on-scroll header
let isInitialAuthCheck = true; // This flag will help the app know when it's running for the very first time on a page load.
let postLoginRedirectPath = null;
let currentOrderSearchTerm = '';
let currentOrderDateFilter = 'all';
let currentOrderStatusFilter = 'all';


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
const pageReviewForm = document.getElementById('page-review-form');
const quickViewModalOverlay = document.getElementById('quick-view-modal-overlay');
const quickViewContent = document.getElementById("quick-view-content");

// ADD THIS HELPER FUNCTION to your public/app.js file
// FILE: public/app.js

// --- ADD THIS HELPER FUNCTION ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
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
// --------------------STAR RATING------------------- //
// FILE: public/app.js

// --- ADD THIS HELPER FUNCTION ---
function generateStarRating(rating = 0) {
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fa-solid fa-star"></i>';
    }
    if (halfStar) {
        starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="fa-regular fa-star"></i>';
    }
    return starsHtml;
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
    router.addRoute('/account/orders/:id/review', params => renderReviewFormPage(params.id));
    router.addRoute('/our-mission', () => fetchAndDisplayStaticPage('our_mission'));
    router.addRoute('/privacy-policy', () => fetchAndDisplayStaticPage('privacy_policy'));
    router.addRoute('/terms-and-conditions', () => fetchAndDisplayStaticPage('terms_and_conditions'));
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

// Find Address button is clicked


// User selects an address from the results dropdown


document.addEventListener('DOMContentLoaded', async () => {
    console.log("!!! DOMContentLoaded event listener started !!!");
    console.log("DOM content loaded. Initializing app...");

    // 1. Fetch ALL critical data first and wait for it to finish.
    //    fetchProducts() has been moved here.
    await Promise.all([
        fetchConfig(),
        fetchMenu(),
        fetchProducts(),
        fetchSiteSettings() 
    ]);

    // 2. Setup core UI and event listeners
    setupEventListeners();
    updateHeaderIcons();
    loadCart();
    //initializePushNotifications();
    loadSavedForLater();

    // 3. Define all application routes
    defineRoutes();

    // 4. NOW that all data is loaded and routes are defined, initialize the router.
    //    This was previously happening in the wrong place (inside handleAuthStateChange).
    if (isInitialAuthCheck) {
        router.init();
        router.handleRouteChange();
        isInitialAuthCheck = false;
        displayCookieConsent();
        displayNewsletterPopup();
    }
    
    // 5. Fetch non-critical data in the background
    Promise.allSettled([
        fetchDiscounts(), 
        fetchFooterInfo(),
        fetchOccasions(), 
        fetchFeatures(), 
        fetchTestimonials()
    ]).then(() => {
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

let initialUserDataPromise = null;
// ------------------------------------------

async function handleAuthStateChange() {
    console.log("[handleAuthStateChange] Auth state changed.");
    updateHeaderIcons(); // Update icons immediately

    const isLoggedIn = auth.isLoggedIn();

    if (isLoggedIn) {
        console.log("[handleAuthStateChange] User is logged in. Fetching initial data...");
        // Start fetching data and store the promise
        initialUserDataPromise = fetchInitialUserData();
        try {
            await initialUserDataPromise; // Wait for the data fetch to complete
            console.log("[handleAuthStateChange] Initial user data fetch completed.");
            loadCart(); // Load cart AFTER user data might have synced it
        } catch (fetchError) {
            console.error("[handleAuthStateChange] Error awaiting initial user data:", fetchError);
            // Even if fetch fails, resolve the promise so the app doesn't hang
             initialUserDataPromise = Promise.resolve(); 
        }

    } else {
        console.log("[handleAuthStateChange] User is logged out.");
        // Clear user data and resolve the promise immediately
        userAddresses = [];
        userOrders = [];
        userReturns = [];
        initialUserDataPromise = Promise.resolve(); // Indicate no user data is needed/available
        loadCart(); // Load empty/local cart
    }

    // Handle routing AFTER auth state and initial data fetch attempt are settled
    if (isInitialAuthCheck) {
        console.log("[handleAuthStateChange] Initial auth check complete. Initializing router...");
        router.init(); // Start listening for hash changes
        router.handleRouteChange(); // Manually trigger the handler for the initial URL
        isInitialAuthCheck = false;
    } else {
        // For subsequent auth changes (login/logout), just handle the current route.
        console.log("[handleAuthStateChange] Subsequent auth change. Handling route...");
        router.handleRouteChange();
    }
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

// FILE: public/app.js

// --- REPLACE the old setupEventListeners function with this one ---
function setupEventListeners() {
    console.log("setupEventListeners: Attaching event listeners.");
    window.addEventListener('resize', renderFooterLayout);
    document.body.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', manageFilterLocation);
    window.addEventListener('authchange', handleAuthStateChange);
    pageAddressForm.addEventListener('submit', (e) => {
        if (e.target && e.target.id === 'address-form') {
            handleSaveAddress(e);
        }
    });
    window.addEventListener('wishlistChange', () => {
        if (pageList.style.display !== 'none') {
            updateProductView();
        }
        if (pageDetail.style.display !== 'none') {
            updateAllWishlistIcons();
        }
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
    }

    document.getElementById('search-form')?.addEventListener('submit', (e) => {
         e.preventDefault(); // Prevent page reload on submit
         updateProductView(); // Trigger search immediately
    });

    // --- THIS IS THE UPGRADED PART ---
    // We now listen to the 'input' event and use our debounce function
    const debouncedSearch = debounce(updateProductView, 300); // 300ms delay
    document.getElementById('search-input')?.addEventListener('input', debouncedSearch);
    // --- END UPGRADE ---

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
    document.getElementById('newsletter-close-btn')?.addEventListener('click', closeNewsletterPopup);
    document.getElementById('newsletter-no-thanks')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        closeNewsletterPopup(); 
    });
    document.getElementById('newsletter-modal-overlay')?.addEventListener('click', (e) => { 
        if (e.target.id === 'newsletter-modal-overlay') closeNewsletterPopup(); 
    });
    document.getElementById('newsletter-form-modal')?.addEventListener('submit', handleNewsletterSubmit);
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

// REPLACE your current handleGlobalClick function with this diagnostic version
// REPLACE your handleGlobalClick function with this ADVANCED diagnostic version
// REPLACE your entire handleGlobalClick function with this final version
function handleGlobalClick(e) {
    // First, loop through all our specific button handlers
    for (const action of CLICK_HANDLERS) {
        const target = e.target.closest(action.selector);
        
        // If a button is matched (e.g., '.quick-view-btn')
        if (target) {
            // Run its specific handler
            const result = action.handler(target, e);
            
            // THIS IS THE FIX:
            // If the handler does its job, we immediately stop this entire function
            // so it doesn't accidentally trigger the link navigation below.
            if (result !== false) {
                return; 
            }
        }
    }

    // This code ONLY runs if no specific button was clicked above
    const link = e.target.closest('a[href^="/#"]');
    if (link) {
        e.preventDefault();
        const path = link.hash.slice(1);
        router.navigate(path);
        if (document.getElementById('mobile-nav-overlay')?.classList.contains('active')) {
            closeMobileMenu();
        }
    }
}

// In app.js

// Replace your existing displayMenu function with this diagnostic version
// FILE: public/app.js

/* REPLACE the existing displayMenu function with this one */
function displayMenu(menuItems) {
    const navLinksContainer = document.getElementById('nav-links');
    const mobileNavLinks = document.getElementById('mobile-nav-links');
    if (!navLinksContainer || !mobileNavLinks) {
        console.error("ERROR: Could not find #nav-links or #mobile-nav-links elements.");
        return;
    }

    let desktopMenuHtml = '';
    let mobileMenuHtml = `<a href="/#/account" class="mobile-nav-link-item account-link"><i class="fa-solid fa-user"></i> My Account / Log In</a>`;

    menuItems.forEach(item => {
        const saleClass = item.isSale ? 'sale-item' : '';

        if (item.isMegaMenu && item.subMenu) {
            // --- Logic for DESKTOP Mega Menu ---
            const subMenuLinks = item.subMenu.map(subItem => 
                `<a href="/#/category/${subItem.argument}" class="mega-menu-link">${subItem.title}</a>`
            ).join('');

            desktopMenuHtml += `
                <div class="nav-item-with-mega-menu">
                    <span class="nav-links-desktop-item ${saleClass}">${item.title}</span>
                    <div class="mega-menu-panel">
                        <div class="mega-menu-content">
                            ${subMenuLinks}
                        </div>
                    </div>
                </div>
            `;

            // --- Logic for MOBILE Accordion Menu ---
            mobileMenuHtml += `
                <div class="mobile-nav-accordion">
                    <button class="mobile-nav-accordion-header">
                        <span>${item.title}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="mobile-nav-accordion-content">
                        ${item.subMenu.map(subItem => `<a href="/#/category/${subItem.argument}" class="mobile-nav-link-item sub-item">${subItem.title}</a>`).join('')}
                    </div>
                </div>
            `;
        } else {
            // --- Logic for standard links (Desktop and Mobile) ---
            const linkTarget = item.target === '/create-your-own' ? '/#/create-your-own' : `/#/category/${item.argument}`;
            desktopMenuHtml += `<a href="${linkTarget}" class="nav-links-desktop-item ${saleClass}">${item.title}</a>`;
            mobileMenuHtml += `<a href="${linkTarget}" class="mobile-nav-link-item ${saleClass}">${item.title}</a>`;
        }
    });

    navLinksContainer.innerHTML = desktopMenuHtml;
    mobileNavLinks.innerHTML = mobileMenuHtml;
    
    // Add event listeners for the new mobile accordion
    document.querySelectorAll('.mobile-nav-accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            button.parentElement.classList.toggle('open');
        });
    });
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


    // REPLACE the existing applyDiscount function in app.js with this new version

    async function applyDiscount(code, source = 'checkout') {
    const messageEl = document.getElementById(`${source}-discount-message`);
    const inputEl = document.getElementById(`${source}-discount-code`);
    const trimmedCode = code.trim();
        if (messageEl) {
        messageEl.textContent = '';
        messageEl.className = 'discount-message';
    }
    if (!trimmedCode) {
        if (appliedDiscount) {
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

    try {
        // Call the new back-end API to validate the code
        const response = await fetch(`/api/user-handler?action=validate_discount&code=${trimmedCode}`);
        const discountData = await response.json();

        if (!response.ok) {
            // If the API returns an error (like 404 Not Found), display it
            throw new Error(discountData.error || 'Invalid discount code.');
        }
        
        // If the code is valid, apply it
        appliedDiscount = discountData;
        messageEl.textContent = `Success! "${discountData.description}" applied.`;
        messageEl.className = 'discount-message success';

    } catch (error) {
        // If the fetch fails or the code is invalid, show an error
        messageEl.textContent = error.message;
        messageEl.className = 'discount-message error';
        // IMPORTANT: Do not remove an existing valid discount if a new invalid one is entered
    } finally {
        // Clear the input field and update totals regardless of the outcome
        if (inputEl) inputEl.value = '';
        updateCartTotals();
    }
}

async function fetchData(url) {
    console.log(`[fetchData] Fetching from: ${url}`); // Add log
    try {
        const response = await fetch(url);
        console.log(`[fetchData] Response status for ${url}: ${response.status}`); // Add log
        if (!response.ok) {
            // Try to get error message from response body, otherwise use status text
            let errorMsg = response.statusText;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || response.statusText;
            } catch (e) { /* Ignore parsing error if response isn't JSON */ }
            console.error(`[fetchData] HTTP error for ${url}: ${response.status} - ${errorMsg}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorMsg}`);
        }
        // Handle potential empty responses specifically if needed, but API should return JSON
        if (response.status === 204 || response.headers.get("content-length") === "0") {
             console.log(`[fetchData] Received empty response for ${url}.`);
             return null; // Or return a default object if appropriate
        }
        const data = await response.json();
        console.log(`[fetchData] Successfully fetched and parsed JSON for ${url}.`); // Add log
        return data;
    } catch (error) {
        console.error(`[fetchData] CATCH block error fetching ${url}:`, error);
        return null; // Return null on any fetch/parse error
    }
}

// REPLACE this entire function in your public/app.js file

// REPLACE your entire existing fetchInitialUserData function with this one.

// In app.js, REPLACE this entire function

async function fetchInitialUserData() {
    if (auth.isLoggedIn()) {
        try {
            console.log("Fetching user data (addresses, orders, and returns)...");
            
            const results = await Promise.allSettled([
                fetchWithAuth('/api/user-handler?action=addresses'),
                // THIS LINE IS THE FIX: It forces the browser to ignore its cache for orders.
                fetchWithAuth('/api/orders-handler?action=get_orders', { cache: 'no-cache' }), 
                fetchWithAuth('→ /api/user-handler?action=returns', { cache: 'no-cache' }) // Also good practice to add for returns
            ]);

            const addressesResult = results[0];
            const ordersResult = results[1];
            const returnsResult = results[2];

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

            if (returnsResult.status === 'fulfilled') {
                userReturns = returnsResult.value;
                console.log("Successfully fetched returns:", userReturns.length);
            } else {
                console.error("Failed to fetch user returns:", returnsResult.reason);
                userReturns = [];
            }
            
        } catch (error) {
            console.error("A critical error occurred during initial user data fetch:", error);
            userAddresses = [];
            userOrders = [];
            userReturns = [];
        }
    } else {
        userOrders = [];
        userAddresses = [];
        userReturns = [];
    }
    return Promise.resolve();
}

// FILE: public/app.js

// Replace the existing fetchProducts function with this one
async function fetchProducts() {
    console.log("fetchProducts: Fetching products data from backend API.");
    const productGrid = document.getElementById('product-grid');
    
    // 1. Show Skeleton Loaders immediately
    if (productGrid) {
        let skeletonHtml = '';
        // Display 8 skeleton cards as placeholders
        for (let i = 0; i < 8; i++) {
            skeletonHtml += `
                <div class="skeleton-card">
                    <div class="skeleton-image shimmer"></div>
                    <div class="skeleton-text shimmer"></div>
                    <div class="skeleton-text short shimmer"></div>
                    <div class="skeleton-price shimmer"></div>
                </div>
            `;
        }
        productGrid.innerHTML = skeletonHtml;
    }

    const productsData = await fetchData('/api/product-handler?action=products'); 
    if (productsData && !productsData.error) {
        allProducts = productsData.map(product => {
            const rawPrice = product.price;
            let parsedPrice = rawPrice;

            if (typeof rawPrice === 'string') {
                parsedPrice = parseFloat(rawPrice.replace(/[^\d.-]/g, ''));
            }

            // --- TYPO FIX IS HERE: 'parsed-price' is now correctly 'parsedPrice' ---
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
        // 2. Once data is fetched, call updateProductView to replace skeletons with real products
        updateProductView(); 
    } else {
        console.error("Failed to fetch products from /api/product-handler?action=products:", productsData ? productsData.error : "No data returned");
        allProducts = [];
        currentlyDisplayedProducts = [];
        if (productGrid) {
            productGrid.innerHTML = `<p style="color: red; text-align: center;">Error: Could not load products from the server. Please try again later.</p>`;
        }
    }
}

async function fetchOccasions() {
    console.log("fetchOccasions: Fetching occasions data.");
    // Updated to use content-handler
    const occasions = await fetchData('/api/content-handler?action=occasions');
    if (occasions) displayOccasions(occasions);
}

async function fetchMenu() {
   console.log("fetchMenu: Fetching menu data from API.");
    // Updated to use admin-handler
    const menuItems = await fetchData('/api/admin-handler?action=get_menu');
    if (menuItems) {
        displayMenu(menuItems);
    } else {
        console.error("fetchMenu: Failed to fetch menu data.");
    }
}

async function fetchFooterInfo() {
    console.log("fetchFooterInfo: Fetching footer info from API.");
    // This now fetches from your new API endpoint
    const footerInfo = await fetchData('/api/content-handler?action=footer_info');
    if (footerInfo) {
        displayFooter(footerInfo);
    } else {
        console.error("fetchFooterInfo: Failed to fetch footer data from /api/content-handler?action=footer_info.");
    }
}

// In app.js, replace the entire function// In app.js, replace the entire function
// FILE: app.js
// Replace your old fetchCustomHamperItems function with this new version.

async function fetchCustomHamperItems() {
    console.log("fetchCustomHamperItems: Fetching components from backend API.");
    // This now fetches from our new Vercel serverless function instead of the local JSON file.
    const customHamperData = await fetchData('/api/product-handler?action=components');

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
    // Updated to use content-handler
    const features = await fetchData('/api/content-handler?action=features');
    if (features) displayFeatures(features);
}

async function fetchTestimonials() {
    console.log("fetchTestimonials: Fetching testimonials data.");
    // Updated to use the merged content-handler
    const testimonials = await fetchData('/api/content-handler?action=testimonials');
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

async function updateProductView() {
    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const priceFilterValue = document.getElementById('filter-select')?.value || 'all';
    const sortValue = document.getElementById('sort-select')?.value || 'default';
    const productsSection = document.getElementById('products-section');
    const productsSectionTitle = document.getElementById('products-section-title');

    if (searchTerm) {
        productsSection.classList.add('search-active');
    } else {
        productsSection.classList.remove('search-active');
    }

    let productsToDisplay = [];
    let currentTitle = "All Hampers";

    if (searchTerm) {
        try {
            const { hits } = await searchIndex.search(searchTerm);
            productsToDisplay = hits;
            currentTitle = `Results for "${searchTerm}"`;
        } catch (error) {
            console.error("Algolia search error:", error);
            productsToDisplay = [];
            currentTitle = "Search Error";
        }
    } else {
        productsToDisplay = [...allProducts];
        
        if (currentTagFilter) {
            productsToDisplay = productsToDisplay.filter(p => p.tag === currentTagFilter);
            currentTitle = currentTagFilter === 'BESTSELLER' ? 'Bestsellers' : 'Special Sale Items';
        } 
        // --- THIS IS THE CORRECTED LOGIC ---
        else if (currentCategoryFilter && currentCategoryFilter !== 'all' && currentCategoryFilter !== '__ALL_PRODUCTS_TRIGGER__') {
            currentTitle = currentCategoryFilter;
            // Loosen the filter to search within text instead of requiring an exact category match.
            // This also removes the trailing 's' to match singular words (e.g., "Hampers" -> "hamper").
            const simplifiedFilter = currentCategoryFilter.replace(/s$/, '').toLowerCase();
            
            productsToDisplay = productsToDisplay.filter(p => 
                (p.title && p.title.toLowerCase().includes(simplifiedFilter)) || 
                (p.category && p.category.toLowerCase().includes(simplifiedFilter))
            );
        }
        // --- END OF CORRECTION ---

        if (priceFilterValue.startsWith('price-')) {
            const range = priceFilterValue.replace('price-', '').split('-');
            const min = Number(range[0]);
            const max = range.length > 1 ? Number(range[1]) : Infinity;
            productsToDisplay = productsToDisplay.filter(p => p.price >= min && p.price < max);
        }

        switch (sortValue) {
            case 'price-asc': productsToDisplay.sort((a, b) => a.price - b.price); break;
            case 'price-desc': productsToDisplay.sort((a, b) => b.price - b.price); break;
            case 'name-asc': productsToDisplay.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'name-desc': productsToDisplay.sort((a, b) => b.title.localeCompare(a.title)); break;
        }
    }
    
    if (productsSectionTitle) {
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

    // CRITICAL: Load dynamic settings
    const { 
        enableQuickView, 
        showLowStockIndicator, 
        lowStockThreshold,
        baseCurrencySymbol
    } = window.appSettings || {};
    // CRITICAL: Pass the currency symbol to the formatting helper
    const currency = baseCurrencySymbol ?? '£'; 
    
    const isSearchActive = document.getElementById('products-section').classList.contains('search-active');

    if (products.length === 0) {
        gridElement.innerHTML = '<p class="text-center py-8">No products found matching your criteria.</p>';
        return;
    }

    gridElement.innerHTML = products.map(product => {
        const isOutOfStock = product.stock <= 0;
        const imageUrls = getProductImageUrls(product);
        const primaryImageUrl = imageUrls[0];
        const isWishlisted = wishlist.getAllItemIds().includes(String(product.id));
        const hasCarousel = imageUrls.length > 1;
        const productSlug = createSlug(product.slug);
        
        // CRITICAL FIX: Use dynamic settings for stock alert visibility and threshold
        const isLowStock = showLowStockIndicator && product.stock > 0 && product.stock <= lowStockThreshold;
        let stockInfoHtml = '<div class="stock-placeholder"></div>';
        if (isOutOfStock) {
            stockInfoHtml = '<p class="out-of-stock-message">Out of Stock</p>';
        } else if (isLowStock) {
            stockInfoHtml = `<p class="low-stock-message">Only ${product.stock} left!</p>`;
        }

        const dotsHtml = hasCarousel ? `<div class="carousel-dots">${imageUrls.map((_, index) => `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}</div>` : '';
        const carouselArrowsHtml = hasCarousel ? `<button class="carousel-arrow prev" data-direction="-1" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button><button class="carousel-arrow next" data-direction="1" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>` : '';
        
        const starRatingHtml = product.rating ? `
            <div class="star-rating">
                ${generateStarRating(product.rating)}
                <span class="review-count">(${product.reviewCount || 0})</span>
            </div>
        ` : '<div class="star-rating-placeholder"></div>';

        const quickViewBtnHtml = enableQuickView 
            ? `<button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>`
            : '';

        const priceHtml = (product.salePrice && product.salePrice < product.price)
            ? `<div class="price-container sale">
                   <span class="sale-price">${currency}${product.salePrice.toFixed(2)}</span>
                   <span class="original-price">${currency}${product.price.toFixed(2)}</span>
               </div>`
            : `<p class="product-price">${currency}${product.price.toFixed(2)}</p>`;

        const imageHtml = `
            <div class="product-image-container" data-product-id="${product.id}" data-images="${imageUrls.join(',')}" data-current-index="0">
                <img src="${primaryImageUrl}" alt="${product.title}" class="product-image" loading="lazy">
                ${quickViewBtnHtml} 
                <button class="wishlist-btn ${isWishlisted ? 'favorited' : ''}" data-product-id="${product.id}" aria-label="Toggle Wishlist">
                    <i class="fa-solid fa-heart"></i>
                </button>
                ${product.tag ? `<div class="product-tag">${product.tag}</div>` : ''}
                ${carouselArrowsHtml}
                ${dotsHtml}
            </div>
        `;

        const titleHtml = `<h3 class="product-title">${product.title}</h3>`;
        const descriptionHtml = product.professionalDescription ? `<p class="product-description">${product.professionalDescription}</p>` : '';
        const addToBasketBtnHtml = `<button class="add-to-basket-btn" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Out of Stock' : 'Add'}</button>`; 

        if (isSearchActive) {
            return `
                <div class="product-card list-view" data-product-id="${product.id}">
                    <div class="list-view-image-wrapper">
                         <a href="/#/products/${productSlug}" class="product-image-link">${imageHtml}</a>
                    </div>
                    <div class="list-view-info-wrapper">
                         <a href="/#/products/${productSlug}" class="product-title-link">${titleHtml}</a>
                         ${starRatingHtml}
                         ${descriptionHtml}
                         ${stockInfoHtml}
                         <div class="product-footer">
                             ${priceHtml}
                             ${addToBasketBtnHtml}
                         </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="product-card" data-product-id="${product.id}">
                    <a href="/#/products/${productSlug}" class="product-image-link">${imageHtml}</a>
                    <div class="product-info">
                        <a href="/#/products/${productSlug}" class="product-title-link">${titleHtml}</a>
                        ${starRatingHtml}
                        ${stockInfoHtml}
                        <div class="product-footer">
                            ${priceHtml}
                            ${addToBasketBtnHtml}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// --- ADD this new helper function anywhere in app.js ---
function getDeliveryEstimate() {
    const today = new Date();
    const startDay = new Date(today);
    startDay.setDate(today.getDate() + 3); // Delivery in 3 days
    const endDay = new Date(today);
    endDay.setDate(today.getDate() + 5); // Delivery within 5 days

    const options = { month: 'short', day: 'numeric' };
    const startStr = startDay.toLocaleDateString('en-GB', options);
    const endStr = endDay.toLocaleDateString('en-GB', options);

    return `FREE delivery ${startStr} - ${endStr}`;
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

// FILE: public/app.js

// --- REPLACE the entire showProductDetail function with this one ---
// Replace your entire existing showProductDetail function
// Replace your entire existing showProductDetail function
async function showProductDetail(slug) {
    // This corrected line normalizes BOTH slugs for a reliable match.
    const product = allProducts.find(p => createSlug(p.slug) === createSlug(slug));

    if (!product) {
        console.error("FAILED to find a matching product for slug:", slug);
        pageDetail.innerHTML = `<div class="container text-center py-8"><h2>Product Not Found</h2><p>Sorry, we couldn't find the product you're looking for.</p><a href="/#/" class="btn btn-primary mt-4">Back to Shopping</a></div>`;
        showPage('detail');
        return;
    }

    // --- The rest of your function remains the same ---
    pageDetail.innerHTML = '';
    showPage('detail');
    // ... (the rest of the function code follows) ...
    const deliveryInfoData = await fetchData('data/pages/delivery_info.json');
    let deliveryReturnsContent = '<p>Delivery information could not be loaded.</p>';
    if (deliveryInfoData && Array.isArray(deliveryInfoData) && deliveryInfoData.length > 0) {
        const deliverySummary = deliveryInfoData[0].content;
        deliveryReturnsContent = `<p>${deliverySummary.replace(/\n/g, '</p><p>')}</p><p style="margin-top: 1rem;">For full details, view our policy.</p><a href="#" class="btn-link" data-target="/delivery-info">View Full Delivery & Returns Policy</a>`;
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
    const contentsHtml = (product.contents && product.contents.length > 0) ? `<ul>${product.contents.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p>Contents for this hamper are not listed.</p>';
    const dotsHtml = hasCarousel ? `<div class="carousel-dots">${imageUrls.map((_, index) => `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}</div>` : '';
    const carouselControlsHtml = hasCarousel ? `<button class="carousel-arrow prev" data-direction="-1"><i class="fa-solid fa-chevron-left"></i></button><button class="carousel-arrow next" data-direction="1"><i class="fa-solid fa-chevron-right"></i></button>${dotsHtml}` : '';
    const actionButtonsHtml = `<div class="quantity-selector"><button class="quantity-btn" data-action="decrease">-</button><input type="number" class="quantity-input" value="1" min="1" max="${product.stock}"><button class="quantity-btn" data-action="increase">+</button></div><button class="btn btn-primary add-to-basket-btn-detail" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}><span>${isOutOfStock ? 'Out of Stock' : 'Add to Basket'}</span></button><button class="btn btn-outline wishlist-toggle-btn" data-product-id="${product.id}"><span>${isWishlisted ? 'Saved' : 'Save'}</span></button>`;
    const starRatingHtml = product.rating ? `<div class="star-rating detail-page-stars">${generateStarRating(product.rating)}<span class="review-count">(${product.reviewCount || 0} reviews)</span></div>` : '';
    pageDetail.innerHTML = `<div class="page-header"><button class="btn btn-secondary" id="back-to-list-detail">&larr; Back to Products</button></div><div class="detail-grid"><div class="image-zoom-container"><div class="detail-image-container" data-images="${imageUrls.join(',')}" data-current-index="0"><img src="${imageUrls[0]}" alt="${product.title}" class="detail-image">${carouselControlsHtml}</div><div id="image-zoom-result" class="image-zoom-result"></div></div><div class="detail-info"><p class="category">${product.category}</p><h1 class="title">${product.title}</h1>${starRatingHtml}<p class="price">£${product.price.toFixed(2)}</p>${stockIndicatorHtml}<div class="product-tabs-container"><div class="tab-nav"><button class="tab-link active" data-tab="description">Description</button><button class="tab-link" data-tab="contents">Hamper Contents</button><button class="tab-link" data-tab="delivery">Delivery & Returns</button></div><div class="tab-content-container"><div class="tab-content active" id="description-tab">${descriptionContent}</div><div class="tab-content" id="contents-tab">${contentsHtml}</div><div class="tab-content" id="delivery-tab">${deliveryReturnsContent}</div></div></div><div class="detail-actions">${actionButtonsHtml}</div></div></div>`;
    setTimeout(() => {
        renderRelatedProducts(product);
        const imageZoomContainer = document.querySelector('.image-zoom-container');
        if (imageZoomContainer) setupImageZoom(imageZoomContainer);
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
            pageDetail.querySelector('[data-action="decrease"]').addEventListener('click', () => { let val = parseInt(qtyInput.value, 10); if (val > 1) qtyInput.value = val - 1; });
            pageDetail.querySelector('[data-action="increase"]').addEventListener('click', () => { let val = parseInt(qtyInput.value, 10); const max = parseInt(qtyInput.max, 10); if (val < max) qtyInput.value = val + 1; });
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

// FILE: public/app.js

function displayOccasions(occasions) {
    const wrapper = document.getElementById('occasions-carousel-wrapper');
    if (!wrapper || !occasions) {
        console.error("Occasions wrapper or data not found.");
        return;
    }

    // Build the complete carousel HTML structure
    const cardsHtml = occasions.map(occasion => `
        <div class="occasion-card" data-navigation-argument="${occasion.navigationArgument}">
            <img src="${occasion.imageUrl}" alt="${occasion.title}" class="occasion-image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/f3f4f6/9ca3af?text=No+Image';">
            <h3 class="occasion-name">${occasion.title}</h3>
        </div>
    `).join('');

    wrapper.innerHTML = `
        <button class="carousel-arrow prev" data-direction="-1" aria-label="Previous occasion">&#8249;</button>
        <div class="carousel-container">
            ${cardsHtml}
        </div>
        <button class="carousel-arrow next" data-direction="1" aria-label="Next occasion">&#8250;</button>
    `;
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
        // Create a container for the product grid
        contentHtml += `<div id="wishlist-product-grid" class="product-grid-wishlist"></div>`;
    }

    wishlistPage.innerHTML = contentHtml;

    // If there are products, use the main displayProducts function to render them
    if (wishlistProducts.length > 0) {
        displayProducts(wishlistProducts, document.getElementById('wishlist-product-grid'));
    }

    showPage('wishlist');
}

// Add this function to public/app.js
async function fetchDiscounts() {
    console.log("fetchDiscounts: Fetching discounts data.");
    const discountsData = await fetchData('data/discounts.json');
    if (discountsData) {
        allDiscounts = discountsData;
    }
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
    if (!headerIconsContainer) {
        console.error("updateHeaderIcons: headerIconsContainer not found yet.");
        return; // Exit if the element isn't ready
    }
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
// REPLACE this function in app.js
function showConfirmationModal(message, callback) {
    // --- DEBUGGING ---
    console.log("--- showConfirmationModal START ---");
    console.log("Message:", message);
    console.log("Callback provided?", typeof callback === 'function');
    console.log("confirmationModalOverlay found?", !!confirmationModalOverlay);
    console.log("confirmationModal found?", !!confirmationModal);
    console.log("modalMessage found?", !!modalMessage);
    // --- END DEBUGGING ---

    if (!confirmationModalOverlay || !confirmationModal || !modalMessage) {
         console.error("showConfirmationModal ABORTED: One or more modal elements NOT found!");
         return; // Stop if elements are missing
    }

    console.log("showConfirmationModal: Elements found, proceeding...");

    modalMessage.textContent = message;
    confirmCallback = callback;

    console.log("showConfirmationModal: Setting overlay display to 'flex'");
    confirmationModalOverlay.style.display = 'flex';

    console.log("showConfirmationModal: Setting modal display to 'block'");
    confirmationModal.style.display = 'block';

    if (modalCancelBtn) {
        modalCancelBtn.style.display = callback ? 'inline-block' : 'none';
        console.log("showConfirmationModal: Set Cancel button display to:", callback ? 'inline-block' : 'none');
    }
    if (modalConfirmBtn) {
        modalConfirmBtn.textContent = callback ? 'Confirm' : 'OK';
         console.log("showConfirmationModal: Set Confirm button text to:", callback ? 'Confirm' : 'OK');
    }
     console.log("--- showConfirmationModal END ---");
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
    let pageContent;
    let endpoint = '';

    // Route to the new Content Handler
    switch(pageName) {
        case 'about_us':
            endpoint = '/api/content-handler?action=about_us';
            break;
        case 'our_mission':
            endpoint = '/api/content-handler?action=our_mission';
            break;
        case 'privacy_policy':
            endpoint = '/api/content-handler?action=privacy_policy';
            break;
        case 'terms_and_conditions':
            endpoint = '/api/content-handler?action=terms_and_conditions';
            break;
        case 'contact_us':
            endpoint = '/api/content-handler?action=contact_us';
            break;
        case 'faqs': 
            endpoint = '/api/content-handler?action=faqs';
            break;
        case 'delivery_info': 
            endpoint = '/api/content-handler?action=delivery_info';
            break;
        default:
            // Dynamic pages now go through the content handler too
            endpoint = `/api/content-handler?action=pages&slug=${pageName}`;
            break;
    }

    try {
        pageContent = await fetchData(endpoint);
        console.log(`[fetchAndDisplayStaticPage] Raw content for '${pageName}':`, pageContent);
        if (!pageContent) throw new Error(`No content received from ${endpoint}`);
    } catch (error) {
         console.error(`Error fetching content for ${pageName}:`, error);
        pageContent = null;
    }

    if (pageContent) {
        if (pageName === 'faqs') {
            renderFaqPage(pageContent);
        } else if (pageName === 'delivery_info') {
            renderDeliveryInfoPage(pageContent);
        } else if (pageName === 'contact_us') {
             renderContactPage(pageContent);
        } else if (pageContent.pageTitle || pageContent.title) {
             // Handle generic pages (About Us, Mission, Privacy, Terms, Dynamic)
             renderGenericStaticPage(pageContent, pageName, pageContent.pageTitle || pageContent.title);
        } else {
            pageStatic.innerHTML = `<div class="static-content-container"><h2>Error</h2><p>Unexpected content format.</p></div>`;
            showPage('static');
        }
    } else {
        pageStatic.innerHTML = `<div class="static-content-container"><h2>Page Not Found</h2><p>The content for '${pageName}' could not be loaded.</p></div>`;
        showPage('static');
    }
}

// REPLACE this function
function renderGenericStaticPage(pageData, pageName, titleOverride = null) {
    // Determine the main title (use override if available)
    const mainTitle = titleOverride || pageData.pageTitle || pageData.sections?.[0]?.title || pageName.replace(/_/g, ' ');

    // Ensure pageData.sections exists and is an array before mapping
    const sectionsHtml = (Array.isArray(pageData.sections) && pageData.sections.length > 0)
        ? pageData.sections.map(section => {
            // Only show section H3 if it's different from the main page title and exists
            const sectionTitleHtml = (section.title && section.title !== mainTitle) ? `<h3>${section.title}</h3>` : '';
            // Ensure content exists, default to empty string
            const sectionContent = section.content || '';
            return `
            <section>
                ${sectionTitleHtml}
                
                <div class="static-content" style="white-space: pre-wrap;">${sectionContent}</div>
            </section>`;
          }).join('')
        : '<p>Content sections could not be loaded or are empty.</p>'; // Fallback content

    // Set the HTML for the static page container
    pageStatic.innerHTML = `
        <div class="static-content-container">
            <div class="page-header">
                <h2>${mainTitle}</h2>
                <button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button>
            </div>
            <div class="static-content-body">${sectionsHtml}</div>
        </div>`;

    // Add event listener to the back button
    const backBtn = pageStatic.querySelector('#back-to-home-btn');
    if (backBtn) {
         backBtn.addEventListener('click', showAllProducts);
    } else {
         console.warn("Could not find #back-to-home-btn in static page content.");
    }

    // Display the static page container
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
    if (!pageStatic) {
        console.error("Static page container not found!");
        return;
    }

    const pageTitle = deliveryData.pageTitle || 'Delivery Information';
    // Ensure sections is an array before mapping
    const sectionsHtml = (Array.isArray(deliveryData.sections) && deliveryData.sections.length > 0)
        ? deliveryData.sections.map(item => `
                <div class="delivery-section mb-8 flex items-start space-x-4">
                    <div class="mt-1 w-8 text-center flex-shrink-0"> {/* Icon container */}
                        <i class="${getDeliveryIconClass(item.iconName)} text-blue-600 text-2xl"></i> {/* Use helper */}
                    </div>
                    <div> 
                        <h3 class="font-semibold text-lg mb-1 text-gray-800">${item.title || 'Untitled Section'}</h3>
                        <p class="text-gray-700 leading-relaxed" style="white-space: pre-wrap;">${item.content || ''}</p> {/* Style content */}
                    </div>
                </div>`).join('')
        : '<p class="text-gray-500">Delivery information is currently unavailable.</p>'; // Fallback message

    pageStatic.innerHTML = `
        <div class="static-content-container container mx-auto px-4 py-8">
            <div class="page-header pb-4 mb-8 border-b"> 
                <h2 class="text-3xl font-bold text-gray-900">${pageTitle}</h2> 
                <button class="btn btn-secondary" id="back-to-home-btn">Back to Home</button>
            </div>
            <div class="delivery-info-list">
                ${sectionsHtml}
            </div>
        </div>`;

    // Re-attach listener after setting innerHTML
    const backBtn = pageStatic.querySelector('#back-to-home-btn');
    if (backBtn) {
        backBtn.addEventListener('click', showAllProducts);
    } else {
        console.warn("Could not find #back-to-home-btn in static page content.");
    }
    showPage('static');
}

function getDeliveryIconClass(iconName = '') {
    // Map of expected icon names (lowercase, no special chars) to Font Awesome classes
    const map = {
        truckfast: 'fa-solid fa-truck-fast', // Delivery truck
        globeeurope: 'fa-solid fa-globe', // Generic globe for international
        magnifyingglasslocation: 'fa-solid fa-magnifying-glass-location', // Tracking
        clipboardlist: 'fa-solid fa-clipboard-list' // Notes
        // Add more mappings here if needed
    };
    // Clean the input name
    const cleanIconName = iconName.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Return the mapped class or a default fallback icon
    return map[cleanIconName] || 'fa-solid fa-info-circle';
}
// ----------------------------------------------------------------- //
// -------------------- KIT: AUTHENTICATION -------------------- //
// ----------------------------------------------------------------- //

// REPLACE this entire function in app.js

// REPLACE this entire function in app.js

// REPLACE the renderLoginPage function in your app.js file with this CORRECT version.

// REPLACE your entire renderLoginPage function with this one
function renderLoginPage() {

    // Before rendering anything, check if the user is already logged in.
    if (auth.isLoggedIn()) {
        console.log("User is already logged in. Redirecting...");
        // Redirect to the intended page (like /checkout) or the account page as a fallback.
        const redirectPath = postLoginRedirectPath || '/account';
        postLoginRedirectPath = null; // Clear the redirect path after using it once.
        router.navigate(redirectPath);
        return; // IMPORTANT: Stop the function here so it doesn't render the login form.
    }
    // --- END OF FIX ---
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

// FILE: public/app.js

// --- Replace the existing validateField function with this upgraded version ---
function validateField(inputElement) {
    if (!inputElement) return false;

    const group = inputElement.closest('.form-group');
    const icon = group.querySelector('.validation-icon');
    const errorMsg = group.querySelector('.error-message');
    let isValid = true;
    let message = '';
    const value = inputElement.value.trim();

    if (inputElement.required && value === '') {
        isValid = false;
        message = 'This field is required.';
    } else if (value !== '') {
        switch (inputElement.id) {
            case 'checkout-name':
            case 'card-name':
                isValid = value.length >= 2;
                message = 'Please enter a full name.';
                break;
            case 'checkout-email':
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                message = 'Please enter a valid email address.';
                break;
            case 'checkout-address1':
            case 'checkout-city':
                isValid = value.length >= 3;
                message = 'Please enter a valid address.';
                break;
            case 'checkout-postcode-manual':
                isValid = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(value);
                message = 'Please enter a valid UK postcode.';
                break;
            case 'card-number':
                const strippedCard = value.replace(/\D/g, '');
                isValid = strippedCard.length >= 13 && luhnCheck(strippedCard);
                message = 'Please enter a valid card number.';
                break;
            case 'card-expiry':
                const expiryParts = value.match(/(\d{2}) \/ (\d{2})/);
                if (expiryParts) {
                    const month = parseInt(expiryParts[1], 10);
                    const year = parseInt(expiryParts[2], 10);
                    if (month < 1 || month > 12) {
                        isValid = false;
                        message = 'Month must be between 01 and 12.';
                    } else {
                        isValid = isValidExpiry(month, year);
                        message = 'This card has expired.';
                    }
                } else {
                    isValid = false;
                    message = 'Enter expiry as MM / YY.';
                }
                break;
            case 'card-cvc':
                isValid = /^[0-9]{3,4}$/.test(value);
                message = 'Enter a valid CVC.';
                break;
        }
    }

    group.classList.remove('has-success', 'has-error');
    icon.style.display = 'none';
    errorMsg.style.display = 'none';

    if (isValid) {
        if (value !== '') {
            group.classList.add('has-success');
            icon.className = 'validation-icon success';
            icon.innerHTML = '✔';
            icon.style.display = 'block';
        }
    } else {
        group.classList.add('has-error');
        icon.className = 'validation-icon error';
        icon.innerHTML = '!';
        errorMsg.textContent = message;
        icon.style.display = 'block';
        errorMsg.style.display = 'block';
    }
    return isValid;
}

// Automatically formats card number with spaces
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '').substring(0, 16);
    let formattedValue = value.replace(/(\d{4})/g, '$1 ').trim();
    input.value = formattedValue;
}

// Automatically formats expiry date with a slash
function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '').substring(0, 4);
    if (value.length > 2) {
        input.value = `${value.substring(0, 2)} / ${value.substring(2)}`;
    } else {
        input.value = value;
    }
}

// Industry-standard Luhn algorithm for card number validation
function luhnCheck(val) {
    let sum = 0;
    for (let i = 0; i < val.length; i++) {
        let intVal = parseInt(val.substr(i, 1));
        if (i % 2 === 0) {
            intVal *= 2;
            if (intVal > 9) {
                intVal = 1 + (intVal % 10);
            }
        }
        sum += intVal;
    }
    return (sum % 10) === 0;
}

// Checks if the expiry date is in the future
function isValidExpiry(month, year) {
    if (!month || !year) return false;
    const now = new Date();
    const currentYear = now.getFullYear() % 100; // Get last two digits of the year
    const currentMonth = now.getMonth() + 1;
    const expiryYear = parseInt(year, 10);
    const expiryMonth = parseInt(month, 10);

    if (expiryYear < currentYear) return false;
    if (expiryYear === currentYear && expiryMonth < currentMonth) return false;
    return true;
}

function attachValidationListeners(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('input').forEach(input => {
        // Reset state while typing
        input.addEventListener('input', () => {
            // Special formatting for payment fields
            if (input.id === 'card-number') formatCardNumber(input);
            if (input.id === 'card-expiry') formatExpiryDate(input);
            if (input.id === 'card-cvc') input.value = input.value.replace(/\D/g, '').substring(0, 4);
            
            resetFieldState(input);
        });
        // Validate when user leaves the field
        input.addEventListener('blur', () => validateField(input));
    });
}

const storeGuestDetails = () => {
    guestDetails.name = document.getElementById('checkout-name')?.value || guestDetails.name;
    guestDetails.email = document.getElementById('checkout-email')?.value || guestDetails.email;
    guestDetails.addressLine1 = document.getElementById('checkout-address1')?.value || guestDetails.addressLine1;
    guestDetails.city = document.getElementById('checkout-city')?.value || guestDetails.city;
    guestDetails.postcode = document.getElementById('checkout-postcode-manual')?.value || guestDetails.postcode;
    guestDetails.phone = document.getElementById('checkout-phone')?.value || guestDetails.phone;
};

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

    // This is the correct logic:
    if (quickViewModalOverlay) {
        quickViewModalOverlay.classList.add('active');
    }
}

function closeQuickViewModal() {
    // This is the correct logic:
    if (quickViewModalOverlay) {
        quickViewModalOverlay.classList.remove('active');
    }
    quickViewContent.innerHTML = ''; 
}

async function saveCart() {
    // 1. Get persistence setting
    const days = window.appSettings?.cartPersistenceDays || 30;
    const now = new Date();
    
    // 2. Set expiration timestamp
    const expiryTimestamp = now.getTime() + (days * 24 * 60 * 60 * 1000);

    // 3. Create a wrapper object with the cart and its expiry
    const cartData = {
        cart: cart,
        expires: expiryTimestamp
    };

    // 4. Save the new object to localStorage
    localStorage.setItem('luxuryHampersCart', JSON.stringify(cartData));

    // 5. Sync to backend (no change here)
    if (auth.isLoggedIn()) {
        try {
            await fetchWithAuth('/api/user-handler?action=cart', {
                method: 'POST',
                body: JSON.stringify({ cart: cart })
            });
        } catch (error) {
            console.error("Could not sync cart to backend:", error);
        }
    }
}
function loadCart() {
    const cartDataString = localStorage.getItem('luxuryHampersCart');
    if (!cartDataString) {
        cart = [];
        return;
    }

    try {
        const cartData = JSON.parse(cartDataString);
        const now = new Date().getTime();

        // Check if it's the new format (an object with 'expires')
        if (cartData && cartData.expires && cartData.cart) {
            if (now > cartData.expires) {
                // Cart is expired
                cart = [];
                localStorage.removeItem('luxuryHampersCart');
            } else {
                // Cart is valid
                cart = cartData.cart;
            }
        } else if (Array.isArray(cartData)) {
            // This is the old format (just an array)
            // For backward compatibility, we'll load it but re-save it in the new format.
            cart = cartData;
            saveCart(); // This will save it in the new format with an expiry date
        } else {
            // Data is corrupt or in an unknown format
            cart = [];
        }
    } catch (error) {
        console.error("Error loading cart from localStorage:", error);
        cart = [];
    }
    
    updateCart(); // Update UI
}

function saveSavedForLater() {
    localStorage.setItem('luxuryHampersSaved', JSON.stringify(savedForLater));
}

function loadSavedForLater() {
    savedForLater = JSON.parse(localStorage.getItem('luxuryHampersSaved')) || [];
}
function saveItemForLater(productId) {
    const itemIndex = cart.findIndex(item => item.id.toString() === productId.toString());
    if (itemIndex === -1) return;

    const [itemToSave] = cart.splice(itemIndex, 1); // Remove from cart

    // Don't worry about quantity, just add it to the saved list
    if (!savedForLater.some(item => item.id.toString() === productId.toString())) {
        savedForLater.push(itemToSave);
    }

    updateCart(); // Re-render everything
}

function moveItemToCart(productId) {
    const itemIndex = savedForLater.findIndex(item => item.id.toString() === productId.toString());
    if (itemIndex === -1) return;

    const [itemToMove] = savedForLater.splice(itemIndex, 1); // Remove from saved list

    // Add back to cart, checking if it already exists
    const existingCartItem = cart.find(item => item.id.toString() === productId.toString());
    if (existingCartItem) {
        existingCartItem.quantity += itemToMove.quantity;
    } else {
        cart.push(itemToMove);
    }

    updateCart(); // Re-render everything
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
         triggerFlyToCartAnimation(productId);
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
function updateCart() {
    // --- THIS IS THE FIX: Check if cart is empty ---
    if (cart.length === 0 && appliedDiscount) {
        console.log("Cart is empty, removing applied discount.");
        removeDiscount(); // This already calls updateCartTotals
    } else {
        updateCartTotals(); // Otherwise, just update totals normally
    }
    // --- END FIX ---

    renderCartItems();
    updateCartCount();
    saveCart();
    saveSavedForLater();
}
function openCart() { sideCart.classList.add('active'); cartOverlay.classList.add('active'); }
function closeCart() { sideCart.classList.remove('active'); cartOverlay.classList.remove('active'); }

// FILE: public/app.js

// Replace the existing renderCartItems function with this final merged version
function renderCartItems() {
    goToCheckoutBtn.disabled = cart.length === 0;
    if (cart.length === 0 && savedForLater.length === 0) {
        cartItemsContainer.innerHTML = '<p>Your basket is empty.</p>';
        goToCheckoutBtn.disabled = true;
        return;
    }
    
    goToCheckoutBtn.disabled = cart.length === 0;

    const activeCartHtml = cart.map(item => {
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
                        <div class="hamper-actions">
                            <button class="btn btn-secondary btn-sm edit-hamper-btn" data-id="${item.id}">
                                <i class="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button class="cart-item-action-link save-for-later-btn" data-id="${item.id}">Save for later</button>
                        </div>
                        <span class="cart-item-price">£${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
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
                    <div class="cart-item-actions">
                        <button class="cart-item-remove-btn" data-id="${item.id}">Remove</button>
                        <button class="cart-item-action-link save-for-later-btn" data-id="${item.id}">Save for later</button>
                    </div>
                </div>`;
        }
    }).join('');

    const savedForLaterHtml = savedForLater.map(item => {
        const primaryImageUrl = getProductImageUrls(item)[0];
        return `
            <div class="cart-item saved-item">
                <img src="${primaryImageUrl}" alt="${item.title}" class="cart-item-image">
                <div class="cart-item-info">
                    <p class="cart-item-title">${item.title}</p>
                    <p class="cart-item-price">£${item.price.toFixed(2)}</p>
                </div>
                <div class="cart-item-actions">
                     <button class="cart-item-remove-btn" data-id="${item.id}">Remove</button>
                     <button class="cart-item-action-link move-to-basket-btn" data-id="${item.id}">Move to basket</button>
                </div>
            </div>`;
    }).join('');

    cartItemsContainer.innerHTML = `
        <div id="active-cart-items">
            ${cart.length > 0 ? activeCartHtml : '<p>Your basket is empty.</p>'}
        </div>
        ${savedForLater.length > 0 ? `
            <div class="saved-for-later-container">
                <h3>Saved for Later</h3>
                <div id="saved-items-list">
                    ${savedForLaterHtml}
                </div>
            </div>
        ` : ''}
    `;
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


function updateCartTotals() {
    const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();
    const discountCode = appliedDiscount ? appliedDiscount.code : '';
    const discountDescription = appliedDiscount ? appliedDiscount.description : '';

    // Function to update a specific summary section (Cart or Checkout)
    const updateSummarySection = (prefix) => {
        const subtotalEl = document.getElementById(`${prefix}-subtotal`);
        const deliveryEl = document.getElementById(`${prefix}-delivery`);
        const totalEl = document.getElementById(`${prefix}-total`);
        const discountRow = document.querySelector(`#${prefix === 'cart' ? 'side-cart' : 'page-checkout'} .discount-row`);
        const discountAmountEl = document.getElementById(`${prefix}-discount`);
        const discountInfoEl = document.getElementById(`${prefix}-discount-info`); // New element for code/remove btn

        if(subtotalEl) subtotalEl.textContent = `£${itemsSubtotal.toFixed(2)}`;
        if(deliveryEl) deliveryEl.textContent = `£${deliveryChargeApplied.toFixed(2)}`;
        if(totalEl) totalEl.textContent = `£${Math.max(0, totalAmount).toFixed(2)}`;
        if(totalEl) totalEl.textContent = formatCurrency(Math.max(0, totalAmount));
        if (discountRow && discountAmountEl) {
            if (appliedDiscount) {
                discountRow.style.display = 'flex';
                ddiscountAmountEl.textContent = `- ${formatCurrency(discountApplied)}`;
                // Add the code and remove button
                if (discountInfoEl) {
                    discountInfoEl.innerHTML = ` (<span class="discount-code-display">${discountCode}</span> <button class="remove-discount-btn" data-source="${prefix}" title="Remove discount">✕</button>)`;
                    discountInfoEl.style.display = 'inline';
                }
            } else {
                discountRow.style.display = 'none';
                if (discountInfoEl) discountInfoEl.style.display = 'none'; // Hide code/remove btn
            }
        }
    };

    updateSummarySection('cart');
    updateSummarySection('checkout');
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

function triggerFlyToCartAnimation(productId) {
    const cartIcon = document.querySelector('.cart-icon-wrapper');
    // Find the source image, whether it's on the product grid, detail page, or quick view modal
    const productImage = document.querySelector(
        `#page-list [data-product-id="${productId}"] .product-image, 
         #page-detail .detail-image, 
         #quick-view-modal .product-image`
    );

    if (!productImage || !cartIcon) return; // Exit if elements aren't visible

    // 1. Get the starting and ending coordinates
    const startRect = productImage.getBoundingClientRect();
    const endRect = cartIcon.getBoundingClientRect();

    // 2. Create a clone of the image
    const imgClone = productImage.cloneNode(true);
    imgClone.classList.add('fly-to-cart-clone');

    // 3. Set the initial position of the clone
    imgClone.style.top = `${startRect.top}px`;
    imgClone.style.left = `${startRect.left}px`;
    imgClone.style.width = `${startRect.width}px`;
    imgClone.style.height = `${startRect.height}px`;

    // 4. Append the clone to the body
    document.body.appendChild(imgClone);

    // 5. Trigger the animation by setting the final position
    // We use requestAnimationFrame to ensure the browser has rendered the initial state first
    requestAnimationFrame(() => {
        imgClone.style.top = `${endRect.top + endRect.height / 4}px`;
        imgClone.style.left = `${endRect.left + endRect.width / 4}px`;
        imgClone.style.width = '0px';
        imgClone.style.height = '0px';
        imgClone.style.opacity = '0.5';
    });

    // 6. Remove the clone from the DOM after the animation finishes
    imgClone.addEventListener('transitionend', () => {
        imgClone.remove();
    });
}

function resetFieldState(inputElement) {
    if (!inputElement) return;
    const group = inputElement.closest('.form-group');
    if (!group) return;

    group.classList.remove('has-success', 'has-error');
    const icon = group.querySelector('.validation-icon');
    const errorMsg = group.querySelector('.error-message');
    if (icon) icon.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';
}

function displayCheckoutPage() {
    if (cart.length === 0) {
        showConfirmationModal("Your shopping basket is empty.");
        router.navigate('/');
        return;
    }
    const isLoggedIn = auth.isLoggedIn();

    if (isLoggedIn && checkoutStep === 1 && userAddresses.length > 0 && !selectedCheckoutAddressId) {
        const defaultAddress = userAddresses.find(addr => addr.isDefault);
        selectedCheckoutAddressId = defaultAddress ? defaultAddress.id : userAddresses[0].id;
    }

    const autocompleteHtml = `
        <div class="autocomplete-container form-group">
            <label for="address-search-input" class="font-semibold">Find Address</label>
            <input type="text" id="address-search-input" placeholder="Start typing your address or postcode..." autocomplete="off" class="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md">
            <div id="address-results-container" class="address-results hidden"></div>
            <p id="address-error-message" class="text-sm text-red-600 mt-1"></p>
        </div>
        <hr class="my-6 border-gray-200">
    `;

    let stepContentHtml = '';
    let actionButtonHtml = '';
    
    const createFormGroup = (label, id, type, { value = '', required = true, readonly = false, maxlength = '', inputmode = '', placeholder = '' } = {}) => `
        <div class="form-group">
            <label for="${id}">${label}</label>
            <input type="${type}" id="${id}" value="${value}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${placeholder ? `placeholder="${placeholder}"` : ''}>
            <span class="validation-icon"></span>
            <p class="error-message"></p>
        </div>
    `;

    switch (checkoutStep) {
        case 1:
            if (isLoggedIn && userAddresses.length > 0) {
                const userName = auth.getUserName();
                const addressOptions = userAddresses.map(addr => `<option value="${addr.id}" ${addr.id === selectedCheckoutAddressId ? 'selected' : ''}>${addr.fullName}, ${addr.addressLine1}, ${addr.postcode}</option>`).join('');
                stepContentHtml = `<h3>1. Shipping Details</h3><p>Welcome back, ${userName}!</p><form id="checkout-details-form"><div class="form-group"><label for="address-select">Select your delivery address:</label><select id="address-select" name="address-select">${addressOptions}</select></div><p class="text-center small-text mt-4">or <a href="#" id="add-new-address-checkout" class="font-semibold text-blue-600 hover:underline">add a new address</a>.</p></form>`;
            } else {
                const nameValue = isLoggedIn ? auth.getUserName() : (guestDetails.name || '');
                const emailValue = isLoggedIn ? auth.getCurrentUser()?.email : (guestDetails.email || '');
                stepContentHtml = `
                    <h3>1. Shipping Details</h3>
                    ${autocompleteHtml}
                    <p class="mb-4 font-semibold">Or Enter Manually</p>
                    <form id="checkout-details-form" class="space-y-4" novalidate>
                        ${createFormGroup('Full Name', 'checkout-name', 'text', { value: nameValue })}
                        ${createFormGroup('Email Address', 'checkout-email', 'email', { value: emailValue, readonly: isLoggedIn })}
                        ${createFormGroup('Address Line 1', 'checkout-address1', 'text', { value: guestDetails.addressLine1 || '' })}
                        ${createFormGroup('Town / City', 'checkout-city', 'text', { value: guestDetails.city || '' })}
                        ${createFormGroup('Postcode', 'checkout-postcode-manual', 'text', { value: guestDetails.postcode || '' })}
                    </form>`;
            }
            actionButtonHtml = `<button id="checkout-step1-btn" class="btn btn-primary btn-full-width mt-6">Continue</button>`;
            break;
        case 2:
            const paymentMethods = { Card: [], PayPal: [] };
            if (window.footerContent?.weAccept?.imageUrls) {
                window.footerContent.weAccept.imageUrls.forEach(url => {
                    if (url.toLowerCase().includes('paypal')) paymentMethods.PayPal.push(`<img src="${url}" alt="PayPal">`);
                    else paymentMethods.Card.push(`<img src="${url}" alt="Card">`);
                });
            }
            stepContentHtml = `
                <h3>2. Payment Details</h3>
                <p>This is a demo payment form.</p>
                <input type="hidden" id="selected-payment-method" value="${guestDetails.paymentMethod || 'Card'}">
                <div class="form-group"><label>Payment Method</label><div class="payment-method-selector">
                    <button type="button" class="payment-method-btn ${ (guestDetails.paymentMethod || 'Card') === 'Card' ? 'active' : '' }" data-method="Card">${paymentMethods.Card.join('') || 'Card'}</button>
                    <button type="button" class="payment-method-btn ${ guestDetails.paymentMethod === 'PayPal' ? 'active' : '' }" data-method="PayPal">${paymentMethods.PayPal.join('') || 'PayPal'}</button>
                </div></div>
                <form id="card-details-form" class="space-y-4" novalidate style="display: ${ (guestDetails.paymentMethod || 'Card') === 'Card' ? 'block' : 'none' };">
                    ${createFormGroup('Name on Card', 'card-name', 'text', { value: guestDetails.cardName || '', placeholder: 'John M. Doe' })}
                    ${createFormGroup('Card Number', 'card-number', 'text', { value: guestDetails.cardNumber || '', placeholder: '4242 4242 4242 4242', maxlength: '19', inputmode: 'numeric' })}
                    <div class="form-group-row">
                        ${createFormGroup('Expiry', 'card-expiry', 'text', { value: guestDetails.cardExpiry || '', placeholder: 'MM / YY', maxlength: '7', inputmode: 'numeric' })}
                        ${createFormGroup('CVC', 'card-cvc', 'text', { value: guestDetails.cardCvc || '', placeholder: '123', maxlength: '4', inputmode: 'numeric' })}
                    </div>
                </form>
                <div id="paypal-message" class="hidden mt-4 text-center text-gray-600" style="display: ${ guestDetails.paymentMethod === 'PayPal' ? 'block' : 'none' };"><p>After clicking 'Continue', you will be redirected to PayPal to complete your purchase securely.</p></div>`;
            actionButtonHtml = `<button id="checkout-step2-btn" class="btn btn-primary btn-full-width mt-6">Continue to Review</button><a href="#" id="checkout-back-btn" class="back-link">Go Back</a>`;
            break;
        case 3:
            const { totalAmount: reviewTotal } = calculateTotals();
            const selectedPaymentMethod = reviewTotal <= 0 ? "N/A (Covered by Discount)" : (guestDetails.paymentMethod || 'Card');
            let finalAddress;
            if (isLoggedIn && selectedCheckoutAddressId) { finalAddress = userAddresses.find(a => a.id === selectedCheckoutAddressId); }
            if (!finalAddress) { finalAddress = { fullName: guestDetails.name, addressLine1: guestDetails.addressLine1, city: guestDetails.city, postcode: guestDetails.postcode }; }
            stepContentHtml = `<h3>3. Review Order</h3><div class="review-section"><h4>Shipping to:</h4><p>${finalAddress.fullName}<br>${finalAddress.addressLine1}<br>${finalAddress.city}, ${finalAddress.postcode}</p></div><div class="review-section"><h4>Payment Method:</h4><p>${selectedPaymentMethod}</p></div>`;
            actionButtonHtml = `<button id="place-order-btn" class="btn btn-primary btn-full-width mt-6"><span class="btn-text">Place Order</span><div class="spinner" style="display: none;"></div></button><a href="#" id="checkout-back-btn" class="back-link">Go Back</a>`;
            break;
    }

    pageCheckout.innerHTML = `
        <div class="page-header"><h2>Checkout</h2></div>
        <div class="checkout-progress-bar">
            <div class="step ${checkoutStep >= 1 ? 'active' : ''}">1. Details</div>
            <div class="step ${checkoutStep >= 2 ? 'active' : ''}">2. Payment</div>
            <div class="step ${checkoutStep >= 3 ? 'active' : ''}">3. Review</div>
        </div>
        <div class="checkout-grid">
            <div class="checkout-form">${stepContentHtml}${actionButtonHtml}</div>
            <div class="order-summary">
                <h3>Order Summary</h3>
                <div id="checkout-items">${cart.map(item => `<div class="summary-row"><span>${item.title} (x${item.quantity})</span><span>£${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}</div>
                <div class="summary-container">
                    <div class="summary-row"><span>Subtotal</span><span id="checkout-subtotal">£0.00</span></div>
                    <div class="summary-row discount-row" style="display: none;">
                        <span>Discount<span id="checkout-discount-info" style="display: none;"></span></span> {/* <-- CORRECTED SPAN HERE */}
                        <span id="checkout-discount">£0.00</span>
                    </div>
                    <div class="summary-row"><span>Delivery</span><span id="checkout-delivery">£0.00</span></div>
                    <div class="summary-row total"><span>Total</span><span id="checkout-total">£0.00</span></div>
                </div>
                <div class="discount-form-container">
                    <form id="checkout-discount-form">
                        <input type="text" id="checkout-discount-code" placeholder="Enter discount code">
                        <button type="submit" class="btn btn-secondary btn-sm">Apply</button>
                    </form>
                    <p id="checkout-discount-message" class="discount-message"></p>
                </div>
            </div>
        </div>`;
    
    showPage('checkout');
    updateCartTotals();

    const storePaymentDetails = () => {
        guestDetails.paymentMethod = document.getElementById('selected-payment-method')?.value || guestDetails.paymentMethod;
        guestDetails.cardName = document.getElementById('card-name')?.value || guestDetails.cardName;
        guestDetails.cardNumber = document.getElementById('card-number')?.value || guestDetails.cardNumber;
        guestDetails.cardExpiry = document.getElementById('card-expiry')?.value || guestDetails.cardExpiry;
        guestDetails.cardCvc = document.getElementById('card-cvc')?.value || guestDetails.cardCvc;
    };

    document.getElementById('checkout-step1-btn')?.addEventListener('click', () => {
        let isFormValid = true;
        let firstInvalidField = null;
        const form = document.getElementById('checkout-details-form');
        if (form) {
            form.querySelectorAll('input[required]').forEach(input => {
                if (!validateField(input)) {
                    isFormValid = false;
                    if (!firstInvalidField) firstInvalidField = input;
                }
            });
        }
        if (isFormValid) {
            storeGuestDetails();
            const { totalAmount } = calculateTotals();
            if (totalAmount <= 0) {
                guestDetails.paymentMethod = "N/A (Covered by Discount)";
                checkoutStep = 3;
            } else {
                checkoutStep = 2;
            }
            displayCheckoutPage();
        } else if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
    
    document.getElementById('checkout-step2-btn')?.addEventListener('click', () => {
        let isFormValid = true;
        let firstInvalidField = null;
        if (document.getElementById('selected-payment-method').value === 'Card') {
            document.getElementById('card-details-form').querySelectorAll('input[required]').forEach(input => {
                if (!validateField(input)) {
                    isFormValid = false;
                    if (!firstInvalidField) firstInvalidField = input;
                }
            });
        }
        if (isFormValid) {
            storePaymentDetails();
            checkoutStep = 3;
            displayCheckoutPage();
        } else if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    document.getElementById('checkout-back-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (checkoutStep > 1) {
            if (checkoutStep === 2) storePaymentDetails();
            checkoutStep--;
            displayCheckoutPage();
        }
    });
    
    document.getElementById('address-search-input')?.addEventListener('input', handleAddressSearch);
    document.getElementById('address-results-container')?.addEventListener('click', (e) => { if (e.target.classList.contains('address-suggestion')) selectAddressSuggestion(e.target.dataset.id); });
    document.getElementById('add-new-address-checkout')?.addEventListener('click', (e) => { e.preventDefault(); addressFormReturnPath = 'checkout'; renderAddressForm(); });
    document.querySelectorAll('.payment-method-btn').forEach(button => { button.addEventListener('click', () => {
        document.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const selectedMethod = button.dataset.method;
        document.getElementById('selected-payment-method').value = selectedMethod;
        document.getElementById('card-details-form').style.display = selectedMethod === 'Card' ? 'block' : 'none';
        document.getElementById('paypal-message').style.display = selectedMethod === 'PayPal' ? 'block' : 'none';
    }); });
    const checkoutDiscountForm = document.getElementById('checkout-discount-form');
    if (checkoutDiscountForm) { checkoutDiscountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('checkout-discount-code');
        if (input.value) applyDiscount(input.value, 'checkout');
    }); }

    if (checkoutStep === 1) attachValidationListeners('checkout-details-form');
    if (checkoutStep === 2) attachValidationListeners('card-details-form');
}
// --- 2. ENSURE these two helper functions are in app.js ---
const handleAddressSearch = debounce(async () => {
    const input = document.getElementById('address-search-input');
    const resultsContainer = document.getElementById('address-results-container');
    const errorEl = document.getElementById('address-error-message');
    const term = input.value.trim();

    errorEl.textContent = ''; // Clear previous errors

    if (term.length < 3) {
        resultsContainer.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`→ /api/user-handler?action=address_autocomplete&term=${encodeURIComponent(term)}`);
        const suggestions = await response.json();
        
        if (!response.ok) throw new Error(suggestions.error || 'Could not fetch suggestions.');

        if (suggestions.length > 0) {
            resultsContainer.innerHTML = suggestions.map(s => `<div class="address-suggestion" data-id="${s.id}">${s.address}</div>`).join('');
            resultsContainer.classList.remove('hidden');
        } else {
            errorEl.textContent = 'No suggestions found.';
            resultsContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Address search failed:', error);
        errorEl.textContent = error.message;
        resultsContainer.classList.add('hidden');
    }
}, 300);



function removeDiscount() {
    appliedDiscount = null;
    // Clear any lingering messages
    const cartMsg = document.getElementById('cart-discount-message');
    const checkoutMsg = document.getElementById('checkout-discount-message');
    if (cartMsg) { cartMsg.textContent = ''; cartMsg.className = 'discount-message'; }
    if (checkoutMsg) { checkoutMsg.textContent = ''; checkoutMsg.className = 'discount-message'; }
    updateCartTotals(); // Update UI everywhere
}

async function placeOrder() {
    const placeOrderBtn = document.getElementById('place-order-btn');
    const btnText = placeOrderBtn.querySelector('.btn-text');
    const spinner = placeOrderBtn.querySelector('.spinner');

    placeOrderBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
        const isLoggedIn = auth.isLoggedIn();

        // --- THIS IS THE CORE FIX ---
        // It now correctly separates the logic for guests from logged-in users.
        if (!isLoggedIn) {
            // If the user is a guest, we call the dedicated guest order function and stop immediately.
            // The guest order function has its own error handling and UI updates.
            await placeGuestOrder();
            return; // Exit the placeOrder function entirely.
        }
        // --- END OF FIX ---

        // --- The code below will now ONLY run for LOGGED-IN users ---
        if (!auth.isVerified()) {
            throw new Error("Please check your inbox and verify your email address before placing an order.");
        }
        if (cart.length === 0) throw new Error('Your cart is empty.');

        const currentUser = auth.getCurrentUser();
        let finalAddress;

        // Determine the correct address for a logged-in user
        if (userAddresses.length > 0 && selectedCheckoutAddressId) {
            finalAddress = userAddresses.find(addr => addr.id === selectedCheckoutAddressId);
            if (!finalAddress) throw new Error('The selected delivery address could not be found.');
        } else {
            // This handles a logged-in user adding their first address manually
            storeGuestDetails(); 
            finalAddress = {
                fullName: guestDetails.name,
                addressLine1: guestDetails.addressLine1,
                city: guestDetails.city,
                postcode: guestDetails.postcode,
            };
            if (!finalAddress.fullName || !finalAddress.addressLine1 || !finalAddress.postcode) {
                throw new Error('Please ensure all address details are filled in correctly.');
            }
        }
        
        const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();

        const orderPayload = {
            userId: currentUser.uid,
            customerName: finalAddress.fullName,
            customerEmail: currentUser.email,
            deliveryAddress: finalAddress,
            items: cart.map(item => ({ 
                productId: item.id,
                title: item.title,
                quantity: item.quantity,
                price: item.price,
                isCustom: item.isCustom || false,
                contents: item.isCustom ? item.contents : undefined, 
                imageUrl: getProductImageUrls(item)[0] 
            })),
            itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount,
            appliedDiscount: appliedDiscount || null
        };

        const result = await fetchWithAuth('/api/orders-handler?action=create', {
            method: 'POST', body: JSON.stringify({ orderPayload })
        });

        // Navigate BEFORE clearing state
        pageCheckout.innerHTML = `<div class="order-confirmation"><h2>Thank You, ${finalAddress.fullName.split(' ')[0]}!</h2><p>Your order #${result.orderId} has been placed successfully.</p><button id="back-to-home-btn" class="btn btn-primary btn-full-width">Continue Shopping</button></div>`;
        document.getElementById('back-to-home-btn').addEventListener('click', () => router.navigate('/'));

        // Clear state AFTER successful navigation setup
        cart = [];
        guestDetails = {};
        appliedDiscount = null;
        selectedCheckoutAddressId = null;
        checkoutStep = 1;
        updateCart();
        await fetchInitialUserData();

    } catch (error) {
        console.error("CRITICAL ERROR in placeOrder:", error);
        showConfirmationModal(`Order Failed: ${error.message}`);

        // Re-enable button on error
        placeOrderBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Add this entire new function to app.js
function calculateTotals() {
    // CRITICAL FIX: Read dynamic settings from the global object
    const settings = window.appSettings || {}; 

    const itemsSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    let deliveryChargeApplied = 0;
    let discountApplied = 0;

    // Use fetched settings or safe defaults
    const freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 50;
    const baseCharge = settings.baseDeliveryCharge ?? 4.99;
    const additionalItemCharge = settings.additionalItemCharge ?? 1.00; // Assuming this might be a future setting

    if (totalItems > 0 && itemsSubtotal < freeDeliveryThreshold) {
        deliveryChargeApplied = baseCharge;
        if (totalItems > 1) {
            // Keep the assumption for additional item charge if present in your logic
            deliveryChargeApplied += (totalItems - 1) * additionalItemCharge;
        }
    }

    const chargeableTotal = itemsSubtotal + deliveryChargeApplied;

    if (appliedDiscount) {
        if (appliedDiscount.type === 'percent') {
            discountApplied = (itemsSubtotal * appliedDiscount.value) / 100;
        } else if (appliedDiscount.type === 'fixed') {
            discountApplied = appliedDiscount.value;
        } 
        else if (appliedDiscount.type === 'store_credit') {
            discountApplied = Math.min(chargeableTotal, appliedDiscount.value);
        } 
        else if (appliedDiscount.type === 'shipping') {
            discountApplied = deliveryChargeApplied;
        }
    }

    discountApplied = Math.min(chargeableTotal, discountApplied);
    const totalAmount = chargeableTotal - discountApplied;
    
    return { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount };
}

// REPLACE your existing placeGuestOrder function
async function placeGuestOrder() {
    // Find button elements within this function's scope
    const placeOrderBtn = document.getElementById('place-order-btn');
    const btnText = placeOrderBtn?.querySelector('.btn-text');
    const spinner = placeOrderBtn?.querySelector('.spinner');

    // Note: Button disabling/spinner is handled in the calling placeOrder function

    try {
        const { itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount } = calculateTotals();
        const orderPayload = {
            customerName: guestDetails.name,
            customerEmail: guestDetails.email,
            deliveryAddress: {
                fullName: guestDetails.name, addressLine1: guestDetails.addressLine1,
                city: guestDetails.city, postcode: guestDetails.postcode
            },
            // Map items correctly for the backend
            items: cart.map(item => ({ 
                productId: item.id,
                title: item.title,
                quantity: item.quantity,
                price: item.price,
                isCustom: item.isCustom || false,
                // Include contents if it's a custom hamper
                contents: item.isCustom ? item.contents : undefined, 
                // Include image URL for consistency (optional for backend but good practice)
                imageUrl: getProductImageUrls(item)[0] 
            })),
            itemsSubtotal, deliveryChargeApplied, discountApplied, totalAmount,
            appliedDiscount: appliedDiscount || null // Pass discount for guests too
        };

        const response = await fetch('/api/orders-handler?action=create_guest', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderPayload })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Guest order submission failed.');
        }
        const result = await response.json();

        // Display confirmation page
        pageCheckout.innerHTML = `<div class="order-confirmation"><h2>Thank You, ${guestDetails.name.split(' ')[0]}!</h2><p>Your order #${result.orderId} has been placed successfully.</p><button id="back-to-home-btn" class="btn btn-primary btn-full-width">Continue Shopping</button></div>`;
        document.getElementById('back-to-home-btn').addEventListener('click', () => router.navigate('/'));

        // Clear state AFTER confirmation page is shown
        cart = [];
        guestDetails = {}; // Clear guest details after successful order
        appliedDiscount = null;
        checkoutStep = 1;
        updateCart(); // Update cart display (will show as empty and disable checkout button)

    } catch (error) {
        console.error("CRITICAL ERROR in placeGuestOrder:", error);
        showConfirmationModal(`Order Failed: ${error.message}`);
        
        // Re-enable button on error - find it again if necessary
        const btn = document.getElementById('place-order-btn');
        const txt = btn?.querySelector('.btn-text');
        const spin = btn?.querySelector('.spinner');
        if(btn) btn.disabled = false;
        if(txt) txt.style.display = 'inline';
        if(spin) spin.style.display = 'none';
    }
}

async function selectAddressSuggestion(id) {
    const resultsContainer = document.getElementById('address-results-container');
    const errorEl = document.getElementById('address-error-message');
    resultsContainer.classList.add('hidden'); // Hide results
    errorEl.textContent = '';

    try {
        const response = await fetch(`/api/user-handler?action=get_address_by_id&id=${id}`);
        const address = await response.json();
        if (!response.ok) throw new Error(address.error);

        // Populate the manual entry form fields
        document.getElementById('checkout-address1').value = address.line_1 || '';
        document.getElementById('checkout-city').value = address.town_or_city || '';
        document.getElementById('checkout-postcode-manual').value = address.postcode || '';
        
        // Clear the search input
        document.getElementById('address-search-input').value = '';

    } catch (error) {
        console.error('Failed to get full address:', error);
        errorEl.textContent = 'Could not retrieve the full address. Please enter it manually.';
    }
}


// ----------------------------------------------------------------- //
// -------------------- KIT: MY ACCOUNT --------------------------- //
// ----------------------------------------------------------------- //

// REPLACE this entire function in your public/app.js file
// Add this entire function to your app.js file

// In app.js
// REPLACE your entire existing showReturnRequestPage function with this one.

// Add this new function to app.js

// In app.js
async function handleOrderCancellation(orderId, type) {
    let itemsToCancel = [];
    let confirmationMessage = '';

    if (type === 'full') {
        confirmationMessage = 'Are you sure you want to cancel this entire order? This action cannot be undone.';
    } else { // Partial cancellation
        const form = document.getElementById('cancel-order-form');
        const checkedItems = form.querySelectorAll('input[name="cancel-item"]:checked');
        
        if (checkedItems.length === 0) {
            showConfirmationModal('Please select at least one item to cancel.');
            return;
        }

        checkedItems.forEach(item => {
            itemsToCancel.push({
                productId: item.value,
                quantity: parseInt(item.dataset.quantity, 10)
            });
        });
        confirmationMessage = `Are you sure you want to cancel the selected ${itemsToCancel.length} item(s)?`;
    }

    showConfirmationModal(confirmationMessage, async () => {
        try {
            await fetchWithAuth(`/api/cancel-order`, {
                method: 'POST',
                body: JSON.stringify({
                    orderId,
                    itemsToCancel: type === 'full' ? [] : itemsToCancel
                })
            });

            await fetchInitialUserData();
            renderOrderDetailPage(orderId);
            showConfirmationModal('Your cancellation request has been processed successfully.');

        } catch (error) {
            console.error('Failed to cancel order:', error);
            showConfirmationModal(`Error: ${error.message}`);
        }
    });
}

function showReturnRequestPage(order) {
    const triggerContainer = document.getElementById('return-trigger-container');
    if (triggerContainer) triggerContainer.style.display = 'none';

    // First, calculate which items are actually available for return
    const returnedQuantities = {};
    userReturns
        .filter(r => r.orderId === order.id && !['Cancelled', 'Rejected'].includes(r.status))
        .flatMap(r => r.items)
        .forEach(item => {
            returnedQuantities[item.productId] = (returnedQuantities[item.productId] || 0) + item.quantity;
        });

    const returnableItems = order.items.filter(item => {
        const alreadyReturned = returnedQuantities[item.productId] || 0;
        return (item.quantity - alreadyReturned) > 0;
    });
    
    const isSingleReturnableItem = returnableItems.length === 1;

    // This HTML variable contains all the necessary sections
    const returnFormHtml = `
        <form id="direct-return-form" class="detail-card">
            <h4>Request a Return for Order #${order.id}</h4>
            <p>Select the items and quantities you wish to return.</p>
            
            <div class="form-group" id="returnable-items-list">
            ${order.items.map(item => {
                const alreadyReturned = returnedQuantities[item.productId] || 0;
                const returnableQty = item.quantity - alreadyReturned;
                if (returnableQty <= 0) {
                    return `<div class="return-item-control disabled"><p>✓ <em>${item.title} (Already Returned/Returning)</em></p></div>`;
                }
                const checkedAttr = isSingleReturnableItem ? 'checked disabled' : '';
                return `
                <div class="return-item-control" data-price="${item.price}">
                    <div class="form-group-checkbox">
                        <input type="checkbox" name="return-item" id="return-item-${item.productId}" value="${item.productId}" ${checkedAttr}>
                        <label for="return-item-${item.productId}">${item.title}</label>
                    </div>
                    <div class="quantity-selector-inline" style="${isSingleReturnableItem ? 'display: flex;' : 'display: none;'}">
                        <button type="button" class="quantity-btn decrease-return-qty" data-product-id="${item.productId}">-</button>
                        <input type="number" class="quantity-input-return" id="return-qty-${item.productId}" value="1" min="1" max="${returnableQty}">
                        <button type="button" class="quantity-btn increase-return-qty" data-product-id="${item.productId}">+</button>
                    </div>
                </div>`;
            }).join('')}
            </div>
            
            <div class="form-group" id="return-outcome-group" style="display: none;">
                <label class="form-label">What would you like?</label>
                <div class="radio-group">
                    <label class="radio-label"><input type="radio" name="desiredOutcome" value="Refund" checked> Direct Refund</label>
                    <label class="radio-label"><input type="radio" name="desiredOutcome" value="Replacement"> Send Replacement</label>
                </div>
            </div>

            <div class="form-group" id="return-reason-group" style="display: none;">
                <label for="return-reason" class="form-label">Reason for return:</label>
                <textarea id="return-reason" rows="4" required></textarea>
            </div>
            
            <div id="return-subtotal-display" class="order-summary-total" style="display: none;">
                <span>Refund Subtotal</span><span id="refund-amount">£0.00</span>
            </div>

            <div style="text-align: right; margin-top: 1rem;">
                <button type="submit" id="submit-return-btn" class="btn btn-primary" disabled>
                    <span class="btn-text">Submit Return Request</span><div class="spinner" style="display: none;"></div>
                </button>
            </div>
        </form>`;
    
    const itemsContainer = document.getElementById('order-items-container');
    const oldForm = document.getElementById('direct-return-form');
    if (oldForm) oldForm.remove();
    if(itemsContainer) itemsContainer.insertAdjacentHTML('afterend', returnFormHtml);

    const returnForm = document.getElementById('direct-return-form');
    if (!returnForm) return; // Exit if form wasn't created

    const reasonGroup = document.getElementById('return-reason-group');
    const outcomeGroup = document.getElementById('return-outcome-group');
    const submitBtn = document.getElementById('submit-return-btn');
    const subtotalDisplay = document.getElementById('return-subtotal-display');
    const refundAmountEl = document.getElementById('refund-amount');

    const calculateTotalAndValidate = () => {
        let refundSubtotal = 0;
        let anyChecked = false;
        const checkedBoxes = returnForm.querySelectorAll('input[name="return-item"]:checked');
        
        checkedBoxes.forEach(checkbox => {
            anyChecked = true;
            const control = checkbox.closest('.return-item-control');
            const price = parseFloat(control.dataset.price);
            const qtyInput = control.querySelector('.quantity-input-return');
            const quantity = parseInt(qtyInput.value, 10);
            if (!isNaN(price) && !isNaN(quantity)) {
                refundSubtotal += price * quantity;
            }
        });

        if(reasonGroup) reasonGroup.style.display = anyChecked ? 'block' : 'none';
        if(outcomeGroup) outcomeGroup.style.display = anyChecked ? 'block' : 'none';
        if(subtotalDisplay) subtotalDisplay.style.display = anyChecked ? 'block' : 'none';
        if(submitBtn) submitBtn.disabled = !anyChecked;
        if(refundAmountEl) refundAmountEl.textContent = `£${refundSubtotal.toFixed(2)}`;
    };

    returnForm.addEventListener('change', (e) => {
        if (e.target.matches('input[name="return-item"]')) {
            const quantitySelector = e.target.closest('.return-item-control').querySelector('.quantity-selector-inline');
            if (quantitySelector) quantitySelector.style.display = e.target.checked ? 'flex' : 'none';
        }
        calculateTotalAndValidate();
    });

    returnForm.addEventListener('click', (e) => {
        if (e.target.matches('.quantity-btn')) {
            const productId = e.target.dataset.productId;
            const qtyInput = document.getElementById(`return-qty-${productId}`);
            let val = parseInt(qtyInput.value, 10);
            const max = parseInt(qtyInput.max, 10);
            if (e.target.matches('.decrease-return-qty') && val > 1) qtyInput.value = val - 1;
            else if (e.target.matches('.increase-return-qty') && val < max) qtyInput.value = val + 1;
            calculateTotalAndValidate();
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
        const desiredOutcome = returnForm.querySelector('input[name="desiredOutcome"]:checked').value;
        const selectedItems = Array.from(returnForm.querySelectorAll('input[name="return-item"]:checked')).map(cb => {
            const item = order.items.find(i => i.productId === cb.value);
            const quantity = parseInt(document.getElementById(`return-qty-${cb.value}`).value, 10);
            return { ...item, quantity };
        });
        const refundAmount = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const returnRequestPayload = { orderId: order.id, reason, items: selectedItems, refundAmount, desiredOutcome };

        try {
            await fetchWithAuth('→ /api/user-handler?action=returns', { method: 'POST', body: JSON.stringify({ returnRequest: returnRequestPayload }) });
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

    // This final call sets the correct initial state of the form.
    calculateTotalAndValidate();
}
function renderAndAttachReturnForm(order) {
    // Hide the 'Request a Return' link that was just clicked
    const triggerContainer = document.getElementById('return-trigger-container');
    if (triggerContainer) triggerContainer.style.display = 'none';

    // This is the same HTML for the form you had before
    const returnFormHtml = `
    <form id="direct-return-form" class="detail-card">
        <h4>Request a Return for Order #${order.id}</h4>
        <p>Select the items and quantities you wish to return.</p>

        <div class="form-group" id="returnable-items-list">
        ${order.items.map(item => {
            const alreadyReturned = returnedQuantities[item.productId] || 0;
            const returnableQty = item.quantity - alreadyReturned;
            if (returnableQty <= 0) {
                return `<div class="return-item-control disabled"><p>✓ <em>${item.title} (Already Returned/Returning)</em></p></div>`;
            }
            const checkedAttr = isSingleReturnableItem ? 'checked disabled' : '';
            return `
            <div class="return-item-control" data-price="${item.price}">
                <div class="form-group-checkbox">
                    <input type="checkbox" name="return-item" id="return-item-${item.productId}" value="${item.productId}" ${checkedAttr}>
                    <label for="return-item-${item.productId}">${item.title}</label>
                </div>
                <div class="quantity-selector-inline" style="${isSingleReturnableItem ? 'display: flex;' : 'display: none;'}">
                    <button type="button" class="quantity-btn decrease-return-qty" data-product-id="${item.productId}">-</button>
                    <input type="number" class="quantity-input-return" id="return-qty-${item.productId}" value="1" min="1" max="${returnableQty}">
                    <button type="button" class="quantity-btn increase-return-qty" data-product-id="${item.productId}">+</button>
                </div>
            </div>`;
        }).join('')}
        </div>

        <div class="form-group" id="return-outcome-group" style="display: none;">
            <label class="form-label">What would you like?</label>
            <div class="radio-group">
                <label class="radio-label"><input type="radio" name="desiredOutcome" value="Refund" checked> Direct Refund</label>
                <label class="radio-label"><input type="radio" name="desiredOutcome" value="Replacement"> Send Replacement</label>
            </div>
        </div>
        <div class="form-group" id="return-reason-group" style="display: none;">
            <label for="return-reason" class="form-label">Reason for return:</label>
            <textarea id="return-reason" rows="4" required></textarea>
        </div>
        <div id="return-subtotal-display" class="order-summary-total" style="display: none;">
            <span>Refund Subtotal</span><span id="refund-amount">£0.00</span>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
            <button type="submit" id="submit-return-btn" class="btn btn-primary" disabled>
                <span class="btn-text">Submit Return Request</span><div class="spinner" style="display: none;"></div>
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
    calculateTotal();
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

    // This innerHTML combines the original menu with the new voucher section
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

    // The event listener for the new form must also be present
    
}

async function handleRedeemCredit(e) {
    e.preventDefault();
    const input = document.getElementById('redeem-code-input');
    const messageEl = document.getElementById('redeem-message');
    const code = input.value.trim();

    if (!code) return;

    try {
        // Use your existing validation API
        const response = await fetch(`/api/user-handler?action=validate_discount&code=${code}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error);

        if (result.type === 'store_credit' && result.value > 0) {
            // This is the "virtual product" ID from Firestore
            const GIFT_CARD_PRODUCT_ID = 'GIFT-CARD';
            const balance = Math.floor(result.value); // Use whole pounds

            if (balance > 0) {
                addToCart(GIFT_CARD_PRODUCT_ID, balance);
                messageEl.className = 'discount-message success';
                messageEl.textContent = `Success! £${balance}.00 in credit has been added to your basket.`;
                openCart(); // Show the user their cart
            } else {
                 throw new Error('Voucher has insufficient balance.');
            }
        } else {
            throw new Error('This is not a valid store credit voucher.');
        }
    } catch (error) {
        messageEl.className = 'discount-message error';
        messageEl.textContent = error.message;
    }
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
    updateReturnStatuses();
    let contentHtml = `<div class="page-header"><h2>My Returns</h2><button class="btn btn-secondary" id="returns-back-to-account">Back to Account</button></div>`;

    if (userReturns.length === 0) {
        contentHtml += `<div class="empty-state-container"><p>You have not requested any returns.</p><a href="/#/account/orders" class="btn btn-primary">View My Orders</a></div>`;
    } else {
        contentHtml += `<div class="returns-list">${userReturns.map(ret => {
            const cancelButtonHtml = ret.status === 'Pending' ? `<button class="btn btn-danger btn-sm cancel-return-btn" data-return-id="${ret.id}">Cancel Request</button>` : '';

            // THIS FIXES THE MISSING IMAGE
            const itemsListHtml = ret.items.map(item => {
                const product = allProducts.find(p => p.id === item.productId);
                const imageUrl = product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A';
                return `
                <li class="returned-item">
                    <img src="${imageUrl}" alt="${item.title}" class="returned-item-image">
                    <span>- ${item.title} (x${item.quantity})</span>
                </li>`;
            }).join('');

            return `
            <div class="data-card return-card">
                <div class="data-card-header">
                    <div>
                        <p class="data-card-title">Return #${ret.id}</p>
                        <p class="data-card-subtitle">For Order: #${ret.orderId}</p>
                    </div>
                    <div>
                        <p class="data-card-title">£${(ret.refundAmount || 0).toFixed(2)}</p>
                        <span class="return-status ${ret.status.toLowerCase()}">${ret.status}</span>
                    </div>
                </div>
                <div class="data-card-body">
                    <div class="return-details-group">
                        <p class="return-detail-label">Request Date:</p>
                        <p class="return-detail-value">${new Date(ret.requestDate).toLocaleDateString()}</p>
                    </div>
                    <div class="return-details-group">
                        <p class="return-detail-label">Desired Outcome:</p>
                        <p class="return-detail-value">${ret.desiredOutcome || 'N/A'}</p>
                    </div>
                    <div class="return-details-group">
                        <p class="return-detail-label">Reason Provided:</p>
                        <p class="return-detail-value reason-text">${ret.reason || 'No reason given'}</p>
                    </div>
                    <div class="return-items-list-container">
                        <p class="return-detail-label">Items:</p>
                        <ul class="returned-items-list">${itemsListHtml}</ul>
                    </div>
                </div>
                <div class="data-card-actions">${cancelButtonHtml}</div>
            </div>`;
        }).join('')}</div>`;
    }
    pageMyReturns.innerHTML = contentHtml;
    showPage('my-returns');
}

// REPLACE this entire function in app.js

// The final, correct version of renderMyOrdersPage
async function renderMyOrdersPage() {
    console.log("[renderMyOrdersPage] Starting...");

    // --- Wait for initial data if needed ---
    if (!initialUserDataPromise) {
        console.warn("[renderMyOrdersPage] Waiting for initial auth/data check...");
        // Add a simple loading indicator while waiting
        pageMyOrders.innerHTML = `<div class="page-header"><h2>My Orders</h2></div><p>Loading orders...</p>`;
        showPage('my-orders'); 
        // We need a mechanism to re-trigger this render after auth completes.
        // For now, let's rely on handleAuthStateChange calling handleRouteChange again.
        // A more robust solution might use custom events.
        return; 
    }
    try {
        await initialUserDataPromise; // Wait for data fetch to finish
        console.log("[renderMyOrdersPage] Initial data promise resolved.");
    } catch (err) {
        console.error("[renderMyOrdersPage] Error awaiting initial data promise:", err);
         // Show error even if the promise failed
    }
    // --- End Wait ---
    
    // --- Refresh orders directly (Optional but good for up-to-date info) ---
    // Keep the try-catch block specifically for the refresh attempt.
    try {
        console.log("[renderMyOrdersPage] Attempting to refresh orders via fetchWithAuth...");
         // Use the no-cache option to ensure fresh data
        userOrders = await fetchWithAuth('/api/orders-handler?action=get_orders', { cache: 'no-cache' });
        console.log("[renderMyOrdersPage] Orders refreshed successfully.");
    } catch (error) {
         // Log the error from fetchWithAuth, which already includes "User not logged in" if that's the cause
        console.error("[renderMyOrdersPage] Could not refresh orders:", error.message); 
        // Don't necessarily clear userOrders if refresh fails, might still have older data
        showConfirmationModal(`Could not load latest orders: ${error.message}. Displaying previously loaded data if available.`);
        // If userOrders is empty after a failed refresh, ensure it's an empty array
        if (!Array.isArray(userOrders)) userOrders = []; 
    }

    const controlsHtml = `
        <div class="my-orders-controls">
            <div class="search-orders">
                <input type="search" id="order-search-input" placeholder="Search by Order ID or Product..." value="${currentOrderSearchTerm}" aria-label="Search your orders">
                <button id="order-search-btn" aria-label="Search orders"><i class="fa-solid fa-search"></i></button>
            </div>
            <div class="filter-orders">
                <select id="order-filter-date" aria-label="Filter orders by date">
                    <option value="all" ${currentOrderDateFilter === 'all' ? 'selected' : ''}>All Dates</option>
                    <option value="6m" ${currentOrderDateFilter === '6m' ? 'selected' : ''}>Last 6 Months</option>
                    <option value="2025" ${currentOrderDateFilter === '2025' ? 'selected' : ''}>2025</option>
                    <option value="2024" ${currentOrderDateFilter === '2024' ? 'selected' : ''}>2024</option>
                </select>
                <select id="order-filter-status" aria-label="Filter orders by status">
                    <option value="all" ${currentOrderStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
                    <option value="Pending" ${currentOrderStatusFilter === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Processing" ${currentOrderStatusFilter === 'Processing' ? 'selected' : ''}>Processing</option>
                    <option value="Packed" ${currentOrderStatusFilter === 'Packed' ? 'selected' : ''}>Packed</option>
                    <option value="Dispatched" ${currentOrderStatusFilter === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                    <option value="Shipped" ${currentOrderStatusFilter === 'Shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="Completed" ${currentOrderStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${currentOrderStatusFilter === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="Partially Cancelled" ${currentOrderStatusFilter === 'Partially Cancelled' ? 'selected' : ''}>Partially Cancelled</option>
                    <option value="Returned" ${currentOrderStatusFilter === 'Returned' ? 'selected' : ''}>Returned</option>
                </select>
            </div>
        </div>
    `;

    let contentHtml = `
        <div class="page-header">
            <h2>My Orders</h2>
            <button class="btn btn-secondary" id="orders-back-to-account">Back to Account</button>
        </div>
        ${controlsHtml}
    `;

    // Filtering Logic
    let filteredOrders = userOrders.filter(order => {
        const searchTermLower = currentOrderSearchTerm.toLowerCase();
        const matchesSearch = !currentOrderSearchTerm ||
            order.id.toLowerCase().includes(searchTermLower) ||
            (order.items && order.items.some(item => item.title && item.title.toLowerCase().includes(searchTermLower)));

        let matchesDate = true;
        if (currentOrderDateFilter !== 'all' && order.orderDate) {
             const orderDate = order.orderDate.seconds ? new Date(order.orderDate.seconds * 1000) : new Date(order.orderDate);
             if (!isNaN(orderDate.getTime())) {
                if (currentOrderDateFilter === '6m') {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    matchesDate = orderDate >= sixMonthsAgo;
                } else {
                    matchesDate = orderDate.getFullYear() === parseInt(currentOrderDateFilter, 10);
                }
            } else {
                 matchesDate = false;
                 console.warn(`Invalid date found for order ${order.id}:`, order.orderDate);
            }
        }

        const matchesStatus = currentOrderStatusFilter === 'all' || (order.status || 'Pending') === currentOrderStatusFilter;

        return matchesSearch && matchesDate && matchesStatus;
    });

    if (filteredOrders.length === 0) {
        contentHtml += `<div class="empty-state-container"><p>You haven't placed any orders matching these criteria.</p>${userOrders.length > 0 ? '<button id="clear-order-filters-btn" class="btn btn-secondary btn-sm">Clear Filters</button>' : '<a href="/#/" class="btn btn-primary">Start Shopping</a>'}</div>`;
    } else {
        contentHtml += `<div class="order-list">${filteredOrders.map(order => {
            const status = order.status || 'Pending';
            const colorClass = getStatusColorClass(status);
            const orderDateObj = order.orderDate?.seconds ? new Date(order.orderDate.seconds * 1000) : new Date(order.orderDate || Date.now());
            const orderDate = !isNaN(orderDateObj.getTime()) ? orderDateObj.toLocaleDateString() : 'Invalid Date';
            const reviewButtonHtml = status === 'Completed'
                ? `<button class="btn btn-secondary btn-sm write-review-btn" data-order-id="${order.id}">Write Review</button>`
                : '';

            return `
            <div class="data-card">
                <div class="data-card-header">
                    <div>
                        <p class="data-card-title">Order #${order.id}</p>
                        <p class="data-card-subtitle">Date: ${orderDate}</p>
                    </div>
                    <div>
                        <p class="data-card-title">£${(order.totalAmount || 0).toFixed(2)}</p>
                        <span class="order-status ${colorClass}">${status}</span>
                    </div>
                </div>
                <div class="data-card-actions">
                    ${reviewButtonHtml}
                    <button class="btn btn-primary btn-sm view-order-details" data-order-id="${order.id}">View Details</button>
                </div>
            </div>`;
        }).join('')}</div>`;
    }

    pageMyOrders.innerHTML = contentHtml;
    showPage('my-orders');

    // Event Listeners
    document.getElementById('order-search-btn')?.addEventListener('click', () => {
        currentOrderSearchTerm = document.getElementById('order-search-input')?.value || '';
        renderMyOrdersPage();
    });
    document.getElementById('order-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentOrderSearchTerm = e.target.value || '';
            renderMyOrdersPage();
        }
    });
    document.getElementById('order-filter-date')?.addEventListener('change', (e) => {
        currentOrderDateFilter = e.target.value;
        renderMyOrdersPage();
    });
    document.getElementById('order-filter-status')?.addEventListener('change', (e) => {
        currentOrderStatusFilter = e.target.value;
        renderMyOrdersPage();
    });
    document.getElementById('clear-order-filters-btn')?.addEventListener('click', () => {
        currentOrderSearchTerm = '';
        currentOrderDateFilter = 'all';
        currentOrderStatusFilter = 'all';
        renderMyOrdersPage();
    });
}

function updateReturnStatuses() {
    const returnWindow = window.appSettings?.returnWindowInDays ?? 28; 
    const daysSinceOrder = (new Date() - orderDateObj) / (1000 * 3600 * 24);

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

/// In app.js, REPLACE the entire renderOrderDetailPage function
// In app.js
async function renderOrderDetailPage(orderId) {
    const order = userOrders.find(o => o.id === orderId);

    if (!order) {
        console.error(`Failed to find order ${orderId} in userOrders array.`);
        renderMyOrdersPage(); // Go back to the list if order not found
        return;
    }

    const currentStatus = order.status || 'Pending';
    const trackingLinkHtml = order.trackingNumber && order.courierUrl ? `<p><strong>Tracking:</strong> <a href="${order.courierUrl}${order.trackingNumber}" target="_blank" class="text-blue-600 hover:underline">${order.trackingNumber}</a> (${order.courier})</p>` : '';

    // Define Order Stages and Generate Tracker HTML
    const orderStages = ['Pending', 'Processing', 'Packed', 'Dispatched', 'Shipped', 'Completed'];
    const terminalStates = ['Cancelled', 'Partially Cancelled', 'Returned'];
    let effectiveStatus = currentStatus;
    if (terminalStates.includes(currentStatus)) {
        effectiveStatus = 'Completed'; // Visually treat these as the end of the line
    }
    const currentStageIndex = orderStages.indexOf(effectiveStatus);

    const trackerHtml = `
        <div class="order-status-tracker">
            ${orderStages.map((stage, index) => {
                let statusClass = '';
                if (index < currentStageIndex) {
                    statusClass = 'completed';
                } else if (index === currentStageIndex) {
                    statusClass = 'active';
                }
                const displayStage = (stage === 'Completed' && terminalStates.includes(currentStatus)) ? currentStatus : stage;
                return `
                    <div class="tracker-step ${statusClass}">
                        <div class="step-icon"></div>
                        <div class="step-label">${displayStage}</div>
                    </div>
                `;
            }).join('<div class="tracker-connector"></div>')}
        </div>
        ${terminalStates.includes(currentStatus) ? `<p class="status-explanation">Order ${currentStatus.toLowerCase()}.</p>` : ''}
    `;

    // Render items
    const initialItemsHtml = order.items.map(item => {
        const product = allProducts.find(p => p.id === item.productId);
        const imageUrl = item.isCustom ? 'assets/images/custom_hamper_placeholder.jpg' : (product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A');
        const componentsHtml = (item.isCustom && item.contents) ? `<ul class="order-detail-components">${item.contents.map(c => `<li>- ${c.name} (x${c.quantity})</li>`).join('')}</ul>` : '';
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
    }).join('');

    // Format date
    const orderDateObj = order.orderDate?.seconds ? new Date(order.orderDate.seconds * 1000) : new Date(order.orderDate || Date.now());
    const orderDate = !isNaN(orderDateObj.getTime()) ? orderDateObj.toLocaleString() : 'Invalid Date';

    // Assemble page content
    const contentHtml = `
        <div class="page-header">
            <h2>Order Details</h2>
            <button class="btn btn-secondary" id="back-to-orders">Back to My Orders</button>
        </div>
        <div class="detail-card">
            <div class="order-detail-summary">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Order Date:</strong> ${orderDate}</p>
                ${trackingLinkHtml}
            </div>
            ${trackerHtml}
        </div>
        <div class="detail-card" id="order-items-container">
            <h3>Items in this Order</h3>
            <div class="order-detail-items">${initialItemsHtml}</div>
        </div>
        <div class="order-summary detail-card">
            <div class="order-summary-item"><span>Items Subtotal</span><span>£${(order.itemsSubtotal || 0).toFixed(2)}</span></div>
            <div class="order-summary-item"><span>Delivery</span><span>£${(order.deliveryChargeApplied || 0).toFixed(2)}</span></div>
            ${order.discountApplied > 0 ? `<div class="order-summary-item discount-row"><span>Discount${order.appliedDiscount?.code ? ` (${order.appliedDiscount.code})` : ''}</span><span>-£${order.discountApplied.toFixed(2)}</span></div>` : ''}
            <div class="order-summary-total"><span>Total Paid</span><span>£${(order.totalAmount || 0).toFixed(2)}</span></div>
        </div>
        <div class="detail-card" id="order-actions-container"></div>`; // Actions container remains

    pageOrderDetail.innerHTML = contentHtml;
    showPage('order-detail');

    // Attach logic for Cancel/Return buttons (preserved from your original code)
    const actionsContainer = document.getElementById('order-actions-container');
    if (!actionsContainer) return;

    const isCancellable = !['Shipped', 'Dispatched', 'Cancelled', 'Partially Cancelled', 'Completed', 'Returned'].includes(order.status) && order.items && order.items.length > 0;
    if (isCancellable) {
        const cancelLink = document.createElement('a');
        cancelLink.href = '#';
        cancelLink.id = 'show-cancel-form-btn';
        cancelLink.className = 'btn-link';
        cancelLink.textContent = 'Need to cancel an item?';
        actionsContainer.appendChild(cancelLink);
        cancelLink.addEventListener('click', (e) => { e.preventDefault(); cancelLink.style.display = 'none'; activateCancellationMode(order); }, { once: true });
    }

    const returnWindow = appConfig?.returns?.returnWindowInDays ?? 28;
    const daysSinceOrder = (new Date() - orderDateObj) / (1000 * 3600 * 24);
    const hasReturnableItems = order.items && order.items.some(orderItem => {
        const returnedQty = userReturns
            .filter(r => r.orderId === order.id && !['Cancelled', 'Rejected'].includes(r.status))
            .flatMap(r => r.items)
            .filter(item => item.productId === orderItem.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
        return returnedQty < orderItem.quantity;
    });

    if (order.status !== 'Cancelled' && daysSinceOrder <= returnWindow && hasReturnableItems) {
        const returnLink = document.createElement('a');
        returnLink.href = '#';
        returnLink.id = 'show-return-form-btn';
        returnLink.className = 'btn-link';
        returnLink.textContent = 'Need to return an item?';
        actionsContainer.appendChild(returnLink);
        returnLink.addEventListener('click', (e) => { e.preventDefault(); returnLink.style.display = 'none'; showReturnRequestPage(order); }, { once: true });
    }
}


function activateCancellationMode(order) {
    const itemsContainer = document.querySelector('#page-order-detail .order-detail-items');
    if (!itemsContainer) return;

    const itemsWithCheckboxesHtml = order.items.map(item => {
        const product = allProducts.find(p => p.id === item.productId);
        const imageUrl = item.isCustom ? 'assets/images/custom_hamper_placeholder.jpg' : (product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A');
        
        // --- RULE 1 IS IMPLEMENTED HERE ---
        // The checkbox is now only created if there is more than one item in the order.
        const checkboxHtml = order.items.length > 1
            ? `<div class="cancellation-control"><input type="checkbox" name="cancel-item" value="${item.productId}" data-quantity="${item.quantity}"></div>`
            : '';

        return `
            <div class="order-summary-item">
                ${checkboxHtml}
                <img src="${imageUrl}" alt="${item.title}" class="cart-item-image">
                <div class="cart-item-info"><p class="cart-item-title">${item.title}</p><p>Qty: ${item.quantity}</p></div>
                <span class="cart-item-price">£${(item.price * item.quantity).toFixed(2)}</span>
            </div>`;
    }).join('');

    itemsContainer.innerHTML = `
        <form id="cancel-order-form">
            <p class="cancellation-prompt">Select items below to request a cancellation.</p>
            ${itemsWithCheckboxesHtml}
            <div class="cancellation-actions">
                <button type="submit" id="cancel-selected-btn" class="btn btn-primary btn-sm">Cancel Selected Items</button>
                <button type="button" id="cancel-full-order-btn" class="btn btn-danger btn-sm">Cancel Entire Order</button>
            </div>
        </form>
    `;

    const cancelSelectedBtn = document.getElementById('cancel-selected-btn');
    const cancelFullOrderBtn = document.getElementById('cancel-full-order-btn');
    const returnLink = document.getElementById('show-return-form-btn');
    const allCheckboxes = itemsContainer.querySelectorAll('input[name="cancel-item"]');

    if (order.items.length === 1) {
        if(cancelSelectedBtn) cancelSelectedBtn.style.display = 'none';
    }

    const handleReturnLinkVisibility = () => {
        if (!returnLink) return;
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        returnLink.style.display = allChecked ? 'none' : '';
    };

    allCheckboxes.forEach(checkbox => checkbox.addEventListener('input', handleReturnLinkVisibility));
    
    if(cancelFullOrderBtn) {
        cancelFullOrderBtn.addEventListener('click', () => {
             if(returnLink) returnLink.style.display = 'none';
             handleOrderCancellation(order.id, 'full');
        });
    }

    document.getElementById('cancel-order-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleOrderCancellation(order.id, 'partial');
    });
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
            await fetchWithAuth('/api/user-handler?action=addresses', {
                method: 'PUT',
                body: JSON.stringify({ addressId, ...newAddressData })
            });
        } else {
            await fetchWithAuth('/api/user-handler?action=addresses', {
                method: 'POST',
                body: JSON.stringify(newAddressData)
            });
        }
        
        userAddresses = await fetchWithAuth('/api/user-handler?action=addresses');
        
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
}function getStatusColorClass(status) {
    const lowerCaseStatus = (status || 'pending').toLowerCase();
    switch (lowerCaseStatus) {
        case 'pending':
            return 'status-yellow'; // Dedicated class for yellow
        case 'cancelled':
        case 'partially cancelled':
            return 'status-grey';   // Dedicated class for grey
        case 'shipped':
        case 'dispatched':
        case 'returned':
            return 'status-green';  // Dedicated class for green
        default:
            return 'status-default'; // A fallback class
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
        //js.src = "https://app-cdn.brevo.com/sdk.js";
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
// ------------------------------------------------------------------ //
// -------------------- KIT: Write Review ------------------------ //
// ------------------------------------------------------------------ //

// REPLACE your old placeholder function with this
// REPLACE this entire function in app.js
function renderReviewFormPage(orderId) {
    console.log("--- renderReviewFormPage CALLED with orderId:", orderId);
    const order = userOrders.find(o => o.id === orderId);
    if (!order) {
        showConfirmationModal("Could not find the order to review.");
        router.navigate('/account/orders');
        return;
    }

    // --- Build the review form for each item ---
    const reviewItemsHtml = order.items.map(item => {
        const product = allProducts.find(p => p.id === item.productId);
        const imageUrl = item.isCustom ? 'assets/images/custom_hamper_placeholder.jpg' : (product ? getProductImageUrls(product)[0] : 'https://placehold.co/80x80/f3f4f6/9ca3af?text=N/A');
        
        return `
        <div class="review-item-card" data-product-id="${item.productId}">
            <div class="review-item-header">
                <img src="${imageUrl}" alt="${item.title}" class="cart-item-image">
                <div class="cart-item-info">
                    <p class="cart-item-title">${item.title}</p>
                </div>
            </div>
            <div class="form-group">
                <label>Your Rating:</label>
                <div class="star-rating-input">
                    <input type="radio" id="star-${item.productId}-5" name="rating-${item.productId}" value="5" required><label for="star-${item.productId}-5" title="5 stars"></label>
                    <input type="radio" id="star-${item.productId}-4" name="rating-${item.productId}" value="4" required><label for="star-${item.productId}-4" title="4 stars"></label>
                    <input type="radio" id="star-${item.productId}-3" name="rating-${item.productId}" value="3" required><label for="star-${item.productId}-3" title="3 stars"></label>
                    <input type="radio" id="star-${item.productId}-2" name="rating-${item.productId}" value="2" required><label for="star-${item.productId}-2" title="2 stars"></label>
                    <input type="radio" id="star-${item.productId}-1" name="rating-${item.productId}" value="1" required><label for="star-${item.productId}-1" title="1 star"></label>
                </div>
            </div>
            <div class="form-group">
                <label for="review-text-${item.productId}">Your Review:</label>
                <textarea id="review-text-${item.productId}" name="review-text-${item.productId}" rows="8" placeholder="What did you like or dislike?"></textarea>
            </div>
        </div>
        `;
    }).join('');

    // --- Full page HTML with the new form ---
    pageReviewForm.innerHTML = `
        <div class="page-header">
            <h2>Write Reviews for Order #${order.id}</h2>
            <button class="btn btn-secondary" id="back-to-orders-from-review">Back to My Orders</button>
        </div>
        <div class="form-container">
            <form id="review-form">
                ${reviewItemsHtml}
                <button type="submit" id="submit-review-btn" class="btn btn-primary btn-full-width">
                    <span class="btn-text">Submit Reviews</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </form>
        </div>
    `;

    showPage('review-form');

    // Add listener for the back button
document.getElementById('back-to-orders-from-review')?.addEventListener('click', renderMyOrdersPage);

    // --- Add form submit listener ---
    const reviewFormElement = document.getElementById('review-form');
    // --- THIS LOG IS CRUCIAL ---
    console.log("[renderReviewFormPage] Found review form element?", !!reviewFormElement);
    // --- END CRUCIAL LOG ---

    // --- MODIFY THIS LISTENER to add logging ---
    reviewFormElement?.addEventListener('submit', (e) => {
        // --- ADDED LOG ---
        console.log("!!! Submit Event Listener Fired !!!");
        // --- END ADDED LOG ---
        handleReviewSubmit(e, orderId); // Call the actual handler function
    });
    // --- END MODIFICATION ---

    // --- Add listeners for star rating interaction ---
    document.querySelectorAll('.star-rating-input label').forEach(label => {
        // Set default icon (empty star)
        label.classList.add('fa-regular', 'fa-star');

        label.addEventListener('click', e => {
            const clickedStarLabel = e.target; // This is the <label>
            const parent = clickedStarLabel.parentElement;
            const allLabels = parent.querySelectorAll('label');

            // Reset all stars to empty
            allLabels.forEach(lbl => lbl.classList.remove('fa-solid'));

            // --- THIS IS THE CORRECTED LOGIC ---
            // The HTML is in reverse order: [label 5, label 4, label 3, label 2, label 1]
            // We need to color the clicked label and all labels that come AFTER it in the HTML.

            clickedStarLabel.classList.add('fa-solid'); // Color the one you clicked

            let nextSibling = clickedStarLabel.nextElementSibling;
            while(nextSibling) {
                if(nextSibling.tagName === 'LABEL') {
                    nextSibling.classList.add('fa-solid'); // Color all labels after it
                }
                nextSibling = nextSibling.nextElementSibling;
            }
            // --- End of corrected logic ---
        });
    });
}

// REPLACE this function in app.js

// REPLACE this function in app.js
async function handleReviewSubmit(e, orderId) {
    e.preventDefault();
    console.log("[handleReviewSubmit] Form submitted for order:", orderId);

    const submitBtn = document.getElementById('submit-review-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    // Disable button and show spinner immediately
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    console.log("[handleReviewSubmit] Button disabled, spinner shown.");

    // --- Collect Review Data (No changes needed here) ---
    const form = document.getElementById('review-form');
    const reviews = [];
    const reviewCards = form.querySelectorAll('.review-item-card');
    let allRatingsProvided = true;
    reviewCards.forEach(card => {
        const productId = card.dataset.productId;
        const ratingInput = form.querySelector(`input[name="rating-${productId}"]:checked`);
        const reviewText = form.querySelector(`#review-text-${productId}`).value;
        if (!ratingInput) { allRatingsProvided = false; }
        reviews.push({
            productId: productId,
            rating: ratingInput ? parseInt(ratingInput.value, 10) : 0,
            comment: reviewText,
        });
    });
    console.log("[handleReviewSubmit] Reviews collected:", reviews);
    // --- End Review Data Collection ---

    // --- Validation Check (No changes needed here) ---
    if (!allRatingsProvided) {
        console.warn("[handleReviewSubmit] Validation failed: Not all ratings provided.");
        showConfirmationModal("Please provide a star rating for each product.");
        // Reset button state on validation error
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        return;
    }
    // --- End Validation Check ---

    try {
        console.log("[handleReviewSubmit] Calling fetchWithAuth('/api/user-handler?action=submit_review')...");
        const response = await fetchWithAuth('/api/user-handler?action=submit_review', {
            method: 'POST',
            body: JSON.stringify({ orderId: orderId, reviews: reviews })
        });
        console.log("[handleReviewSubmit] fetchWithAuth successful! Response:", response);

        // Update local order status (optional, no changes needed)
        const reviewedOrder = userOrders.find(o => o.id === orderId);
        if (reviewedOrder) {
            reviewedOrder.status = 'Completed (Reviewed)';
            console.log("[handleReviewSubmit] Local order status updated.");
        }

        // --- FIX IS HERE: Reset button state BEFORE navigating ---
        console.log("[handleReviewSubmit] Resetting button state before navigation...");
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        // --- END FIX ---

        // Now navigate
        console.log("[handleReviewSubmit] Review successful. Navigating back to /account/orders...");
        router.navigate('/account/orders');

    } catch (error) {
        // Error handling (No changes needed here)
        console.error("[handleReviewSubmit] CATCH block executed. Error:", error);
        showConfirmationModal(`Error submitting reviews: ${error.message}`);
        // Reset button state on error
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}
//---SITE SETTINGS--
async function fetchSiteSettings() {
    console.log("fetchSiteSettings: Fetching site configuration from CMS.");
    try {
        // Use a simple fetch, as the public site does not need admin authentication
        const response = await fetch('/api/content-handler?action=site_settings'); 
        if (!response.ok) throw new Error('Could not fetch site settings.');
        
        const settingsData = await response.json();
        
        // Update the global settings variable
        window.appSettings = settingsData; 
        
        // Apply CSS variables immediately for colors and fonts
        applyCssVariables(settingsData); 
        const thresholdEl = document.getElementById('top-bar-threshold');
        if (thresholdEl) {
            const symbol = settingsData.baseCurrencySymbol || '£';
            const threshold = (settingsData.freeDeliveryThreshold || 50).toFixed(0);
            thresholdEl.textContent = `${symbol}${threshold}`;
        }
        console.log("Site settings loaded and applied.");
    } catch (error) {
        console.error("Error fetching site settings. Using defaults:", error);
        // Fallback to defaults if the API call fails
        window.appSettings = {
            freeDeliveryThreshold: 50,
            baseDeliveryCharge: 4.99,
            // Add other defaults as necessary
        };
    }
}
function formatCurrency(amount) {
    const symbol = window.appSettings?.baseCurrencySymbol ?? '£';
    // Ensure amount is a number and return formatted string
    if (typeof amount !== 'number' || isNaN(amount)) return `${symbol}0.00`;
    return `${symbol}${amount.toFixed(2)}`;
}
function displayNewsletterPopup() {
    // 1. Check if the setting is enabled
    console.log("Checking showNewsletterPopup setting:", window.appSettings?.showNewsletterPopup);
    if (!window.appSettings?.showNewsletterPopup) {
        console.log("Newsletter popup is disabled in settings.");
        return;
    }
    // 2. Check if user has already seen it this session
   // if (sessionStorage.getItem('newsletterPopupShown') === 'true') {
      //  console.log("Newsletter popup already shown this session.");
      //  return;
    //}

    const overlay = document.getElementById('newsletter-modal-overlay');
    if (!overlay) return; // HTML doesn't exist

    // 3. Wait 5 seconds before showing
    setTimeout(() => {
        overlay.style.display = 'flex';
        // 4. Mark it as shown for this session
        sessionStorage.setItem('newsletterPopupShown', 'true');
    }, 5000);
}

// --- ADD THIS FUNCTION ---
function closeNewsletterPopup() {
    const overlay = document.getElementById('newsletter-modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- ADD THIS FUNCTION ---
function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email-modal');
    if (emailInput) {
        const email = emailInput.value;
        showConfirmationModal(`Thank you for subscribing, ${email}! (This is a demo).`);
        closeNewsletterPopup();
        document.getElementById('newsletter-form-modal').reset();
    }
}
function displayCookieConsent() {
    const message = window.appSettings?.cookieConsentMessage || 'We use cookies to ensure you get the best experience on our website.';
    const hasConsented = localStorage.getItem('cookieConsent') === 'granted';

    if (hasConsented) return;

    const consentBanner = document.createElement('div');
    consentBanner.id = 'cookie-consent-banner';
    consentBanner.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(0, 0, 0, 0.85); color: white; padding: 15px; text-align: center; z-index: 9999; display: flex; justify-content: center; align-items: center; gap: 20px; font-size: 14px;';
    
    consentBanner.innerHTML = `
        <span>${message}</span>
        <button id="cookie-consent-accept" style="background: var(--cta-color-green); color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 4px; font-weight: bold;">
            Accept
        </button>
    `;

    document.body.appendChild(consentBanner);

    document.getElementById('cookie-consent-accept')?.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'granted');
        consentBanner.remove();
    });
}
function applyCssVariables(settings) {
    if (!settings) return; // Add a safety check
    const root = document.documentElement;
    
    // Set properties only if they exist in the settings object
    if (settings.primaryColor) root.style.setProperty('--primary-color', settings.primaryColor);
    if (settings.ctaColorGreen) root.style.setProperty('--cta-color-green', settings.ctaColorGreen);
    if (settings.fontFamilyHeadings) root.style.setProperty('--font-family-headings', settings.fontFamilyHeadings);
    if (settings.fontFamilyBody) root.style.setProperty('--font-family-body', settings.fontFamilyBody);
}

