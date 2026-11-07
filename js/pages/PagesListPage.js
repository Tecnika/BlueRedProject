import { createElement } from '../utils/dom.js?v=14';
import { store } from '../core/Store.js?v=14';
import { translateError } from '../utils/translateError.js?v=14';
import { getAllPages, buildPageTree, filterVisiblePages } from '../firebase/pagesService.js?v=14';
import { Button } from '../components/Button.js?v=14';
import { FactionBadge } from '../components/FactionBadge.js?v=14';
import { StatusMessage } from '../components/StatusMessage.js?v=14';
import { ViewModeToggle, isAdminMode } from '../components/ViewModeToggle.js?v=14';

export async function PagesListPage() {
    const section = createElement('section', { className: 'pages-list-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    const adminMode = isAdminMode(user);

    try {
        const allPages = await getAllPages();
        const viewer = { role: adminMode ? 'master' : 'player', character: store.get('character') || {} };
        const visible = filterVisiblePages(allPages, viewer);
        const tree = buildPageTree(visible);

        const container = createElement('div', { className: 'pages-list-page__container' });

        const header = createElement('div', { className: 'pages-list-page__header' });
        header.appendChild(createElement('h1', { className: 'pages-list-page__title', text: 'Эфир' }));
        header.appendChild(Button({ text: 'Правила', icon: 'gavel', variant: 'secondary', size: 'sm', href: '#/rules' }));

        if (adminMode) {
            header.appendChild(Button({ text: 'Новое досье', icon: 'add', href: '#/page/create' }));
        }
        const toggle = ViewModeToggle(user);
        if (toggle) header.appendChild(toggle);

        container.appendChild(header);

        if (tree.length === 0) {
            container.appendChild(StatusMessage({ type: 'ok', text: 'Нет доступных досье' }));
        } else {
            const list = renderTree(tree);
            container.appendChild(list);
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function renderTree(nodes) {
    const list = createElement('ul', { className: 'pages-tree' });

    for (const node of nodes) {
        const li = createElement('li', { className: 'pages-tree__item' });

        const link = createElement('a', {
            className: 'pages-tree__link',
            text: node.page.title,
            attributes: { href: `#/page/view?slug=${node.page.slug}` }
        });

        if (node.page.faction) {
            link.appendChild(FactionBadge({ faction: node.page.faction, size: 'sm' }));
        }

        li.appendChild(link);

        if (node.children.length > 0) {
            li.appendChild(renderTree(node.children));
        }

        list.appendChild(li);
    }

    return list;
}
