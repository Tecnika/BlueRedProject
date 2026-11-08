/**
 * profile — контекст текущего игрока и его персонажа.
 *
 * Новая модель (v0.3):
 *   users/{uid}        — профиль игрока (PII: ФИ, контакт, медданные)
 *   characters/{id}    — персонаж (роль внутри игры)
 *   games/{id}         — игра
 *
 * Активная фракция определяется персонажем в активной игре.
 */

import { store } from '../core/Store.js?v=21';

/** Фракции */
export const FACTIONS = ['red', 'blue', 'purple'];

/** Читаемые названия фракций */
export const FACTION_LABELS = {
    red: 'Красные',
    blue: 'Синие',
    purple: 'Фиолетовые',
    common: 'Общий'
};

/** Активная игра (из store) */
export function getActiveGame() {
    return store.get('activeGame') || null;
}

/** Активный персонаж текущего игрока (из store) */
export function getActiveCharacter() {
    return store.get('character') || null;
}

/** Фракция активного персонажа */
export function getActiveFaction() {
    const user = store.get('user');
    // Все мастера и игротехи — фиолетовые
    if (user && (user.role === 'master' || user.role === 'igrotech')) return 'purple';
    // Аккаунт радиорубки действует как терминал своей фракции
    if (user?.radioFaction) return user.radioFaction;
    const character = getActiveCharacter();
    return character?.faction || null;
}
