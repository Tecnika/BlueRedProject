import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';

import { getFirebase } from './firebase.js';

export function onAuthChange(callback) {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, callback);
}

export async function signUp(email, password) {
    const { auth } = getFirebase();
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email, password) {
    const { auth } = getFirebase();
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
    const { auth } = getFirebase();
    return signOut(auth);
}
