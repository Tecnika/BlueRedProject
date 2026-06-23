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

import { getFirebase } from './firebase.js';

function getDb() {
    return getFirebase().db;
}

export async function getDocument(collectionName, docId) {
    const docRef = doc(getDb(), collectionName, docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

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

export async function addDocument(collectionName, data) {
    const docRef = await addDoc(collection(getDb(), collectionName), data);
    return docRef.id;
}

export async function updateDocument(collectionName, docId, data) {
    await updateDoc(doc(getDb(), collectionName, docId), data);
}

export async function deleteDocument(collectionName, docId) {
    await deleteDoc(doc(getDb(), collectionName, docId));
}
