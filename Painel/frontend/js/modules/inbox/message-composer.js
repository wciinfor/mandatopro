/**
 * MessageComposer — caixa de texto para envio de mensagens.
 * - Suporte a Enter (enviar) / Shift+Enter (nova linha)
 * - Estado de envio com loading
 * - Emite evento 'inbox:message-sent' após envio bem-sucedido
 *
 * Fase 4:
 * - Botão de anexo (clip) com input[type=file] oculto
 * - Preview de mídia antes de enviar (imagem ou ícone genérico)
 * - Estado de upload com indicador de progresso
 * - Envio de mídia via InboxApi.uploadMedia + InboxApi.sendMedia
 *
 * Depende de: window.InboxApi, window.Notiflix (opcional)
 */
const MessageComposer = (() => {
  let _container      = null;
  let _textarea       = null;
  let _sendBtn        = null;
  let _attachBtn      = null;
  let _fileInput      = null;
  let _previewEl      = null;
  let _conversationId = null;
  let _sending        = false;

  /** Anexo pendente: { attachmentId, filename, mediaType, previewUrl } | null */
  let _pendingAttachment = null;

  // Tipos aceitos pelo input[type=file]
  const ACCEPT_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].join(',');

  // ── Construção do DOM ─────────────────────────────────────────

  function _build(container) {
    container.innerHTML = `
      <div class="inbox-composer">
        <div class="inbox-composer-media-preview" style="display:none;"></div>
        <div class="inbox-composer-row">
          <button class="btn btn-sm inbox-composer-attach" type="button" title="Anexar arquivo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            type="file"
            class="inbox-composer-file-input"
            accept="${ACCEPT_TYPES}"
            style="display:none;"
          />
          <textarea
            class="inbox-composer-input"
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows="2"
            maxlength="4096"
          ></textarea>
          <div class="inbox-composer-actions">
            <button class="btn btn-primary btn-sm inbox-composer-send" type="button" disabled>
              Enviar
            </button>
          </div>
        </div>
      </div>
    `;

    _textarea   = container.querySelector('.inbox-composer-input');
    _sendBtn    = container.querySelector('.inbox-composer-send');
    _attachBtn  = container.querySelector('.inbox-composer-attach');
    _fileInput  = container.querySelector('.inbox-composer-file-input');
    _previewEl  = container.querySelector('.inbox-composer-media-preview');

    _textarea.addEventListener('input', _onInput);
    _textarea.addEventListener('keydown', _onKeyDown);
    _sendBtn.addEventListener('click', _doSend);
    _attachBtn.addEventListener('click', () => _fileInput.click());
    _fileInput.addEventListener('change', _onFileSelected);
  }

  // ── Eventos ───────────────────────────────────────────────────

  function _onInput() {
    const hasText   = _textarea.value.trim().length > 0;
    const hasMedia  = _pendingAttachment !== null;
    _sendBtn.disabled = (!hasText && !hasMedia) || _sending;
  }

  function _onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!_sendBtn.disabled) _doSend();
    }
  }

  async function _onFileSelected() {
    const file = _fileInput.files?.[0];
    if (!file || !_conversationId) {
      _fileInput.value = '';
      return;
    }

    // Limpar attachment anterior se houver
    _clearAttachment();

    // Mostrar preview de loading
    _showPreviewLoading(file);
    _setSending(true);

    try {
      const res = await InboxApi.uploadMedia(_conversationId, file);
      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao enviar arquivo');
      }

      const { attachment, signedUrl } = res.data;
      _pendingAttachment = {
        attachmentId: attachment.id,
        filename:     attachment.filename,
        mediaType:    attachment.media_type,
        previewUrl:   signedUrl,
      };

      _showPreviewReady(attachment, signedUrl);
    } catch (err) {
      console.error('[MessageComposer] Erro ao upar arquivo:', err);
      _clearAttachment();
      if (window.Notiflix) {
        Notiflix.Notify.failure(err.message || 'Falha ao enviar arquivo. Tente novamente.');
      }
    } finally {
      _setSending(false);
      _fileInput.value = '';
      _onInput();
    }
  }

  async function _doSend() {
    if (!_conversationId || _sending) return;

    const text    = _textarea.value.trim();
    const media   = _pendingAttachment;
    const hasText = text.length > 0;
    const hasMedia = media !== null;

    if (!hasText && !hasMedia) return;

    _setSending(true);

    try {
      if (hasMedia) {
        // Enviar mídia (com caption opcional)
        const res = await InboxApi.sendMedia(_conversationId, media.attachmentId, text || undefined);
        if (!res.success) {
          throw new Error(res.error?.message || 'Erro ao enviar mídia');
        }
        _clearAttachment();
        _textarea.value = '';
        _textarea.style.height = '';
      } else {
        // Enviar texto puro
        const res = await InboxApi.sendMessage(_conversationId, text);
        if (!res.success) {
          throw new Error(res.error?.message || 'Erro ao enviar mensagem');
        }
        _textarea.value = '';
        _textarea.style.height = '';
      }

      document.dispatchEvent(
        new CustomEvent('inbox:message-sent', { detail: { conversationId: _conversationId } }),
      );
    } catch (err) {
      console.error('[MessageComposer] Erro ao enviar:', err);
      if (window.Notiflix) {
        Notiflix.Notify.failure(err.message || 'Falha ao enviar. Tente novamente.');
      }
    } finally {
      _setSending(false);
      _onInput();
    }
  }

  // ── Preview de mídia ──────────────────────────────────────────

  function _showPreviewLoading(file) {
    _previewEl.style.display = 'flex';
    _previewEl.innerHTML = `
      <div class="composer-preview-item loading">
        <span class="composer-preview-name">${_escHtml(file.name)}</span>
        <span class="composer-preview-size">${_formatSize(file.size)}</span>
        <span class="composer-preview-spinner">⏳ Enviando...</span>
      </div>
    `;
  }

  function _showPreviewReady(attachment, signedUrl) {
    const isImage = attachment.media_type === 'image';
    _previewEl.style.display = 'flex';
    _previewEl.innerHTML = `
      <div class="composer-preview-item">
        ${isImage
          ? `<img src="${signedUrl}" alt="${_escHtml(attachment.filename)}" class="composer-preview-thumb" />`
          : `<span class="composer-preview-icon">${_mediaIcon(attachment.media_type)}</span>`
        }
        <div class="composer-preview-info">
          <span class="composer-preview-name">${_escHtml(attachment.filename)}</span>
          <span class="composer-preview-size">${_formatSize(attachment.size_bytes)}</span>
        </div>
        <button class="composer-preview-remove" title="Remover arquivo">✕</button>
      </div>
    `;
    _previewEl.querySelector('.composer-preview-remove')?.addEventListener('click', () => {
      _clearAttachment();
      _onInput();
    });
  }

  function _clearAttachment() {
    _pendingAttachment = null;
    if (_previewEl) {
      _previewEl.style.display = 'none';
      _previewEl.innerHTML = '';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  function _setSending(value) {
    _sending             = value;
    _sendBtn.disabled    = value;
    _sendBtn.textContent = value ? '...' : 'Enviar';
    if (_attachBtn) _attachBtn.disabled = value;
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _formatSize(bytes) {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function _mediaIcon(type) {
    const icons = { image: '🖼️', video: '🎬', audio: '🎵', document: '📄' };
    return icons[type] ?? '📎';
  }

  // ── API pública ───────────────────────────────────────────────

  return {
    /**
     * Inicializa o composer no container informado.
     * @param {HTMLElement} container
     */
    init(container) {
      _container = container;
      _build(container);
    },

    /**
     * Define a conversa ativa (habilita ou desabilita o composer).
     * @param {string|null} conversationId
     * @param {boolean} enabled — false para conversas fechadas/arquivadas
     */
    setConversation(conversationId, enabled = true) {
      _conversationId    = conversationId;
      _clearAttachment();
      if (_textarea) {
        _textarea.disabled  = !enabled;
        _textarea.value     = '';
        if (_attachBtn) _attachBtn.disabled = !enabled;
        if (!enabled) {
          _textarea.placeholder = 'Conversa encerrada — reabra para enviar mensagens.';
          _sendBtn.disabled     = true;
        } else {
          _textarea.placeholder = 'Digite uma mensagem... (Enter para enviar)';
          _onInput();
        }
      }
    },

    /** Foca no campo de texto. */
    focus() {
      _textarea?.focus();
    },

    destroy() {
      _container         = null;
      _textarea          = null;
      _sendBtn           = null;
      _attachBtn         = null;
      _fileInput         = null;
      _previewEl         = null;
      _conversationId    = null;
      _pendingAttachment = null;
    },
  };
})();

window.MessageComposer = MessageComposer;
