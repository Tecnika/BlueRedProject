import { createElement } from '../utils/dom.js?v=21';
import { FACTION_LABELS } from '../utils/profile.js?v=21';

export function FactionBadge({ faction, size = 'md' }) {
    const label = FACTION_LABELS[faction] || faction || '—';
    return createElement('span', {
        className: `badge badge--${faction || 'none'} badge--${size}`,
        text: label
    });
}
