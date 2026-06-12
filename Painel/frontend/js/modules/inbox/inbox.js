/**
 * InboxModule — orquestra todos os sub-componentes do inbox multiatendente.
 *
 * Estrutura HTML esperada dentro de #atendimento-section:
 *
 *   #inbox-agent-status-bar      ← AgentStatus
 *   .inbox-filter-tabs            ← botões de filtro (open | pending | all)
 *   #inbox-conv-list              ← ConversationList
 *   #inbox-view-header            ← ConversationView (cabeçalho)
 *   #inbox-msg-list               ← ConversationView (lista de mensagens)
 *   #inbox-composer               ← MessageComposer
 *   #inbox-empty-view             ← placeholder quando nenhuma conversa selecionada
 *
 * Depende de: window.ConversationList, window.ConversationView,
 *             window.MessageComposer, window.AgentStatus,
 *             window.InboxApi, window.InboxRealtime,
 *             window.InboxAiPanel (Fase 5),
 *             window.AuthService (ou acesso ao usuário logado)
 */
const InboxModule = (() => {
  let _initialized  = false;
  let _workspaceId  = null;
  let _userId       = null;
  // Referência do listener para remoção precisa em _destroy()
  let _convSelectedHandler = null;

  // ── Bootstrap do DOM do inbox ─────────────────────────────────

  function _buildHtml(section) {
    section.innerHTML = `
      <div class="inbox-layout">

        <!-- Painel esquerdo: filtros + lista -->
        <aside class="inbox-sidebar">
          <div id="inbox-agent-status-bar"></div>

          <div class="inbox-filter-tabs" role="tablist" aria-label="Filtrar conversas">
            <button class="inbox-filter-tab is-active" data-filter="open"    role="tab">
              Abertas
              <span id="inbox-unread-badge" class="inbox-unread-badge" style="display:none"></span>
            </button>
            <button class="inbox-filter-tab"            data-filter="pending" role="tab">Pendentes</button>
            <button class="inbox-filter-tab"            data-filter="all"    role="tab">Todas</button>
          </div>

          <div id="inbox-conv-list" class="inbox-conv-list"></div>
        </aside>

        <!-- Painel direito: conversa ativa -->
        <main class="inbox-main">
          <div id="inbox-empty-view" class="inbox-empty-view">
            <p>Selecione uma conversa para começar.</p>
          </div>

          <div id="inbox-conversation-panel" class="inbox-conversation-panel" style="display:none">
            <div id="inbox-view-header" class="inbox-view-header"></div>
            <div id="inbox-msg-list"    class="inbox-msg-list"></div>
            <div id="inbox-typing-bar"  class="inbox-typing-bar" style="display:none"></div>
            <div id="inbox-composer"    class="inbox-composer-wrap"></div>
          </div>
        </main>

        <!-- Painel lateral direito: IA Assistiva (Fase 5) -->
        <aside class="inbox-ai-sidebar" id="inbox-ai-sidebar">
          <div id="inbox-ai-panel"></div>
        </aside>

      </div>
    `;
  }

  // ── Eventos de filtro ─────────────────────────────────────────

  function _bindFilterTabs(section) {
    section.querySelectorAll('.inbox-filter-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        section.querySelectorAll('.inbox-filter-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        await ConversationList.setFilter(tab.dataset.filter);

        // Limpar view ao trocar de filtro
        ConversationView.clear();
        _showEmptyView(section, true);
      });
    });
  }

  // ── Show/hide panels ──────────────────────────────────────────

  function _showEmptyView(section, show) {
    const empty = section.querySelector('#inbox-empty-view');
    const panel = section.querySelector('#inbox-conversation-panel');
    if (empty) empty.style.display  = show ? '' : 'none';
    if (panel) panel.style.display  = show ? 'none' : '';
  }

  // ── Inicialização ─────────────────────────────────────────────

  async function _init() {
    if (_initialized) return;

    const section = document.getElementById('atendimento-section');
    if (!section) return;

    // Resolver workspaceId e userId
    try {
      _workspaceId = await ApiService.getWorkspaceId();
      const { data: { user } } = await window.SupabaseClient.auth.getUser();
      _userId = user?.id;
    } catch (err) {
      console.error('[InboxModule] Falha ao resolver workspace/user:', err);
      section.innerHTML = `<div style="padding:2rem;color:#ef4444;">Erro ao carregar atendimento: ${err.message}</div>`;
      return;
    }

    if (!_workspaceId) {
      console.error('[InboxModule] workspaceId não resolvido — perfil sem workspace associado.');
      section.innerHTML = `<div style="padding:2rem;color:#f59e0b;">Nenhum workspace encontrado para este usuário. Verifique o cadastro.</div>`;
      return;
    }

    // Construir HTML do inbox
    _buildHtml(section);

    // Inicializar sub-componentes
    try {
      await AgentStatus.init(
        section.querySelector('#inbox-agent-status-bar'),
        _userId,
      );
      AgentStatus.setOnline(); // marcar online ao abrir a seção
    } catch (err) {
      console.warn('[InboxModule] AgentStatus falhou (não crítico):', err);
    }

    // Fase 2: conectar WebSocket (typing indicators + presença)
    if (window.InboxWs) {
      InboxWs.connect(_workspaceId).catch((e) =>
        console.warn('[InboxModule] InboxWs.connect falhou:', e),
      );
    }

    try {
      await ConversationList.init(
        section.querySelector('#inbox-conv-list'),
        _workspaceId,
        section.querySelector('#inbox-unread-badge'), // Fase 2
      );
    } catch (err) {
      console.error('[InboxModule] ConversationList.init falhou:', err);
    }

    try {
      ConversationView.init({
        header:    section.querySelector('#inbox-view-header'),
        msgList:   section.querySelector('#inbox-msg-list'),
        composer:  section.querySelector('#inbox-composer'),
        typingBar: section.querySelector('#inbox-typing-bar'), // Fase 2
      });
    } catch (err) {
      console.error('[InboxModule] ConversationView.init falhou:', err);
    }

    _bindFilterTabs(section);

    // Fase 5: inicializar painel de IA
    if (window.InboxAiPanel) {
      InboxAiPanel.init();
    }

    // Quando usuário seleciona uma conversa
    _convSelectedHandler = async (e) => {
      const { id } = e.detail;
      _showEmptyView(section, false);
      await ConversationView.open(id);
      ConversationList.clearUnread(id);
      // Fase 5: carregar análise de IA da conversa
      if (window.InboxAiPanel) {
        InboxAiPanel.loadConversation(id);
      }
    };
    document.addEventListener('inbox:conversation-selected', _convSelectedHandler);

    _initialized = true;
  }

  // ── Limpeza ao sair da seção ──────────────────────────────────

  function _destroy() {
    ConversationView.clear();
    ConversationList.destroy();
    InboxRealtime.unsubscribeAll();
    AgentStatus.destroy();
    // Fase 2: desconectar WebSocket ao sair da seção
    if (window.InboxWs) InboxWs.disconnect();
    // Fase 5: limpar painel de IA
    if (window.InboxAiPanel) InboxAiPanel.clear();
    // Remover listener para evitar acúmulo a cada re-entrada na seção
    if (_convSelectedHandler) {
      document.removeEventListener('inbox:conversation-selected', _convSelectedHandler);
      _convSelectedHandler = null;
    }
    _initialized = false;
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /** Chamado pelo sistema de navegação ao exibir a seção "Atendimento". */
    async onEnter() {
      await _init();
    },

    /** Chamado ao sair da seção (ex: navegar para outra aba). */
    onLeave() {
      _destroy();
    },
  };
})();

window.InboxModule = InboxModule;
