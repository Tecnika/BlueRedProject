import { createElement } from '../utils/dom.js?v=2';

export function ThemeToggle(themeManager) {
    const themes = themeManager.getAvailableThemes();
    const current = themeManager.getTheme();
    const label = getThemeLabel(current);

    const button = createElement('button', {
        className: 'theme-toggle',
        text: label,
        attributes: { type: 'button', title: 'Сменить тему' },
        dataset: { theme: current },
        events: {
            click: () => {
                const next = themeManager.nextTheme();
                button.textContent = getThemeLabel(next);
                button.dataset.theme = next;
            }
        }
    });

    document.addEventListener('themechange', (e) => {
        button.textContent = getThemeLabel(e.detail.theme);
        button.dataset.theme = e.detail.theme;
    });

    return button;
}

function getThemeLabel(theme) {
    const labels = {
        purple: 'Фи',
        blue: 'Си',
        red: 'Кр',
        gray: 'Се'
    };
    return labels[theme] || theme;
}
