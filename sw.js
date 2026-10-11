// Service worker: guarda as imagens das cartas para que a coleção abra instantaneamente nas próximas visitas
// (o GitHub só deixa o navegador guardá-las por 5 minutos).
// Arquivos do próprio jogo usam "rede primeiro", então atualizações aparecem na hora quando há internet.

const APP_CACHE = 'gcg-app-v1';
const IMAGE_CACHE = 'gcg-img-v1';
const IMAGE_HOST = 'raw.githubusercontent.com';

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

    if (url.hostname === IMAGE_HOST) {
        event.respondWith(staleWhileRevalidate(event, request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    }
});

async function staleWhileRevalidate(event, request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
        // Respostas "opacas" (sem CORS) não são guardadas: ocupam muito espaço na cota do navegador.
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
