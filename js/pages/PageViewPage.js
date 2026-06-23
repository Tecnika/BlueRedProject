/**
 * PageViewPage — просмотр страницы.
 *
 * Выбирает версию под фракцию пользователя.
 * Мастер видит все версии + кнопку редактировать.
 * Тело страницы окрашивается в цвет фракции страницы (шапка — нет).
 */

import { createElement } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { getPageBySlug, resolveVersion, getAllPages, buildPageTree, filterVisiblePages } from '../firebase/pagesService.js';

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

        // Проверка доступа
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

        // Окрашиваем body в цвет фракции страницы (шапка не меняется)
        const factionColor = FACTION_COLORS[page.faction];
        if (factionColor) {
            document.body.style.backgroundColor = factionColor + '08';
        }

        // Шапка
        const header = createElement('div', { className: 'page-view-page__header' });

        // Хлебные крошки
        const breadcrumbs = createElement('div', { className: 'page-view-page__breadcrumbs' });
        const allPages = await getAllPages();
        const crumbs = buildBreadcrumbs(page, allPages);
        for (const crumb of crumbs) {
            const link = createElement('a', {
                className: 'page-view-page__crumb',
                text: crumb.title,
                attributes: { href: `#/page/view?slug=${crumb.slug}` }
            });
            breadcrumbs.appendChild(link);
            if (crumb !== crumbs[crumbs.length - 1]) {
                breadcrumbs.appendChild(createElement('span', {
                    className: 'page-view-page__crumb-sep',
                    text: ' / '
                }));
            }
        }
        header.appendChild(breadcrumbs);

        // Заголовок
        const resolved = resolveVersion(page, user.faction);
        header.appendChild(createElement('h1', {
            className: 'page-view-page__title',
            text: resolved.title
        }));

        // Метки
        const meta = createElement('div', { className: 'page-view-page__meta' });
        if (page.faction) {
            meta.appendChild(createElement('span', {
                className: `page-view-page__badge page-view-page__badge--${page.faction}`,
                text: FACTION_LABELS[page.faction]
            }));
        }
        if (page.tags && page.tags.length) {
            for (const tag of page.tags) {
                meta.appendChild(createElement('span', {
                    className: 'page-view-page__tag',
                    text: tag
                }));
            }
        }
        header.appendChild(meta);

        container.appendChild(header);

        // Контент
        const content = createElement('div', {
            className: 'page-view-page__content',
            html: resolved.content.replace(/\n/g, '<br>')
        });
        container.appendChild(content);

        // Селектор версий (для мастера)
        if (isAdmin && page.versions) {
            const versionKeys = Object.keys(page.versions);
            if (versionKeys.length > 0) {
                const versionBlock = createElement('div', { className: 'page-view-page__versions' });
                versionBlock.appendChild(createElement('h3', {
                    className: 'page-view-page__versions-title',
                    text: 'Версии'
                }));
                for (const key of versionKeys) {
                    const v = page.versions[key];
                    const vEl = createElement('div', { className: 'page-view-page__version' });
                    vEl.appendChild(createElement('span', {
                        className: 'page-view-page__version-label',
                        text: key
                    }));
                    vEl.appendChild(createElement('div', {
                        className: 'page-view-page__version-content',
                        html: (typeof v === 'string' ? v : v.content || '').replace(/\n/g, '<br>')
                    }));
                    versionBlock.appendChild(vEl);
                }
                container.appendChild(versionBlock);
            }
        }

        // Кнопка редактирования для мастера
        if (isAdmin) {
            const editLink = createElement('a', {
                className: 'page-view-page__edit-btn',
                text: 'Редактировать',
                attributes: { href: `#/page/edit?slug=${page.slug}` }
            });
            container.appendChild(editLink);
        }

        // Дочерние страницы
        const children = allPages.filter(p => p.parentId === page.id);
        if (children.length > 0) {
            const childBlock = createElement('div', { className: 'page-view-page__children' });
            childBlock.appendChild(createElement('h3', {
                className: 'page-view-page__children-title',
                text: 'Подстраницы'
            }));
            const childList = createElement('ul', { className: 'page-view-page__child-list' });
            for (const child of children) {
                const childLink = createElement('a', {
                    className: 'page-view-page__child-link',
                    text: child.title,
                    attributes: { href: `#/page/view?slug=${child.slug}` }
                });
                const li = createElement('li', { className: 'page-view-page__child-item', children: [childLink] });
                childList.appendChild(li);
            }
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

/** Построить хлебные крошки от корня до текущей страницы */
function buildBreadcrumbs(page, allPages) {
    const crumbs = [];
    let current = page;
    while (current) {
        crumbs.unshift({ title: current.title, slug: current.slug });
        current = allPages.find(p => p.id === current.parentId);
    }
    return crumbs;
}
