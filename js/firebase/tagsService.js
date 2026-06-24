/**
 * tagsService — каталог тегов в Firestore.
 *
 * Коллекция 'tags': { name, createdAt }
 * Теги глобальные — используются для назначения игрокам.
 *
 * Мастер управляет каталогом: добавляет и удаляет теги.
 * При вводе нового тега в UI он автоматически сохраняется в каталог.
 */

import { collection, doc, getDocs, setDoc, deleteDoc, query, limit } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';

/** Стартовый пул тегов (космические навыки / должности) */
const INITIAL_TAGS = [
    'Пилот',
    'Инженер',
    'Медик',
    'Навигатор',
    'Связист',
    'Офицер безопасности',
    'Дипломат',
    'Учёный',
    'Техник',
    'Штурман'
];

/** Получить все теги из каталога (сортировка на клиенте) */
export async function getAllTags() {
    const { db } = getFirebase();
    const snapshot = await getDocs(collection(db, 'tags'));
    const tags = [];
    snapshot.forEach(d => tags.push({ id: d.id, ...d.data() }));
    tags.sort((a, b) => a.name.localeCompare(b.name));
    return tags;
}

/** Поиск тегов по префиксу (для автокомплита) */
export async function searchTags(prefix) {
    if (!prefix || !prefix.trim()) return getAllTags();
    const all = await getAllTags();
    const lower = prefix.toLowerCase();
    return all.filter(t => t.name.toLowerCase().includes(lower));
}

/** Добавить новый тег в каталог */
export async function addTag(name) {
    const { db } = getFirebase();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Название грифа не может быть пустым');

    // Нормализуем id: уникальный ключ на основе имени
    const id = trimmed.toLowerCase().replace(/\s+/g, '_');
    await setDoc(doc(db, 'tags', id), {
        name: trimmed,
        createdAt: new Date().toISOString()
    });
    return id;
}

/** Удалить тег из каталога */
export async function removeTag(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'tags', id));
}

/** Сидировать начальные теги, если каталог пуст */
export async function seedInitialTags() {
    const { db } = getFirebase();
    const snapshot = await getDocs(
        query(collection(db, 'tags'), limit(1))
    );
    if (!snapshot.empty) return; // уже есть теги

    for (const name of INITIAL_TAGS) {
        const id = name.toLowerCase().replace(/\s+/g, '_');
        await setDoc(doc(db, 'tags', id), {
            name,
            createdAt: new Date().toISOString()
        });
    }
}
