import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=12';
import { store } from '../core/Store.js?v=12';

/**
 * Комментарии о людях, видимые в списке фракции.
 * Документ: factionComments/{targetUid} → { comments: [{ authorId, authorName, text, createdAt }] }
 */

export async function getAllComments() {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'factionComments'));
    const map = {};
    snap.forEach(d => { map[d.id] = d.data().comments || []; });
    return map;
}

export async function addComment(targetId, text) {
    const { db } = getFirebase();
    const user = store.get('user');
    const character = store.get('character');

    const ref = doc(db, 'factionComments', String(targetId));
    const snap = await getDoc(ref);
    const comments = snap.exists() ? (snap.data().comments || []) : [];

    const entry = {
        authorId: user.uid,
        authorName: character?.name || user.username || 'Агент',
        text: String(text).trim(),
        createdAt: new Date().toISOString()
    };
    comments.push(entry);

    await setDoc(ref, { comments });
    return entry;
}
