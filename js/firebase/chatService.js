import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit
} from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=27';
import { FACTION_LABELS } from '../utils/profile.js?v=27';

/**
 * Чаты: chats/{id}
 *   type: 'faction' | 'dm' | 'master'
 *   faction, members, playerId, title, lastMessage, lastMessageAt
 * Сообщения: chats/{id}/messages/{msgId}
 */

export function factionChatId(faction) {
    return 'faction_' + faction;
}

export function masterChatId(uid) {
    return 'master_' + uid;
}

export function dmChatId(a, b) {
    return 'dm_' + [a, b].sort().join('_');
}

async function ensureChat(id, data) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'chats', id), {
        ...data,
        createdAt: new Date().toISOString()
    }, { merge: true });
    return id;
}

export async function ensureFactionChat(faction) {
    return ensureChat(factionChatId(faction), {
        type: 'faction',
        faction,
        members: [],
        title: FACTION_LABELS[faction] || faction
    });
}

export async function ensureMasterChat(user) {
    return ensureChat(masterChatId(user.uid), {
        type: 'master',
        playerId: user.uid,
        members: [user.uid],
        title: 'Мастерская'
    });
}

export async function ensureDm(me, other, title) {
    return ensureChat(dmChatId(me.uid, other.uid), {
        type: 'dm',
        members: [me.uid, other.uid],
        title
    });
}

export function subscribeChat(id, callback, onError) {
    const { db } = getFirebase();
    return onSnapshot(doc(db, 'chats', id), snap => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, onError);
}

export function subscribeDmChats(uid, callback, onError) {
    const { db } = getFirebase();
    const q = query(collection(db, 'chats'), where('members', 'array-contains', uid));
    return onSnapshot(q, snap => {
        const list = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.type === 'dm') list.push({ id: d.id, ...data });
        });
        callback(list);
    }, onError);
}

export function subscribeChatsByType(type, callback, onError) {
    const { db } = getFirebase();
    const q = query(collection(db, 'chats'), where('type', '==', type));
    return onSnapshot(q, snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        callback(list);
    }, onError);
}

export function subscribeMessages(chatId, callback, onError) {
    const { db } = getFirebase();
    const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200)
    );
    return onSnapshot(q, snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        callback(list);
    }, onError);
}

export async function sendMessage(chatId, text, author, meta = {}) {
    const { db } = getFirebase();
    const ref = doc(collection(db, 'chats', chatId, 'messages'));
    const payload = {
        authorId: author.uid,
        authorName: author.name,
        faction: author.faction || null,
        text: String(text).trim(),
        createdAt: new Date().toISOString()
    };
    await setDoc(ref, payload);
    await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: { text: payload.text, authorId: author.uid, authorName: author.name },
        lastMessageAt: payload.createdAt
    });

    // Журнал для мастеров: кто, кому, что и когда
    try {
        await logEvent({
            chatId,
            chatType: meta.type || '',
            chatTitle: meta.title || chatId,
            authorId: author.uid,
            authorName: author.name,
            faction: author.faction || null,
            text: payload.text,
            createdAt: payload.createdAt
        });
    } catch (e) { /* журнал не должен ломать отправку */ }
}

/** Запись в журнал мастеров */
export async function logEvent(entry) {
    const { db } = getFirebase();
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await setDoc(doc(db, 'logs', id), {
        ...entry,
        createdAt: entry.createdAt || new Date().toISOString()
    });
}

/** Последние записи журнала (только мастер) */
export async function getRecentLogs(max = 200) {
    const { db } = getFirebase();
    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
}

export async function markRead(uid, chatId, timestamp) {
    const { db } = getFirebase();
    try {
        await updateDoc(doc(db, 'users', uid), { ['lastRead.' + chatId]: timestamp });
    } catch (e) {
        // нет прав/документа — не критично
    }
}
