import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/HomePage.js';
import { AuthPage } from './pages/AuthPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { render } from './utils/dom.js';
import { ThemeManager } from './core/ThemeManager.js';
import { Router } from './core/Router.js';
import { store } from './core/Store.js';
import { initFirebase } from './firebase/firebase.js';
import { onAuthChange, getUserProfile } from './firebase/authService.js';

const themeManager = new ThemeManager();
let headerEl = null;
let footerEl = null;

async function init() {
    const app = document.getElementById('app');

    themeManager.init();

    await initFirebase();

    let navItems = [];
    try {
        const response = await fetch('data/navigation.json');
        navItems = await response.json();
    } catch (error) {
        console.warn('Не удалось загрузить навигацию:', error);
    }

    headerEl = Header(navItems, themeManager);
    footerEl = Footer();

    const contentRoot = document.createElement('main');
    contentRoot.className = 'content';

    render(app, [headerEl, contentRoot, footerEl]);

    const router = new Router(contentRoot);
    router.register('/', () => HomePage());
    router.register('/login', () => AuthPage());
    router.register('/profile', () => {
        const hash = window.location.hash;
        const idx = hash.indexOf('?');
        const uid = idx >= 0 ? new URLSearchParams(hash.slice(idx)).get('uid') : null;
        return ProfilePage(uid);
    });
    router.start();

    onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
            const profile = await getUserProfile(firebaseUser.uid);
            if (profile) {
                store.set('user', { uid: firebaseUser.uid, ...profile });
            }
        } else {
            store.set('user', null);
        }
        store.set('isAuthReady', true);
    });
}

document.addEventListener('DOMContentLoaded', init);
