// Every time you deploy, you MUST increment this version number
const CACHE_NAME = 'luxury-hampers-cache-v32'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/auth.js',
    '/manifest.json',
    // Data files
    '/data/occasions.json',
    '/data/Header_nav.json',
    '/data/footer_info.json',
    // Page content files
    '/data/pages/about_us.json',
    '/data/pages/contact_us.json',
    '/data/pages/delivery_info.json',
    '/data/pages/faqs.json',
    '/data/pages/our_mission.json',
    '/data/pages/privacy_policy.json',
    '/data/pages/terms_and_conditions.json',
    // External assets
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    // Images
    '/assets/images/hero_main_banner.jpg',
    '/assets/images/occasion_birthday.jpg',
    '/assets/images/occasion_anniversary.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
            })
            .then(() => {
                // Force the new service worker to become active immediately
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Tell the new service worker to take control of the page
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
    );
});
