export class Router {
    constructor(contentRoot) {
        this.contentRoot = contentRoot;
        this.routes = {};
        this.currentPath = null;
        this.beforeHooks = [];
    }

    register(path, renderFn) {
        this.routes[path] = renderFn;
    }

    beforeEach(hook) {
        this.beforeHooks.push(hook);
    }

    navigate(path) {
        window.location.hash = path;
    }

    start() {
        window.addEventListener('hashchange', () => this._resolve());

        if (!window.location.hash) {
            window.location.hash = '#/';
        } else {
            this._resolve();
        }
    }

    async _resolve() {
        const fullPath = window.location.hash.slice(1) || '/';
        const path = fullPath.split('?')[0];

        for (const hook of this.beforeHooks) {
            const result = await hook(fullPath, this.currentPath);
            if (result === false) return;
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
