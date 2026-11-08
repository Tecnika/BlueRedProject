import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=26';

/** Базовый каталог профессий: используется в персонажах и радиорубке */
const INITIAL_PROFESSIONS = [
    'Инженер',
    'Связист',
    'Дипломат',
    'Хакер',
    'Медик',
    'Пилот',
    'Навигатор',
    'Штурман',
    'Офицер безопасности',
    'Учёный',
    'Техник',
    'Аналитик',
    'Логист',
    'Курьер',
    'Переговорщик',
    'Куратор'
];

/** Каталог профессий: professions/{id} → { name } */

export async function getAllProfessions() {
    const { db } = getFirebase();
    const snap = await getDocs(query(collection(db, 'professions'), orderBy('name', 'asc')));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
}

/** Заполнить каталог профессий, если он пуст */
export async function seedInitialProfessions() {
    const { db } = getFirebase();
    const snapshot = await getDocs(query(collection(db, 'professions'), limit(1)));
    if (!snapshot.empty) return;

    for (const name of INITIAL_PROFESSIONS) {
        const id = 'prof_' + name.toLowerCase().replace(/\s+/g, '_');
        await setDoc(doc(db, 'professions', id), {
            name,
            createdAt: new Date().toISOString()
        });
    }
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
