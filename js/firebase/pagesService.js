/**
 * pagesService — CRUD для страниц wiki.
 *
 * Коллекция 'pages':
 *   { title, slug, faction, tags, parentId, order,
 *     slots: [{ content, tags: [...] }, ...],
 *     createdBy, createdAt, updatedAt }
 *
 * Вложенность через parentId.
 * Контент разбит на слоты — каждый слот виден только
 * пользователям, у которых есть хотя бы один из его тегов.
 * Слот без тегов виден всем, кто видит страницу.
 * Пользователь не знает о существовании скрытых слотов.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js';

/** Транслитерация кириллицы в латиницу для slug */
const CYR_TO_LAT = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
    'щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    'А':'a','Б':'b','В':'v','Г':'g','Д':'d','Е':'e','Ё':'yo','Ж':'zh','З':'z',
    'И':'i','Й':'y','К':'k','Л':'l','М':'m','Н':'n','О':'o','П':'p','Р':'r',
    'С':'s','Т':'t','У':'u','Ф':'f','Х':'kh','Ц':'ts','Ч':'ch','Ш':'sh',
    'Щ':'shch','Ъ':'','Ы':'y','Ь':'','Э':'e','Ю':'yu','Я':'ya'
};

/** Сгенерировать slug из заголовка */
export function slugify(title) {
    let s = title.replace(/[ъь]/g, '').replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '');
    s = s.split('').map(c => CYR_TO_LAT[c] || c).join('');
    s = s.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s.toLowerCase() || 'page';
}

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

/** Создать / обновить страницу (slug генерируется из title при создании) */
export async function savePage(pageId, data) {
    const { db } = getFirebase();
    const now = new Date().toISOString();
    const payload = { ...data, updatedAt: now };
    if (!pageId) {
        payload.createdAt = now;
        payload.slug = payload.slug || slugify(payload.title || '') + '-' + Date.now().toString(36);
        pageId = payload.slug;
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
        if (!p.faction) return true;
        if (p.faction !== userFaction) return false;
        if (!p.tags || p.tags.length === 0) return true;
        const pageTags = p.tags.map(t => t.toLowerCase());
        return pageTags.some(t => userTags.includes(t));
    });
}

/**
 * Отфильтровать блоки контента по тегам пользователя.
 *
 * Каждый блок может быть тегирован. Без тегов — видят все,
 * кто видит страницу. С тегами — только если у пользователя
 * есть хотя бы один совпадающий тег.
 *
 * Пропаганда доступна по тегу «propaganda» или «propaganda-*».
 * Жёсткая пропаганда — по тегу «hard-propaganda».
 * Пользователь не видит скрытые блоки и не знает об их существовании.
 *
 * @param {Array} blocks — [{ content, faction, type, tags }]
 * @param {Object} user — { accessTags }
 * @returns {Array}
 */
export function filterVisibleBlocks(blocks, user) {
    if (!blocks || blocks.length === 0) return [];
    if (user.role === 'master') return blocks;

    const userTags = (user.accessTags || []).map(t => t.toLowerCase());

    return blocks.filter(block => {
        if (!block.tags || block.tags.length === 0) return true;
        const blockTags = block.tags.map(t => t.toLowerCase());
        return blockTags.some(t => userTags.includes(t));
    });
}

/**
 * Преобразовать содержимое блока в HTML:
 * - {{img:URL}} → <img src="URL">
 * - переносы строк → <br>
 */
export function renderBlockContent(content, extraImages = []) {
    let html = (content || '')
        .replace(/{{img:\s*([^}]+)\s*}}/g, '<img src="$1" alt="" loading="lazy">')
        .replace(/\n/g, '<br>');

    for (const url of extraImages) {
        if (url.trim()) {
            html += '<br><img src="' + url.trim() + '" alt="" loading="lazy">';
        }
    }

    return html;
}

/** Создать стартовую страницу, если страниц ещё нет (только для мастеров) */
export async function seedInitialPages() {
    const all = await getAllPages();
    if (all.length > 0) return;
    await savePage(null, {
        title: 'Добро пожаловать',
        slug: 'welcome',
        faction: '',
        tags: [],
        parentId: null,
        order: 0,
        createdBy: 'system',
        blocks: [
            { content: 'Это первая страница wiki проекта BlueRed.\n\nЗдесь будет описание вселенной, фракций и правил.\n\nВы можете отредактировать эту страницу или создать новую.', tags: [], faction: '', type: 'info' }
        ]
    });
}
