// =============================================================
// DISPARO PRO — API SERVICE
// Camada de abstração para a API Layer própria.
//
// ESTRATÉGIA DE MIGRAÇÃO GRADUAL:
//   • Se API_BASE_URL estiver configurada → usa a API própria
//   • Se não estiver configurada → usa N8N/Supabase direto (legado)
//   • Cada método documenta o fallback que executa
//
// Todas as respostas seguem o padrão: { success, data, error, meta }
// =============================================================

const ApiService = {
    _baseUrl: '',
    _workspaceId: null,

    // ── Inicialização ───────────────────────────────────────────
    init() {
        const raw = typeof getAppEnv === 'function'
            ? getAppEnv('API_BASE_URL')
            : (window.APP_ENV && window.APP_ENV.API_BASE_URL) || '';

        // Remover barra final para evitar paths duplos
        this._baseUrl = (raw || '').replace(/\/$/, '');

        if (this._baseUrl) {
            console.log('[ApiService] API Layer configurada:', this._baseUrl);
        } else {
            console.info('[ApiService] API_BASE_URL não configurada — usando fallback N8N/Supabase.');
        }
    },

    // ── Utilitários ─────────────────────────────────────────────

    /** Retorna true se a API Layer está configurada. */
    isConfigured() {
        return !!this._baseUrl;
    },

    /** Retorna o JWT da sessão Supabase atual, ou null se não autenticado. */
    async getToken() {
        try {
            if (!window.SupabaseClient) return null;
            const { data: { session } } = await window.SupabaseClient.auth.getSession();
            return session?.access_token || null;
        } catch {
            return null;
        }
    },

    /**
     * Define o workspaceId manualmente.
     * Chamado durante o login após o perfil ser carregado.
     */
    setWorkspaceId(id) {
        this._workspaceId = id;
    },

    /**
     * Resolve o workspaceId ativo.
     * Ordem de prioridade:
     *   1. this._workspaceId (setado explicitamente)
     *   2. AppState.currentWorkspaceId (se existir)
     *   3. Busca no perfil do usuário (users_profiles.default_workspace_id)
     */
    async getWorkspaceId() {
        if (this._workspaceId) return this._workspaceId;

        if (window.AppState?.currentWorkspaceId) {
            this._workspaceId = window.AppState.currentWorkspaceId;
            return this._workspaceId;
        }

        try {
            const token = await this.getToken();
            if (!token || !window.SupabaseClient) return null;

            const { data: { session } } = await window.SupabaseClient.auth.getSession();
            if (!session?.user?.id) return null;

            const { data } = await window.SupabaseClient
                .from('users_profiles')
                .select('default_workspace_id')
                .eq('id', session.user.id)
                .maybeSingle();

            if (data?.default_workspace_id) {
                this._workspaceId = data.default_workspace_id;
            }
        } catch (err) {
            console.warn('[ApiService] Falha ao buscar workspaceId:', err.message);
        }

        return this._workspaceId;
    },

    // ── Requisição base ─────────────────────────────────────────

    /**
     * Executa uma requisição autenticada na API Layer.
     * Retorna `data` do payload { success, data, error, meta }.
     * Lança um Error descritivo em caso de falha.
     */
    async request(method, path, body = null) {
        if (!this._baseUrl) {
            throw new Error('[ApiService] API_BASE_URL não configurada.');
        }

        const token = await this.getToken();
        if (!token) {
            throw new Error('[ApiService] Sessão expirada ou usuário não autenticado.');
        }

        const workspaceId = await this.getWorkspaceId();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
        if (workspaceId) {
            headers['x-workspace-id'] = workspaceId;
        }

        const opts = { method, headers };
        if (body !== null) {
            opts.body = JSON.stringify(body);
        }

        const url = `${this._baseUrl}${path}`;
        const res = await fetch(url, opts);

        let json;
        try {
            json = await res.json();
        } catch {
            throw new Error(`[ApiService] Resposta não-JSON (HTTP ${res.status}) em ${path}`);
        }

        // Verificar formato { success, data, error, meta }
        if (Object.prototype.hasOwnProperty.call(json, 'success')) {
            if (!json.success) {
                const apiErr = new Error(json.error?.message || `Erro HTTP ${res.status} em ${path}`);
                apiErr.code    = json.error?.code;
                apiErr.details = json.error?.details;
                apiErr.meta    = json.meta;
                throw apiErr;
            }
            return json.data;
        }

        // Resposta raw (health check, etc.)
        if (!res.ok) {
            throw new Error(`[ApiService] HTTP ${res.status} em ${path}`);
        }
        return json;
    },

    // ── Health ──────────────────────────────────────────────────

    async healthCheck() {
        if (!this.isConfigured()) return { status: 'unconfigured' };
        try {
            const data = await this.request('GET', '/health');
            return data;
        } catch (err) {
            console.warn('[ApiService] Health check falhou:', err.message);
            return { status: 'error', message: err.message };
        }
    },

    // ── Instâncias ──────────────────────────────────────────────

    /**
     * Lista instâncias do workspace.
     * Fallback: Supabase direto via SupabaseClient (legado).
     */
    async listInstances() {
        if (!this.isConfigured()) {
            return this._fallbackListInstances();
        }
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para listInstances.');
        return this.request('GET', `/api/v1/workspaces/${wid}/instances`);
    },

    /**
     * Busca uma instância pelo ID com status em tempo real (Evolution).
     * Sem fallback local — use apenas quando a API estiver configurada.
     */
    async getInstance(instanceId) {
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para getInstance.');
        return this.request('GET', `/api/v1/workspaces/${wid}/instances/${instanceId}`);
    },

    /**
     * Busca QR Code de uma instância desconectada.
     * Sem fallback — use após verificar isConfigured().
     */
    async getInstanceQrCode(instanceId) {
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para getInstanceQrCode.');
        return this.request('GET', `/api/v1/workspaces/${wid}/instances/${instanceId}/qrcode`);
    },

    /**
     * Desconecta (logout) uma instância.
     */
    async logoutInstance(instanceId) {
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para logoutInstance.');
        return this.request('DELETE', `/api/v1/workspaces/${wid}/instances/${instanceId}/logout`);
    },

    // ── Campanhas ───────────────────────────────────────────────

    /**
     * Lista campanhas do workspace com paginação.
     * @param {Object} params - { page, limit, status }
     */
    async listCampaigns(params = {}) {
        if (!this.isConfigured()) return null; // caller lida com fallback
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para listCampaigns.');
        const qs = new URLSearchParams(
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
        ).toString();
        return this.request('GET', `/api/v1/workspaces/${wid}/campaigns${qs ? '?' + qs : ''}`);
    },

    /**
     * Busca uma campanha pelo ID (inclui mensagens).
     */
    async getCampaign(campaignId) {
        if (!this.isConfigured()) return null;
        const wid = await this.getWorkspaceId();
        if (!wid) throw new Error('[ApiService] Workspace não resolvido para getCampaign.');
        return this.request('GET', `/api/v1/workspaces/${wid}/campaigns/${campaignId}`);
    },

    /**
     * Inicia uma campanha — enfileira disparo via BullMQ.
     * Fallback: chama N8N via N8nService se API não configurada.
     */
    async startCampaign(campaignId) {
        if (this.isConfigured()) {
            const wid = await this.getWorkspaceId();
            if (!wid) throw new Error('[ApiService] Workspace não resolvido para startCampaign.');
            return this.request('POST', `/api/v1/workspaces/${wid}/campaigns/${campaignId}/start`);
        }
        // Fallback N8N
        return this._fallbackCampaignAction('start', campaignId);
    },

    /**
     * Pausa uma campanha em execução.
     * Fallback: N8N.
     */
    async pauseCampaign(campaignId) {
        if (this.isConfigured()) {
            const wid = await this.getWorkspaceId();
            if (!wid) throw new Error('[ApiService] Workspace não resolvido para pauseCampaign.');
            return this.request('POST', `/api/v1/workspaces/${wid}/campaigns/${campaignId}/pause`);
        }
        return this._fallbackCampaignAction('pause', campaignId);
    },

    // ── Billing ─────────────────────────────────────────────────
    //
    // FASE 1 (atual): billing ainda vai via N8N.
    // FASE 2: criar endpoint /api/v1/billing/charges e substituir aqui.
    // O objetivo é que billing.js não acesse N8nService diretamente.

    /**
     * Gera cobrança no Asaas via N8N (Fase 1).
     * @returns {Object} dados retornados pelo N8N (paymentId, invoiceUrl, etc.)
     */
    async createBillingCharge(payload) {
        // TODO Fase 2: if (this.isConfigured()) return this.request('POST', '/api/v1/billing/charges', payload);
        const webhook = this._getBillingWebhook();
        if (!webhook) throw new Error('N8N_WEBHOOK_ASAAS_BILLING não configurado.');
        const res = await window.N8nService.postJson(webhook, {
            action: 'criar_cobranca',
            ...payload,
        });
        return res.data;
    },

    /**
     * Cancela cobranças de um usuário no Asaas via N8N (Fase 1).
     */
    async cancelUserBillingCharges(userId) {
        // TODO Fase 2: if (this.isConfigured()) return this.request('DELETE', `/api/v1/billing/charges?userId=${userId}`);
        const webhook = this._getBillingWebhook();
        if (!webhook) throw new Error('N8N_WEBHOOK_ASAAS_BILLING não configurado.');
        const res = await window.N8nService.postJson(webhook, {
            action: 'cancelar_por_usuario',
            userId,
        });
        return res.data;
    },

    // ── Fallbacks internos (privados) ───────────────────────────

    /** Lê o webhook de billing de ENV (admin.js injeta em window.ENV). */
    _getBillingWebhook() {
        return (window.ENV && window.ENV.N8N_WEBHOOK_ASAAS_BILLING) || '';
    },

    /** Fallback de listInstances via Supabase direto. */
    async _fallbackListInstances() {
        const client = window.SupabaseClient || window.SupabaseService?.getClient();
        if (!client) return [];
        const { data: { session } } = await client.auth.getSession();
        if (!session?.user?.id) return [];
        const { data } = await client
            .from('instances')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
        return data || [];
    },

    /** Fallback de ações de campanha via N8N. */
    async _fallbackCampaignAction(action, campaignId) {
        const webhookUrl = (typeof WEBHOOK_URL !== 'undefined') ? WEBHOOK_URL : '';
        if (!webhookUrl) {
            throw new Error('N8N não configurado e API_BASE_URL ausente. Configure ao menos um dos dois.');
        }
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: `campanha_${action}`, campaignId }),
        });
        return res.json();
    },
};

window.ApiService = ApiService;

// Auto-inicializar após carregamento do DOM
(function () {
    function _init() { ApiService.init(); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();
