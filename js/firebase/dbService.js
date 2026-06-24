/**
 * dbService — обёртка над Firestore для базовых CRUD-операций.
 *
 * Позволяет работать с любой коллекцией без импорта Firebase SDK
 * в каждом компоненте. Для специфических запросов (например, заметки
 * с составным ключом) используйте специализированные сервисы.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';

import { getFirebase } from './firebase.js?v=3';

function getDb() {
    return getFirebase().db;
}

/** Получить один документ по id */
export async function getDocument(collectionName, docId) {
    const docRef = doc(getDb(), collectionName, docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Получить все документы коллекции (с опциональной фильтрацией).
 * @param {Object[]} conditions — [{ field, op, value }]
 */
export async function getCollection(collectionName, conditions = []) {
    let q = collection(getDb(), collectionName);

    for (const c of conditions) {
        q = query(q, where(c.field, c.op, c.value));
    }

    const snapshot = await getDocs(q);
    const result = [];

    snapshot.forEach(d => result.push({ id: d.id, ...d.data() }));

    return result;
}

/** Добавить документ в коллекцию (авто-id) */
export async function addDocument(collectionName, data) {
    const docRef = await addDoc(collection(getDb(), collectionName), data);
    return docRef.id;
}

/** Обновить документ по id */
export async function updateDocument(collectionName, docId, data) {
    await updateDoc(doc(getDb(), collectionName, docId), data);
}

/** Удалить документ по id */
export async function deleteDocument(collectionName, docId) {
    await deleteDoc(doc(getDb(), collectionName, docId));
}
