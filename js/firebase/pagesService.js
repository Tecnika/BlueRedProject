/**
 * pagesService — CRUD для страниц wiki.
 *
 * Коллекция 'pages':
 *   { title, slug, content, faction, tags, parentId, order,
 *     versions: { red, blue, pro-red-for-blue, pro-blue-for-red },
 *     createdBy, createdAt, updatedAt }
 *
 * Вложенность через parentId, версионность через versions-мапу.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js';

/** Получить все страницы (плоский список, сортировка на клиенте) */
export async function getAllPages() {
    const { db } = getFirebase();
    const snapshot = await getDocs(collection(db, 'pages'));
    const pages = [];
    snapshot.forEach(d => pages.push({ id: d.id, ...d.data() }));
    pages.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || ''));
    return pages;
}

/** Получить одну страницу по id */
export async function getPage(pageId) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'pages', pageId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Получить страницу по slug */
export async function getPageBySlug(slug) {
    const all = await getAllPages();
    return all.find(p => p.slug === slug) || null;
}

/** Создать / обновить страницу */
export async function savePage(pageId, data) {
    const { db } = getFirebase();
    const now = new Date().toISOString();
    const payload = { ...data, updatedAt: now };
    if (!pageId) {
        payload.createdAt = now;
        pageId = data.slug || crypto.randomUUID();
    }
    await setDoc(doc(db, 'pages', pageId), payload, { merge: true });
    return pageId;
}

/** Удалить страницу */
export async function deletePage(pageId) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'pages', pageId));
}

/**
 * Построить дерево из плоского списка.
 * @returns {Array} [{ page, children: [...] }]
 */
export function buildPageTree(pages) {
    const map = {};
    const roots = [];

    for (const p of pages) {
        map[p.id] = { page: p, children: [] };
    }

    for (const p of pages) {
        if (p.parentId && map[p.parentId]) {
            map[p.parentId].children.push(map[p.id]);
        } else {
            roots.push(map[p.id]);
        }
    }

    return roots;
}

/**
 * Отфильтровать страницы по фракции и тегам пользователя.
 * @param {Array} pages — плоский список
 * @param {Object} user — { faction, accessTags }
 * @returns {Array}
 */
export function filterVisiblePages(pages, user) {
    if (!user) return [];
    if (user.role === 'master') return pages;

    const userTags = (user.accessTags || []).map(t => t.toLowerCase());
    const userFaction = user.faction;

    return pages.filter(p => {
        // Страница без фракции — видна всем
        if (!p.faction) return true;
        // Фракция не совпадает
        if (p.faction !== userFaction) return false;
        // Если у страницы нет тегов — видна всем во фракции
        if (!p.tags || p.tags.length === 0) return true;
        // Должен совпасть хотя бы один тег
        const pageTags = p.tags.map(t => t.toLowerCase());
        return pageTags.some(t => userTags.includes(t));
    });
}

/** Создать стартовую страницу, если страниц ещё нет (только для мастеров) */
export async function seedInitialPages() {
    const all = await getAllPages();
    if (all.length > 0) return;
    await savePage(null, {
        title: 'Добро пожаловать',
        slug: 'welcome',
        content: 'Это первая страница wiki проекта BlueRed.\n\nЗдесь будет описание вселенной, фракций и правил.\n\nВы можете отредактировать эту страницу или создать новую.',
        faction: '',
        tags: [],
        parentId: null,
        order: 0,
        createdBy: 'system'
    });
}

/** Приоритет версий в зависимости от фракции пользователя */
const VERSION_PRIORITY = {
    red:    ['pro-blue-for-red', 'red', 'default'],
    blue:   ['pro-red-for-blue', 'blue', 'default'],
    purple: ['purple', 'default']
};

/**
 * Получить контент для конкретной фракции (с учётом версий).
 * @returns { content, title } или null
 */
export function resolveVersion(page, faction) {
    if (!page) return null;
    const priority = VERSION_PRIORITY[faction] || ['default'];
    const versions = page.versions || {};

    for (const key of priority) {
        if (key === 'default') {
            return { content: page.content, title: page.title };
        }
        if (versions[key]) {
            return {
                content: versions[key].content || versions[key],
                title: versions[key].title || page.title
            };
        }
    }

    return { content: page.content, title: page.title };
}
