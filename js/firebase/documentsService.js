import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';
import { store } from '../core/Store.js?v=3';
import { updateUserProfile } from './authService.js?v=3';

function randomDigits(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
}

function randomAccessKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

export async function getAllDocuments() {
    const { db } = getFirebase();
    const q = query(collection(db, 'documents'), orderBy('number', 'asc'));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
}

export async function getDocument(id) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'documents', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createDocument(data) {
    const { db } = getFirebase();
    const user = store.get('user');

    let number;
    let numberOk = false;
    while (!numberOk) {
        number = randomDigits(4);
        const check = await getDocs(query(collection(db, 'documents'), where('number', '==', number)));
        if (check.empty) numberOk = true;
    }

    const accessKey = randomAccessKey();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await setDoc(doc(db, 'documents', docId), {
        number,
        accessKey,
        faction: data.faction || '',
        content: data.content || '',
        createdBy: user.uid,
        createdAt: new Date().toISOString()
    });

    return { id: docId, number, accessKey };
}

export async function updateDocument(id, data) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'documents', id), data, { merge: true });
}

export async function deleteDocument(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'documents', id));
}

export async function grantDocumentAccess(documentId, uid) {
    const { db } = getFirebase();
    const profile = await getDoc(doc(db, 'users', uid));
    if (!profile.exists()) return;
    const docs = profile.data().documents || [];
    if (docs.includes(documentId)) return;
    docs.push(documentId);
    await setDoc(doc(db, 'users', uid), { documents: docs }, { merge: true });
}

export async function addDocumentByCode(number, accessKey) {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'documents'));
    let found = null;
    snap.forEach(d => {
        const data = d.data();
        if (data.number === number && data.accessKey === accessKey) {
            found = { id: d.id, ...data };
        }
    });
    return found;
}

export async function getDocumentReaders(documentId) {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'users'));
    const readers = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.documents && data.documents.includes(documentId)) {
            readers.push({ uid: d.id, username: data.username, faction: data.faction });
        }
    });
    return readers;
}
