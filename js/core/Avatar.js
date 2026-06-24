/**
 * Avatar — генерация URL для аватарок через ui-avatars.com.
 *
 * Формат: инициалы пользователя на цветном фоне фракции.
 * Результат: стабильная уникальная аватарка без загрузки файлов.
 */

/** Цвета фона для каждой фракции (hex) */
const COLORS = {
    purple: '7c3aed',
    blue: '2563eb',
    red: 'dc2626',
    none: '6b7280'
};

/**
 * @param {string} username — отображается на аватарке
 * @param {string} faction — определяет цвет фона
 * @returns {string} URL PNG-аватарки
 */
export function getAvatarUrl(username, faction) {
    const bg = COLORS[faction] || COLORS.none;
    const name = encodeURIComponent(username || '?');
    return `https://ui-avatars.com/api/?name=${name}&background=${bg}&color=fff&rounded=true&bold=true&size=128`;
}
