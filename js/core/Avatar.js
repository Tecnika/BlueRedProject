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
 * @returns {string} URL SVG-аватарки
 */
export function getAvatarUrl(username, faction) {
    const bgColor = COLORS[faction] || COLORS.none;
    const seed = encodeURIComponent(username || 'user');
    return `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundColor=${bgColor}&backgroundType=gradientLinear&radius=50`;
}
