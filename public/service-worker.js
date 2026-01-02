// FILE: public/service-worker.js

// 1. IMPORTANT: Increment the version number one last time.
const CACHE_NAME = 'luxury-hampers-cache-v33'; // Or any number higher than your current one

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/auth.js',
    '/wishlist.js',
    '/firebase-config.js',
    '/manifest.json',
    
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    '/assets/images/hero_main_banner.jpg',
    '/assets/images/occasion_birthday.jpg',
    '/assets/images/occasion_anniversary.jpg',
    '/api/get-menu',
    '/api/admin/footer_info',
    '/api/admin/site_settings',
    '/api/products',
    '/api/custom-hamper-components',
    '/api/public/page?slug=about-us',
    '/api/public/page?slug=contact-us',
    '/api/public/page?slug=faqs',
    '/api/public/page?slug=delivery-info',
    '/api/public/page?slug=privacy-policy',
    '/api/public/page?slug=terms-and-conditions',
    '/api/public/page?slug=our-mission',
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
// REPLACE your 'fetch' event listener with this entire block

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // STRATEGY: Cache-first, then network, with offline fallback.
        
        // If a cached response is found, return it immediately.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache, fetch it from the network.
        return fetch(event.request).catch(() => {
          // THIS IS THE FIX:
          // If the network fetch fails (user is offline),
          // return a fallback page from the cache.
          // This ensures the browser always gets a valid response.
          return caches.match('/index.html'); 
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