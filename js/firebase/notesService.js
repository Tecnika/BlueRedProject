/**
 * notesService — заметки об игроках.
 *
 * Каждая заметка хранится в коллекции 'notes' с составным id:
 *   notes/{authorId}_{targetId}
 *
 * Одна заметка на пару автор-цель (создаётся или обновляется).
 * Видна только автору (по Firestore rules).
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=2';

/** Составной id: автор + цель */
function noteId(authorId, targetId) {
    return `${authorId}_${targetId}`;
}

/** Прочитать заметку, если существует */
export async function getNote(authorId, targetId) {
    const { db } = getFirebase();
    const snapshot = await getDoc(doc(db, 'notes', noteId(authorId, targetId)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Сохранить (создать или обновить) заметку.
 * Если документ существует — updateDoc, иначе setDoc с createdAt.
 */
export async function saveNote(authorId, targetId, content) {
    const { db } = getFirebase();
    const ref = doc(db, 'notes', noteId(authorId, targetId));
    const existing = await getDoc(ref);

    const data = {
        authorId,
        targetId,
        content,
        updatedAt: new Date().toISOString()
    };

    if (existing.exists()) {
        await updateDoc(ref, data);
    } else {
        data.createdAt = new Date().toISOString();
        await setDoc(ref, data);
    }
}
