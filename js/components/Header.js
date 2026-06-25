import { createElement } from '../utils/dom.js?v=3';
import { Navigation } from './Navigation.js?v=3';
import { store } from '../core/Store.js?v=3';
import { signOutUser } from '../firebase/authService.js?v=3';

const ROLE_LABELS = { master: 'Мастер', igrotech: 'Игротех', player: 'Игрок' };

export function Header(navItems, themeManager) {
    const header = createElement('header', { className: 'header' });
    const container = createElement('div', { className: 'header__container' });

    const logo = createElement('a', {
        className: 'header__logo',
        html: '<span class="header__logo-b">B</span>lue<span class="header__logo-r">R</span>ed',
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

    store.subscribe('user', () => {
        const oldBlock = rightGroup.querySelector('[data-auth]');
        if (oldBlock) {
            rightGroup.replaceChild(createAuthBlock(), oldBlock);
        }
        toggleAdminLink(navList);
    });

    toggleAdminLink(navList);

    return header;
}

function toggleAdminLink(navList) {
    if (!navList) return;
    const user = store.get('user');
    const existingItem = navList.querySelector('[data-admin-link]');

    if (user && user.role === 'master') {
        if (existingItem) return;
        const link = createElement('a', {
            className: 'nav__link',
            text: 'Мастерская',
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

function createAuthBlock() {
    const user = store.get('user');

    if (user) {
        const block = createElement('div', { className: 'header__user', dataset: { auth: '' } });

        const avatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username || '?') + '&background=4c3b9e&color=fff&size=72&bold=true';
        const avatar = createElement('img', {
            className: 'header__user-avatar',
            attributes: { src: avatarUrl, alt: '', width: '36', height: '36' }
        });
        block.appendChild(avatar);

        const info = createElement('div', { className: 'header__user-info' });

        const profileLink = createElement('a', {
            className: 'header__user-name',
            text: user.username,
            attributes: { href: '#/profile' }
        });
        info.appendChild(profileLink);

        const role = ROLE_LABELS[user.role] || 'Игрок';
        info.appendChild(createElement('span', { className: 'header__user-role', text: role }));

        block.appendChild(info);

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

        block.appendChild(logoutBtn);
        return block;
    }

    const link = createElement('a', {
        className: 'header__user-login',
        text: 'Войти в систему',
        attributes: { href: '#/login' },
        dataset: { auth: '' },
        events: {
            click: (e) => { e.preventDefault(); window.location.hash = '#/login'; }
        }
    });

    return link;
}
