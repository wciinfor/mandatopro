/**
 * InboxApi — camada de acesso à API REST do inbox.
 * Todos os métodos retornam a resposta completa { success, data, error, meta }.
 * Depende de: window.ApiService
 */
const InboxApi = (() => {
  async function _wid() {
    return ApiService.getWorkspaceId();
  }

  function _qs(params) {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    const s = new URLSearchParams(clean).toString();
    return s ? `?${s}` : '';
  }

  return {
    /**
     * Lista conversas do workspace com filtros opcionais.
     * @param {Object} params — status, assigned_to, search, limit, cursor
     */
    async listConversations(params = {}) {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/conversations${_qs(params)}`);
    },

    /**
     * Retorna detalhes de uma conversa + últimas 50 mensagens.
     * @param {string} id — conversation ID
     */
    async getConversation(id) {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/conversations/${id}`);
    },

    /**
     * Lista mensagens paginadas (cursor-based).
     * @param {string} id — conversation ID
     * @param {string|null} before — ISO timestamp (cursor)
     * @param {number} limit — default 50
     */
    async getMessages(id, before = null, limit = 50) {
      const wid = await _wid();
      return ApiService.request(
        'GET',
        `/api/v1/workspaces/${wid}/inbox/conversations/${id}/messages${_qs({ before, limit })}`,
      );
    },

    /**
     * Envia mensagem de texto em uma conversa.
     * @param {string} id — conversation ID
     * @param {string} text — conteúdo
     * @param {string|null} replyToId — message ID para resposta (opcional)
     */
    async sendMessage(id, text, replyToId = null) {
      const wid = await _wid();
      const body = { text };
      if (replyToId) body.reply_to_message_id = replyToId;
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/messages`, body);
    },

    /**
     * Atualiza status de uma conversa.
     * @param {string} id — conversation ID
     * @param {'open'|'pending'|'waiting'|'closed'} status
     */
    async updateStatus(id, status) {
      const wid = await _wid();
      return ApiService.request('PATCH', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/status`, { status });
    },

    /**
     * Auto-atribuição da conversa ao agente logado.
     * @param {string} id — conversation ID
     */
    async assignToMe(id) {
      const wid = await _wid();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/assign-me`);
    },

    /**
     * Atribui conversa a outro agente (requer admin/owner).
     * @param {string} id — conversation ID
     * @param {string} agentId — ID do agente destino
     */
    async assign(id, agentId) {
      const wid = await _wid();
      return ApiService.request('PATCH', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/assign`, { agent_id: agentId });
    },

    /**
     * Marca conversa como lida (zerando unread_count).
     * @param {string} id — conversation ID
     */
    async markRead(id) {
      const wid = await _wid();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/read`);
    },

    // ── Fase 2 ────────────────────────────────────────────────

    /**
     * Transfere conversa para outro agente (ou desatribui se toAgentId = null).
     * @param {string} id — conversation ID
     * @param {string|null} toAgentId
     * @param {string} [note] — nota opcional exibida como msg de sistema
     */
    async transfer(id, toAgentId, note = '') {
      const wid = await _wid();
      const body = { toAgentId };
      if (note?.trim()) body.note = note.trim();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/conversations/${id}/transfer`, body);
    },

    /**
     * Retorna totais de não-lidas do workspace e do agente logado.
     */
    async getUnreadSummary() {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/unread-summary`);
    },

    /**
     * Lista agentes ativos do workspace (para seletor de transferência).
     */
    async listAgents() {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/agents`);
    },

    // ── Fase 3 — Busca, soft-delete, labels, quick replies ────

    /**
     * Busca full-text em mensagens do workspace.
     * @param {string} q — termo de busca
     * @param {number} [page]
     * @param {number} [limit]
     */
    async searchMessages(q, page = 1, limit = 20) {
      const wid = await _wid();
      return ApiService.request(
        'GET',
        `/api/v1/workspaces/${wid}/inbox/conversations/search${_qs({ q, page, limit })}`,
      );
    },

    /**
     * Soft-delete de uma mensagem (is_deleted = true, conteúdo apagado).
     * @param {string} convId — conversation ID
     * @param {string} msgId  — message ID
     */
    async deleteMessage(convId, msgId) {
      const wid = await _wid();
      return ApiService.request(
        'DELETE',
        `/api/v1/workspaces/${wid}/inbox/conversations/${convId}/messages/${msgId}`,
      );
    },

    // ── Labels do workspace (catálogo) ─────────────────────────

    /** Lista todas as labels do workspace. */
    async listLabels() {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/labels`);
    },

    /**
     * Cria nova label.
     * @param {{ name: string, color?: string }} body
     */
    async createLabel(body) {
      const wid = await _wid();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/labels`, body);
    },

    /**
     * Edita label (admin+).
     * @param {string} id
     * @param {{ name?: string, color?: string }} body
     */
    async updateLabel(id, body) {
      const wid = await _wid();
      return ApiService.request('PATCH', `/api/v1/workspaces/${wid}/inbox/labels/${id}`, body);
    },

    /**
     * Remove label (admin+).
     * @param {string} id
     */
    async deleteLabel(id) {
      const wid = await _wid();
      return ApiService.request('DELETE', `/api/v1/workspaces/${wid}/inbox/labels/${id}`);
    },

    // ── Labels de uma conversa ─────────────────────────────────

    /**
     * Lista labels aplicadas a uma conversa.
     * @param {string} convId
     */
    async getConversationLabels(convId) {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/conversations/${convId}/labels`);
    },

    /**
     * Aplica label a uma conversa.
     * @param {string} convId
     * @param {string} labelId
     */
    async addLabel(convId, labelId) {
      const wid = await _wid();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/conversations/${convId}/labels`, { labelId });
    },

    /**
     * Remove label de uma conversa.
     * @param {string} convId
     * @param {string} labelId
     */
    async removeLabel(convId, labelId) {
      const wid = await _wid();
      return ApiService.request('DELETE', `/api/v1/workspaces/${wid}/inbox/conversations/${convId}/labels/${labelId}`);
    },

    // ── Quick Replies ──────────────────────────────────────────

    /**
     * Lista respostas rápidas ativas.
     * @param {string} [search] — filtra por shortcut/title/body
     */
    async listQuickReplies(search) {
      const wid = await _wid();
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/quick-replies${_qs({ search })}`);
    },

    /**
     * Cria nova resposta rápida.
     * @param {{ shortcut: string, title: string, body: string, category?: string }} body
     */
    async createQuickReply(body) {
      const wid = await _wid();
      return ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/quick-replies`, body);
    },

    /**
     * Edita resposta rápida.
     * @param {string} id
     * @param {Object} body
     */
    async updateQuickReply(id, body) {
      const wid = await _wid();
      return ApiService.request('PATCH', `/api/v1/workspaces/${wid}/inbox/quick-replies/${id}`, body);
    },

    /**
     * Remove resposta rápida (admin+).
     * @param {string} id
     */
    async deleteQuickReply(id) {
      const wid = await _wid();
      return ApiService.request('DELETE', `/api/v1/workspaces/${wid}/inbox/quick-replies/${id}`);
    },

    // ── Fase 4 — Mídia ──────────────────────────────────────────

    /**
     * Faz upload de um arquivo de mídia para uma conversa.
     * Retorna { attachment, signedUrl } para preview imediato.
     * @param {string} conversationId
     * @param {File} file  — objeto File do input[type=file]
     * @returns {Promise<{ success: boolean, data: { attachment, signedUrl } }>}
     */
    async uploadMedia(conversationId, file) {
      const wid = await _wid();
      const formData = new FormData();
      formData.append('file', file);

      const token = await ApiService.getAuthToken?.() ?? null;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/v1/workspaces/${wid}/inbox/conversations/${conversationId}/media`,
        { method: 'POST', headers, body: formData },
      );
      return res.json();
    },

    /**
     * Envia mídia já upada para o contato via Evolution.
     * @param {string} conversationId
     * @param {string} attachmentId
     * @param {string} [caption]
     */
    async sendMedia(conversationId, attachmentId, caption) {
      const wid = await _wid();
      return ApiService.request(
        'POST',
        `/api/v1/workspaces/${wid}/inbox/conversations/${conversationId}/media/${attachmentId}/send`,
        { caption: caption ?? undefined },
      );
    },

    /**
     * Obtém URL assinada temporária para renderizar ou baixar um attachment.
     * @param {string} attachmentId
     * @param {boolean} [forDownload=false]  — true para TTL maior (documentos)
     */
    async getMediaUrl(attachmentId, forDownload = false) {
      const wid = await _wid();
      const qs  = forDownload ? '?download=true' : '';
      return ApiService.request('GET', `/api/v1/workspaces/${wid}/inbox/media/${attachmentId}/url${qs}`);
    },

    // ── Fase 5 — IA Assistiva ─────────────────────────────────

    /** Solicita análise IA da conversa (enfileira job assíncrono). */
    async requestAiAnalysis(conversationId) {
      const wid = await _wid();
      return ApiService.request(
        'POST',
        `/api/v1/workspaces/${wid}/inbox/conversations/${conversationId}/ai/analyze`,
      );
    },

    /** Retorna a análise IA atual da conversa. */
    async getAiAnalysis(conversationId) {
      const wid = await _wid();
      return ApiService.request(
        'GET',
        `/api/v1/workspaces/${wid}/inbox/conversations/${conversationId}/ai`,
      );
    },
  };
})();

window.InboxApi = InboxApi;
