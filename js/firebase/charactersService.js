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
import { getFirebase } from './firebase.js?v=21';
import { syncPublicPlayer } from './authService.js?v=21';

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
    // Один фильтр по gameId, выбор игрока — на клиенте (не требует составного индекса)
    const snap = await getDocs(query(collection(db, 'characters'), where('gameId', '==', gameId)));
    const mine = [];
    snap.forEach(d => {
        const character = { id: d.id, ...d.data() };
        if (character.playerId === uid) mine.push(character);
    });

    const active = mine.find(c => c.active === true);
    if (active) return active;

    // Совместимость со старыми персонажами без поля active
    return mine.find(c => c.active === undefined) || null;
}

/** Активен ли персонаж (старые записи без active считаем активными) */
export function isActiveCharacter(character) {
    return character?.active !== false;
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
        variant: data.variant || data.faction || null,
        active: data.active !== false,
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

    // Если персонажа переназначили другому игроку — чистим старую проекцию
    if (current.playerId && data.playerId !== undefined && data.playerId !== current.playerId) {
        await syncPublicPlayer(current.playerId, {
            gameId: current.gameId,
            characterName: '',
            faction: null
        });
    }

    await syncCharacterPublic(next);
}

export async function deleteCharacter(id) {
    const { db } = getFirebase();
    const current = await getCharacter(id);
    await deleteDoc(doc(db, 'characters', id));
    if (current?.playerId && current.active !== false) {
        await syncPublicPlayer(current.playerId, {
            gameId: current.gameId,
            characterName: '',
            faction: null
        });
    }
}

/** Активировать одну из версий персонажа (red/blue) и погасить вторую */
export async function activateCharacterVariant(gameId, playerId, variant) {
    const { db } = getFirebase();
    const all = await getCharactersByGame(gameId);
    const mine = all.filter(c => c.playerId === playerId);
    const target = mine.find(c => (c.variant || c.faction) === variant);
    if (!target) return null;

    for (const character of mine) {
        const active = character.id === target.id;
        if (character.active !== active || (active && character.faction !== variant)) {
            await setDoc(doc(db, 'characters', character.id), {
                active,
                faction: active ? variant : character.faction
            }, { merge: true });
        }
    }

    await syncPublicPlayer(playerId, {
        gameId,
        characterName: target.name || '',
        faction: variant
    });

    return { ...target, active: true, faction: variant };
}

/**
 * Добавить игрока в игру: обычному игроку — красная и синяя версии,
 * мастеру/игротеху — фиолетовая (все мастера и игротехи фиолетовые).
 */
export async function ensurePlayerCharacters(gameId, player) {
    const { db } = getFirebase();
    const all = await getCharactersByGame(gameId);
    const mine = all.filter(c => c.playerId === player.uid);
    const isStaff = player.role === 'master' || player.role === 'igrotech';
    const displayName = player.displayName || player.username || 'Персонаж';

    if (isStaff) {
        let purple = mine.find(c => (c.variant || c.faction) === 'purple');
        for (const character of mine) {
            if (purple && character.id === purple.id) continue;
            if (character.active !== false) {
                await setDoc(doc(db, 'characters', character.id), { active: false }, { merge: true });
            }
        }
        if (!purple) {
            purple = await createCharacter(gameId, {
                playerId: player.uid,
                name: displayName,
                faction: 'purple',
                variant: 'purple',
                active: true
            });
        } else if (purple.active !== true || purple.faction !== 'purple') {
            await setDoc(doc(db, 'characters', purple.id), {
                active: true,
                faction: 'purple',
                variant: 'purple'
            }, { merge: true });
        }

        await syncPublicPlayer(player.uid, {
            gameId,
            characterName: purple.name || '',
            faction: 'purple'
        });
        return { staff: true, purple };
    }

    const findVariant = (name) => mine.find(c => (c.variant || c.faction) === name);
    let red = findVariant('red');
    let blue = findVariant('blue');

    if (!red) {
        red = await createCharacter(gameId, {
            playerId: player.uid,
            name: displayName,
            faction: 'red',
            variant: 'red',
            active: false
        });
    }
    if (!blue) {
        blue = await createCharacter(gameId, {
            playerId: player.uid,
            name: displayName,
            faction: 'blue',
            variant: 'blue',
            active: false
        });
    }

    // Старые персонажи без variant получают свою фракцию как вариант
    for (const character of mine) {
        if (!character.variant && character.faction) {
            await setDoc(doc(db, 'characters', character.id), { variant: character.faction }, { merge: true });
        }
    }

    const hasActive = mine.some(c => c.active === true || c.active === undefined);
    if (!hasActive) {
        await syncPublicPlayer(player.uid, {
            gameId,
            characterName: '',
            faction: null
        });
    }

    return { red, blue };
}

/** Назначает фракцию персонажу (при активации игры) */
export async function assignFaction(id, faction) {
    await updateCharacter(id, { faction: faction || null });
}

/** Синхронизация публичной проекции (без PII) */
async function syncCharacterPublic(character) {
    if (!character?.playerId) return;
    if (character.active === false) return;
    await syncPublicPlayer(character.playerId, {
        gameId: character.gameId,
        characterName: character.name || '',
        faction: character.faction || null
    });
}
