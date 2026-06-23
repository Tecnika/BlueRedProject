/**
 * Store — простое реактивное хранилище (pub/sub).
 *
 * Позволяет компонентам подписываться на изменения ключей.
 * Замена глобальным переменным.
 *
 * Пример:
 *   store.get('user')        // читаем
 *   store.set('user', data)  // пишем, оповещаем подписчиков
 *   store.subscribe('user', fn)  // подписываемся
 */

class Store {
    constructor(initial = {}) {
        this._state = { ...initial };
        this._listeners = {};      // { key: [callback, ...] }
    }

    /** Читает значение по ключу */
    get(key) {
        return this._state[key];
    }

    /** Записывает значение и оповещает подписчиков */
    set(key, value) {
        this._state[key] = value;
        this._emit(key, value);
    }

    /**
     * Подписывается на изменения ключа.
     * @returns {Function} — функция отписки
     */
    subscribe(key, callback) {
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(callback);
        return () => {
            this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
        };
    }

    /** Внутренний вызов всех подписчиков ключа */
    _emit(key, value) {
        if (this._listeners[key]) {
            for (const cb of this._listeners[key]) {
                cb(value);
            }
        }
    }
}

/** Единственный экземпляр хранилища на всё приложение */
export const store = new Store({
    user: null,             // Текущий пользователь { uid, username, role, ... }
    isAuthReady: false      // Флаг, что onAuthChange отработал
});
