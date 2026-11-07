import { Button } from './Button.js?v=8';

export function BackButton({ fallback = '#/' }) {
    return Button({
        text: 'Назад',
        icon: 'arrow_back',
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
