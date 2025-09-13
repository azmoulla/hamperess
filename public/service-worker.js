// FILE: public/service-worker.js

// 1. IMPORTANT: Increment the version number one last time.
const CACHE_NAME = 'luxury-hampers-cache-v33'; // Or any number higher than your current one

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/auth.js',
    '/manifest.json',
    '/data/occasions.json',
    '/data/Header_nav.json',
    '/data/footer_info.json',
    '/data/pages/about_us.json',
    '/data/pages/contact_us.json',
    '/data/pages/delivery_info.json',
    '/data/pages/faqs.json',
    '/data/pages/our_mission.json',
    '/data/pages/privacy_policy.json',
    '/data/pages/terms_and_conditions.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    '/assets/images/hero_main_banner.jpg',
    '/assets/images/occasion_birthday.jpg',
    '/assets/images/occasion_anniversary.jpg',
];

// --- LIFECYCLE FIX 1: IMMEDIATE ACTIVATION ---
// The new service worker will activate as soon as it has finished installing.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching static assets');
                return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
            })
    );
    self.skipWaiting(); // This forces the new service worker to become active immediately.
});

// --- CACHING STRATEGY FIX ---
// REPLACE the existing 'fetch' event listener with this entire block.
self.addEventListener('fetch', event => {
    // --- THIS IS THE FIX ---
    // Only apply caching strategies to GET requests. Ignore all others (POST, etc.)
    if (event.request.method !== 'GET') {
        return;
    }

    // For API calls, use a "Network-First" strategy.
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // For all other GET requests (static assets), use the "Cache-First" strategy.
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        if (!event.request.url.startsWith('chrome-extension://')) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
    );
});

// --- LIFECYCLE FIX 2: TAKE CONTROL ---
// The new service worker takes control of the page and cleans up old caches.
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // This makes the new worker control all open tabs.
    );
});