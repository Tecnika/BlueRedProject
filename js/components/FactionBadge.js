import { createElement } from '../utils/dom.js?v=12';
import { FACTION_LABELS } from '../utils/profile.js?v=12';

export function FactionBadge({ faction, size = 'md' }) {
    const label = FACTION_LABELS[faction] || faction || '—';
    return createElement('span', {
        className: `badge badge--${faction || 'none'} badge--${size}`,
        text: label
    });
}
