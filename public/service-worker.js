// Replace your old 'fetch' listener with this one.
self.addEventListener('fetch', event => {
    // We only handle GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // --- Network-First Strategy for API calls ---
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // If we get a response, update the cache and return it
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // If the network fails, try to serve the response from the cache
                    return caches.match(event.request);
                })
        );
        return; // End execution for API requests
    }

    // --- Cache-First Strategy for all other static assets (default) ---
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
