// Service Worker — Capybara Runner PWA
// Cache-first for static assets, network-first for API/HTML

const CACHE_NAME = 'capyrun-v1';
const STATIC_ASSETS = [
    '/',
    '/style.css',
    '/manifest.json',
    '/favicon.png',
    '/assets/favicon-192.png',
    '/assets/capybara-default.png',
    '/assets/capybara-towel.png',
    '/assets/capybara-yukata.png',
    '/assets/capybara-santa.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API calls — always network
    if (url.pathname.startsWith('/api')) return;

    // Static assets (JS chunks, images, CSS): cache-first
    if (
        url.pathname.match(/\.(js|css|png|jpg|webp|woff2?)$/) ||
        STATIC_ASSETS.includes(url.pathname)
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // HTML: network-first with cache fallback
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
