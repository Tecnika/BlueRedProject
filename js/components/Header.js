import { createElement } from '../utils/dom.js';
import { Navigation } from './Navigation.js';
import { store } from '../core/Store.js';
import { signOutUser } from '../firebase/authService.js';

export function Header(navItems, themeManager) {
    const header = createElement('header', { className: 'header' });
    const container = createElement('div', { className: 'header__container' });

    const logo = createElement('a', {
        className: 'header__logo',
        text: 'BlueRed',
        attributes: { href: '#/' }
    });

    const nav = Navigation(navItems);

    const rightGroup = createElement('div', {
        className: 'header__right',
        children: [nav, createAuthBlock()]
    });

    container.appendChild(logo);
    container.appendChild(rightGroup);
    header.appendChild(container);

    store.subscribe('user', () => {
        const oldBlock = rightGroup.querySelector('[data-auth]');
        if (oldBlock) {
            rightGroup.replaceChild(createAuthBlock(), oldBlock);
        }
    });

    return header;
}

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
