/**
 * gamesService — CRUD для игр.
 *
 * Коллекция 'games':
 *   { name, status: 'draft'|'active'|'finished', startDate, createdBy, createdAt }
 *
 * Активная игра — та, у которой status === 'active'.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=10';
import { store } from '../core/Store.js?v=10';

export async function getAllGames() {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'games'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getGame(id) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'games', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createGame(data) {
    const { db } = getFirebase();
    const user = store.get('user');
    const id = `game_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
        name: data.name || 'Без названия',
        status: 'draft',
        startDate: data.startDate || '',
        createdBy: user?.uid || '',
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'games', id), payload);
    return { id, ...payload };
}

export async function updateGame(id, data) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'games', id), data, { merge: true });
}

export async function deleteGame(id) {
    const { db } = getFirebase();
    await deleteDoc(doc(db, 'games', id));
}

/**
 * Активирует игру: выбранная становится 'active', прочие активные — 'draft'.
 */
export async function activateGame(id) {
    const { db } = getFirebase();
    const all = await getAllGames();
    for (const game of all) {
        if (game.id === id) {
            await setDoc(doc(db, 'games', id), { status: 'active' }, { merge: true });
        } else if (game.status === 'active') {
            await setDoc(doc(db, 'games', game.id), { status: 'draft' }, { merge: true });
        }
    }
}

/** Завершает игру */
export async function finishGame(id) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'games', id), { status: 'finished' }, { merge: true });
}

/** Возвращает активную игру (или null) */
export async function getActiveGame() {
    const { db } = getFirebase();
    const snap = await getDocs(query(collection(db, 'games'), where('status', '==', 'active')));
    let active = null;
    snap.forEach(d => {
        const g = { id: d.id, ...d.data() };
        if (!active || (g.createdAt || '') > (active.createdAt || '')) active = g;
    });
    return active;
}
