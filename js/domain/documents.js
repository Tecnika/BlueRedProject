/**
 * domain/documents — правила файлов: уровни, доступ, отображение.
 *
 * Каждая версия файла — отдельная запись с общим `number`:
 *   { number, faction, level: 'truth'|'official'|'propaganda', content, accessKey }
 *
 * Уровни самостоятельные:
 *   - propaganda не открывает ничего;
 *   - official — обычный доступ;
 *   - truth открывает и official той же фракции (и только его).
 */

import { renderCipher, LANGUAGE_THRESHOLDS } from '../utils/cipher.js?v=18';

/** Доступные уровни текста */
export const LEVELS = ['truth', 'official', 'propaganda'];

/** Подписи уровней */
export const LEVEL_LABELS = {
    truth: 'Правда',
    official: 'Официальная версия',
    propaganda: 'Пропаганда'
};

/** Фракции файлов (включая «Общий») */
export const DOC_FACTIONS = ['red', 'blue', 'purple', 'common'];

/** Теги персонажа, дающие доступ к «Правде» фракции */
export const TRUTH_TAGS = {
    red: ['правда_к', 'правда_red'],
    blue: ['правда_с', 'правда_blue'],
    purple: ['правда_ф', 'правда_purple'],
    common: ['правда_общий', 'правда_common']
};

/** Есть ли у персонажа гриф «Правда» на фракцию */
export function hasTruthTag(character, faction) {
    const tags = [
        ...(character?.accessTags || []),
        ...(character?.hiddenTags || [])
    ].map(t => String(t).toLowerCase());
    return (TRUTH_TAGS[faction] || []).some(tag => tags.includes(tag));
}

/** Есть ли прямой доступ к версии (выдача, QR или гриф «Правда») */
export function isVersionAccessible(version, user, character) {
    if (!user || !version) return false;
    if (version.faction === 'common') return true;
    if (user.role === 'master') return true;
    if ((user.documents || []).includes(version.id)) return true;
    if (version.level === 'truth' && hasTruthTag(character, version.faction)) return true;
    return false;
}

/** Все версии, доступные зрителю (с учётом «Правда → Официальная» того же номера) */
export function getAccessibleVersions(versions, user, character) {
    if (!user) return [];
    if (user.role === 'master') return [...versions].sort(sortVersions);

    // Для каждого номера файла: у каких фракций зритель видит «Правду»
    const truthByNumber = new Map();
    for (const version of versions) {
        if (version.level !== 'truth') continue;
        if (!isVersionAccessible(version, user, character)) continue;
        const key = version.number;
        if (!truthByNumber.has(key)) truthByNumber.set(key, new Set());
        truthByNumber.get(key).add(version.faction);
    }

    const accessible = versions.filter(version =>
        isVersionAccessible(version, user, character)
        || (version.level === 'official'
            && truthByNumber.get(version.number)?.has(version.faction))
    );

    return accessible.sort(sortVersions);
}

/** Языки, которые зритель знает: своя фракция + языки персонажа + изученные */
export function getKnownLanguages(character, decryptions) {
    const known = new Set();
    if (character?.faction) known.add(character.faction);
    for (const lang of character?.languages || []) known.add(lang);
    for (const [lang, count] of Object.entries(decryptions || {})) {
        if (count >= LANGUAGE_THRESHOLDS.full) known.add(lang);
    }
    return known;
}

/** Что показывать в блоке версии */
export function getVersionView(version, viewerFaction, decryptions, isMaster = false, character = null) {
    const language = version.faction === 'common' ? null : version.faction;
    const count = language ? (decryptions?.[language] || 0) : 0;

    if (isMaster || version.faction === 'common') {
        return { text: version.content || '', encrypted: false, language, count };
    }

    const known = getKnownLanguages(character, decryptions);
    if (known.has(version.faction)) {
        return { text: version.content || '', encrypted: false, language, count };
    }

    return {
        text: renderCipher(version.content || '', version.faction, version.id, count),
        encrypted: true,
        language,
        count
    };
}

/** Сортировка версий: по фракции, затем по уровню */
export function sortVersions(a, b) {
    const factionDiff = DOC_FACTIONS.indexOf(a.faction) - DOC_FACTIONS.indexOf(b.faction);
    if (factionDiff !== 0) return factionDiff;
    return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
}

/** Сгруппировать версии по номеру файла */
export function groupByNumber(versions) {
    const map = new Map();
    for (const version of versions) {
        const key = version.number || '—';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(version);
    }
    for (const list of map.values()) list.sort(sortVersions);
    return map;
}
