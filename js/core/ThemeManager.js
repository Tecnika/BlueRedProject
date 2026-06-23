const STORAGE_KEY = 'bluered-theme';
const THEMES = ['purple', 'blue', 'red', 'gray'];

const FACTION_THEME_MAP = {
    red: 'red',
    blue: 'blue',
    purple: 'purple'
};

export class ThemeManager {
    constructor() {
        this.currentTheme = 'purple';
    }

    init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && THEMES.includes(saved)) {
            this.setTheme(saved);
        } else {
            this.setTheme('purple');
        }
    }

    setTheme(theme) {
        if (!THEMES.includes(theme)) return;

        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);

        document.dispatchEvent(
            new CustomEvent('themechange', { detail: { theme } })
        );
    }

    setThemeByFaction(faction) {
        const theme = FACTION_THEME_MAP[faction] || 'gray';
        this.setTheme(theme);
    }

    getTheme() {
        return this.currentTheme;
    }

    getAvailableThemes() {
        return [...THEMES];
    }

    nextTheme() {
        const index = THEMES.indexOf(this.currentTheme);
        const next = (index + 1) % THEMES.length;
        this.setTheme(THEMES[next]);
        return THEMES[next];
    }
}
