import { createElement } from '../utils/dom.js?v=5';

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

export function Button({ text, variant = 'primary', size = 'md', disabled = false, loading = false, type = 'button', href, onClick, className = '', attributes = {} }) {
    const classes = ['btn', VARIANT_CLASS[variant] || 'btn--primary', SIZE_CLASS[size] || 'btn--md', className].filter(Boolean).join(' ');
    const attrs = { type: href ? undefined : type, ...attributes };
    if (disabled || loading) attrs.disabled = true;

    const el = createElement(href ? 'a' : 'button', {
        className: classes,
        text: loading ? 'Загрузка...' : text,
        attributes: { ...attrs, href }
    });

    if (onClick) {
        el.addEventListener('click', onClick);
    }

    return el;
}
