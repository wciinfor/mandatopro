const N8nService = {
    async postJson(url, payload, options = {}) {
        if (!url) {
            throw new Error('Webhook do N8N nao configurado.');
        }

        const timeoutMs = Number(options.timeoutMs || 0);
        const controller = timeoutMs > 0 ? new AbortController() : null;
        const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller ? controller.signal : undefined
            });

            const raw = await response.text();
            if (!raw || !raw.trim()) {
                throw new Error(`Workflow nao respondeu (status ${response.status}). Reimporte o workflow atualizado no N8N.`);
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (error) {
                throw new Error(`Resposta invalida do N8N: ${raw.slice(0, 300)}`);
            }

            return { status: response.status, data };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
};

window.N8nService = N8nService;
