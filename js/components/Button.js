import { createElement } from '../utils/dom.js?v=27';
import { Icon } from './Icon.js?v=27';

const VARIANT_CLASS = {
    primary: 'btn--primary',
    secondary: 'btn--secondary',
    danger: 'btn--danger'
};

const SIZE_CLASS = {
    sm: 'btn--sm',
    md: 'btn--md',
    lg: 'btn--lg'
};

export function Button({ text, icon, variant = 'primary', size = 'md', disabled = false, loading = false, type = 'button', href, onClick, className = '', attributes = {} }) {
    const classes = ['btn', VARIANT_CLASS[variant] || 'btn--primary', SIZE_CLASS[size] || 'btn--md', className].filter(Boolean).join(' ');
    const attrs = { type: href ? undefined : type, ...attributes };
    if (disabled || loading) attrs.disabled = true;

    const el = createElement(href ? 'a' : 'button', {
        className: classes,
        attributes: { ...attrs, href }
    });

    if (loading) {
        el.textContent = 'Загрузка...';
    } else if (icon) {
        el.appendChild(Icon({ name: icon, size: 'sm' }));
        if (text) el.appendChild(createElement('span', { text }));
    } else if (text) {
        el.textContent = text;
    }

    if (onClick) {
        el.addEventListener('click', onClick);
    }

    return el;
}
