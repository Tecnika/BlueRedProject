import { createElement } from '../utils/dom.js?v=2';
import { store } from '../core/Store.js?v=2';
import { translateError } from '../utils/translateError.js?v=2';
import { getPageBySlug, getAllPages, filterVisiblePages, filterVisibleCells, renderContent, FACTION_COLUMNS, MATRIX_ROWS, MATRIX_ROW_LABELS } from '../firebase/pagesService.js?v=2';

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
        section.appendChild(createElement('p', { className: 'page-view-page__error', text: 'Ошибка: ' + translateError(err) }));
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
    const filtered = filterVisibleCells(page.matrix, user, page.tags || []);
    let anyContent = false;

    const isAdmin = user.role === 'master';

    for (const f of FACTION_COLUMNS) {
        if (!filtered[f]) continue;
        for (const row of MATRIX_ROWS) {
            const cell = filtered[f][row];
            if (!cell || !cell.content) continue;
            anyContent = true;

            const card = createElement('div', { className: `page-view__faction-card page-view__faction-card--${f}` });

            const meta = createElement('div', { className: 'page-view__faction-card-meta' });
            meta.appendChild(createElement('span', { className: `page-view__faction-badge page-view__faction-badge--${f}`, text: FACTION_LABELS[f] }));
            // Не-мастерам не показываем метку пропаганды — всё выглядит как «О фракции»
            if (isAdmin) {
                meta.appendChild(createElement('span', { className: 'page-view__faction-type', text: MATRIX_ROW_LABELS[row] }));
            } else {
                meta.appendChild(createElement('span', { className: 'page-view__faction-type', text: 'О фракции' }));
            }
            card.appendChild(meta);

            card.appendChild(createElement('div', { className: 'page-view__faction-card-content', html: renderContent(cell.content, cell.images) }));

            container.appendChild(card);
        }
    }

    if (!anyContent) {
        container.appendChild(createElement('p', { className: 'page-view-page__empty', text: 'Нет доступного контента' }));
    }
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
