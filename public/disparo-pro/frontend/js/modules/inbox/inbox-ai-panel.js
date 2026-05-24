/**
 * InboxAiPanel — Fase 5
 * Painel lateral de IA assistiva na conversa.
 *
 * Responsabilidades:
 *  - Renderizar análise de IA (classificação, prioridade, resumo, sentimento, lead score, sugestões)
 *  - Botão "Reanalisar"
 *  - Botão "Usar sugestão" (insere no composer, NUNCA envia automaticamente)
 *  - Polling enquanto status = pending/processing
 *
 * Dependências: window.InboxApi, window.MessageComposer (opcional)
 */
const InboxAiPanel = (() => {
  // ── Estado ───────────────────────────────────────────────────

  let _panel          = null;   // elemento DOM #inbox-ai-panel
  let _conversationId = null;
  let _pollTimer      = null;
  let _polling        = false;

  const POLL_INTERVAL_MS = 3_000;
  const MAX_POLL_ROUNDS  = 40;   // ~2 min máximo

  // ── Helpers de escape ─────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Badges de categoria / prioridade / sentimento ────────────

  const CATEGORY_LABELS = {
    vendas:       'Vendas',
    suporte:      'Suporte',
    financeiro:   'Financeiro',
    cancelamento: 'Cancelamento',
    reclamacao:   'Reclamação',
    spam:         'Spam',
    outros:       'Outros',
  };

  const PRIORITY_CLASS = {
    baixa:   'badge-priority--baixa',
    media:   'badge-priority--media',
    alta:    'badge-priority--alta',
    urgente: 'badge-priority--urgente',
  };

  const PRIORITY_LABELS = {
    baixa:   '⬇ Baixa',
    media:   '➡ Média',
    alta:    '⬆ Alta',
    urgente: '🔴 Urgente',
  };

  const SENTIMENT_CLASS = {
    positivo: 'badge-sentiment--positivo',
    neutro:   'badge-sentiment--neutro',
    negativo: 'badge-sentiment--negativo',
  };

  const SENTIMENT_LABELS = {
    positivo: '😊 Positivo',
    neutro:   '😐 Neutro',
    negativo: '😠 Negativo',
  };

  // ── Render ───────────────────────────────────────────────────

  function _renderLoading() {
    return `
      <div class="ai-panel-loading">
        <div class="ai-panel-spinner"></div>
        <p>Analisando conversa...</p>
      </div>
    `;
  }

  function _renderEmpty() {
    return `
      <div class="ai-panel-empty">
        <p>Nenhuma análise disponível.</p>
        <p class="ai-panel-hint">Clique em <strong>Analisar</strong> para gerar insights sobre esta conversa.</p>
      </div>
    `;
  }

  function _renderFailed(errorMsg) {
    return `
      <div class="ai-panel-failed">
        <p>⚠️ Falha na análise.</p>
        <p class="ai-panel-error-msg">${_esc(errorMsg || 'Erro desconhecido.')}</p>
      </div>
    `;
  }

  function _scoreBar(score) {
    const pct     = Math.max(0, Math.min(100, score ?? 0));
    const cls     = pct >= 80 ? 'score-bar--hot'
                  : pct >= 60 ? 'score-bar--warm'
                  : pct >= 40 ? 'score-bar--mid'
                  : 'score-bar--cold';
    return `
      <div class="score-bar-track">
        <div class="score-bar-fill ${_esc(cls)}" style="width:${pct}%"></div>
      </div>
    `;
  }

  function _renderSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) return '';
    const items = suggestions.map((s, i) => `
      <div class="ai-suggestion-item">
        <p class="ai-suggestion-text">${_esc(s)}</p>
        <button class="btn btn-sm ai-use-suggestion-btn"
                data-action="use-suggestion"
                data-index="${i}"
                title="Inserir no campo de mensagem">
          ✏️ Usar sugestão
        </button>
      </div>
    `).join('');
    return `
      <section class="ai-section">
        <h4 class="ai-section-title">💬 Sugestões de resposta</h4>
        <div class="ai-suggestions-list">${items}</div>
        <p class="ai-suggestions-disclaimer">As sugestões nunca são enviadas automaticamente.</p>
      </section>
    `;
  }

  function _renderAnalysis(a) {
    const catLabel  = CATEGORY_LABELS[a.category]  ?? '—';
    const priLabel  = PRIORITY_LABELS[a.priority]  ?? '—';
    const priClass  = PRIORITY_CLASS[a.priority]   ?? '';
    const senLabel  = SENTIMENT_LABELS[a.sentiment] ?? '—';
    const senClass  = SENTIMENT_CLASS[a.sentiment]  ?? '';

    const keyPoints = Array.isArray(a.key_points) && a.key_points.length > 0
      ? `<ul class="ai-key-points">${a.key_points.map((p) => `<li>${_esc(p)}</li>`).join('')}</ul>`
      : '';

    const analyzedAt = a.analyzed_at
      ? `<span class="ai-meta-time" title="${_esc(a.analyzed_at)}">
           Analisado ${_formatRelative(a.analyzed_at)}
         </span>`
      : '';

    return `
      <!-- Classificação + Prioridade -->
      <section class="ai-section ai-section--header">
        <div class="ai-badges-row">
          <span class="badge badge-category">${_esc(catLabel)}</span>
          <span class="badge badge-priority ${_esc(priClass)}">${_esc(priLabel)}</span>
          <span class="badge badge-sentiment ${_esc(senClass)}">${_esc(senLabel)}</span>
        </div>
        ${analyzedAt}
      </section>

      <!-- Intenção -->
      ${a.main_intent ? `
        <section class="ai-section">
          <h4 class="ai-section-title">🎯 Intenção</h4>
          <p class="ai-text">${_esc(a.main_intent)}</p>
        </section>
      ` : ''}

      <!-- Resumo -->
      ${a.summary ? `
        <section class="ai-section">
          <h4 class="ai-section-title">📋 Resumo</h4>
          <p class="ai-text">${_esc(a.summary)}</p>
          ${keyPoints}
        </section>
      ` : ''}

      <!-- Próxima ação -->
      ${a.next_action ? `
        <section class="ai-section ai-section--next-action">
          <h4 class="ai-section-title">▶ Próxima ação sugerida</h4>
          <p class="ai-text ai-next-action">${_esc(a.next_action)}</p>
        </section>
      ` : ''}

      <!-- Lead Score -->
      ${a.lead_score !== null && a.lead_score !== undefined ? `
        <section class="ai-section">
          <h4 class="ai-section-title">⭐ Lead Score
            <span class="ai-lead-score-value">${a.lead_score}/100</span>
          </h4>
          ${_scoreBar(a.lead_score)}
          ${a.lead_score_reason ? `<p class="ai-text ai-text--sm">${_esc(a.lead_score_reason)}</p>` : ''}
        </section>
      ` : ''}

      <!-- Sugestões -->
      ${_renderSuggestions(a.suggestions)}
    `;
  }

  // ── Render do painel completo ─────────────────────────────────

  function _renderPanel(analysis) {
    let body = '';

    if (!analysis) {
      body = _renderEmpty();
    } else if (analysis.status === 'pending' || analysis.status === 'processing') {
      body = _renderLoading();
    } else if (analysis.status === 'failed') {
      body = _renderFailed(analysis.error_message);
    } else {
      body = _renderAnalysis(analysis);
    }

    const isLoading = analysis && (analysis.status === 'pending' || analysis.status === 'processing');

    return `
      <div class="ai-panel-inner">
        <div class="ai-panel-topbar">
          <span class="ai-panel-title">✨ Assistente IA</span>
          <button class="btn btn-sm ai-analyze-btn ${isLoading ? 'btn-disabled' : ''}"
                  data-action="ai-analyze"
                  ${isLoading ? 'disabled' : ''}
                  title="Solicitar nova análise">
            ${isLoading ? '⏳ Analisando...' : '🔄 Analisar'}
          </button>
        </div>
        <div class="ai-panel-body">
          ${body}
        </div>
      </div>
    `;
  }

  // ── Polling ──────────────────────────────────────────────────

  function _stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer  = null;
      _polling    = false;
    }
  }

  function _startPolling(conversationId) {
    if (_polling) return;
    _polling = true;
    let rounds = 0;

    _pollTimer = setInterval(async () => {
      rounds++;
      if (rounds > MAX_POLL_ROUNDS || conversationId !== _conversationId) {
        _stopPolling();
        return;
      }

      try {
        const res = await InboxApi.getAiAnalysis(conversationId);
        if (!res?.success) { _stopPolling(); return; }

        const a = res.data;
        if (a?.status === 'completed' || a?.status === 'failed') {
          _stopPolling();
          _renderAndMount(a);
        }
      } catch {
        _stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Montar no DOM ─────────────────────────────────────────────

  function _renderAndMount(analysis) {
    if (!_panel) return;
    _panel.innerHTML = _renderPanel(analysis);
    _bindEvents(analysis);
  }

  function _bindEvents(analysis) {
    if (!_panel) return;

    // Botão Analisar / Reanalisar
    const analyzeBtn = _panel.querySelector('[data-action="ai-analyze"]');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        if (!_conversationId) return;
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Solicitando...';
        try {
          const res = await InboxApi.requestAiAnalysis(_conversationId);
          if (res?.success) {
            _renderAndMount(res.data);
            _startPolling(_conversationId);
          }
        } catch (err) {
          console.error('[InboxAiPanel] Erro ao solicitar análise:', err);
          analyzeBtn.disabled    = false;
          analyzeBtn.textContent = '🔄 Analisar';
        }
      });
    }

    // Botões "Usar sugestão"
    _panel.querySelectorAll('[data-action="use-suggestion"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index ?? '0', 10);
        const suggestions = analysis?.suggestions ?? [];
        const text = suggestions[idx];
        if (!text) return;

        // Inserir no composer (nunca envia automaticamente)
        if (window.MessageComposer && typeof window.MessageComposer.setText === 'function') {
          window.MessageComposer.setText(text);
        } else {
          // Fallback: tentar preencher o textarea diretamente
          const textarea = document.querySelector('.inbox-composer-input');
          if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.focus();
          }
        }
      });
    });
  }

  // ── API Pública ──────────────────────────────────────────────

  /**
   * Inicializa o painel, montando-o no elemento com id="inbox-ai-panel".
   * Chamado uma vez após o DOM do inbox estar pronto.
   */
  function init() {
    _panel = document.getElementById('inbox-ai-panel');
    if (!_panel) {
      console.warn('[InboxAiPanel] Elemento #inbox-ai-panel não encontrado.');
      return;
    }
    _renderAndMount(null);
  }

  /**
   * Carrega a análise para a conversa selecionada.
   * @param {string} conversationId
   */
  async function loadConversation(conversationId) {
    _stopPolling();
    _conversationId = conversationId;

    if (!_panel) return;

    // Mostrar loading imediato
    _panel.innerHTML = _renderPanel({ status: 'pending' });

    try {
      const res = await InboxApi.getAiAnalysis(conversationId);
      if (!res?.success) {
        _renderAndMount(null);
        return;
      }

      const a = res.data;
      _renderAndMount(a);

      // Se ainda está processando, iniciar polling
      if (a && (a.status === 'pending' || a.status === 'processing')) {
        _startPolling(conversationId);
      }
    } catch (err) {
      console.error('[InboxAiPanel] Erro ao carregar análise:', err);
      _renderAndMount(null);
    }
  }

  /** Limpa o painel (quando nenhuma conversa está selecionada). */
  function clear() {
    _stopPolling();
    _conversationId = null;
    if (_panel) _renderAndMount(null);
  }

  return { init, loadConversation, clear };

  // ── Utilitário de data ────────────────────────────────────────

  function _formatRelative(isoString) {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const min  = Math.floor(diff / 60_000);
      if (min < 1)  return 'agora mesmo';
      if (min < 60) return `há ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24)   return `há ${h}h`;
      return `há ${Math.floor(h / 24)}d`;
    } catch { return ''; }
  }
})();

window.InboxAiPanel = InboxAiPanel;
