// FILE: public/service-worker.js

const CACHE_NAME = 'luxury-hampers-cache-v34';

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/auth.js',
    '/wishlist.js',
    '/firebase-config.js',
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

// Cache what we can on install, but don't let one bad URL fail the whole install.
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                urlsToCache.map(url => cache.add(new Request(url, { cache: 'reload' })))
            );
        })
    );
});

// Clean up old caches and take control immediately.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Network-first, cache as fallback. Critically: never resolve with undefined,
// which is what was causing "Failed to convert value to 'Response'" errors.
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(event.request);
                return cachedResponse || Response.error();
            })
    );
});
