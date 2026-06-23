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

import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/HomePage.js';
import { AuthPage } from './pages/AuthPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { FactionPage } from './pages/FactionPage.js';
import { render } from './utils/dom.js';
import { ThemeManager } from './core/ThemeManager.js';
import { Router } from './core/Router.js';
import { store } from './core/Store.js';
import { initFirebase } from './firebase/firebase.js';
import { onAuthChange, getUserProfile } from './firebase/authService.js';
import { seedInitialTags } from './firebase/tagsService.js';

const themeManager = new ThemeManager();
let headerEl = null;
let footerEl = null;

async function init() {
    const app = document.getElementById('app');

    // Восстанавливаем сохранённую тему или ставим 'purple'
    themeManager.init();

    // Инициализируем Firebase (конфиг из data/firebase.json)
    await initFirebase();

    // Сидируем начальные теги, если каталог пуст
    await seedInitialTags();

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
    router.start();

    // Слушаем изменения статуса авторизации
    onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
            // Загружаем профиль из Firestore и пишем в store
            const profile = await getUserProfile(firebaseUser.uid);
            if (profile) {
                store.set('user', { uid: firebaseUser.uid, ...profile });
                // Тема автоматически подстраивается под фракцию
                themeManager.setThemeByFaction(profile.faction);
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
