/**
 * PWA — регистрация service worker, установка приложения, офлайн-статус.
 */

let deferredPrompt = null;

/** Приложение запущено как установленное (standalone) */
export function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
}

/** Есть ли отложенное предложение установки */
export function canInstall() {
    return Boolean(deferredPrompt) && !isStandalone();
}

/** Показать системное окно установки. Возвращает true, если установили. */
export async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choice.outcome === 'accepted';
}

/** Зарегистрировать service worker (только на https/localhost) */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !isLocal) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('sw.js', { scope: './', updateViaCache: 'none' })
            .catch(err => console.warn('Service worker не зарегистрирован:', err));
    });
}

/** Инициализация PWA: SW + перехват установки */
export function initPWA() {
    registerServiceWorker();

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        window.dispatchEvent(new Event('pwa:installable'));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        window.dispatchEvent(new Event('pwa:installed'));
    });
}
