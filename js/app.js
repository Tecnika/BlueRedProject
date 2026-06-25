/**
 * app.js — точка входа в приложение BlueRed.
 *
 * Последовательность инициализации:
 *   1. Создаём ThemeManager и восстанавливаем тему
 *   2. Инициализируем Firebase (конфиг из data/firebase.json)
 *   3. Загружаем навигацию из data/navigation.json
 *   4. Собираем шапку, подвал, контентную область
 *   5. Регистрируем маршруты в Router
 *   6. Подписываемся на onAuthChange — обновляем store и тему
 */

import { Header } from './components/Header.js?v=3';
import { Footer } from './components/Footer.js?v=3';
import { HomePage } from './pages/HomePage.js?v=3';
import { AuthPage } from './pages/AuthPage.js?v=3';
import { ProfilePage } from './pages/ProfilePage.js?v=3';
import { FactionPage } from './pages/FactionPage.js?v=3';
import { AdminPage } from './pages/AdminPage.js?v=3';
import { PagesListPage } from './pages/PagesListPage.js?v=3';
import { PageViewPage } from './pages/PageViewPage.js?v=3';
import { PageEditPage } from './pages/PageEditPage.js?v=3';
import { DocumentsListPage } from './pages/DocumentsListPage.js?v=3';
import { DocumentViewPage } from './pages/DocumentViewPage.js?v=3';
import { DocumentEditPage } from './pages/DocumentEditPage.js?v=3';
import { DocumentAddPage } from './pages/DocumentAddPage.js?v=3';
import { render, createElement } from './utils/dom.js?v=3';
import { ThemeManager } from './core/ThemeManager.js?v=3';
import { Router } from './core/Router.js?v=3';
import { store } from './core/Store.js?v=3';
import { initFirebase } from './firebase/firebase.js?v=3';
import { onAuthChange, getUserProfile } from './firebase/authService.js?v=3';
import { seedInitialTags } from './firebase/tagsService.js?v=3';
import { seedInitialPages } from './firebase/pagesService.js?v=3';
import { subscribeDesign } from './firebase/settingsService.js?v=3';

const themeManager = new ThemeManager();
let headerEl = null;
let footerEl = null;
let designUnsub = null;

async function init() {
    const app = document.getElementById('app');

    // По умолчанию v1, переключится после авторизации
    document.documentElement.classList.add('design-v1');

    // Восстанавливаем сохранённую тему или ставим 'purple'
    themeManager.init();

    // Инициализируем Firebase (конфиг из data/firebase.json)
    await initFirebase();

    // Загружаем пункты меню из JSON
    let navItems = [];
    try {
        const response = await fetch('data/navigation.json');
        navItems = await response.json();
    } catch (error) {
        console.warn('Не удалось загрузить навигацию:', error);
    }

    // Собираем базовую структуру (шапка + контент + подвал)
    headerEl = Header(navItems, themeManager);
    footerEl = Footer();

    const contentRoot = document.createElement('main');
    contentRoot.className = 'content';

    render(app, [headerEl, contentRoot, footerEl]);

    // Регистрируем маршруты
    const router = new Router(contentRoot);
    router.register('/', () => HomePage());
    router.register('/login', () => AuthPage());
    router.register('/faction', () => FactionPage());
    router.register('/profile', () => {
        const hash = window.location.hash;
        const idx = hash.indexOf('?');
        const uid = idx >= 0 ? new URLSearchParams(hash.slice(idx)).get('uid') : null;
        return ProfilePage(uid, themeManager);
    });
    router.register('/pages', () => PagesListPage());
    router.register('/page/view', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return PageViewPage(params.get('slug'));
    });
    router.register('/page/edit', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return PageEditPage(params.get('slug'));
    });
    router.register('/page/create', () => PageEditPage(null));
    router.register('/documents', () => DocumentsListPage());
    router.register('/documents/view', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const user = store.get('user');
        if (!user || !params.get('id')) return Promise.resolve(createElement('p', { className: 'error-text', text: 'Ошибка: нужен ID документа' }));
        return DocumentViewPage(params.get('id'));
    });
    router.register('/documents/create', () => DocumentEditPage(null));
    router.register('/documents/edit', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return DocumentEditPage(params.get('id'));
    });
    router.register('/documents/add', () => DocumentAddPage());
    router.register('/admin', () => AdminPage());

    // Ждём восстановления сессии Firebase перед первым переходом
    router.beforeEach(async () => {
        if (!store.get('isAuthReady')) {
            await new Promise(resolve => {
                const unsub = store.subscribe('isAuthReady', (ready) => {
                    if (ready) { unsub(); resolve(); }
                });
            });
        }
    });

    router.start();

    // Слушаем изменения статуса авторизации
    onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
            // Сидируем начальные теги при первом входе
            try { await seedInitialTags(); } catch (e) { /* каталог уже есть */ }

            // Загружаем профиль из Firestore и пишем в store
            const profile = await getUserProfile(firebaseUser.uid);
            if (profile) {
                store.set('user', { uid: firebaseUser.uid, ...profile });
                // Тема автоматически подстраивается под фракцию
                themeManager.setThemeByFaction(profile.faction);

                // Сидируем стартовую страницу, если пусто (только для мастеров)
                if (profile.role === 'master') {
                    try { await seedInitialPages(); } catch (e) { /* страница уже есть */ }
                }
            }

            // Подписываемся на глобальный дизайн (только после авторизации)
            if (designUnsub) designUnsub();
            designUnsub = subscribeDesign((version) => {
                document.documentElement.classList.remove('design-v1', 'design-v2');
                document.documentElement.classList.add('design-' + (version || 'v1'));
                store.set('design', version || 'v1');
            });
        } else {
            document.documentElement.classList.remove('design-v1', 'design-v2');
            document.documentElement.classList.add('design-v1');
            store.set('design', 'v1');
            store.set('user', null);
            if (designUnsub) { designUnsub(); designUnsub = null; }
            themeManager.setThemeByFaction(null);
        }
        store.set('isAuthReady', true);
    });
}

// Стартуем после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
