/**
 * Navigation — горизонтальное меню из массива пунктов.
 *
 * Каждый пункт: { label: 'Название', path: '#/путь' }
 * Данные загружаются из data/navigation.json.
 */

import { createElement } from '../utils/dom.js';

export function Navigation(items) {
    const nav = createElement('nav', { className: 'nav' });
    const list = createElement('ul', { className: 'nav__list' });

    if (!items) {
        return nav;
    }

    for (const item of items) {
        const link = createElement('a', {
            className: 'nav__link',
            text: item.label,
            attributes: { href: item.path }
        });

        const li = createElement('li', { className: 'nav__item', children: [link] });
        list.appendChild(li);
    }

    nav.appendChild(list);
    return nav;
}
