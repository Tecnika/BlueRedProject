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

import { Header } from './components/Header.js?v=18';
import { Footer } from './components/Footer.js?v=18';
import { ChatWidget } from './components/ChatWidget.js?v=18';
import { HomePage } from './pages/HomePage.js?v=18';
import { AuthPage } from './pages/AuthPage.js?v=18';
import { ProfilePage } from './pages/ProfilePage.js?v=18';
import { FactionPage } from './pages/FactionPage.js?v=18';
import { AdminPage } from './pages/AdminPage.js?v=18';
import { PagesListPage } from './pages/PagesListPage.js?v=18';
import { PageViewPage } from './pages/PageViewPage.js?v=18';
import { PageEditPage } from './pages/PageEditPage.js?v=18';
import { RulesPage } from './pages/RulesPage.js?v=18';
import { RulesEditPage } from './pages/RulesEditPage.js?v=18';
import { DocumentsListPage } from './pages/DocumentsListPage.js?v=18';
import { DocumentViewPage } from './pages/DocumentViewPage.js?v=18';
import { DocumentEditPage } from './pages/DocumentEditPage.js?v=18';
import { DocumentAddPage } from './pages/DocumentAddPage.js?v=18';
import { DocumentPrintPage } from './pages/DocumentPrintPage.js?v=18';
import { UsersAdminPage } from './pages/UsersAdminPage.js?v=18';
import { RadioRoomPage } from './pages/RadioRoomPage.js?v=18';
import { RadioScanPage } from './pages/RadioScanPage.js?v=18';
import { GamesAdminPage } from './pages/GamesAdminPage.js?v=18';
import { GameEditPage } from './pages/GameEditPage.js?v=18';
import { render, createElement } from './utils/dom.js?v=18';
import { ThemeManager } from './core/ThemeManager.js?v=18';
import { initPWA } from './core/pwa.js?v=18';
import { initViewMode } from './components/ViewModeToggle.js?v=18';
import { Router } from './core/Router.js?v=18';
import { store } from './core/Store.js?v=18';
import { initFirebase } from './firebase/firebase.js?v=18';
import { onAuthChange, getUserProfile } from './firebase/authService.js?v=18';
import { getActiveGame } from './firebase/gamesService.js?v=18';
import { getCharacterForPlayer } from './firebase/charactersService.js?v=18';
import { seedInitialTags } from './firebase/tagsService.js?v=18';
import { seedInitialPages } from './firebase/pagesService.js?v=18';
import { seedInitialRules } from './firebase/rulesService.js?v=18';
import { subscribeDesign } from './firebase/settingsService.js?v=18';

const themeManager = new ThemeManager();
let headerEl = null;
let footerEl = null;
let designUnsub = null;

async function init() {
    const app = document.getElementById('app');

    // PWA: service worker и установка приложения
    initPWA();
    initViewMode();

    // Сначала применяем закешированный дизайн (если есть), иначе тёмная тема v2
    const cachedDesign = localStorage.getItem('bluered_design');
    document.documentElement.classList.add(cachedDesign ? 'design-' + cachedDesign : 'design-v2');

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
    document.body.appendChild(ChatWidget());

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
        if (!user || !params.get('id')) return Promise.resolve(createElement('p', { className: 'error-text', text: 'Ошибка: нужен ID файла' }));
        return DocumentViewPage(params.get('id'));
    });
    router.register('/documents/create', () => DocumentEditPage(null));
    router.register('/documents/edit', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return DocumentEditPage(params.get('id'));
    });
    router.register('/documents/add', () => DocumentAddPage());
    router.register('/documents/print', () => DocumentPrintPage());
    router.register('/rules', () => RulesPage());
    router.register('/rules/article', () => RulesPage());
    router.register('/rules/create', () => RulesEditPage());
    router.register('/rules/edit', () => RulesEditPage());
    router.register('/admin', () => AdminPage());
    router.register('/admin/users', () => UsersAdminPage());
    router.register('/admin/games', () => GamesAdminPage());
    router.register('/radio', () => RadioRoomPage());
    router.register('/radio/scan', () => RadioScanPage());
    router.register('/admin/games/edit', () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return GameEditPage(params.get('id'));
    });

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

    // Ждём восстановления сессии Firebase перед первым переходом,
    // но не дольше 6 секунд — иначе страница останется пустой при сбое сети.
    router.beforeEach(async () => {
        if (!store.get('isAuthReady')) {
            await Promise.race([
                new Promise(resolve => {
                    const unsub = store.subscribe('isAuthReady', (ready) => {
                        if (ready) { unsub(); resolve(); }
                    });
                }),
                new Promise(resolve => setTimeout(resolve, 6000))
            ]);
        }
    });

    router.start();

    // Слушаем изменения статуса авторизации
    onAuthChange(async (firebaseUser) => {
        try {
            if (firebaseUser) {
                // Сидируем начальные теги при первом входе
                await withTimeout(seedInitialTags(), 4000);

                // Загружаем профиль из Firestore (с повторами после регистрации)
                let profile = await withTimeout(getUserProfile(firebaseUser.uid), 6000);
                for (let attempt = 0; !profile && attempt < 6; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    profile = await withTimeout(getUserProfile(firebaseUser.uid), 6000);
                }

                if (profile) {
                    store.set('user', { uid: firebaseUser.uid, ...profile });

                    // Активная игра и персонаж игрока (не блокируем старт при сбое)
                    const game = await withTimeout(getActiveGame(), 5000);
                    const character = game
                        ? await withTimeout(getCharacterForPlayer(game.id, firebaseUser.uid), 5000)
                        : null;
                    store.set('activeGame', game);
                    store.set('character', character);

                    // Мастера и игротехи — фиолетовые; радиорубка — своя фракция; иначе персонаж
                    const faction = (profile.role === 'master' || profile.role === 'igrotech')
                        ? 'purple'
                        : (profile.radioFaction || character?.faction || null);
                    themeManager.setThemeByFaction(faction);

                    // Сидируем стартовую страницу, если пусто (только для мастеров)
                    if (profile.role === 'master') {
                        await withTimeout(seedInitialPages(), 5000);
                        await withTimeout(seedInitialRules(), 5000);
                    }
                }

                // Подписываемся на глобальный дизайн (только после авторизации)
                if (designUnsub) designUnsub();
                designUnsub = subscribeDesign((version) => {
                    document.documentElement.classList.remove('design-v1', 'design-v2');
                    document.documentElement.classList.add('design-' + (version || 'v2'));
                    store.set('design', version || 'v2');
                });
            } else {
                document.documentElement.classList.remove('design-v1', 'design-v2');
                document.documentElement.classList.add('design-v2');
                store.set('design', 'v2');
                store.set('user', null);
                store.set('activeGame', null);
                store.set('character', null);
                if (designUnsub) { designUnsub(); designUnsub = null; }
                themeManager.setThemeByFaction(null);
            }
        } finally {
            store.set('isAuthReady', true);
        }
    });
}

/** Промис с таймаутом: при зависании возвращает fallback */
function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        new Promise(resolve => setTimeout(() => resolve(fallback), ms))
    ]);
}

// Стартуем после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
