/**
 * charactersService — CRUD для персонажей.
 *
 * Коллекция 'characters':
 *   { gameId, playerId, name, profession, age, worldview, about,
 *     languages, accessTags, hiddenTags, factionAccessTags,
 *     faction: null|'red'|'blue'|'purple', createdAt }
 *
 * Персонаж создаётся без фракции; фракция назначается при активации игры.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getFirebase } from './firebase.js?v=4';
import { syncPublicPlayer } from './authService.js?v=4';

export async function getCharactersByGame(gameId) {
    const { db } = getFirebase();
    const snap = await getDocs(query(collection(db, 'characters'), where('gameId', '==', gameId)));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
}

export async function getCharacter(id) {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'characters', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Персонаж конкретного игрока в игре (первый найденный) */
export async function getCharacterForPlayer(gameId, uid) {
    const { db } = getFirebase();
    const snap = await getDocs(query(
        collection(db, 'characters'),
        where('gameId', '==', gameId),
        where('playerId', '==', uid)
    ));
    let found = null;
    snap.forEach(d => { if (!found) found = { id: d.id, ...d.data() }; });
    return found;
}

export async function createCharacter(gameId, data) {
    const { db } = getFirebase();
    const id = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
        gameId,
        playerId: data.playerId || null,
        name: data.name || '',
        profession: data.profession || '',
        age: data.age ?? null,
        worldview: data.worldview || '',
        about: data.about || '',
        languages: data.languages || [],
        accessTags: data.accessTags || [],
        hiddenTags: data.hiddenTags || [],
        factionAccessTags: data.factionAccessTags || [],
        faction: data.faction || null,
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'characters', id), payload);
    await syncCharacterPublic(payload);
    return { id, ...payload };
}

export async function updateCharacter(id, data) {
    const { db } = getFirebase();
    const current = await getCharacter(id);
    if (!current) return;
    const next = { ...current, ...data };
    await setDoc(doc(db, 'characters', id), data, { merge: true });
    await syncCharacterPublic(next);
}

export async function deleteCharacter(id) {
    const { db } = getFirebase();
    const current = await getCharacter(id);
    await deleteDoc(doc(db, 'characters', id));
    if (current?.playerId) {
        await syncPublicPlayer(current.playerId, {
            gameId: current.gameId,
            characterName: '',
            faction: null
        });
    }
}

/** Назначает фракцию персонажу (при активации игры) */
export async function assignFaction(id, faction) {
    await updateCharacter(id, { faction: faction || null });
}

/** Синхронизация публичной проекции (без PII) */
async function syncCharacterPublic(character) {
    if (!character?.playerId) return;
    await syncPublicPlayer(character.playerId, {
        gameId: character.gameId,
        characterName: character.name || '',
        faction: character.faction || null
    });
}
