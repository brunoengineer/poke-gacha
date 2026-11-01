// Service worker: caches sprites, trainer portraits and cries so the collection opens instantly on later visits
// (GitHub only lets browsers cache them for 5 minutes). Game files use network-first, so updates show up right away.

const APP_CACHE = 'pg-app-v1';
const IMAGE_CACHE = 'pg-assets-v1';
const ASSET_HOSTS = ['raw.githubusercontent.com', 'play.pokemonshowdown.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keep = [APP_CACHE, IMAGE_CACHE];
        for (const name of await caches.keys()) {
            if (!keep.includes(name)) await caches.delete(name);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (ASSET_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(event, request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    }
});

async function staleWhileRevalidate(event, request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
        // Opaque (no-CORS) responses are not cached: they take a lot of the browser's storage quota.
        if (response.ok) cache.put(request, response.clone());
        return response;
    });
    if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
    }
    return network;
}

async function networkFirst(request) {
    const cache = await caches.open(APP_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw error;
    }
}
