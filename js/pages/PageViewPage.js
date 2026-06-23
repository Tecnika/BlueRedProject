import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, getAllPages, filterVisiblePages, filterVisibleBlocks, renderBlockContent } from '../firebase/pagesService.js';

const FACTION_COLORS = {
    red: '#dc2626',
    blue: '#2563eb',
    purple: '#7c3aed'
};

const FACTION_LABELS = {
    red: 'Красные',
    blue: 'Синие',
    purple: 'Фиолетовые'
};

const TYPE_LABELS = {
    'info': 'Информация',
    'propaganda': 'Пропаганда',
    'hard-propaganda': 'Жёсткая пропаганда'
};

const TYPE_COLORS = {
    'info': 'var(--color-primary)',
    'propaganda': '#f59e0b',
    'hard-propaganda': '#dc2626'
};

export async function PageViewPage(slug) {
    const section = createElement('section', { className: 'page-view-page' });
    const user = store.get('user');

    if (!user) {
        section.appendChild(createElement('p', {
            className: 'page-view-page__error',
            text: 'Необходимо авторизоваться'
        }));
        return section;
    }

    try {
        const page = await getPageBySlug(slug);

        if (!page) {
            section.appendChild(createElement('p', {
                className: 'page-view-page__error',
                text: 'Страница не найдена'
            }));
            return section;
        }

        const visible = filterVisiblePages([page], user);
        if (visible.length === 0 && user.role !== 'master') {
            section.appendChild(createElement('p', {
                className: 'page-view-page__error',
                text: 'Нет доступа к этой странице'
            }));
            return section;
        }

        const isAdmin = user.role === 'master';
        const container = createElement('div', { className: 'page-view-page__container' });

        const factionColor = FACTION_COLORS[page.faction];
        if (factionColor) document.body.style.backgroundColor = factionColor + '08';

        // Хлебные крошки
        const breadcrumbs = createElement('div', { className: 'page-view-page__breadcrumbs' });
        const allPages = await getAllPages();
        const crumbs = buildBreadcrumbs(page, allPages);
        crumbs.forEach((crumb, i) => {
            const link = createElement('a', {
                className: 'page-view-page__crumb',
                text: crumb.title,
                attributes: { href: `#/page/view?slug=${crumb.slug}` }
            });
            breadcrumbs.appendChild(link);
            if (i < crumbs.length - 1) {
                breadcrumbs.appendChild(createElement('span', { className: 'page-view-page__crumb-sep', text: ' / ' }));
            }
        });
        container.appendChild(breadcrumbs);

        // Заголовок
        container.appendChild(createElement('h1', { className: 'page-view-page__title', text: page.title }));

        // Метки
        const meta = createElement('div', { className: 'page-view-page__meta' });
        if (page.tags && page.tags.length) {
            page.tags.forEach(tag => {
                meta.appendChild(createElement('span', { className: 'page-view-page__tag', text: tag }));
            });
        }
        container.appendChild(meta);

        // Блоки контента — фильтруем по тегам
        const visibleBlocks = filterVisibleBlocks(page.blocks || [], user);

        if (visibleBlocks.length === 0) {
            container.appendChild(createElement('p', {
                className: 'page-view-page__empty',
                text: 'Нет доступного контента'
            }));
        } else {
            visibleBlocks.forEach(block => {
                const blockEl = createElement('div', { className: 'page-view-page__block' });

                // Шапка блока: фракция + тип
                const blockMeta = createElement('div', { className: 'page-view-page__block-meta' });
                if (block.faction) {
                    blockMeta.appendChild(createElement('span', {
                        className: `page-view-page__badge page-view-page__badge--${block.faction}`,
                        text: FACTION_LABELS[block.faction] || block.faction
                    }));
                }
                if (block.type) {
                    blockMeta.appendChild(createElement('span', {
                        className: 'page-view-page__block-type-badge',
                        text: TYPE_LABELS[block.type] || block.type,
                        attributes: { style: `background-color:${TYPE_COLORS[block.type] || '#666'}` }
                    }));
                }
                blockEl.appendChild(blockMeta);

                // Контент с картинками
                const content = createElement('div', {
                    className: 'page-view-page__block-content',
                    html: renderBlockContent(block.content, block.images)
                });
                blockEl.appendChild(content);

                container.appendChild(blockEl);
            });
        }

        // Кнопка редактирования
        if (isAdmin) {
            container.appendChild(createElement('a', {
                className: 'page-view-page__edit-btn',
                text: 'Редактировать',
                attributes: { href: `#/page/edit?slug=${page.slug}` }
            }));
        }

        // Дочерние страницы
        const children = allPages.filter(p => p.parentId === page.id);
        if (children.length > 0) {
            const childBlock = createElement('div', { className: 'page-view-page__children' });
            childBlock.appendChild(createElement('h3', { className: 'page-view-page__children-title', text: 'Подстраницы' }));
            const childList = createElement('ul', { className: 'page-view-page__child-list' });
            children.forEach(child => {
                const childLink = createElement('a', {
                    className: 'page-view-page__child-link',
                    text: child.title,
                    attributes: { href: `#/page/view?slug=${child.slug}` }
                });
                childList.appendChild(createElement('li', { className: 'page-view-page__child-item', children: [childLink] }));
            });
            childBlock.appendChild(childList);
            container.appendChild(childBlock);
        }

        section.appendChild(container);
    } catch (err) {
        section.appendChild(createElement('p', {
            className: 'page-view-page__error',
            text: 'Ошибка: ' + err.message
        }));
    }

    return section;
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
