/**
 * cipher — языковой шифр фракций.
 *
 * Каждый символ кириллицы заменяется символом другого языка:
 *   - Синие      → хирагана
 *   - Красные    → катакана
 *   - Фиолетовые → корейский (хангыль)
 *
 * Пробелы, цифры, пунктуация и латиница не меняются.
 * Порядок сопоставления — русский алфавит (33 буквы).
 */

/** Русский алфавит (33 буквы) */
const CYR = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

/** Алфавиты фракций (по 33 символа, в порядке русского алфавита)
 *  Хирагана и катакана — фиксированно перемешанные наборы,
 *  фиолетовые — слоги хангыля из 4 джамо (например 값, 닭).
 */
export const FACTION_ALPHABETS = {
    blue: 'せひにむけさおいのてちとまくすえきねたほつなみふそうしこはかぬへあ',
    red: 'ネイタトアミノソフエウサスケムカシクハヒセキホヘコオツナチニヌマテ',
    purple: '맓핉칪뺡뷗젒쌿퐶굵팙믃뺇팏먪쓂핺궋딵뼩잲쥖뺉쨿읁셅푻넶톪롟툖흷왋삺'
};

/** Читаемые названия языков */
export const LANGUAGE_LABELS = {
    blue: 'Хирагана',
    red: 'Катакана',
    purple: 'Корейский'
};

/** Пары «кириллица → символ» для справки/таблицы */
export function getAlphabetPairs(faction) {
    const alphabet = FACTION_ALPHABETS[faction] || '';
    return CYR.split('').map((letter, index) => ({
        letter,
        symbol: alphabet[index] || ''
    }));
}

/** Пороги изучения языка */
export const LANGUAGE_THRESHOLDS = { half: 4, full: 10 };

/**
 * Зашифровать текст алфавитом фракции.
 * @param {string} text
 * @param {'red'|'blue'|'purple'} faction
 */
export function encryptToFaction(text, faction) {
    const alphabet = FACTION_ALPHABETS[faction];
    if (!alphabet) return text || '';
    return (text || '').split('').map(ch => {
        const idx = CYR.indexOf(ch.toLowerCase());
        return idx === -1 ? ch : alphabet[idx];
    }).join('');
}

/** Расшифровать текст (символы языка → кириллица). Обратная операция к encryptToFaction. */
export function decryptFromFaction(text, faction) {
    const alphabet = FACTION_ALPHABETS[faction];
    if (!alphabet) return text || '';
    return (text || '').split('').map(ch => {
        const idx = alphabet.indexOf(ch);
        return idx === -1 ? ch : CYR[idx];
    }).join('');
}

/** Детерминированный хэш строки (FNV-1a + финализатор) для выбора открытых букв */
function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return h >>> 0;
}

/**
 * Частично раскрыть текст: часть букв открыта, остальные зашифрованы.
 * Выбор открытых букв детерминирован (стабилен при перезагрузке).
 * @param {string} plain — исходный текст
 * @param {'red'|'blue'|'purple'} faction
 * @param {string} docId — идентификатор файла (для стабильного выбора)
 * @param {number} fraction — доля открытых букв (0..1)
 */
export function revealPartial(plain, faction, docId, fraction) {
    const text = plain || '';
    if (fraction >= 1) return text;
    if (fraction <= 0) return encryptToFaction(text, faction);

    const cipher = encryptToFaction(text, faction);
    return text.split('').map((ch, i) => {
        const isLetter = CYR.includes(ch.toLowerCase());
        if (!isLetter) return ch;
        return hashString(docId + ':' + i) % 100 < Math.round(fraction * 100) ? ch : cipher[i];
    }).join('');
}

/**
 * Текст для показа с учётом прогресса изучения языка.
 * @param {string} plain — исходный текст
 * @param {'red'|'blue'|'purple'} faction — язык файла
 * @param {string} docId
 * @param {number} count — количество расшифровок языка
 */
export function renderCipher(plain, faction, docId, count = 0) {
    if (count >= LANGUAGE_THRESHOLDS.full) return plain || '';
    if (count >= LANGUAGE_THRESHOLDS.half) return revealPartial(plain, faction, docId, 0.5);
    return encryptToFaction(plain, faction);
}

/** Нормализация текста для сверки расшифровки */
export function normalizeForCompare(text) {
    return (text || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
}
