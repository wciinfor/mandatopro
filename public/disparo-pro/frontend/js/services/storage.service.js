const StorageService = {
    getLocal(key, fallback = null) {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    },
    setLocal(key, value) {
        localStorage.setItem(key, String(value));
    },
    removeLocal(key) {
        localStorage.removeItem(key);
    },
    clearLocal() {
        localStorage.clear();
    },
    getSession(key, fallback = null) {
        const value = sessionStorage.getItem(key);
        return value === null ? fallback : value;
    },
    setSession(key, value) {
        sessionStorage.setItem(key, String(value));
    },
    removeSession(key) {
        sessionStorage.removeItem(key);
    },
    clearSession() {
        sessionStorage.clear();
    },
    getLocalJson(key, fallback = null) {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return this.safeParseJson(raw, fallback);
    },
    setLocalJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    getSessionJson(key, fallback = null) {
        const raw = sessionStorage.getItem(key);
        if (raw === null) return fallback;
        return this.safeParseJson(raw, fallback);
    },
    setSessionJson(key, value) {
        sessionStorage.setItem(key, JSON.stringify(value));
    },
    safeParseJson(raw, fallback = null) {
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    },
    getAutoSaveInfo() {
        if (typeof AutoSaveManager !== 'undefined' && typeof AutoSaveManager.getStorageInfo === 'function') {
            return AutoSaveManager.getStorageInfo();
        }

        return {
            exists: false,
            contacts: 0,
            messages: 0,
            sizeKB: 0
        };
    }
};

window.StorageService = StorageService;
