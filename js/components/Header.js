/**
 * Header — шапка сайта.
 *
 * Содержит: логотип, навигацию, блок авторизации (username/logout или "Войти").
 * При смене пользователя через store автоматически обновляет блок auth.
 */

import { createElement } from '../utils/dom.js?v=2';
import { Navigation } from './Navigation.js?v=2';
import { store } from '../core/Store.js?v=2';
import { signOutUser } from '../firebase/authService.js?v=2';

export function Header(navItems, themeManager) {
    const header = createElement('header', { className: 'header' });
    const container = createElement('div', { className: 'header__container' });

    const logo = createElement('a', {
        className: 'header__logo',
        text: 'BlueRed',
        attributes: { href: '#/' }
    });

    const nav = Navigation(navItems);
    const navList = nav.querySelector('.nav__list');

    const hamburger = createElement('button', {
        className: 'header__hamburger',
        attributes: { type: 'button', 'aria-label': 'Меню' },
        text: '☰'
    });

    const rightGroup = createElement('div', {
        className: 'header__right',
        children: [nav, createAuthBlock()]
    });

    container.appendChild(logo);
    container.appendChild(hamburger);
    container.appendChild(rightGroup);
    header.appendChild(container);

    function toggleMenu(open) {
        const isOpen = open !== undefined ? open : !header.classList.contains('header--menu-open');
        header.classList.toggle('header--menu-open', isOpen);
        hamburger.textContent = isOpen ? '✕' : '☰';
    }

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    rightGroup.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', () => toggleMenu(false));

    rightGroup.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => toggleMenu(false));
    });

    // Авто-обновление блока авторизации и ссылки админки при смене пользователя
    store.subscribe('user', () => {
        const oldBlock = rightGroup.querySelector('[data-auth]');
        if (oldBlock) {
            rightGroup.replaceChild(createAuthBlock(), oldBlock);
        }
        toggleAdminLink(navList);
    });

    // Применяем сразу на случай, если пользователь уже в store
    toggleAdminLink(navList);

    return header;
}

/** Добавляет или убирает пункт "Админ" в навигации в зависимости от роли */
function toggleAdminLink(navList) {
    if (!navList) return;
    const user = store.get('user');
    const existingItem = navList.querySelector('[data-admin-link]');

    if (user && user.role === 'master') {
        if (existingItem) return;
        const link = createElement('a', {
            className: 'nav__link',
            text: 'Админ',
            attributes: { href: '#/admin' }
        });
        const li = createElement('li', {
            className: 'nav__item',
            attributes: { 'data-admin-link': '' },
            children: [link]
        });
        navList.appendChild(li);
    } else {
        if (existingItem) existingItem.remove();
    }
}

/** Создаёт блок "имя + выход" или "войти" в зависимости от store */
function createAuthBlock() {
    const user = store.get('user');

    if (user) {
        const block = createElement('div', { className: 'header__user', dataset: { auth: '' } });

        const profileLink = createElement('a', {
            className: 'header__user-link',
            text: user.username,
            attributes: { href: '#/profile' }
        });

        const logoutBtn = createElement('button', {
            className: 'header__user-logout',
            text: 'Выйти',
            attributes: { type: 'button' },
            events: {
                click: async () => {
                    await signOutUser();
                    window.location.hash = '#/';
                }
            }
        });

        block.appendChild(profileLink);
        block.appendChild(logoutBtn);
        return block;
    }

    const link = createElement('a', {
        className: 'header__user-login',
        text: 'Войти',
        attributes: { href: '#/login' },
        dataset: { auth: '' }
    });

    return link;
}
