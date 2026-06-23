/**
 * Router — хеш-роутер для SPA.
 *
 * Использует window.location.hash для навигации.
 * Поддерживает query-параметры (разделяются по '?').
 *
 * Пример маршрута: #/profile?uid=abc123
 *   path = '/profile'
 *   query = 'uid=abc123'
 */

export class Router {
    /**
     * @param {HTMLElement} contentRoot — контейнер для рендера страниц
     */
    constructor(contentRoot) {
        this.contentRoot = contentRoot;
        this.routes = {};            // { '/path': renderFn }
        this.currentPath = null;     // Текущий полный путь
        this.beforeHooks = [];       // Хуки перед сменой маршрута
    }

    /** Регистрирует маршрут: path -> функция, возвращающая DOM-элемент */
    register(path, renderFn) {
        this.routes[path] = renderFn;
    }

    /** Добавляет хук, вызываемый перед каждым переходом */
    beforeEach(hook) {
        this.beforeHooks.push(hook);
    }

    /** Переход по хешу */
    navigate(path) {
        window.location.hash = path;
    }

    /** Запускает роутер: слушает hashchange и резолвит текущий путь */
    start() {
        window.addEventListener('hashchange', () => this._resolve());

        if (!window.location.hash) {
            window.location.hash = '#/';
        } else {
            this._resolve();
        }
    }

    /** Разбирает хеш, выполняет хуки и рендерит страницу */
    async _resolve() {
        const fullPath = window.location.hash.slice(1) || '/';
        const path = fullPath.split('?')[0];  // Отделяем query-параметры

        // Выполняем все before-хуки последовательно
        for (const hook of this.beforeHooks) {
            const result = await hook(fullPath, this.currentPath);
            if (result === false) return;  // Хук отменил переход
        }

        const renderFn = this.routes[path];
        if (renderFn) {
            this.currentPath = fullPath;
            this.contentRoot.innerHTML = '';
            const element = await renderFn();
            if (element) {
                this.contentRoot.appendChild(element);
            }
        }
    }
}
