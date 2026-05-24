const HttpService = {
    async head(url) {
        const response = await fetch(url, { method: 'HEAD' });
        return response;
    },
    async getJson(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json();
        return { response, data };
    },
    async postJson(url, payload, options = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            ...options
        });
        const data = await response.json();
        return { response, data };
    }
};

window.HttpService = HttpService;
