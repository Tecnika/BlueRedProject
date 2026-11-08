/**
 * authService — сервис авторизации через Firebase Auth + Firestore.
 *
 * Особенности:
 *   - Логин/регистрация по username + password
 *   - Email генерируется как username@bluered.project (скрыт от пользователя)
 *   - Профили хранятся в Firestore (коллекция 'users')
 *   - Роли: player (по умолчанию), igrotech, master
 *   - Публичная проекция игрока — коллекция 'publicPlayers' (без PII)
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from 'firebase/firestore';

import { getFirebase } from './firebase.js?v=27';

/** Домен-заглушка для email (Firebase Auth требует email) */
const FAKE_DOMAIN = '@bluered.project';

/** Генерирует email-заглушку из username */
function makeEmail(username) {
    return username.toLowerCase() + FAKE_DOMAIN;
}

/** Отображаемое имя игрока */
export function getPlayerDisplayName(user) {
    if (!user) return '';
    const p = user.player || {};
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || user.username || '';
}

/**
 * Подписывается на изменения статуса авторизации.
 * @param {Function} callback — получает User | null
 */
export function onAuthChange(callback) {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, callback);
}

/** Вход по username + password */
export async function signInWithUsername(username, password) {
    const { auth } = getFirebase();
    return signInWithEmailAndPassword(auth, makeEmail(username), password);
}

/**
 * Регистрация нового обитателя сектора.
 * @param {Object} payload
 * @param {string} payload.username
 * @param {string} payload.password
 * @param {Object} payload.player — { firstName, lastName, contact, emergencyName, emergencyContact, emergencyRelation, allergies, medical }
 */
export async function signUpWithUsername({ username, password, player }) {
    const { auth, db } = getFirebase();
    const key = (username || '').toLowerCase();

    // Проверяем уникальность через публичный реестр позывных (users закрыт правилами)
    const existing = await getDoc(doc(db, 'usernames', key));
    if (existing.exists()) {
        throw new Error('Позывной уже зарегистрирован в системе');
    }

    const email = makeEmail(username);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const data = {
        username,
        email,
        role: 'player',
        player: {
            firstName: (player?.firstName || '').trim(),
            lastName: (player?.lastName || '').trim(),
            contact: (player?.contact || '').trim(),
            emergencyName: (player?.emergencyName || '').trim(),
            emergencyContact: (player?.emergencyContact || '').trim(),
            emergencyRelation: (player?.emergencyRelation || '').trim(),
            allergies: (player?.allergies || '').trim(),
            medical: (player?.medical || '').trim()
        },
        games: [],
        decryptions: { red: 0, blue: 0, purple: 0 },
        decryptedDocs: [],
        documents: [],
        createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', uid), data);

    // Публичный реестр позывных (для проверки уникальности без доступа к users)
    await setDoc(doc(db, 'usernames', key), { uid, createdAt: data.createdAt });

    // Публичная проекция (без PII) — её видят другие игроки
    await setDoc(doc(db, 'publicPlayers', uid), {
        uid,
        username,
        displayName: getPlayerDisplayName(data),
        role: 'player',
        updatedAt: data.createdAt
    });

    return credential;
}

/**
 * Меняет роль игрока (только player/igrotech; права мастера не выдаются).
 * @param {string} uid
 * @param {'player'|'igrotech'} role
 */
export async function setRadioRoom(uid, faction) {
    const value = faction || null;
    await updateUserProfile(uid, { radioFaction: value });
    // Публичная проекция: по ней список фракции исключает терминалы радиорубок
    await syncPublicPlayer(uid, { radioFaction: value });
}

export async function setUserRole(uid, role) {
    if (!['player', 'igrotech'].includes(role)) {
        throw new Error('Недопустимая роль');
    }
    await updateUserProfile(uid, { role });
    // Синхронизируем публичную проекцию (роль отображается в списках)
    await syncPublicPlayer(uid, { role });
}

/**
 * Читает профиль пользователя из Firestore.
 * @param {string} uid
 * @returns {Object|null}
 */
export async function getUserProfile(uid) {
    const { db } = getFirebase();
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}

/** Обновляет поля профиля в Firestore */
export async function updateUserProfile(uid, data) {
    const { db } = getFirebase();
    await updateDoc(doc(db, 'users', uid), data);
}

/**
 * Синхронизирует публичную проекцию игрока (позывной, имя, роль, персонаж).
 * @param {string} uid
 * @param {Object} patch — { username, displayName, role, gameId, characterName, faction }
 */
export async function syncPublicPlayer(uid, patch) {
    const { db } = getFirebase();
    await setDoc(doc(db, 'publicPlayers', uid), {
        uid,
        ...patch,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/** Выход из аккаунта */
export async function signOutUser() {
    const { auth } = getFirebase();
    return signOut(auth);
}
