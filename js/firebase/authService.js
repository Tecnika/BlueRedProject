/**
 * authService — сервис авторизации через Firebase Auth + Firestore.
 *
 * Особенности:
 *   - Логин/регистрация по username + password
 *   - Email генерируется как username@bluered.project (скрыт от пользователя)
 *   - Профили хранятся в Firestore (коллекция 'users')
 *   - Роли: player (по умолчанию), igrotech, master
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc
} from 'firebase/firestore';

import { getFirebase } from './firebase.js?v=3';

/** Домен-заглушка для email (Firebase Auth требует email) */
const FAKE_DOMAIN = '@bluered.project';

/** Генерирует email-заглушку из username */
function makeEmail(username) {
    return username.toLowerCase() + FAKE_DOMAIN;
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
 * Регистрация нового пользователя.
 * Проверяет уникальность username в Firestore.
 * Создаёт запись в коллекции 'users' с ролью 'player'.
 */
export async function signUpWithUsername(username, password) {
    const { auth, db } = getFirebase();

    // Проверяем, не занят ли username
    const existing = await getDocs(
        query(collection(db, 'users'), where('username', '==', username))
    );

    if (!existing.empty) {
        throw new Error('Имя пользователя уже занято');
    }

    const email = makeEmail(username);
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Создаём профиль в Firestore
    await setDoc(doc(db, 'users', credential.user.uid), {
        username,
        email,
        role: 'player',           // Роль по умолчанию
        faction: '',               // Фракция не выбрана
        worldview: '',             // Мировоззрение
        about: '',                 // О себе
        accessTags: [],            // Теги доступа (видны всем)
        hiddenTags: [],            // Скрытые теги
        factionAccessTags: [],      // Технические субтеги (только мастера)
        createdAt: new Date().toISOString()
    });

    return credential;
}

/**
 * Читает профиль пользователя из Firestore.
 * @param {string} uid
 * @returns {Object|null} — { uid, username, role, faction, ... } или null
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

/** Выход из аккаунта */
export async function signOutUser() {
    const { auth } = getFirebase();
    return signOut(auth);
}
