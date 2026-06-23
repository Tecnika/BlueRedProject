import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js';

function noteId(authorId, targetId) {
    return `${authorId}_${targetId}`;
}

export async function getNote(authorId, targetId) {
    const { db } = getFirebase();
    const snapshot = await getDoc(doc(db, 'notes', noteId(authorId, targetId)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

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
