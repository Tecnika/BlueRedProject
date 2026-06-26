/**
 * Avatar — создание элемента аватарки.
 *
 * Приоритет:
 *   1. Пытаемся загрузить DiceBear (personas)
 *   2. Если не загрузился за 3 сек — показываем ui-avatars (инициалы)
 */

import { createElement } from '../utils/dom.js?v=3';

const COLORS = {
    purple: '7c3aed',
    blue: '2563eb',
    red: 'dc2626',
    none: '6b7280'
};

function bgColor(faction) {
    return COLORS[faction] || COLORS.none;
}

/** DiceBear URL */
function dicebearUrl(username, faction, gender) {
    let seed = encodeURIComponent(username || 'user');
    if (gender === 'male') seed += '_m';
    else if (gender === 'female') seed += '_f';
    return `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundColor=${bgColor(faction)}&backgroundType=gradientLinear&radius=50`;
}

/** ui-avatars URL (запасной) */
function fallbackUrl(username, faction) {
    const name = encodeURIComponent(username || '?');
    return `https://ui-avatars.com/api/?name=${name}&background=${bgColor(faction)}&color=fff&rounded=true&bold=true&size=128`;
}

/**
 * Создать <img> с аватаркой.
 * Сразу ставим ui-avatars, параллельно пробуем DiceBear.
 * Если DiceBear загрузился — заменяем src.
 */
export function createAvatar(username, faction, className, gender) {
    const img = createElement('img', {
        className,
        attributes: { alt: username || 'avatar' }
    });

    // Сразу показываем запасной вариант (инициалы)
    img.src = fallbackUrl(username, faction);

    // Пробуем загрузить DiceBear
    const test = new Image();
    test.onload = () => { img.src = test.src; };
    test.onerror = () => { /* остаётся fallback */ };
    test.src = dicebearUrl(username, faction, gender);

    // Таймаут 3 сек — если DiceBear не ответил, остаётся fallback
    setTimeout(() => {
        if (!test.complete || test.naturalWidth === 0) {
            test.src = ''; /* отменяем */
        }
    }, 3000);

    return img;
}
