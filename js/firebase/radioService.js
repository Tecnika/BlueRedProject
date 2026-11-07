import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    onSnapshot
} from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=10';
import { FACTION_LABELS } from '../utils/profile.js?v=10';
import { logEvent } from './chatService.js?v=10';

/** Сессия радиорубки: radioSessions/{roomUid} */
export function sessionRef(roomUid) {
    const { db } = getFirebase();
    return doc(db, 'radioSessions', roomUid);
}

export function subscribeSession(roomUid, callback, onError) {
    return onSnapshot(sessionRef(roomUid), snap => {
        callback(snap.exists() ? snap.data() : {});
    }, onError);
}

export async function getSession(roomUid) {
    const snap = await getDoc(sessionRef(roomUid));
    return snap.exists() ? snap.data() : {};
}

/**
 * Выдать доступ специалисту.
 * role: 'engineer' | 'signalman'
 */
export async function grantAccess(roomUid, role, user, { minutes = 20, hacked = false } = {}) {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await setDoc(sessionRef(roomUid), {
        [role]: {
            uid: user.uid,
            name: user.name,
            expiresAt,
            hacked
        },
        updatedAt: new Date().toISOString()
    }, { merge: true });

    await logEvent({
        chatTitle: 'Радиорубка',
        authorId: user.uid,
        authorName: user.name,
        text: `${hacked ? 'ВЗЛОМ: ' : ''}доступ «${role}» выдан до ${expiresAt}`
    });
}

export async function setChannel(roomUid, channelId, recipientCode) {
    await setDoc(sessionRef(roomUid), {
        channelId,
        recipientCode,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

export async function addTrace(roomUid, amount) {
    const session = await getSession(roomUid);
    const trace = Math.min(100, (session.trace || 0) + amount);
    await setDoc(sessionRef(roomUid), { trace, updatedAt: new Date().toISOString() }, { merge: true });
    return trace;
}

export async function clearSession(roomUid) {
    await setDoc(sessionRef(roomUid), {
        engineer: null,
        signalman: null,
        channelId: null,
        recipientCode: null,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/* ---------- коды получателя ---------- */

function randomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createRecipientCode(owner, faction, hours = 3) {
    const { db } = getFirebase();
    let code = randomCode();
    for (let i = 0; i < 20; i++) {
        const exists = await getDoc(doc(db, 'radioCodes', code));
        if (!exists.exists()) break;
        code = randomCode();
    }
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await setDoc(doc(db, 'radioCodes', code), {
        code,
        ownerId: owner.uid,
        ownerName: owner.name,
        faction: faction || null,
        expiresAt,
        createdAt: new Date().toISOString()
    });
    return { code, expiresAt };
}

export async function getRecipientCode(code) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'radioCodes', String(code)));
    return snap.exists() ? snap.data() : null;
}

export async function listRecipientCodes() {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'radioCodes'));
    const list = [];
    snap.forEach(d => list.push(d.data()));
    return list;
}

export function isCodeValid(code) {
    return Boolean(code && code.expiresAt && new Date(code.expiresAt).getTime() > Date.now());
}

/* ---------- межфракционный канал ---------- */

export function crossChatId(f1, f2) {
    return 'cross_' + [f1, f2].sort().join('_');
}

export async function ensureCrossChat(radioFaction, targetFaction) {
    const { db } = getFirebase();
    const id = crossChatId(radioFaction, targetFaction);
    await setDoc(doc(db, 'chats', id), {
        type: 'cross',
        factions: [radioFaction, targetFaction].sort(),
        members: [],
        title: `Связь: ${FACTION_LABELS[radioFaction] || radioFaction} ↔ ${FACTION_LABELS[targetFaction] || targetFaction}`,
        createdAt: new Date().toISOString()
    }, { merge: true });
    return id;
}

export async function findTargetFaction(code) {
    if (!code) return null;
    if (code.faction) return code.faction;
    if (code.ownerId) {
        const { db } = getFirebase();
        const snap = await getDoc(doc(db, 'publicPlayers', code.ownerId));
        if (snap.exists()) return snap.data().faction || null;
    }
    return null;
}
