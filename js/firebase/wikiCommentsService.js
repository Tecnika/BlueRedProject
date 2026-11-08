import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=26';
import { getActiveFaction } from '../utils/profile.js?v=26';

/**
 * Комментарии вики (Эфир и Правила).
 * wikiComments/{id} → {
 *   targetType: 'page'|'rule', targetId, parentId,
 *   authorId, authorName, authorRole, faction,
 *   text, visibleToAll, createdAt
 * }
 */

const COLLECTION = 'wikiComments';

function isStaff(user) {
    return user?.role === 'master' || user?.role === 'igrotech';
}

export async function getWikiComments(targetType, targetId, user) {
    const { db } = getFirebase();
    const base = [
        where('targetType', '==', targetType),
        where('targetId', '==', targetId)
    ];

    const snapshots = [];

    if (isStaff(user)) {
        snapshots.push(await getDocs(query(collection(db, COLLECTION), ...base)));
    } else {
        const faction = getActiveFaction() || '';
        snapshots.push(await getDocs(query(
            collection(db, COLLECTION),
            ...base,
            where('faction', '==', faction)
        )));
        snapshots.push(await getDocs(query(
            collection(db, COLLECTION),
            ...base,
            where('visibleToAll', '==', true)
        )));
    }

    const map = new Map();
    for (const snap of snapshots) {
        snap.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    }

    return [...map.values()].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function addWikiComment({ targetType, targetId, parentId, text, user, authorName }) {
    const { db } = getFirebase();
    return addDoc(collection(db, COLLECTION), {
        targetType,
        targetId,
        parentId: parentId || null,
        authorId: user.uid,
        authorName: authorName || user.username || 'Агент',
        authorRole: user.role || 'player',
        faction: getActiveFaction() || null,
        text: String(text || '').trim(),
        visibleToAll: false,
        createdAt: new Date().toISOString()
    });
}

export async function setWikiCommentVisible(id, visible) {
    const { db } = getFirebase();
    await updateDoc(doc(db, COLLECTION, id), { visibleToAll: Boolean(visible) });
}

export async function deleteWikiComment(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, COLLECTION, id));
}
