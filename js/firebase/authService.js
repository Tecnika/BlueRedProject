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

import { getFirebase } from './firebase.js';

const FAKE_DOMAIN = '@bluered.project';

function makeEmail(username) {
    return username.toLowerCase() + FAKE_DOMAIN;
}

export function onAuthChange(callback) {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, callback);
}

export async function signInWithUsername(username, password) {
    const { auth } = getFirebase();
    return signInWithEmailAndPassword(auth, makeEmail(username), password);
}

export async function signUpWithUsername(username, password) {
    const { auth, db } = getFirebase();

    const existing = await getDocs(
        query(collection(db, 'users'), where('username', '==', username))
    );

    if (!existing.empty) {
        throw new Error('Имя пользователя уже занято');
    }

    const email = makeEmail(username);
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, 'users', credential.user.uid), {
        username,
        email,
        role: 'player',
        faction: '',
        worldview: '',
        about: '',
        accessTags: [],
        hiddenTags: [],
        createdAt: new Date().toISOString()
    });

    return credential;
}

export async function getUserProfile(uid) {
    const { db } = getFirebase();
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}

export async function updateUserProfile(uid, data) {
    const { db } = getFirebase();
    await updateDoc(doc(db, 'users', uid), data);
}

export async function signOutUser() {
    const { auth } = getFirebase();
    return signOut(auth);
}
