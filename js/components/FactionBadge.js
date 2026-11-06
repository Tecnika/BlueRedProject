import { createElement } from '../utils/dom.js?v=4';

const FACTION_LABELS = { red: 'Красные', blue: 'Синие', purple: 'Фиолетовые', common: 'Общий' };

export function FactionBadge({ faction, size = 'md' }) {
    const label = FACTION_LABELS[faction] || faction || '—';
    return createElement('span', {
        className: `badge badge--${faction || 'none'} badge--${size}`,
        text: label
    });
}
