import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=3';

const SETTINGS_PATH = 'settings/design';

export async function getDesign() {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, SETTINGS_PATH));
    return snap.exists() ? snap.data().version || 'v1' : 'v1';
}

export async function setDesign(version) {
    const { db } = getFirebase();
    await setDoc(doc(db, SETTINGS_PATH), { version });
}

export function subscribeDesign(callback) {
    const { db } = getFirebase();
    return onSnapshot(doc(db, SETTINGS_PATH),
        (snap) => callback(snap.exists() ? snap.data().version || 'v1' : 'v1'),
        (err) => {
            console.warn('design: fallback to v1', err.code);
            callback('v1');
        }
    );
}
