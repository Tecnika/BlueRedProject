import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, getAllPages, filterVisiblePages, filterVisibleCells, renderContent, FACTION_COLUMNS, MATRIX_ROWS, MATRIX_ROW_LABELS } from '../firebase/pagesService.js';

const FACTION_COLORS = { red: '#dc2626', blue: '#2563eb', purple: '#7c3aed' };
const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые' };
const TYPE_LABELS = {
    info: 'О фракции',
    propaganda: 'Пропаганда',
    'hard-propaganda': 'Жёсткая пропаганда'
};
const TYPE_COLORS = {
    info: 'var(--color-primary)',
    propaganda: '#f59e0b',
    'hard-propaganda': '#dc2626'
};

export async function PageViewPage(slug) {
    const section = createElement('section', { className: 'page-view-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', { className: 'page-view-page__error', text: 'Необходимо авторизоваться' }));
        return section;
    }

    try {
        const page = await getPageBySlug(slug);
        if (!page) {
            section.appendChild(createElement('p', { className: 'page-view-page__error', text: 'Страница не найдена' }));
            return section;
        }

        const visible = filterVisiblePages([page], user);
        if (visible.length === 0 && user.role !== 'master') {
            section.appendChild(createElement('p', { className: 'page-view-page__error', text: 'Нет доступа к этой странице' }));
            return section;
        }

        const isAdmin = user.role === 'master';
        const container = createElement('div', { className: 'page-view-page__container' });

        // Фон: для general — серый, для faction — цвет фракции пользователя
        if (page.type === 'general') {
            document.body.style.backgroundColor = '#f5f5f510';
        } else {
            const fc = FACTION_COLORS[user.faction];
            if (fc) document.body.style.backgroundColor = fc + '08';
        }

        // Хлебные крошки
        const breadcrumbs = createElement('div', { className: 'page-view-page__breadcrumbs' });
        const allPages = await getAllPages();
        const crumbs = buildBreadcrumbs(page, allPages);
        crumbs.forEach((crumb, i) => {
            const link = createElement('a', { className: 'page-view-page__crumb', text: crumb.title, attributes: { href: `#/page/view?slug=${crumb.slug}` } });
            breadcrumbs.appendChild(link);
            if (i < crumbs.length - 1) breadcrumbs.appendChild(createElement('span', { className: 'page-view-page__crumb-sep', text: ' / ' }));
        });
        container.appendChild(breadcrumbs);

        // Заголовок
        container.appendChild(createElement('h1', { className: 'page-view-page__title', text: page.title }));

        // Метки
        if (page.tags && page.tags.length) {
            const meta = createElement('div', { className: 'page-view-page__meta' });
            page.tags.forEach(tag => meta.appendChild(createElement('span', { className: 'page-view-page__tag', text: tag })));
            container.appendChild(meta);
        }

        if (page.type === 'general') {
            renderGeneralView(container, page);
        } else {
            renderFactionView(container, page, user);
        }

        // Кнопка редактирования
        if (isAdmin) {
            container.appendChild(createElement('a', { className: 'page-view-page__edit-btn', text: 'Редактировать', attributes: { href: `#/page/edit?slug=${page.slug}` } }));
        }

        // Дочерние страницы
        const children = allPages.filter(p => p.parentId === page.id);
        if (children.length > 0) {
            const childBlock = createElement('div', { className: 'page-view-page__children' });
            childBlock.appendChild(createElement('h3', { className: 'page-view-page__children-title', text: 'Подстраницы' }));
            const childList = createElement('ul', { className: 'page-view-page__child-list' });
            children.forEach(child => {
                childList.appendChild(createElement('li', { className: 'page-view-page__child-item', children: [
                    createElement('a', { className: 'page-view-page__child-link', text: child.title, attributes: { href: `#/page/view?slug=${child.slug}` } })
                ] }));
            });
            childBlock.appendChild(childList);
            container.appendChild(childBlock);
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', { className: 'page-view-page__error', text: 'Ошибка: ' + err.message }));
    }

    return section;
}

function renderGeneralView(container, page) {
    if (page.content) {
        container.appendChild(createElement('div', { className: 'page-view-page__content', html: renderContent(page.content, page.images) }));
    } else {
        container.appendChild(createElement('p', { className: 'page-view-page__empty', text: 'Страница пуста' }));
    }
}

function renderFactionView(container, page, user) {
    const filtered = filterVisibleCells(page.matrix, user);
    const hasAny = Object.keys(filtered).length > 0;

    if (!hasAny) {
        container.appendChild(createElement('p', { className: 'page-view-page__empty', text: 'Нет доступного контента' }));
        return;
    }

    // Рендерим таблицу 3×3 только с видимыми ячейками
    const table = createElement('div', { className: 'page-view__faction-table' });

    // Заголовки колонок
    const headerRow = createElement('div', { className: 'page-view__ft-row page-view__ft-header' });
    headerRow.appendChild(createElement('div', { className: 'page-view__ft-cell page-view__ft-corner' }));
    for (const f of FACTION_COLUMNS) {
        if (filtered[f]) {
            headerRow.appendChild(createElement('div', { className: `page-view__ft-cell page-view__ft-col-head page-view__ft-col-head--${f}`, text: FACTION_LABELS[f] }));
        }
    }
    table.appendChild(headerRow);

    // Строки
    for (const row of MATRIX_ROWS) {
        const hasRowCell = FACTION_COLUMNS.some(f => filtered[f] && filtered[f][row]);
        if (!hasRowCell) continue;

        const rowEl = createElement('div', { className: 'page-view__ft-row' });
        rowEl.appendChild(createElement('div', { className: 'page-view__ft-cell page-view__ft-row-head', text: MATRIX_ROW_LABELS[row] }));

        for (const f of FACTION_COLUMNS) {
            const cell = filtered[f] && filtered[f][row];
            if (cell) {
                const cellEl = createElement('div', { className: `page-view__ft-cell page-view__ft-data page-view__ft-data--${f}` });
                cellEl.appendChild(createElement('div', { className: 'page-view__ft-content', html: renderContent(cell.content, cell.images) }));
                rowEl.appendChild(cellEl);
            }
        }

        table.appendChild(rowEl);
    }

    container.appendChild(table);
}

function buildBreadcrumbs(page, allPages) {
    const crumbs = [];
    let current = page;
    while (current) {
        crumbs.unshift({ title: current.title, slug: current.slug });
        current = allPages.find(p => p.id === current.parentId);
    }
    return crumbs;
}
