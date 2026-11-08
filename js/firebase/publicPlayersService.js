/**
 * publicPlayersService — публичная проекция игроков (без PII).
 *
 * Коллекция 'publicPlayers/{uid}':
 *   { uid, username, displayName, role, gameId, characterName, faction, updatedAt }
 */

import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=27';

export async function getAllPublicPlayers() {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'publicPlayers'));
    const list = [];
    snap.forEach(d => list.push({ uid: d.id, ...d.data() }));
    return list;
}

export async function getPublicPlayer(uid) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'publicPlayers', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
}
