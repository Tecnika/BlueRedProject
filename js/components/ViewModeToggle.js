import { createElement } from '../utils/dom.js?v=25';
import { store } from '../core/Store.js?v=25';

const STORAGE_KEY = 'bluered_view_mode';

/** Текущий режим просмотра: 'admin' | 'player' */
export function getViewMode() {
    return localStorage.getItem(STORAGE_KEY) === 'player' ? 'player' : 'admin';
}

/** Мастер в режиме админа (видит всё) */
export function isAdminMode(user) {
    return Boolean(user && user.role === 'master' && getViewMode() === 'admin');
}

/** Восстановить режим при старте приложения */
export function initViewMode() {
    store.set('viewMode', getViewMode());
}

/**
 * Переключатель «Игрок / Админ». Возвращает null для не-мастеров.
 * После переключения перерисовывает текущую страницу.
 */
export function ViewModeToggle(user) {
    if (!user || user.role !== 'master') return null;

    const wrap = createElement('div', { className: 'view-mode', attributes: { role: 'group', 'aria-label': 'Режим просмотра' } });

    const modes = [
        { value: 'player', label: 'Игрок' },
        { value: 'admin', label: 'Админ' }
    ];

    const buttons = [];

    function apply(mode, persist = true) {
        if (persist) localStorage.setItem(STORAGE_KEY, mode);
        store.set('viewMode', mode);
        buttons.forEach(btn => btn.classList.toggle('view-mode__btn--active', btn.dataset.mode === mode));
        if (persist) window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    for (const mode of modes) {
        const btn = createElement('button', {
            className: 'view-mode__btn' + (getViewMode() === mode.value ? ' view-mode__btn--active' : ''),
            text: mode.label,
            attributes: { type: 'button', 'data-mode': mode.value, 'aria-pressed': getViewMode() === mode.value },
            events: {
                click: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    apply(mode.value);
                }
            }
        });
        buttons.push(btn);
        wrap.appendChild(btn);
    }

    return wrap;
}
