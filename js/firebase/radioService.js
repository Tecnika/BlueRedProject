import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    onSnapshot
} from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=28';
import { FACTION_LABELS } from '../utils/profile.js?v=28';
import { logEvent } from './chatService.js?v=28';

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
 * Если в рубке стоит подмена другого игрока, настоящий специалист раскрывает её (+40 следа).
 */
export async function grantAccess(roomUid, role, user, { minutes = 20, hacked = false } = {}) {
    const roleLabel = role === 'engineer' ? 'Инженер' : role === 'signalman' ? 'Связист' : role;
    const session = await getSession(roomUid);
    const current = session[role];
    const exposesHack = Boolean(current && current.hacked && current.uid !== user.uid);

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
        text: `${hacked ? 'ВЗЛОМ: ' : ''}доступ «${roleLabel}» выдан до ${expiresAt}`
    });

    if (exposesHack) {
        const trace = await addTrace(roomUid, 40, { uid: user.uid, name: user.name });
        await logEvent({
            chatTitle: 'Радиорубка',
            authorId: user.uid,
            authorName: user.name,
            text: `тревога: раскрыта подмена «${roleLabel}» (+40 следа, всего ${trace}/100)`
        });
    }
}

export async function setChannel(roomUid, channelId, recipientCode) {
    await setDoc(sessionRef(roomUid), {
        channelId,
        recipientCode,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

export async function addTrace(roomUid, amount, actor = null) {
    const session = await getSession(roomUid);
    const base = effectiveTrace(session);
    const trace = Math.min(100, base + amount);
    const now = new Date().toISOString();
    await setDoc(sessionRef(roomUid), {
        trace,
        traceUpdatedAt: now,
        discovered: trace >= 100,
        updatedAt: now
    }, { merge: true });

    // На 100 мастер должен узнать об обнаружении рубки (один раз при переходе порога)
    if (trace >= 100 && base < 100 && actor) {
        try {
            await logEvent({
                chatTitle: 'Радиорубка',
                authorId: actor.uid,
                authorName: actor.name,
                text: `Радиорубка обнаружена: след 100/100 (комната ${roomUid})`
            });
        } catch (e) { /* журнал не должен ломать механику */ }
    }
    return trace;
}

/** След с учётом восстановления: −10 за каждый полный час без взломов */
export function effectiveTrace(session) {
    const base = Number(session?.trace || 0);
    if (!session?.traceUpdatedAt) return base;
    const age = Date.now() - new Date(session.traceUpdatedAt).getTime();
    if (!Number.isFinite(age) || age <= 0) return base;
    const hours = Math.floor(age / (60 * 60 * 1000));
    return Math.max(0, base - hours * 10);
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
