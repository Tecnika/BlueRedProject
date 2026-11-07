import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=14';
import { store } from '../core/Store.js?v=14';

function randomDigits(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
}

function randomAccessKey() {
    return randomDigits(8);
}

function normalize(version) {
    return { ...version, level: version.level || 'official' };
}

function makeVersionId() {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getAllDocuments() {
    const { db } = getFirebase();
    const q = query(collection(db, 'documents'), orderBy('number', 'asc'));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push(normalize({ id: d.id, ...d.data() })));
    return list;
}

export async function getDocument(id) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'documents', id));
    return snap.exists() ? normalize({ id: snap.id, ...snap.data() }) : null;
}

/** Все версии файла с общим номером */
export async function getVersionsByNumber(number) {
    const { db } = getFirebase();
    const snap = await getDocs(query(collection(db, 'documents'), where('number', '==', String(number))));
    const list = [];
    snap.forEach(d => list.push(normalize({ id: d.id, ...d.data() })));
    return list;
}

/** Уникальный 4-значный номер файла (общий для всех версий) */
async function generateNumber() {
    const all = await getAllDocuments();
    const used = new Set(all.map(d => String(d.number)));
    for (let attempt = 0; attempt < 50; attempt++) {
        const candidate = randomDigits(4);
        if (!used.has(candidate)) return candidate;
    }
    return randomDigits(4);
}

/**
 * Создать группу версий одного файла (общий номер, у каждой свой ключ).
 * @param {Array} items — [{ faction, level, content }]
 */
export async function createVersions(items) {
    const { db } = getFirebase();
    const user = store.get('user');
    const number = await generateNumber();
    const created = [];

    for (const item of items) {
        const id = makeVersionId();
        const accessKey = randomAccessKey();
        const payload = {
            number,
            faction: item.faction,
            level: item.level,
            content: item.content || '',
            accessKey,
            createdBy: user?.uid || '',
            createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'documents', id), payload);
        created.push({ id, ...payload });
    }

    return { number, versions: created };
}

/** Добавить ещё одну версию к существующему номеру */
export async function addVersion(number, item) {
    const { db } = getFirebase();
    const user = store.get('user');
    const id = makeVersionId();
    const accessKey = randomAccessKey();
    const payload = {
        number: String(number),
        faction: item.faction,
        level: item.level,
        content: item.content || '',
        accessKey,
        createdBy: user?.uid || '',
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'documents', id), payload);
    return { id, ...payload };
}

export async function updateDocument(id, data) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'documents', id), data, { merge: true });
}

/** Удалить одну версию */
export async function deleteDocument(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'documents', id));
}

/** Удалить все версии файла по номеру */
export async function deleteVersionGroup(number) {
    const versions = await getVersionsByNumber(number);
    for (const version of versions) {
        await deleteDocument(version.id);
    }
}

export async function grantDocumentAccess(versionId, uid) {
    const { db } = getFirebase();
    const profile = await getDoc(doc(db, 'users', uid));
    if (!profile.exists()) return;
    const docs = profile.data().documents || [];
    if (docs.includes(versionId)) return;
    docs.push(versionId);
    await setDoc(doc(db, 'users', uid), { documents: docs }, { merge: true });
}

/** Найти версию по номеру файла и коду доступа */
export async function addDocumentByCode(number, accessKey) {
    const versions = await getVersionsByNumber(number);
    return versions.find(v => v.accessKey === accessKey) || null;
}

export async function getDocumentReaders(versionId) {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'users'));
    const readers = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.documents && data.documents.includes(versionId)) {
            readers.push({ uid: d.id, username: data.username });
        }
    });

    const publicSnap = await getDocs(collection(db, 'publicPlayers'));
    const pubMap = {};
    publicSnap.forEach(d => { pubMap[d.id] = d.data(); });

    return readers.map(r => ({
        uid: r.uid,
        username: r.username,
        displayName: pubMap[r.uid]?.displayName || r.username,
        characterName: pubMap[r.uid]?.characterName || '',
        faction: pubMap[r.uid]?.faction || null
    }));
}

/** ������ �������� (���� ������ users) ��� ������� */
export async function getAccessIndex() {
    const { db } = getFirebase();
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnap.forEach(d => {
        const data = d.data();
        users.push({ uid: d.id, username: data.username, documents: data.documents || [] });
    });

    const pubSnap = await getDocs(collection(db, 'publicPlayers'));
    const pubMap = {};
    pubSnap.forEach(d => { pubMap[d.id] = d.data(); });

    return users.map(u => ({
        ...u,
        displayName: pubMap[u.uid]?.displayName || u.username,
        faction: pubMap[u.uid]?.faction || null
    }));
}
