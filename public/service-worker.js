const CACHE_NAME = 'luxury-hampers-cache-v24'; // Increment version for update

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/auth.js',
    '/manifest.json',
    // Data files
    '/data/products.json',
    '/data/occasions.json',
    '/data/Header_nav.json',
    '/data/custom_hamper_components.json',
    '/data/footer_info.json',
    
    
    '/data/orders.json',
    '/data/addresses.json',
    '/data/returns.json', // <-- ADDED
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
    '/assets/images/occasion_anniversary.jpg',
    // ... other images
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
            })
    );
});

self.addEventListener('fetch', event => {
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
        })
    );
});