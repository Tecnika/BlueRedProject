import { createElement } from '../utils/dom.js';
import { Navigation } from './Navigation.js';
import { ThemeToggle } from './ThemeToggle.js';

export function Header(navItems, themeManager) {
    const header = createElement('header', { className: 'header' });
    const container = createElement('div', { className: 'header__container' });

    const logo = createElement('a', {
        className: 'header__logo',
        text: 'BlueRed',
        attributes: { href: '/' }
    });

    const nav = Navigation(navItems);
    const themeToggle = ThemeToggle(themeManager);

    const rightGroup = createElement('div', {
        className: 'header__right',
        children: [nav, themeToggle]
    });

    container.appendChild(logo);
    container.appendChild(rightGroup);
    header.appendChild(container);

    return header;
}
