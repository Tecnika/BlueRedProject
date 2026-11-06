import { createElement } from '../utils/dom.js?v=4';
import { Button } from './Button.js?v=4';

export function BackButton({ fallback = '#/' }) {
    return Button({
        text: '← Назад',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
            if (document.referrer && document.referrer !== window.location.href) {
                window.history.back();
            } else {
                window.location.hash = fallback;
            }
        }
    });
}
