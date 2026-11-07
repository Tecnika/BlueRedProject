import { createElement } from '../utils/dom.js?v=13';

const SIZE_CLASS = {
    sm: 'icon--sm',
    md: '',
    lg: 'icon--lg'
};

/**
 * Иконка Material Icons (локальный шрифт).
 * Имя — ligature-код иконки, например: 'menu', 'close', 'arrow_back'.
 */
export function Icon({ name, size = 'md', className = '', label }) {
    return createElement('span', {
        className: ['icon', SIZE_CLASS[size] || '', className].filter(Boolean).join(' '),
        text: name,
        attributes: label
            ? { role: 'img', 'aria-label': label }
            : { 'aria-hidden': 'true' }
    });
}
