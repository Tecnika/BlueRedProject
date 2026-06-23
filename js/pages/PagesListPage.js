/**
 * PagesListPage — дерево доступных страниц.
 *
 * Для мастера: все страницы + кнопка «Создать».
 * Для игрока: только те, что совпадают по фракции и тегу.
 */

import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { translateError } from '../utils/translateError.js';
import { getAllPages, buildPageTree, filterVisiblePages } from '../firebase/pagesService.js';

export async function PagesListPage() {
    const section = createElement('section', { className: 'pages-list-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', {
            className: 'pages-list-page__empty',
            text: 'Необходимо авторизоваться'
        }));
        return section;
    }

    try {
        const allPages = await getAllPages();
        const visible = filterVisiblePages(allPages, user);
        const tree = buildPageTree(visible);

        const container = createElement('div', { className: 'pages-list-page__container' });

        const header = createElement('div', { className: 'pages-list-page__header' });
        header.appendChild(createElement('h1', {
            className: 'pages-list-page__title',
            text: 'Страницы'
        }));

        if (user.role === 'master') {
            const createBtn = createElement('a', {
                className: 'pages-list-page__create-btn',
                text: '+ Создать страницу',
                attributes: { href: '#/page/create' }
            });
            header.appendChild(createBtn);
        }

        container.appendChild(header);

        if (tree.length === 0) {
            container.appendChild(createElement('p', {
                className: 'pages-list-page__empty',
                text: 'Нет доступных страниц'
            }));
        } else {
            const list = renderTree(tree);
            container.appendChild(list);
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', {
            className: 'pages-list-page__empty',
            text: 'Ошибка: ' + translateError(err)
        }));
    }

    return section;
}

/** Рекурсивно рендерит дерево страниц */
function renderTree(nodes) {
    const list = createElement('ul', { className: 'pages-tree' });

    for (const node of nodes) {
        const li = createElement('li', { className: 'pages-tree__item' });

        const link = createElement('a', {
            className: 'pages-tree__link',
            text: node.page.title,
            attributes: { href: `#/page/view?slug=${node.page.slug}` }
        });

        // Метка фракции
        if (node.page.faction) {
            const badge = createElement('span', {
                className: `pages-tree__badge pages-tree__badge--${node.page.faction}`,
                text: node.page.faction === 'red' ? 'Кр' : node.page.faction === 'blue' ? 'Си' : 'Фи'
            });
            link.appendChild(badge);
        }

        li.appendChild(link);

        // Дочерние страницы
        if (node.children.length > 0) {
            li.appendChild(renderTree(node.children));
        }

        list.appendChild(li);
    }

    return list;
}
