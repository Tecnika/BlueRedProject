import { createElement } from '../utils/dom.js?v=27';
import { store } from '../core/Store.js?v=27';
import { translateError } from '../utils/translateError.js?v=27';
import { getPageBySlug, getAllPages, filterVisiblePages, filterVisibleCells, renderContent, FACTION_COLUMNS, MATRIX_ROWS, MATRIX_ROW_LABELS } from '../firebase/pagesService.js?v=27';
import { Button } from '../components/Button.js?v=27';
import { FactionBadge } from '../components/FactionBadge.js?v=27';
import { StatusMessage } from '../components/StatusMessage.js?v=27';
import { WikiComments } from '../components/WikiComments.js?v=27';
import { getActiveFaction } from '../utils/profile.js?v=27';
import { ViewModeToggle, isAdminMode } from '../components/ViewModeToggle.js?v=27';

const FACTION_COLORS = { red: '#dc2626', blue: '#2563eb', purple: '#7c3aed' };
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
        section.appendChild(StatusMessage({ type: 'err', text: 'Требуется идентификация' }));
        return section;
    }

    try {
        const page = await getPageBySlug(slug);
        if (!page) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Досье не найдено' }));
            return section;
        }

        const adminMode = isAdminMode(user);
        const viewer = { role: adminMode ? 'master' : 'player', character: store.get('character') || {} };
        const visible = filterVisiblePages([page], viewer);
        if (visible.length === 0 && !adminMode) {
            section.appendChild(StatusMessage({ type: 'err', text: 'Недостаточно прав доступа' }));
            return section;
        }

        const isAdmin = adminMode;
        const isMaster = user.role === 'master';
        const container = createElement('div', { className: 'page-view-page__container wiki-article' });

        if (page.type === 'general') {
            section.classList.add('page-view-page--general');
        } else if (getActiveFaction() && FACTION_COLORS[getActiveFaction()]) {
            section.classList.add('page-view-page--faction-' + getActiveFaction());
        }

        const topRow = createElement('div', { className: 'page-view-page__top' });
        topRow.appendChild(Button({ text: 'Назад к эфиру', icon: 'arrow_back', variant: 'secondary', size: 'sm', href: '#/pages' }));
        const modeToggle = ViewModeToggle(user);
        if (modeToggle) topRow.appendChild(modeToggle);
        container.appendChild(topRow);

        const breadcrumbs = createElement('div', { className: 'page-view-page__breadcrumbs' });
        const allPages = await getAllPages();
        const crumbs = buildBreadcrumbs(page, allPages);
        crumbs.forEach((crumb, i) => {
            const link = createElement('a', { className: 'page-view-page__crumb', text: crumb.title, attributes: { href: `#/page/view?slug=${crumb.slug}` } });
            breadcrumbs.appendChild(link);
            if (i < crumbs.length - 1) breadcrumbs.appendChild(createElement('span', { className: 'page-view-page__crumb-sep', text: ' / ' }));
        });
        container.appendChild(breadcrumbs);

        const tabs = createElement('div', { className: 'wiki-article__tabs' });
        tabs.appendChild(createElement('span', {
            className: 'wiki-article__tab wiki-article__tab--active',
            text: 'Статья'
        }));
        const talkTab = createElement('button', {
            className: 'wiki-article__tab',
            text: 'Обсуждение',
            attributes: { type: 'button' }
        });
        talkTab.addEventListener('click', () => {
            document.getElementById('wiki-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        tabs.appendChild(talkTab);
        container.appendChild(tabs);

        container.appendChild(createElement('h1', { className: 'page-view-page__title', text: page.title }));

        const updated = page.updatedAt || page.createdAt;
        const updatedText = updated && !Number.isNaN(new Date(updated).getTime())
            ? new Date(updated).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
        container.appendChild(createElement('div', {
            className: 'wiki-article__meta-line',
            text: `Материал из BlueRed · последняя правка: ${updatedText}`
        }));

        if (page.tags && page.tags.length) {
            const meta = createElement('div', { className: 'page-view-page__meta' });
            page.tags.forEach(tag => meta.appendChild(createElement('span', { className: 'page-view-page__tag', text: tag })));
            container.appendChild(meta);
        }

        if (page.type === 'general') {
            renderGeneralView(container, page);
        } else {
            renderFactionView(container, page, viewer, isAdmin);
        }

        if (isMaster) {
            const actions = createElement('div', { className: 'wiki-article__actions' });
            actions.appendChild(Button({
                text: 'Редактировать страницу',
                icon: 'edit',
                variant: 'secondary',
                size: 'sm',
                href: `#/page/edit?slug=${page.slug}`
            }));
            container.appendChild(actions);
        }

        const children = allPages.filter(p => p.parentId === page.id);
        if (children.length > 0) {
            const childBlock = createElement('div', { className: 'page-view-page__children' });
            childBlock.appendChild(createElement('h3', { className: 'page-view-page__children-title', text: 'Вложенные сводки' }));
            const childList = createElement('ul', { className: 'page-view-page__child-list' });
            children.forEach(child => {
                childList.appendChild(createElement('li', { className: 'page-view-page__child-item', children: [
                    createElement('a', { className: 'page-view-page__child-link', text: child.title, attributes: { href: `#/page/view?slug=${child.slug}` } })
                ] }));
            });
            childBlock.appendChild(childList);
            container.appendChild(childBlock);
        }

        container.appendChild(await WikiComments({
            targetType: 'page',
            targetId: page.id,
            rulesWiki: false
        }));

        section.appendChild(container);
    } catch (err) {
        section.appendChild(StatusMessage({ type: 'err', text: 'Ошибка: ' + translateError(err) }));
    }

    return section;
}

function renderGeneralView(container, page) {
    if (page.content) {
        container.appendChild(createElement('div', { className: 'page-view-page__content', html: renderContent(page.content, page.images) }));
    } else {
        container.appendChild(createElement('p', { className: 'page-view-page__empty', text: 'Сводка пуста' }));
    }
}

function renderFactionView(container, page, viewer, isAdmin) {
    const filtered = filterVisibleCells(page.matrix, viewer, page.tags || []);
    let anyContent = false;

    for (const f of FACTION_COLUMNS) {
        if (!filtered[f]) continue;
        for (const row of MATRIX_ROWS) {
            const cell = filtered[f][row];
            if (!cell || !cell.content) continue;
            anyContent = true;

            const card = createElement('div', { className: `page-view__faction-card page-view__faction-card--${f}` });

            const meta = createElement('div', { className: 'page-view__faction-card-meta' });
            meta.appendChild(FactionBadge({ faction: f }));
            if (isAdmin) {
                meta.appendChild(createElement('span', { className: 'page-view__faction-type', text: MATRIX_ROW_LABELS[row] }));
            } else {
                meta.appendChild(createElement('span', { className: 'page-view__faction-type', text: 'Сводка по фракции' }));
            }
            card.appendChild(meta);

            card.appendChild(createElement('div', { className: 'page-view__faction-card-content', html: renderContent(cell.content, cell.images) }));

            container.appendChild(card);
        }
    }

    if (!anyContent) {
        container.appendChild(createElement('p', { className: 'page-view-page__empty', text: 'Нет доступных данных' }));
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
