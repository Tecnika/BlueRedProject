import { createElement } from '../utils/dom.js?v=10';
import { Navigation } from './Navigation.js?v=10';
import { store } from '../core/Store.js?v=10';
import { signOutUser } from '../firebase/authService.js?v=10';
import { ROLE_LABELS } from '../utils/constants.js?v=10';
import { Icon } from './Icon.js?v=10';
import { canInstall, promptInstall, isStandalone } from '../core/pwa.js?v=10';

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
        attributes: { type: 'button', 'aria-label': 'Меню' }
    });
    hamburger.appendChild(Icon({ name: 'menu' }));

    const installBtn = createElement('button', {
        className: 'header__install',
        text: 'Установить',
        attributes: { type: 'button', 'aria-label': 'Установить приложение' }
    });

    const offlineBadge = createElement('span', {
        className: 'header__offline',
        text: 'Офлайн',
        attributes: { title: 'Нет сети — показаны сохранённые данные' }
    });

    const rightGroup = createElement('div', {
        className: 'header__right',
        children: [nav, installBtn, offlineBadge, createAuthBlock()]
    });

    container.appendChild(logo);
    container.appendChild(hamburger);
    container.appendChild(rightGroup);
    header.appendChild(container);

    function toggleMenu(open) {
        const isOpen = open !== undefined ? open : !header.classList.contains('header--menu-open');
        header.classList.toggle('header--menu-open', isOpen);
        hamburger.replaceChildren(Icon({ name: isOpen ? 'close' : 'menu' }));
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
        applyRadioNav(navList);
    });

    toggleAdminLink(navList);
    applyRadioNav(navList);

    // Установка приложения
    const updateInstall = () => {
        installBtn.hidden = !canInstall() || isStandalone();
    };
    updateInstall();
    window.addEventListener('pwa:installable', updateInstall);
    window.addEventListener('pwa:installed', updateInstall);
    installBtn.addEventListener('click', async () => {
        await promptInstall();
        updateInstall();
    });

    // Индикатор офлайна
    offlineBadge.hidden = navigator.onLine !== false;
    window.addEventListener('online', () => { offlineBadge.hidden = true; });
    window.addEventListener('offline', () => { offlineBadge.hidden = false; });

    return header;
}

function applyRadioNav(navList) {
    if (!navList) return;
    const user = store.get('user');
    const isRadio = Boolean(user && user.radioFaction);

    navList.querySelectorAll('.nav__item').forEach(li => {
        if (li.hasAttribute('data-radio-link') || li.hasAttribute('data-admin-link')) return;
        const label = li.textContent.trim();
        const keep = label === 'Эфир' || label === 'Фракции';
        li.style.display = isRadio && !keep ? 'none' : '';
    });

    let radioLi = navList.querySelector('[data-radio-link]');
    if (isRadio) {
        if (!radioLi) {
            radioLi = createElement('li', { className: 'nav__item', attributes: { 'data-radio-link': '' } });
            radioLi.appendChild(createElement('a', {
                className: 'nav__link',
                text: 'Радиорубка',
                attributes: { href: '#/radio' }
            }));
            navList.appendChild(radioLi);
        }
        radioLi.style.display = '';
    } else if (radioLi) {
        radioLi.remove();
    }
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

        const p = user.player || {};
        const displayName = [p.firstName || user.firstName, p.lastName || user.lastName]
            .filter(Boolean)
            .join(' ') || user.username;
        const profileLink = createElement('a', {
            className: 'header__user-name',
            text: displayName,
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
