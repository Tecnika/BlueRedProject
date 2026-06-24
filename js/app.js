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
import { render } from './utils/dom.js?v=3';
import { ThemeManager } from './core/ThemeManager.js?v=3';
import { Router } from './core/Router.js?v=3';
import { store } from './core/Store.js?v=3';
import { initFirebase } from './firebase/firebase.js?v=3';
import { onAuthChange, getUserProfile } from './firebase/authService.js?v=3';
import { seedInitialTags } from './firebase/tagsService.js?v=3';
import { seedInitialPages } from './firebase/pagesService.js?v=3';

const themeManager = new ThemeManager();
let headerEl = null;
let footerEl = null;

async function init() {
    const app = document.getElementById('app');

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
        } else {
            store.set('user', null);
            themeManager.setThemeByFaction(null);
        }
        store.set('isAuthReady', true);
    });
}

// Стартуем после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
