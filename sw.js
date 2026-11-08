/**
 * Service worker BlueRed.
 *
 * Стратегии:
 *   - навигация (HTML): сеть → кеш → офлайн index.html
 *   - статика (css/js/png/json): из кеша сразу + обновление в фоне
 *   - сторонние запросы (Firebase, аватары, QR): не трогаем
 *
 * При релизе меняйте CACHE_VERSION — старые кеши удалятся.
 */

const CACHE_VERSION = 'bluered-v18-2026-11-08';
const SHELL_CACHE = 'shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'runtime-' + CACHE_VERSION;

const SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './data/firebase.json',
    './data/navigation.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
    './fonts/material-icons.woff2',
    './css/reset.css?v=22',
    './css/variables.css?v=22',
    './css/themes.css?v=22',
    './css/cosmic.css?v=22',
    './css/design-v2.css?v=22',
    './css/responsive.css?v=22',
    './css/components/header.css?v=22',
    './css/components/navigation.css?v=22',
    './css/components/footer.css?v=22',
    './css/components/tag-input.css?v=22',
    './css/components/button.css?v=22',
    './css/components/badge.css?v=22',
    './css/components/message.css?v=22',
    './css/components/form-field.css?v=22',
    './css/components/chip.css?v=22',
    './css/components/qr.css?v=22',
    './css/components/icons.css?v=22',
    './css/components/view-mode.css?v=22',
    './css/components/chat.css?v=22',
    './css/pages/radio.css?v=22',
    './css/pages/home.css?v=22',
    './css/pages/auth.css?v=22',
    './css/pages/profile.css?v=22',
    './css/pages/faction.css?v=22',
    './css/pages/pages.css?v=22',
    './css/pages/admin-page.css?v=22',
    './css/pages/users-admin.css?v=22',
    './css/pages/games-admin.css?v=22',
    './css/pages/documents.css?v=22',
    './css/pages/rules.css?v=22'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await Promise.allSettled(
            SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })))
        );
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
                .map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Сторонние домены (Firebase, gstatic, аватары, QR) — без вмешательства
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
            return response;
        }

        // Сервер ответил ошибкой — отдаём сохранённую оболочку
        const cached = await cache.match(request) || await cache.match('./index.html');
        if (cached) return cached;
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const shell = await cache.match('./index.html');
        if (shell) return shell;
        throw err;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    return cached || (await network) || Response.error();
}
