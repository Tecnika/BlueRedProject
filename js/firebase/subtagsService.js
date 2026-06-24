/**
 * subtagsService — технические субтеги для доступа к ячейкам
 * фракционных страниц. Хранятся в коллекции 'subtags'.
 *
 * Отличаются от обычных тегов:
 *   - Не показываются в общем каталоге тегов
 *   - Создаются автоматически при сохранении фракционной страницы
 *   - Назначаются пользователям только мастерами
 *   - Используются в filterVisibleCells для проверки доступа
 */

import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';

/** Получить все субтеги */
export async function getAllSubTags() {
    const { db } = getFirebase();
    const snapshot = await getDocs(collection(db, 'subtags'));
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

/** Добавить субтег */
export async function addSubTag(name) {
    const { db } = getFirebase();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/\s+/g, '_');
    await setDoc(doc(db, 'subtags', id), {
        name: trimmed,
        createdAt: new Date().toISOString()
    });
    return id;
}

/** Удалить субтег */
export async function removeSubTag(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'subtags', id));
}
