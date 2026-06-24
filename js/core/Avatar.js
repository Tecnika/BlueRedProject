/**
 * Avatar — генерация URL для DiceBear-аватарок.
 *
 * Стиль: personas (люди).
 * Цвет фона — по фракции, seed — по имени пользователя.
 * Результат: стабильная уникальная аватарка без загрузки файлов.
 */

/** Цвета фона для каждой фракции (hex без #) */
const COLORS = {
    purple: '7c3aed',
    blue: '2563eb',
    red: 'dc2626',
    none: '6b7280'
};

/**
 * @param {string} username — для генерации уникального seed
 * @param {string} faction — определяет цвет фона
 * @returns {string} URL SVG-аватарки (DiceBear)
 */
export function getAvatarUrl(username, faction) {
    const bgColor = COLORS[faction] || COLORS.none;
    const seed = encodeURIComponent(username || 'user');
    return `https://api.dicebear.com/10.x/personas/svg?seed=${seed}&backgroundColor=${bgColor}&backgroundType=gradientLinear&radius=50`;
}

/**
 * Запасной URL (ui-avatars) — если DiceBear не отвечает.
 * @param {string} username
 * @param {string} faction
 * @returns {string}
 */
export function getFallbackAvatarUrl(username, faction) {
    const bg = COLORS[faction] || COLORS.none;
    const name = encodeURIComponent(username || '?');
    return `https://ui-avatars.com/api/?name=${name}&background=${bg}&color=fff&rounded=true&bold=true&size=128`;
}
