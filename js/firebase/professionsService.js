import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=18';

/** Каталог профессий: professions/{id} → { name } */

export async function getAllProfessions() {
    const { db } = getFirebase();
    const snap = await getDocs(query(collection(db, 'professions'), orderBy('name', 'asc')));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
}

export async function addProfession(name) {
    const { db } = getFirebase();
    const clean = String(name || '').trim();
    if (!clean) return null;
    const id = 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await setDoc(doc(db, 'professions', id), { name: clean });
    return { id, name: clean };
}

export async function removeProfession(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'professions', id));
}
