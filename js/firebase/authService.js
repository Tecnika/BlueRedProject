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
    getDoc
} from 'firebase/firestore';

import { getFirebase } from './firebase.js';

export function onAuthChange(callback) {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, callback);
}

export async function signInWithUsername(username, password) {
    const { auth, db } = getFirebase();

    const snapshot = await getDocs(
        query(collection(db, 'users'), where('username', '==', username))
    );

    if (snapshot.empty) {
        throw new Error('Пользователь не найден');
    }

    const userData = snapshot.docs[0].data();
    return signInWithEmailAndPassword(auth, userData.email, password);
}

export async function signUpWithUsername(username, email, password) {
    const { auth, db } = getFirebase();

    const existing = await getDocs(
        query(collection(db, 'users'), where('username', '==', username))
    );

    if (!existing.empty) {
        throw new Error('Имя пользователя уже занято');
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, 'users', credential.user.uid), {
        username,
        email,
        role: 'user',
        createdAt: new Date().toISOString()
    });

    return credential;
}

export async function getUserProfile(uid) {
    const { db } = getFirebase();
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? snapshot.data() : null;
}

export async function signOutUser() {
    const { auth } = getFirebase();
    return signOut(auth);
}
