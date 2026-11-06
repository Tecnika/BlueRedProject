import { createElement } from '../utils/dom.js?v=4';

const VARIANT_PREFIX = {
    lang: 'chip--lang-',
    access: 'chip--access-',
    faction: 'chip--faction-',
    default: 'chip--'
};

export function Chip({ text, variant = 'default', color, removable = false, onRemove }) {
    const varClass = color ? (VARIANT_PREFIX[variant] || 'chip--') + color : '';
    const chip = createElement('span', {
        className: `chip ${varClass}`.trim(),
        text
    });

    if (removable && onRemove) {
        const removeBtn = createElement('button', {
            className: 'chip__remove',
            text: '✕',
            attributes: { type: 'button', 'aria-label': 'Удалить' },
            events: { click: (e) => { e.stopPropagation(); onRemove(); } }
        });
        chip.appendChild(removeBtn);
    }

    return chip;
}
