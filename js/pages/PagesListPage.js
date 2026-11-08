import { createElement } from '../utils/dom.js?v=27';
import { store } from '../core/Store.js?v=27';
import { translateError } from '../utils/translateError.js?v=27';
import { getAllPages, buildPageTree, filterVisiblePages } from '../firebase/pagesService.js?v=27';
import { Button } from '../components/Button.js?v=27';
import { FactionBadge } from '../components/FactionBadge.js?v=27';
import { StatusMessage } from '../components/StatusMessage.js?v=27';
import { ViewModeToggle, isAdminMode } from '../components/ViewModeToggle.js?v=27';

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

        const container = createElement('div', { className: 'pages-list-page__container' });

        const header = createElement('div', { className: 'pages-list-page__header' });
        const headerText = createElement('div', { className: 'pages-list-page__header-text' });
        headerText.appendChild(createElement('h1', { className: 'pages-list-page__title', text: 'Эфир' }));
        headerText.appendChild(createElement('p', {
            className: 'pages-list-page__subtitle',
            text: 'Вики сектора BlueRed. Статьи дополняют мастера, обсуждать может каждый.'
        }));
        header.appendChild(headerText);
        header.appendChild(Button({ text: 'Правила', icon: 'gavel', variant: 'secondary', size: 'sm', href: '#/rules' }));

        if (adminMode) {
            header.appendChild(Button({ text: 'Новое досье', icon: 'add', href: '#/page/create' }));
        }
        const toggle = ViewModeToggle(user);
        if (toggle) header.appendChild(toggle);

        container.appendChild(header);

        const search = createElement('input', {
            className: 'pages-list-page__search',
            attributes: { type: 'search', placeholder: 'Поиск по статьям...', 'aria-label': 'Поиск по статьям' }
        });
        const countEl = createElement('span', { className: 'pages-list-page__count', text: '' });
        container.appendChild(search);
        container.appendChild(countEl);

        const listContainer = createElement('div', { className: 'pages-list-page__list' });
        container.appendChild(listContainer);

        function renderFiltered() {
            const q = search.value.trim().toLowerCase();
            const filtered = q
                ? visible.filter(p => (p.title || '').toLowerCase().includes(q))
                : visible;
            listContainer.innerHTML = '';
            countEl.textContent = q
                ? `Найдено: ${filtered.length} из ${visible.length}`
                : `Всего статей: ${visible.length}`;

            if (filtered.length === 0) {
                listContainer.appendChild(StatusMessage({
                    type: 'ok',
                    text: q ? 'Ничего не найдено' : 'Нет доступных досье'
                }));
                return;
            }
            listContainer.appendChild(renderTree(buildPageTree(filtered)));
        }

        search.addEventListener('input', renderFiltered);
        renderFiltered();

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
