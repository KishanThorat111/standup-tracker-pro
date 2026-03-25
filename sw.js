/**
 * Standup Tracker Pro - Service Worker v15
 * Stale-while-revalidate caching with offline fallback
 */

const CACHE_NAME = 'standup-tracker-pro-v15';
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
];

// Install - pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(err => console.error('Pre-cache failed:', err))
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names
                    .filter(n => n !== CACHE_NAME)
                    .map(n => caches.delete(n))
            )
        )
    );
    self.clients.claim();
});

// Fetch - stale-while-revalidate for own assets, network-first for CDN
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isOwnAsset = url.origin === self.location.origin;

    // Never cache API calls
    if (url.pathname.startsWith('/api/')) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return cached || new Response('Offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });

            return isOwnAsset && cached ? cached : networkFetch;
        })
    );
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-attendance') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'sync-complete' });
                });
            })
        );
    }
});

// Message handler
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
