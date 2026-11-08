import { createElement } from '../utils/dom.js?v=28';

export function StatusMessage({ type = 'err', text = '', hidden = false }) {
    const msg = createElement('p', {
        className: `msg msg--${type}`,
        text,
        attributes: {
            role: type === 'err' ? 'alert' : 'status',
            'aria-live': type === 'err' ? 'assertive' : 'polite'
        }
    });
    if (hidden) msg.style.display = 'none';
    return msg;
}

export function showMessage(msg, text, type = 'ok') {
    msg.textContent = text;
    msg.className = `msg msg--${type}`;
    msg.style.display = 'block';
}

/**
 * Показать сообщение с HTML-содержимым (для ссылок и разметки).
 */
export function showMessageHTML(msg, html, type = 'ok') {
    msg.innerHTML = html;
    msg.className = `msg msg--${type}`;
    msg.style.display = 'block';
}

export function hideMessage(msg) {
    msg.style.display = 'none';
}
