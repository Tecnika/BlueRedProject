import { createElement } from '../utils/dom.js?v=9';
import { Icon } from './Icon.js?v=9';

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
            attributes: { type: 'button', 'aria-label': 'Удалить' },
            events: { click: (e) => { e.stopPropagation(); onRemove(); } }
        });
        removeBtn.appendChild(Icon({ name: 'close', size: 'sm' }));
        chip.appendChild(removeBtn);
    }

    return chip;
}
