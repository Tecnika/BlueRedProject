/**
 * Инициализация Firebase
 *
 * Конфиг загружается из data/firebase.json (не хранится в коде).
 * После первого вызова initFirebase() экземпляры кешируются.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';

let app = null;
let auth = null;
let db = null;

/**
 * Загружает конфиг из JSON и инициализирует Firebase.
 * Безопасно вызывать повторно — не инициализирует заново.
 */
export async function initFirebase() {
    if (app) return { app, auth, db };

    const response = await fetch('data/firebase.json');
    const config = await response.json();

    app = initializeApp(config);
    auth = getAuth(app);

    // Офлайн-кеш Firestore (IndexedDB). Если браузер не поддерживает — обычный режим.
    try {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    } catch (err) {
        console.warn('Офлайн-кеш Firestore недоступен:', err);
        db = getFirestore(app);
    }

    return { app, auth, db };
}

/**
 * Возвращает инициализированные экземпляры Firebase.
 * Кидает ошибку, если initFirebase() не был вызван.
 */
export function getFirebase() {
    if (!app) {
        throw new Error('Firebase not initialized. Call initFirebase() first.');
    }
    return { app, auth, db };
}
