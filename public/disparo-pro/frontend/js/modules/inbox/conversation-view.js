/**
 * ConversationView — exibe mensagens de uma conversa e ações sobre ela.
 * - Renderiza histórico de mensagens (inbound/outbound/system)
 * - Scroll automático para a última mensagem
 * - Carregamento de mensagens anteriores (infinite scroll up)
 * - Ações: fechar, reabrir, atribuir a mim, transferir (Fase 2)
 * - Atualiza em tempo real via InboxRealtime (conversation-level)
 * - Indicador "digitando..." via WebSocket (Fase 2)
 * - Fase 3: reply-to, soft-delete, exibição de mensagens deletadas
 *
 * Fase 2 fix: msg.message (não msg.content) — alinhado com schema
 *
 * Depende de: window.InboxApi, window.InboxRealtime,
 *             window.MessageComposer, window.InboxWs (Fase 2)
 */
const ConversationView = (() => {
  let _container      = null;
  let _msgList        = null;
  let _header         = null;
  let _typingBar      = null;
  let _composerEl     = null;
  let _conversation   = null;
  let _messages       = [];
  let _oldestCursor   = null;
  let _loadingOlder   = false;

  // Fase 3 — reply-to
  let _replyTo        = null; // { id, message, direction }
  let _replyPreviewEl = null;

  // ── Typing indicator (Fase 2) ─────────────────────────────────
  const _typingAgents       = new Map();
  const TYPING_CLEAR_DELAY  = 6_000;
  let _wsTypingStartHandler = null;
  let _wsTypingStopHandler  = null;

  // ── Utilitários ───────────────────────────────────────────────

  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const STATUS_ICON = { queued: '🕐', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '✗' };

  // ── Renderização de mensagem individual ───────────────────────

  function _renderMsg(msg) {
    const dir   = msg.direction;
    const isOut = dir === 'outbound' || dir === 'ai';
    const isSys = dir === 'system';
    const time  = _fmtTime(msg.created_at);

    if (isSys) {
      const content = _esc(msg.message ?? '');
      return `<div class="inbox-msg-system"><span>${content}</span></div>`;
    }

    // Fase 3 — mensagem deletada (soft-delete)
    if (msg.is_deleted) {
      return `
        <div class="inbox-msg ${isOut ? 'inbox-msg--out' : 'inbox-msg--in'} inbox-msg--deleted" data-msg-id="${msg.id}">
          <div class="inbox-msg-bubble inbox-msg-bubble--deleted">
            <span class="inbox-msg-deleted-label">🚫 Esta mensagem foi removida</span>
          </div>
          <span class="inbox-msg-meta">${time}</span>
        </div>
      `.trim();
    }

    const content = _esc(msg.message ?? '');
    const status  = isOut ? (STATUS_ICON[msg.status] || '') : '';

    // Fase 3 — exibir prévia da mensagem original (reply-to)
    let replyPreview = '';
    if (msg.reply_to_message_id) {
      const original = _messages.find((m) => m.id === msg.reply_to_message_id);
      const snippet  = original
        ? _esc((original.message ?? 'Mensagem').substring(0, 80))
        : '(mensagem não encontrada)';
      replyPreview = `<div class="inbox-msg-reply-preview">${snippet}</div>`;
    }

    // Fase 4 — renderizar bloco de mídia
    const mediaBlock = _renderMediaBlock(msg);

    // Fase 3 — botões de ação por mensagem
    const actions = `
      <div class="inbox-msg-actions">
        <button class="inbox-msg-action-btn" data-action="reply" data-msg-id="${msg.id}" title="Responder">↩</button>
        <button class="inbox-msg-action-btn" data-action="delete" data-msg-id="${msg.id}" title="Remover">🗑</button>
      </div>
    `;

    // Texto só aparece se há conteúdo (pode ser caption de mídia ou texto puro)
    const textBlock = content
      ? `<span class="inbox-msg-text">${content}</span>`
      : '';

    return `
      <div class="inbox-msg ${isOut ? 'inbox-msg--out' : 'inbox-msg--in'}" data-msg-id="${msg.id}">
        ${replyPreview}
        <div class="inbox-msg-bubble">
          ${mediaBlock}
          ${textBlock}
          ${actions}
        </div>
        <span class="inbox-msg-meta">${time} ${status}</span>
      </div>
    `.trim();
  }

  // ── Fase 4 — Renderização de bloco de mídia ──────────────────

  /**
   * Retorna HTML do bloco de mídia para uma mensagem, ou '' se não há mídia.
   * As URLs são geradas de forma assíncrona via data-attachment-id após render.
   */
  function _renderMediaBlock(msg) {
    const attId     = msg.media_attachment_id;
    const mediaType = msg.media_type;

    // Compatibilidade: media_url direto (inbound antes do storage processar)
    const directUrl = msg.media_url;

    if (!attId && !directUrl) return '';

    // Se ainda não temos URL e o processamento de storage está pendente,
    // mostramos um placeholder que será atualizado via _loadMediaUrl
    if (mediaType === 'image') {
      const src = directUrl || '';
      return `
        <div class="inbox-msg-media inbox-msg-media--image"
             ${attId ? `data-attachment-id="${attId}"` : ''}
             data-media-type="image">
          ${src
            ? `<img src="${_escAttr(src)}" alt="Imagem" class="inbox-media-img" loading="lazy" />`
            : `<div class="inbox-media-loading">🖼️ Carregando imagem...</div>`
          }
        </div>
      `.trim();
    }

    if (mediaType === 'video') {
      return `
        <div class="inbox-msg-media inbox-msg-media--video"
             ${attId ? `data-attachment-id="${attId}"` : ''}
             data-media-type="video">
          ${directUrl
            ? `<video controls preload="none" class="inbox-media-video">
                 <source src="${_escAttr(directUrl)}" />
                 Seu browser não suporta vídeo.
               </video>`
            : `<div class="inbox-media-loading">🎬 Carregando vídeo...</div>`
          }
        </div>
      `.trim();
    }

    if (mediaType === 'audio') {
      return `
        <div class="inbox-msg-media inbox-msg-media--audio"
             ${attId ? `data-attachment-id="${attId}"` : ''}
             data-media-type="audio">
          ${directUrl
            ? `<audio controls class="inbox-media-audio">
                 <source src="${_escAttr(directUrl)}" />
                 Seu browser não suporta áudio.
               </audio>`
            : `<div class="inbox-media-loading">🎵 Carregando áudio...</div>`
          }
        </div>
      `.trim();
    }

    if (mediaType === 'document') {
      const filename = _esc(msg.message || 'documento');
      return `
        <div class="inbox-msg-media inbox-msg-media--document"
             ${attId ? `data-attachment-id="${attId}"` : ''}
             data-media-type="document">
          <div class="inbox-media-document">
            <span class="inbox-media-doc-icon">📄</span>
            <span class="inbox-media-doc-name">${filename}</span>
            ${attId
              ? `<button class="btn btn-sm inbox-media-download-btn"
                         data-action="download-media"
                         data-attachment-id="${attId}"
                         title="Baixar documento">⬇ Baixar</button>`
              : directUrl
                ? `<a href="${_escAttr(directUrl)}" download class="btn btn-sm">⬇ Baixar</a>`
                : ''
            }
          </div>
        </div>
      `.trim();
    }

    return '';
  }

  /**
   * Carrega URLs signed para todos os blocos de mídia visíveis que têm attachment-id.
   * Chamado após _appendMessages.
   */
  async function _hydrateMediaBlocks(container) {
    const blocks = container.querySelectorAll('[data-attachment-id]');
    for (const block of blocks) {
      const attId     = block.dataset.attachmentId;
      const mediaType = block.dataset.mediaType;
      if (!attId || block.dataset.hydrated) continue;
      block.dataset.hydrated = '1';

      try {
        const forDownload = mediaType === 'document';
        const res = await InboxApi.getMediaUrl(attId, forDownload);
        if (!res?.success) continue;

        const url = res.data?.signedUrl;
        if (!url) continue;

        if (mediaType === 'image') {
          const loading = block.querySelector('.inbox-media-loading');
          if (loading) {
            loading.outerHTML = `<img src="${_escAttr(url)}" alt="Imagem" class="inbox-media-img" loading="lazy" />`;
            // Click para abrir lightbox simples
            block.querySelector('img')?.addEventListener('click', () => _openLightbox(url));
          } else {
            const img = block.querySelector('img');
            if (img) { img.src = url; img.addEventListener('click', () => _openLightbox(url)); }
          }
        } else if (mediaType === 'video') {
          const loading = block.querySelector('.inbox-media-loading');
          if (loading) {
            loading.outerHTML = `<video controls preload="none" class="inbox-media-video"><source src="${_escAttr(url)}" />Seu browser não suporta vídeo.</video>`;
          } else {
            const src = block.querySelector('source');
            if (src) src.src = url;
          }
        } else if (mediaType === 'audio') {
          const loading = block.querySelector('.inbox-media-loading');
          if (loading) {
            loading.outerHTML = `<audio controls class="inbox-media-audio"><source src="${_escAttr(url)}" />Seu browser não suporta áudio.</audio>`;
          } else {
            const src = block.querySelector('source');
            if (src) src.src = url;
          }
        } else if (mediaType === 'document') {
          const btn = block.querySelector('.inbox-media-download-btn');
          if (btn) {
            btn.addEventListener('click', () => {
              const a = document.createElement('a');
              a.href     = url;
              a.download = '';
              a.target   = '_blank';
              a.rel      = 'noopener noreferrer';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            });
          }
        }
      } catch (err) {
        console.warn('[ConversationView] Falha ao carregar URL de mídia:', err);
      }
    }
  }

  /** Lightbox simples — abre imagem em overlay */
  function _openLightbox(url) {
    const overlay = document.createElement('div');
    overlay.className = 'inbox-lightbox-overlay';
    overlay.innerHTML = `
      <div class="inbox-lightbox-inner">
        <img src="${_escAttr(url)}" alt="Imagem ampliada" class="inbox-lightbox-img" />
        <button class="inbox-lightbox-close" title="Fechar">✕</button>
      </div>
    `;
    overlay.querySelector('.inbox-lightbox-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _appendMessages(msgs, prepend = false) {
    if (!_msgList) return;
    const html = msgs.map(_renderMsg).join('');
    if (prepend) {
      _msgList.insertAdjacentHTML('afterbegin', html);
    } else {
      _msgList.insertAdjacentHTML('beforeend', html);
    }
    // Fase 3 — bind nos botões de ação de mensagem
    _bindMsgActions();
    // Fase 4 — carregar URLs signed para blocos de mídia
    _hydrateMediaBlocks(_msgList).catch((e) =>
      console.warn('[ConversationView] _hydrateMediaBlocks error:', e),
    );
  }

  // ── Fase 3 — Ações de mensagem (reply, delete) ────────────────

  function _bindMsgActions() {
    if (!_msgList) return;
    // Usar event delegation para evitar múltiplos listeners
    // (o listener de scroll já está no msgList; reutilizamos delegação no click)
  }

  function _onMsgListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const msgId  = btn.dataset.msgId;

    if (action === 'reply') {
      _startReply(msgId);
    } else if (action === 'delete') {
      _confirmDeleteMessage(msgId);
    }
    // Fase 4 — download-media é tratado pelo listener adicionado em _hydrateMediaBlocks
  }

  function _startReply(msgId) {
    const msg = _messages.find((m) => m.id === msgId);
    if (!msg || msg.is_deleted) return;

    _replyTo = { id: msg.id, message: msg.message, direction: msg.direction };
    _renderReplyPreview();
  }

  function _clearReply() {
    _replyTo = null;
    if (_replyPreviewEl) {
      _replyPreviewEl.innerHTML = '';
      _replyPreviewEl.hidden = true;
    }
  }

  function _renderReplyPreview() {
    if (!_replyPreviewEl || !_replyTo) return;
    const snippet = _esc((_replyTo.message ?? '').substring(0, 120));
    _replyPreviewEl.innerHTML = `
      <div class="reply-to-preview">
        <span class="reply-to-icon">↩</span>
        <span class="reply-to-text">${snippet}</span>
        <button class="reply-to-cancel" aria-label="Cancelar resposta">&times;</button>
      </div>
    `;
    _replyPreviewEl.hidden = false;

    _replyPreviewEl.querySelector('.reply-to-cancel').addEventListener('click', _clearReply);
  }

  async function _confirmDeleteMessage(msgId) {
    if (!_conversation) return;
    if (!confirm('Remover esta mensagem? A ação não pode ser desfeita.')) return;

    const res = await InboxApi.deleteMessage(_conversation.id, msgId);
    if (res.success) {
      // Atualizar no array local
      const idx = _messages.findIndex((m) => m.id === msgId);
      if (idx !== -1) _messages[idx] = { ..._messages[idx], is_deleted: true, message: null };

      // Atualizar DOM
      const el = _msgList?.querySelector(`[data-msg-id="${msgId}"]`);
      if (el) {
        const updated = _messages.find((m) => m.id === msgId);
        el.outerHTML = _renderMsg(updated);
      }
    } else {
      if (window.Notiflix) Notiflix.Notify.failure(res.error?.message || 'Erro ao remover mensagem.');
    }
  }

  // ── Typing indicator helpers (Fase 2) ──────────────────────────

  function _updateTypingBar() {
    if (!_typingBar) return;
    if (_typingAgents.size === 0) {
      _typingBar.textContent = '';
      _typingBar.style.display = 'none';
      return;
    }
    const names = Array.from(_typingAgents.values()).map((a) => a.name);
    const label = names.length === 1
      ? `${_esc(names[0])} está digitando...`
      : `${names.slice(0, 2).map(_esc).join(', ')} estão digitando...`;
    _typingBar.textContent = label;
    _typingBar.style.display = 'block';
  }

  function _onTypingStart(e) {
    const { conversationId, agentId, agentName } = e.detail ?? {};
    if (!_conversation || conversationId !== _conversation.id) return;
    const existing = _typingAgents.get(agentId);
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => { _typingAgents.delete(agentId); _updateTypingBar(); }, TYPING_CLEAR_DELAY);
    _typingAgents.set(agentId, { name: agentName || 'Agente', timer });
    _updateTypingBar();
  }

  function _onTypingStop(e) {
    const { conversationId, agentId } = e.detail ?? {};
    if (!_conversation || conversationId !== _conversation.id) return;
    const existing = _typingAgents.get(agentId);
    if (existing?.timer) clearTimeout(existing.timer);
    _typingAgents.delete(agentId);
    _updateTypingBar();
  }

  function _bindWsTyping() {
    _wsTypingStartHandler = (e) => _onTypingStart(e);
    _wsTypingStopHandler  = (e) => _onTypingStop(e);
    document.addEventListener('inbox:ws:typing:start', _wsTypingStartHandler);
    document.addEventListener('inbox:ws:typing:stop',  _wsTypingStopHandler);
  }

  function _unbindWsTyping() {
    if (_wsTypingStartHandler) {
      document.removeEventListener('inbox:ws:typing:start', _wsTypingStartHandler);
      _wsTypingStartHandler = null;
    }
    if (_wsTypingStopHandler) {
      document.removeEventListener('inbox:ws:typing:stop', _wsTypingStopHandler);
      _wsTypingStopHandler = null;
    }
    _typingAgents.forEach((a) => { if (a.timer) clearTimeout(a.timer); });
    _typingAgents.clear();
  }

  // ── Transfer modal (Fase 2) ───────────────────────────────────

  async function _showTransferModal() {
    if (!_conversation) return;
    let agents = [];
    try {
      const res = await InboxApi.listAgents();
      agents = res.data?.agents ?? [];
    } catch (e) {
      console.error('[ConversationView] Erro ao buscar agentes:', e);
    }

    document.getElementById('inbox-transfer-modal')?.remove();

    const options = agents.map((a) => `
      <div class="transfer-agent-option" data-agent-id="${a.id}" role="button" tabindex="0">
        <span>${_esc(a.display_name || 'Agente')}</span>
      </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'inbox-transfer-modal';
    modal.className = 'inbox-transfer-modal';
    modal.innerHTML = `
      <div class="inbox-transfer-dialog">
        <div class="inbox-transfer-dialog-header">
          <strong>Transferir conversa</strong>
          <button class="btn-close-modal" aria-label="Fechar">×</button>
        </div>
        <div class="inbox-transfer-dialog-body">
          <p>Selecione o agente destino:</p>
          <div class="transfer-agents-list">${options || '<p class="text-muted">Nenhum agente disponível.</p>'}</div>
          <hr>
          <button class="btn btn-sm btn-outline-secondary w-100" id="inbox-transfer-unassign">Desatribuir</button>
        </div>
        <div class="inbox-transfer-dialog-footer">
          <label for="inbox-transfer-note" class="form-label form-label-sm">Nota (opcional):</label>
          <input id="inbox-transfer-note" class="form-control form-control-sm"
                 placeholder="Ex: Especialidade técnica" maxlength="200">
        </div>
      </div>
      <div class="inbox-transfer-backdrop"></div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.btn-close-modal').addEventListener('click', close);
    modal.querySelector('.inbox-transfer-backdrop').addEventListener('click', close);

    modal.querySelectorAll('.transfer-agent-option').forEach((el) => {
      const go = async () => {
        const toAgentId = el.dataset.agentId;
        const note      = modal.querySelector('#inbox-transfer-note')?.value ?? '';
        close();
        await _doTransfer(toAgentId, note);
      };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(); });
    });

    modal.querySelector('#inbox-transfer-unassign').addEventListener('click', async () => {
      const note = modal.querySelector('#inbox-transfer-note')?.value ?? '';
      close();
      await _doTransfer(null, note);
    });
  }

  async function _doTransfer(toAgentId, note) {
    if (!_conversation) return;
    const res = await InboxApi.transfer(_conversation.id, toAgentId, note);
    if (res.success) {
      _conversation = { ..._conversation, assigned_agent_id: toAgentId };
      _renderHeader(_conversation);
      if (window.Notiflix) Notiflix.Notify.success('Conversa transferida com sucesso.');
    } else {
      if (window.Notiflix) Notiflix.Notify.failure(res.error?.message || 'Erro ao transferir.');
    }
  }

  // ── Header ────────────────────────────────────────────────────

  function _renderHeader(conv) {
    if (!_header) return;
    const name   = conv.contact?.name || conv.contact_name || conv.contact_phone || 'Contato';
    const status = conv.status;
    const isClosed = status === 'closed' || status === 'archived';

    _header.innerHTML = `
      <div class="inbox-view-header-info">
        <span class="inbox-view-contact">${_esc(name)}</span>
        <span class="inbox-view-status inbox-view-status--${status}">${_esc(status)}</span>
      </div>
      <div class="inbox-view-actions">
        ${!isClosed
          ? `<button class="btn btn-sm btn-outline-secondary" id="inbox-btn-assign-me">Atribuir a mim</button>
             <button class="btn btn-sm btn-outline-info"      id="inbox-btn-transfer">Transferir</button>
             <button class="btn btn-sm btn-outline-warning"   id="inbox-btn-close">Fechar</button>`
          : `<button class="btn btn-sm btn-outline-success"   id="inbox-btn-reopen">Reabrir</button>`
        }
      </div>
    `;

    _header.querySelector('#inbox-btn-assign-me')?.addEventListener('click', _doAssignMe);
    _header.querySelector('#inbox-btn-transfer')?.addEventListener('click', _showTransferModal);
    _header.querySelector('#inbox-btn-close')?.addEventListener('click', () => _doUpdateStatus('closed'));
    _header.querySelector('#inbox-btn-reopen')?.addEventListener('click', () => _doUpdateStatus('open'));
  }

  // ── Ações ─────────────────────────────────────────────────────

  async function _doAssignMe() {
    const res = await InboxApi.assignToMe(_conversation.id);
    if (res.success) {
      _conversation = { ..._conversation, ...res.data };
      _renderHeader(_conversation);
      if (window.Notiflix) Notiflix.Notify.success('Conversa atribuída a você.');
    } else {
      if (window.Notiflix) Notiflix.Notify.failure(res.error?.message || 'Erro ao atribuir.');
    }
  }

  async function _doUpdateStatus(newStatus) {
    const res = await InboxApi.updateStatus(_conversation.id, newStatus);
    if (res.success) {
      _conversation = { ..._conversation, status: newStatus };
      _renderHeader(_conversation);
      MessageComposer.setConversation(
        _conversation.id,
        newStatus !== 'closed' && newStatus !== 'archived',
      );
      document.dispatchEvent(
        new CustomEvent('inbox:conversation-updated', { detail: { conversation: _conversation } }),
      );
    } else {
      if (window.Notiflix) Notiflix.Notify.failure(res.error?.message || 'Erro ao alterar status.');
    }
  }

  // ── Realtime ──────────────────────────────────────────────────

  function _handleRealtimeMessage(payload) {
    const { eventType, new: newRow } = payload;

    if (eventType === 'INSERT') {
      _messages.push(newRow);
      _appendMessages([newRow]);
      _scrollToBottom();
      void InboxApi.markRead(_conversation.id);
    } else if (eventType === 'UPDATE') {
      const idx = _messages.findIndex((m) => m.id === newRow.id);
      if (idx !== -1) _messages[idx] = { ..._messages[idx], ...newRow };

      // Re-renderizar a mensagem atualizada no DOM (cobre is_deleted via realtime)
      const el = _msgList?.querySelector(`[data-msg-id="${newRow.id}"]`);
      if (el) {
        el.outerHTML = _renderMsg(_messages.find((m) => m.id === newRow.id) ?? newRow);
      }
    }
  }

  // ── Scroll ────────────────────────────────────────────────────

  function _scrollToBottom() {
    if (_msgList) _msgList.scrollTop = _msgList.scrollHeight;
  }

  function _onScroll() {
    if (_msgList.scrollTop < 80 && !_loadingOlder && _oldestCursor) {
      _loadOlderMessages();
    }
  }

  async function _loadOlderMessages() {
    if (_loadingOlder || !_oldestCursor) return;
    _loadingOlder = true;

    const prevScrollHeight = _msgList.scrollHeight;

    try {
      const res = await InboxApi.getMessages(_conversation.id, _oldestCursor);
      if (res.success && res.data?.messages?.length > 0) {
        const older = res.data.messages;
        _messages   = [...older, ..._messages];
        _appendMessages(older, true);
        _oldestCursor = res.data.meta?.oldest_cursor ?? null;
        _msgList.scrollTop = _msgList.scrollHeight - prevScrollHeight;
      } else {
        _oldestCursor = null;
      }
    } catch (err) {
      console.error('[ConversationView] Erro ao carregar mensagens antigas:', err);
    } finally {
      _loadingOlder = false;
    }
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /**
     * Inicializa o componente nos containers informados.
     * @param {Object} els — { header, msgList, composer, typingBar?, replyPreview? }
     */
    init(els) {
      _header         = els.header;
      _msgList        = els.msgList;
      _composerEl     = els.composer;
      _typingBar      = els.typingBar ?? null;
      _replyPreviewEl = els.replyPreview ?? null; // Fase 3

      if (!MessageComposer._initialized) {
        MessageComposer.init(_composerEl, {
          onSend: async (text) => {
            if (!_conversation) return;
            const replyToId = _replyTo?.id ?? null;
            const res = await InboxApi.sendMessage(_conversation.id, text, replyToId);
            if (res.success) {
              _clearReply();
            } else {
              if (window.Notiflix) Notiflix.Notify.failure(res.error?.message || 'Erro ao enviar.');
            }
          },
        });
        MessageComposer._initialized = true;
      }

      _msgList.addEventListener('scroll', _onScroll);
      // Fase 3 — delegação de cliques para reply/delete
      _msgList.addEventListener('click', _onMsgListClick);
      _bindWsTyping();
    },

    /**
     * Abre e renderiza uma conversa.
     * @param {string} conversationId
     */
    async open(conversationId) {
      _messages       = [];
      _oldestCursor   = null;
      _loadingOlder   = false;
      _clearReply();

      if (_msgList) _msgList.innerHTML = '<div class="inbox-loading"><span class="spinner-sm"></span></div>';

      try {
        const res = await InboxApi.getConversation(conversationId);
        if (!res.success) {
          _msgList.innerHTML = '<div class="inbox-error">Erro ao carregar conversa.</div>';
          return;
        }

        _conversation = res.data.conversation;
        _messages     = res.data.messages ?? [];
        _oldestCursor = res.data.oldest_cursor ?? null;

        const isClosed = _conversation.status === 'closed' || _conversation.status === 'archived';

        _renderHeader(_conversation);
        _msgList.innerHTML = '';
        _appendMessages(_messages);
        _scrollToBottom();

        MessageComposer.setConversation(_conversation.id, !isClosed);
        if (!isClosed) MessageComposer.focus();

        InboxRealtime.subscribeConversation(conversationId, _handleRealtimeMessage);
        void InboxApi.markRead(conversationId);

      } catch (err) {
        console.error('[ConversationView] Erro ao abrir conversa:', err);
        _msgList.innerHTML = '<div class="inbox-error">Falha ao carregar conversa.</div>';
      }
    },

    /** Limpa a view. */
    clear() {
      _unbindWsTyping();
      _clearReply();
      InboxRealtime.unsubscribeConversation();
      document.getElementById('inbox-transfer-modal')?.remove();
      _conversation = null;
      _messages     = [];
      if (_header)  _header.innerHTML  = '';
      if (_msgList) {
        _msgList.removeEventListener('click', _onMsgListClick);
        _msgList.innerHTML = '';
      }
      if (_typingBar) { _typingBar.textContent = ''; _typingBar.style.display = 'none'; }
      MessageComposer.setConversation(null, false);
    },

    destroy() {
      this.clear();
      _header         = null;
      _msgList        = null;
      _composerEl     = null;
      _typingBar      = null;
      _replyPreviewEl = null;
    },
  };
})();

window.ConversationView = ConversationView;
