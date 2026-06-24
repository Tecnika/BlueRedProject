/**
 * pagesService — CRUD для страниц wiki.
 *
 * Коллекция 'pages':
 *   { title, slug, type, tags, parentId, order,
 *     createdBy, createdAt, updatedAt }
 *
 * Два типа страниц:
 *
 * 1. type='general' — общая страница с серым фоном,
 *    контент в поляx content + images, доступ по тегам.
 *
 * 2. type='faction' — фракционная страница. Таблица 3×3:
 *    строки: info / propaganda / hard-propaganda
 *    колонки: red / blue / purple
 *    matrix = {
 *      red:   { info: {content,tags,images}, propaganda: {...}, hard-propaganda: {...} },
 *      blue:  { ... },
 *      purple:{ ... }
 *    }
 *    Каждая ячейка — контент + теги доступа + изображения.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=2';
import { addSubTag } from './subtagsService.js?v=2';

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
 * Отфильтровать страницы по тегам пользователя.
 * Общие страницы — по тегам. Фракционные — по тегам + фракция автоматом.
 * @param {Array} pages
 * @param {Object} user — { accessTags }
 * @returns {Array}
 */
export function filterVisiblePages(pages, user) {
    if (!user) return [];
    if (user.role === 'master') return pages;

    const allUserTags = [
        ...(user.accessTags || []).map(t => t.toLowerCase()),
        ...(user.factionAccessTags || []).map(t => t.toLowerCase())
    ];

    return pages.filter(p => {
        if (!p.tags || p.tags.length === 0) return true;
        const pageTags = p.tags.map(t => t.toLowerCase());
        return pageTags.some(t =>
            allUserTags.some(ut => ut === t || ut.startsWith(t + '_'))
        );
    });
}

/**
 * Отфильтровать ячейки матрицы фракционной страницы.
 * Доступ к ячейке — по составному тегу {pageTag}_{abbr}_{level}
 *   abbr: к / с / ф  (red / blue / purple)
 *   level: 0 (info) / 1 (propaganda) / 2 (hard-propaganda)
 *
 * Например: техник_к_0 — доступ к красной колонке info,
 *           техник_с_1 — доступ к синей колонке propaganda.
 *
 * Игрок не видит разницы между уровнями — propaganda и
 * hard-propaganda отображаются как обычная информация.
 */
export function filterVisibleCells(matrix, user, pageTags = []) {
    if (!matrix) return {};
    if (user.role === 'master') return matrix;

    const userTags = [
        ...(user.accessTags || []).map(t => t.toLowerCase()),
        ...(user.factionAccessTags || []).map(t => t.toLowerCase())
    ];
    const tags = pageTags.map(t => t.toLowerCase());
    const result = {};

    for (const f of FACTION_COLUMNS) {
        if (!matrix[f]) continue;
        const cellGroup = {};
        for (const r of MATRIX_ROWS) {
            const cell = matrix[f][r];
            if (!cell) continue;

            // Составной тег: техник_к_0
            const required = tags.map(t => `${t}_${FACTION_ABBR[f]}_${LEVEL_ABBR[r]}`);
            const hasAccess = required.some(tag => userTags.includes(tag));

            if (hasAccess) {
                cellGroup[r] = { content: cell.content, images: cell.images || [] };
            }
        }
        if (Object.keys(cellGroup).length > 0) {
            result[f] = cellGroup;
        }
    }
    return result;
}

/**
 * Преобразовать контент в HTML:
 * - {{img:URL}} → <img src="URL">
 * - переносы строк → <br>
 */
export function renderContent(content, extraImages = []) {
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

/** Константы для матрицы фракционных страниц */
export const FACTION_COLUMNS = ['red', 'blue', 'purple'];
export const MATRIX_ROWS = ['info', 'propaganda', 'hard-propaganda'];
export const MATRIX_ROW_LABELS = {
    info: 'О фракции',
    propaganda: 'Пропаганда',
    'hard-propaganda': 'Жёсткая пропаганда'
};

/** Сокращения фракций для составных тегов: техник_к_0 */
export const FACTION_ABBR = { red: 'к', blue: 'с', purple: 'ф' };
/** Уровни пропаганды для составных тегов */
export const LEVEL_ABBR = { info: '0', propaganda: '1', 'hard-propaganda': '2' };

/**
 * Создать субтеги для фракционной страницы в каталоге тегов.
 * Для каждого тега страницы создаются: {tag}_{abbr}_{level}
 *   abbr: к/с/ф, level: 0/1/2
 */
export async function ensureFactionSubTags(pageTags) {
    for (const tag of pageTags) {
        if (!tag || !tag.trim()) continue;
        for (const f of FACTION_COLUMNS) {
            for (const r of MATRIX_ROWS) {
                const subTag = `${tag.trim()}_${FACTION_ABBR[f]}_${LEVEL_ABBR[r]}`;
                try { await addSubTag(subTag); } catch (e) { /* дубликат — ок */ }
            }
        }
    }
}

/** Создать пустую матрицу 3×3 */
export function createEmptyMatrix() {
    const m = {};
    for (const f of FACTION_COLUMNS) {
        m[f] = {};
        for (const r of MATRIX_ROWS) {
            m[f][r] = { content: '', images: [] };
        }
    }
    return m;
}

/** Создать стартовую страницу, если страниц ещё нет (только для мастеров) */
export async function seedInitialPages() {
    const all = await getAllPages();
    if (all.length > 0) return;
    await savePage(null, {
        title: 'Добро пожаловать',
        slug: 'welcome',
        type: 'general',
        tags: [],
        parentId: null,
        order: 0,
        createdBy: 'system',
        content: 'Это первая страница wiki проекта BlueRed.\n\nЗдесь будет описание вселенной, фракций и правил.\n\nВы можете отредактировать эту страницу или создать новую.',
        images: []
    });
}
