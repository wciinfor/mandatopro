/**
 * AgentStatus — exibe e atualiza o status operacional do agente logado
 * no topo do painel de atendimento.
 *
 * Fase 2: integração com InboxWs para broadcast de presença em tempo real.
 * Status possíveis: online | busy | away | offline | dnd
 *
 * Depende de: window.SupabaseClient, window.InboxWs
 */
const AgentStatus = (() => {
  const STATUS_LABELS = {
    online:  'Online',
    busy:    'Ocupado',
    away:    'Ausente',
    offline: 'Offline',
    dnd:     'Não perturbe',
  };

  const STATUS_COLORS = {
    online:  '#22c55e',
    busy:    '#ef4444',
    away:    '#f59e0b',
    offline: '#9ca3af',
    dnd:     '#7c3aed',
  };

  let _container          = null;
  let _userId             = null;
  let _status             = 'offline';
  let _presenceMap        = new Map(); // agentId → { name, status }

  // refs para remoção precisa dos listeners globais
  let _wsSnapshotHandler  = null;
  let _wsPresenceHandler  = null;
  let _beforeUnloadHandler = null;

  // ── Renderização ─────────────────────────────────────────────

  function _render() {
    if (!_container) return;
    _container.innerHTML = `
      <div class="agent-status-bar">
        <span class="agent-status-dot"
              style="background:${STATUS_COLORS[_status] ?? STATUS_COLORS.offline}"></span>
        <span class="agent-status-label">${STATUS_LABELS[_status] ?? _status}</span>
        <select class="agent-status-select" aria-label="Alterar status">
          ${Object.entries(STATUS_LABELS)
            .map(([v, l]) => `<option value="${v}"${v === _status ? ' selected' : ''}>${l}</option>`)
            .join('')}
        </select>
        <span class="agent-presence-count" title="Agentes online">
          ${_onlineCount()} online
        </span>
      </div>
    `;
    _container.querySelector('.agent-status-select')
      .addEventListener('change', (e) => _setStatus(e.target.value));
  }

  function _onlineCount() {
    let n = 0;
    _presenceMap.forEach((v) => { if (v.status === 'online' || v.status === 'busy') n++; });
    return n;
  }

  // ── Persistência ──────────────────────────────────────────────

  async function _loadStatus() {
    if (!_userId) return;
    try {
      const { data } = await window.SupabaseClient
        .from('agent_status')
        .select('status')
        .eq('user_id', _userId)
        .maybeSingle();
      _status = data?.status || 'offline';
    } catch (err) {
      console.warn('[AgentStatus] Não foi possível carregar status:', err);
    }
    _render();
  }

  async function _setStatus(newStatus) {
    if (!_userId) return;
    _status = newStatus;
    _render();

    // Fase 2: propagar via WebSocket (servidor persiste + broadcast)
    if (window.InboxWs?.isConnected()) {
      InboxWs.updatePresence(newStatus);
    } else {
      // Fallback direto ao Supabase quando WS não está conectado
      try {
        await window.SupabaseClient
          .from('agent_status')
          .upsert(
            { user_id: _userId, status: newStatus, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
      } catch (err) {
        console.error('[AgentStatus] Erro ao salvar status (fallback):', err);
      }
    }
  }

  // ── Listeners de eventos WS (Fase 2) ──────────────────────────

  function _bindWsEvents() {
    // Evitar acúmulo ao re-inicializar (ex: sair e entrar na seção)
    _unbindWsEvents();

    _wsSnapshotHandler = (e) => {
      const agents = e.detail?.agents ?? [];
      _presenceMap = new Map(agents.map((a) => [a.agentId ?? a.name, a]));
      _render();
    };
    _wsPresenceHandler = (e) => {
      const { agentId, name, status } = e.detail ?? {};
      if (agentId) {
        _presenceMap.set(agentId, { name, status });
        _render();
      }
    };

    document.addEventListener('inbox:ws:presence:snapshot', _wsSnapshotHandler);
    document.addEventListener('inbox:ws:presence:changed',  _wsPresenceHandler);
  }

  function _unbindWsEvents() {
    if (_wsSnapshotHandler) {
      document.removeEventListener('inbox:ws:presence:snapshot', _wsSnapshotHandler);
      _wsSnapshotHandler = null;
    }
    if (_wsPresenceHandler) {
      document.removeEventListener('inbox:ws:presence:changed', _wsPresenceHandler);
      _wsPresenceHandler = null;
    }
  }

  // ── Marcar offline ao fechar a aba ───────────────────────────

  function _registerBeforeUnload() {
    if (_beforeUnloadHandler) {
      window.removeEventListener('beforeunload', _beforeUnloadHandler);
    }
    _beforeUnloadHandler = () => {
      if (window.InboxWs?.isConnected()) {
        InboxWs.updatePresence('offline');
      }
    };
    window.addEventListener('beforeunload', _beforeUnloadHandler);
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /**
     * Inicializa o componente.
     * @param {HTMLElement} container
     * @param {string} userId — ID do usuário autenticado
     */
    async init(container, userId) {
      _container = container;
      _userId    = userId;
      _render();
      await _loadStatus();
      _bindWsEvents();
      _registerBeforeUnload();
    },

    /** Define status programaticamente (ex: ao entrar na seção). */
    async setOnline() {
      await _setStatus('online');
    },

    /** Retorna o status atual. */
    getStatus() {
      return _status;
    },

    destroy() {
      _unbindWsEvents();
      if (_beforeUnloadHandler) {
        window.removeEventListener('beforeunload', _beforeUnloadHandler);
        _beforeUnloadHandler = null;
      }
      _container   = null;
      _userId      = null;
      _presenceMap = new Map();
    },
  };
})();

window.AgentStatus = AgentStatus;

