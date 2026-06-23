import { createElement } from '../utils/dom.js';

export function Footer() {
    const footer = createElement('footer', { className: 'footer' });
    const container = createElement('div', { className: 'footer__container' });

    const year = new Date().getFullYear();
    const copyright = createElement('p', {
        className: 'footer__copyright',
        text: `© ${year} BlueRed. Все права защищены.`
    });

    container.appendChild(copyright);
    footer.appendChild(container);

    return footer;
}
