/**
 * InboxWs — cliente WebSocket para eventos efêmeros do inbox.
 *
 * Responsabilidades:
 *   • Autenticação no servidor via JWT + workspaceId
 *   • Envio de typing:start / typing:stop
 *   • Envio de presence:update
 *   • Re-conexão automática (até MAX_RECONNECT tentativas)
 *   • Dispatch de CustomEvents para consumo pelos componentes
 *
 * Eventos CustomEvents emitidos em document:
 *   inbox:ws:auth:ok          — autenticação confirmada { agentId }
 *   inbox:ws:presence:snapshot — snapshot inicial { agents: [] }
 *   inbox:ws:presence:changed  — agente mudou status { agentId, name, status }
 *   inbox:ws:typing:start      — agente digitando { conversationId, agentId, agentName }
 *   inbox:ws:typing:stop       — agente parou de digitar { conversationId, agentId }
 *   inbox:ws:connected         — conexão estabelecida
 *   inbox:ws:disconnected      — conexão encerrada
 *
 * Depende de: window.ENV (API_BASE_URL), window.SupabaseClient
 */
const InboxWs = (() => {
  let _ws               = null;
  let _workspaceId      = null;
  let _reconnectTimer   = null;
  let _reconnectCount   = 0;
  let _intentionalClose = false;

  const MAX_RECONNECT   = 8;
  const BASE_DELAY_MS   = 500;   // 0.5s → 1s → 2s... (exponencial + jitter, cap 30s)
  const MAX_DELAY_MS    = 30_000;
  const PING_INTERVAL   = 25_000;
  let   _pingTimer      = null;

  // ── URL ─────────────────────────────────────────────────────

  function _wsUrl() {
    const apiBase = (window.ENV?.API_BASE_URL || '').trim();
    if (apiBase) {
      return apiBase.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/ws/inbox';
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/inbox`;
  }

  // ── Dispatch ─────────────────────────────────────────────────

  function _emit(type, detail) {
    document.dispatchEvent(new CustomEvent(`inbox:ws:${type}`, { detail }));
  }

  // ── Ping keepalive ────────────────────────────────────────────

  function _startPing() {
    _stopPing();
    _pingTimer = setInterval(() => {
      if (_ws?.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);
  }

  function _stopPing() {
    if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
  }

  // ── Conexão ───────────────────────────────────────────────────

  async function _connect() {
    if (_ws?.readyState === WebSocket.OPEN || _ws?.readyState === WebSocket.CONNECTING) return;

    // Obter token JWT da sessão Supabase
    let token = null;
    try {
      const { data: { session } } = await window.SupabaseClient.auth.getSession();
      token = session?.access_token ?? null;
    } catch (e) {
      console.error('[InboxWs] Erro ao obter token:', e);
    }
    if (!token || !_workspaceId) return;

    const url = _wsUrl();
    console.debug('[InboxWs] Conectando a', url);

    try {
      _ws = new WebSocket(url);
    } catch (e) {
      console.error('[InboxWs] Falha ao criar WebSocket:', e);
      _scheduleReconnect();
      return;
    }

    _ws.onopen = () => {
      console.debug('[InboxWs] Conectado');
      _reconnectCount = 0; // resetar backoff ao conectar com sucesso
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
      _ws.send(JSON.stringify({ type: 'auth', token, workspaceId: _workspaceId }));
      _startPing();
      _emit('connected', {});
    };

    _ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'auth:ok':
          _emit('auth:ok', msg);
          break;
        case 'presence:snapshot':
          _emit('presence:snapshot', msg);
          break;
        case 'presence:changed':
          _emit('presence:changed', msg);
          break;
        case 'typing:start':
          _emit('typing:start', msg);
          break;
        case 'typing:stop':
          _emit('typing:stop', msg);
          break;
        case 'pong':
          // keepalive — sem ação
          break;
        case 'error':
          console.warn('[InboxWs] Erro do servidor:', msg.message);
          break;
        default:
          console.debug('[InboxWs] Mensagem desconhecida:', msg.type);
      }
    };

    _ws.onerror = (err) => {
      console.error('[InboxWs] Erro no socket:', err);
    };

    _ws.onclose = (event) => {
      _stopPing();
      _ws = null;
      _emit('disconnected', { code: event.code, reason: event.reason });
      console.debug('[InboxWs] Desconectado — código:', event.code);
      if (!_intentionalClose) {
        _scheduleReconnect();
      }
    };
  }

  function _scheduleReconnect() {
    if (_reconnectCount >= MAX_RECONNECT) {
      console.warn('[InboxWs] Máximo de tentativas de reconexão atingido');
      _emit('reconnect:failed', { attempts: _reconnectCount });
      return;
    }
    // Exponential backoff com jitter ±20% e teto de 30s
    const base  = Math.min(BASE_DELAY_MS * Math.pow(2, _reconnectCount), MAX_DELAY_MS);
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.round(base + jitter);
    _reconnectCount++;
    console.debug(`[InboxWs] Reconectando em ${delay}ms (tentativa ${_reconnectCount}/${MAX_RECONNECT})`);
    _emit('reconnecting', { attempt: _reconnectCount, delayMs: delay });
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(_connect, delay);
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /**
     * Inicializa e conecta o WebSocket para o workspace.
     * @param {string} workspaceId
     */
    async connect(workspaceId) {
      _workspaceId      = workspaceId;
      _intentionalClose = false;
      await _connect();
    },

    /** Encerra a conexão e cancela reconexões. */
    disconnect() {
      _intentionalClose = true;
      _stopPing();
      clearTimeout(_reconnectTimer);
      _reconnectCount = MAX_RECONNECT; // bloqueia futura reconexão
      if (_ws) { _ws.close(1000, 'intentional_close'); _ws = null; }
    },

    /**
     * Envia evento typing:start para a conversa ativa.
     * @param {string} conversationId
     */
    sendTypingStart(conversationId) {
      if (_ws?.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify({ type: 'typing:start', conversationId }));
      }
    },

    /**
     * Envia evento typing:stop para a conversa ativa.
     * @param {string} conversationId
     */
    sendTypingStop(conversationId) {
      if (_ws?.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify({ type: 'typing:stop', conversationId }));
      }
    },

    /**
     * Atualiza o status de presença do agente logado.
     * @param {'online'|'offline'|'busy'|'away'|'dnd'} status
     */
    updatePresence(status) {
      if (_ws?.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify({ type: 'presence:update', status }));
      }
    },

    /** Retorna true se a conexão WebSocket está ativa. */
    isConnected() {
      return _ws?.readyState === WebSocket.OPEN;
    },
  };
})();

window.InboxWs = InboxWs;
