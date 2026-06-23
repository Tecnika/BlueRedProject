class Store {
    constructor(initial = {}) {
        this._state = { ...initial };
        this._listeners = {};
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        this._state[key] = value;
        this._emit(key, value);
    }

    subscribe(key, callback) {
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(callback);
        return () => {
            this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
        };
    }

    _emit(key, value) {
        if (this._listeners[key]) {
            for (const cb of this._listeners[key]) {
                cb(value);
            }
        }
    }
}

export const store = new Store({
    user: null,
    isAuthReady: false
});
