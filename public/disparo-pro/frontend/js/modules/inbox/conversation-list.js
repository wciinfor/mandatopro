/**
 * ConversationList — renderiza e gerencia a lista de conversas no painel inbox.
 * - Carrega lista via InboxApi
 * - Atualiza em tempo real via InboxRealtime (workspace-level)
 * - Emite evento customizado 'inbox:conversation-selected' ao clicar
 * - Fase 2: badge de não-lidas do workspace + dots de presença
 * - Fase 3: filtros avançados (status, agente, depto, label, instância, não-lidas, período)
 *           busca por contato/telefone com debounce
 *
 * Depende de: window.InboxApi, window.InboxRealtime
 */
const ConversationList = (() => {
  const FILTER_DEFAULT = 'open';
  const SEARCH_DEBOUNCE_MS = 300;

  let _container     = null;
  let _unreadBadgeEl = null;
  let _conversations  = [];
  let _activeFilter  = FILTER_DEFAULT;
  let _selectedId    = null;
  let _workspaceId   = null;
  let _presenceMap   = new Map();

  // Fase 3 — filtros avançados
  let _advancedFilters = {
    agentId:      '',
    departmentId: '',
    labelId:      '',
    instanceId:   '',
    unreadOnly:   false,
    from:         '',
    to:           '',
    search:       '',
  };
  let _searchDebounceTimer = null;
  let _filterPanelEl       = null;
  let _searchInputEl       = null;

  // WS presence handlers (Fase 2)
  let _wsSnapshotHandler = null;
  let _wsPresenceHandler = null;

  // ── Unread summary ──────────────────────────────────────────────

  async function _refreshUnreadSummary() {
    if (!_unreadBadgeEl) return;
    try {
      const res = await InboxApi.getUnreadSummary();
      if (res.success) {
        const total = res.data?.workspaceTotal ?? 0;
        _unreadBadgeEl.textContent = total > 99 ? '99+' : (total > 0 ? String(total) : '');
        _unreadBadgeEl.style.display = total > 0 ? 'inline-flex' : 'none';
      }
    } catch (e) {
      // Silencioso
    }
  }

  // ── Presence (Fase 2) ───────────────────────────────────────────

  function _bindWsPresence() {
    _wsSnapshotHandler = (e) => {
      const agents = e.detail?.agents ?? [];
      _presenceMap = new Map(agents.map((a) => [a.agentId, a.status]));
    };
    _wsPresenceHandler = (e) => {
      const { agentId, status } = e.detail ?? {};
      if (agentId) _presenceMap.set(agentId, status);
    };
    document.addEventListener('inbox:ws:presence:snapshot', _wsSnapshotHandler);
    document.addEventListener('inbox:ws:presence:changed',  _wsPresenceHandler);
  }

  function _unbindWsPresence() {
    if (_wsSnapshotHandler) {
      document.removeEventListener('inbox:ws:presence:snapshot', _wsSnapshotHandler);
      _wsSnapshotHandler = null;
    }
    if (_wsPresenceHandler) {
      document.removeEventListener('inbox:ws:presence:changed', _wsPresenceHandler);
      _wsPresenceHandler = null;
    }
  }

  // ── Renderização ──────────────────────────────────────────────

  function _statusLabel(status) {
    const MAP = { open: 'Aberta', pending: 'Pendente', waiting: 'Aguardando', closed: 'Fechada', archived: 'Arquivada' };
    return MAP[status] ?? status;
  }

  function _timeAgo(isoDate) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    const min  = Math.floor(diff / 60_000);
    if (min < 1)   return 'agora';
    if (min < 60)  return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24)    return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  function _renderItem(conv) {
    const isSelected = conv.id === _selectedId;
    const unread     = conv.unread_count || 0;
    const contactName = conv.contact?.name || conv.contact_name || conv.contact_phone || 'Contato';
    const lastMsg    = conv.last_message_preview || '';
    const time       = _timeAgo(conv.last_message_at);

    return `
      <div class="inbox-conv-item ${isSelected ? 'is-selected' : ''} ${unread > 0 ? 'has-unread' : ''}"
           data-id="${conv.id}" role="button" tabindex="0">
        <div class="inbox-conv-avatar">
          <span>${contactName.charAt(0).toUpperCase()}</span>
        </div>
        <div class="inbox-conv-info">
          <div class="inbox-conv-header">
            <span class="inbox-conv-name">${_escHtml(contactName)}</span>
            <span class="inbox-conv-time">${time}</span>
          </div>
          <div class="inbox-conv-preview">
            <span class="inbox-conv-text">${_escHtml(lastMsg)}</span>
            ${unread > 0 ? `<span class="inbox-conv-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </div>
      </div>
    `.trim();
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _render() {
    if (!_container) return;

    if (_conversations.length === 0) {
      _container.innerHTML = `
        <div class="inbox-empty-state">
          <p>Nenhuma conversa encontrada.</p>
        </div>
      `;
      return;
    }

    _container.innerHTML = _conversations.map(_renderItem).join('');

    _container.querySelectorAll('.inbox-conv-item').forEach((el) => {
      el.addEventListener('click', () => _selectConversation(el.dataset.id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') _selectConversation(el.dataset.id);
      });
    });
  }

  // ── Seleção ───────────────────────────────────────────────────

  function _selectConversation(id) {
    _selectedId = id;
    _render();
    document.dispatchEvent(
      new CustomEvent('inbox:conversation-selected', { detail: { id } }),
    );
  }

  // ── Fase 3 — Filtros avançados ────────────────────────────────

  function _buildQueryParams() {
    const params = {};
    if (_activeFilter && _activeFilter !== 'all') params.status = _activeFilter;
    if (_advancedFilters.agentId)                params.agentId      = _advancedFilters.agentId;
    if (_advancedFilters.departmentId)           params.departmentId = _advancedFilters.departmentId;
    if (_advancedFilters.labelId)                params.labelId      = _advancedFilters.labelId;
    if (_advancedFilters.instanceId)             params.instanceId   = _advancedFilters.instanceId;
    if (_advancedFilters.unreadOnly)             params.unreadOnly   = 'true';
    if (_advancedFilters.from)                   params.from         = _advancedFilters.from;
    if (_advancedFilters.to)                     params.to           = _advancedFilters.to;
    if (_advancedFilters.search?.trim())         params.search       = _advancedFilters.search.trim();
    return params;
  }

  function _hasActiveFilters() {
    return Object.values(_advancedFilters).some((v) => v && v !== false && v !== '');
  }

  /** Renderiza chips dos filtros ativos acima da lista. */
  function _renderFilterChips() {
    const chipsContainer = document.getElementById('inbox-filter-chips');
    if (!chipsContainer) return;

    const chips = [];
    if (_advancedFilters.search)       chips.push({ label: `Busca: ${_advancedFilters.search}`, key: 'search' });
    if (_advancedFilters.agentId)      chips.push({ label: `Agente`, key: 'agentId' });
    if (_advancedFilters.departmentId) chips.push({ label: `Depto`, key: 'departmentId' });
    if (_advancedFilters.labelId)      chips.push({ label: `Label`, key: 'labelId' });
    if (_advancedFilters.instanceId)   chips.push({ label: `Instância`, key: 'instanceId' });
    if (_advancedFilters.unreadOnly)   chips.push({ label: 'Não lidas', key: 'unreadOnly' });
    if (_advancedFilters.from)         chips.push({ label: `De: ${_advancedFilters.from}`, key: 'from' });
    if (_advancedFilters.to)           chips.push({ label: `Até: ${_advancedFilters.to}`, key: 'to' });

    chipsContainer.innerHTML = chips.map((c) => `
      <span class="filter-chip" data-key="${c.key}">
        ${_escHtml(c.label)}
        <button class="filter-chip-remove" aria-label="Remover filtro">&times;</button>
      </span>
    `).join('');

    chipsContainer.querySelectorAll('.filter-chip-remove').forEach((btn) => {
      const key = btn.closest('[data-key]').dataset.key;
      btn.addEventListener('click', () => {
        if (key === 'unreadOnly') {
          _advancedFilters.unreadOnly = false;
        } else {
          _advancedFilters[key] = '';
        }
        _renderFilterChips();
        void _load();
      });
    });
  }

  /** Inicia painel de filtros avançados (injeta HTML + binds). */
  function _initFilterPanel(panelContainerId) {
    const container = panelContainerId
      ? document.getElementById(panelContainerId)
      : null;
    if (!container) return;

    container.innerHTML = `
      <div class="inbox-filter-panel" id="inbox-filter-panel" hidden>
        <div class="filter-row">
          <label>Agente (ID)</label>
          <input type="text" id="filter-agentId" placeholder="ID do agente" />
        </div>
        <div class="filter-row">
          <label>Departamento (ID)</label>
          <input type="text" id="filter-departmentId" placeholder="ID do departamento" />
        </div>
        <div class="filter-row">
          <label>Instância (ID)</label>
          <input type="text" id="filter-instanceId" placeholder="ID da instância" />
        </div>
        <div class="filter-row">
          <label>Label (ID)</label>
          <input type="text" id="filter-labelId" placeholder="ID da label" />
        </div>
        <div class="filter-row filter-row--inline">
          <label><input type="checkbox" id="filter-unreadOnly" /> Apenas não lidas</label>
        </div>
        <div class="filter-row">
          <label>De (data)</label>
          <input type="date" id="filter-from" />
        </div>
        <div class="filter-row">
          <label>Até (data)</label>
          <input type="date" id="filter-to" />
        </div>
        <div class="filter-actions">
          <button id="filter-apply-btn" class="btn btn-primary btn-sm">Aplicar</button>
          <button id="filter-clear-btn" class="btn btn-ghost btn-sm">Limpar</button>
        </div>
      </div>
    `;
    _filterPanelEl = container.querySelector('#inbox-filter-panel');

    container.querySelector('#filter-apply-btn').addEventListener('click', () => {
      _advancedFilters.agentId      = container.querySelector('#filter-agentId').value.trim();
      _advancedFilters.departmentId = container.querySelector('#filter-departmentId').value.trim();
      _advancedFilters.instanceId   = container.querySelector('#filter-instanceId').value.trim();
      _advancedFilters.labelId      = container.querySelector('#filter-labelId').value.trim();
      _advancedFilters.unreadOnly   = container.querySelector('#filter-unreadOnly').checked;
      _advancedFilters.from         = container.querySelector('#filter-from').value;
      _advancedFilters.to           = container.querySelector('#filter-to').value;
      _filterPanelEl.hidden = true;
      _renderFilterChips();
      void _load();
    });

    container.querySelector('#filter-clear-btn').addEventListener('click', () => {
      _advancedFilters = { agentId: '', departmentId: '', labelId: '', instanceId: '', unreadOnly: false, from: '', to: '', search: '' };
      container.querySelectorAll('input[type=text], input[type=date]').forEach((el) => (el.value = ''));
      container.querySelector('#filter-unreadOnly').checked = false;
      if (_searchInputEl) _searchInputEl.value = '';
      _filterPanelEl.hidden = true;
      _renderFilterChips();
      void _load();
    });
  }

  /** Vincula campo de busca (debounce). */
  function _initSearchInput(searchInputId) {
    _searchInputEl = searchInputId ? document.getElementById(searchInputId) : null;
    if (!_searchInputEl) return;

    _searchInputEl.addEventListener('input', () => {
      clearTimeout(_searchDebounceTimer);
      _searchDebounceTimer = setTimeout(() => {
        _advancedFilters.search = _searchInputEl.value.trim();
        _renderFilterChips();
        void _load();
      }, SEARCH_DEBOUNCE_MS);
    });
  }

  // ── Carregamento ──────────────────────────────────────────────

  async function _load() {
    if (!_container) return;
    _container.innerHTML = '<div class="inbox-loading"><span class="spinner-sm"></span> Carregando...</div>';

    try {
      const params = _buildQueryParams();
      const res = await InboxApi.listConversations(params);
      if (res.success) {
        _conversations = res.data?.conversations ?? [];
        _render();
      } else {
        _container.innerHTML = `<div class="inbox-error">Erro ao carregar conversas.</div>`;
      }
    } catch (err) {
      console.error('[ConversationList] Erro ao carregar:', err);
      _container.innerHTML = `<div class="inbox-error">Falha de conexão.</div>`;
    }
  }

  // ── Realtime update ───────────────────────────────────────────

  function _handleRealtimeChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      if (_activeFilter === 'all' || newRow.status === _activeFilter) {
        _conversations.unshift(newRow);
        _render();
      }
    } else if (eventType === 'UPDATE') {
      const idx = _conversations.findIndex((c) => c.id === newRow.id);
      if (idx !== -1) {
        if (_activeFilter !== 'all' && newRow.status !== _activeFilter) {
          _conversations.splice(idx, 1);
        } else {
          _conversations[idx] = { ..._conversations[idx], ...newRow };
        }
        _render();
      } else if (_activeFilter === 'all' || newRow.status === _activeFilter) {
        _conversations.unshift(newRow);
        _render();
      }
    } else if (eventType === 'DELETE') {
      _conversations = _conversations.filter((c) => c.id !== oldRow?.id);
      _render();
    }
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /**
     * Inicializa o componente.
     * @param {HTMLElement} container — elemento onde a lista será renderizada
     * @param {string} workspaceId
     * @param {HTMLElement} [unreadBadgeEl] — badge de não-lidas
     * @param {Object} [opts] — Fase 3: { filterPanelContainerId, searchInputId, filterToggleBtnId }
     */
    async init(container, workspaceId, unreadBadgeEl = null, opts = {}) {
      _container     = container;
      _workspaceId   = workspaceId;
      _unreadBadgeEl = unreadBadgeEl;

      // Fase 3 — painel de filtros e campo de busca
      if (opts.filterPanelContainerId) {
        _initFilterPanel(opts.filterPanelContainerId);
      }
      if (opts.searchInputId) {
        _initSearchInput(opts.searchInputId);
      }

      // Botão toggle do painel de filtros
      const toggleBtn = opts.filterToggleBtnId
        ? document.getElementById(opts.filterToggleBtnId)
        : null;
      if (toggleBtn && _filterPanelEl) {
        toggleBtn.addEventListener('click', () => {
          _filterPanelEl.hidden = !_filterPanelEl.hidden;
        });
      }

      await _load();
      void _refreshUnreadSummary();

      InboxRealtime.subscribeWorkspace(workspaceId, _handleRealtimeChange);
      _bindWsPresence();
    },

    /** Muda o filtro de status e recarrega. */
    async setFilter(status) {
      _activeFilter = status;
      _selectedId   = null;
      await _load();
    },

    /** Define um filtro avançado e recarrega. */
    async setAdvancedFilter(key, value) {
      _advancedFilters[key] = value;
      _renderFilterChips();
      await _load();
    },

    /** Força recarga. */
    reload: _load,

    /** Atualiza badge unread do workspace. */
    refreshUnread: _refreshUnreadSummary,

    /** Limpa badge de uma conversa específica sem reload. */
    clearUnread(conversationId) {
      const conv = _conversations.find((c) => c.id === conversationId);
      if (conv) {
        conv.unread_count = 0;
        _render();
      }
    },

    destroy() {
      clearTimeout(_searchDebounceTimer);
      _unbindWsPresence();
      InboxRealtime.unsubscribeAll();
      _container     = null;
      _conversations  = [];
      _presenceMap   = new Map();
      _unreadBadgeEl = null;
      _filterPanelEl = null;
      _searchInputEl = null;
    },
  };
})();

window.ConversationList = ConversationList;
