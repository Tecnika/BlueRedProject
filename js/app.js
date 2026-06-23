import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/HomePage.js';
import { render } from './utils/dom.js';
import { ThemeManager } from './core/ThemeManager.js';
import { initFirebase } from './firebase/firebase.js';
import { onAuthChange } from './firebase/authService.js';

const themeManager = new ThemeManager();

async function init() {
    const app = document.getElementById('app');

    themeManager.init();

    try {
        const { auth } = await initFirebase();
        onAuthChange((user) => {
            if (user) {
                console.log('Пользователь авторизован:', user.email);
            }
        });
        console.log('Firebase подключён');
    } catch (error) {
        console.warn('Firebase не подключён:', error);
    }

    let navItems = [];

    try {
        const response = await fetch('data/navigation.json');
        navItems = await response.json();
    } catch (error) {
        console.warn('Не удалось загрузить навигацию:', error);
    }

    const header = Header(navItems, themeManager);
    const content = HomePage();
    const footer = Footer();

    render(app, [header, content, footer]);
}

document.addEventListener('DOMContentLoaded', init);
