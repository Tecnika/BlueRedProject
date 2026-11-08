import { collection, getDocs } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=21';

/**
 * Технические учётки радиорубок.
 * techAccounts/{faction} → { faction, label, username, password, uid, updatedAt }
 *
 * Пароли хранятся в открытом виде: коллекция читается только мастерами.
 */

const FACTION_ORDER = ['red', 'blue', 'purple'];

export async function getTechAccounts() {
    const { db } = getFirebase();
    const snap = await getDocs(collection(db, 'techAccounts'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
        const ai = FACTION_ORDER.indexOf(a.faction);
        const bi = FACTION_ORDER.indexOf(b.faction);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    return list;
}
