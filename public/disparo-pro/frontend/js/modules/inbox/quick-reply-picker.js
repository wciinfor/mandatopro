/**
 * QuickReplyPicker — componente para seleção de respostas rápidas.
 *
 * Uso:
 *   QuickReplyPicker.init(textareaEl, onSelectCallback)
 *
 * Gatilho automático: digitar "/" no início de uma linha no textarea.
 * Também pode ser aberto programaticamente via QuickReplyPicker.show(filter).
 *
 * Depende de: window.InboxApi
 */
const QuickReplyPicker = (() => {
  let _textarea   = null;
  let _onSelect   = null;    // (reply: QuickReply) => void
  let _listEl     = null;    // elemento DOM do painel
  let _replies    = [];      // cache da lista completa
  let _filtered   = [];      // lista filtrada atual
  let _activeIdx  = -1;      // índice selecionado por teclado
  let _visible    = false;

  // ── Carregamento ──────────────────────────────────────────────

  async function _loadReplies(search = '') {
    try {
      const res = await InboxApi.listQuickReplies(search || undefined);
      if (res.success) {
        _replies = res.data?.replies ?? [];
      }
    } catch (e) {
      console.warn('[QuickReplyPicker] Erro ao carregar respostas rápidas:', e);
    }
  }

  // ── Renderização ──────────────────────────────────────────────

  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _renderList() {
    if (!_listEl) return;

    if (_filtered.length === 0) {
      _listEl.innerHTML = '<div class="qrp-empty">Nenhuma resposta encontrada</div>';
      return;
    }

    _listEl.innerHTML = _filtered.map((r, i) => `
      <div class="qrp-item ${i === _activeIdx ? 'qrp-item--active' : ''}"
           data-idx="${i}" role="option" aria-selected="${i === _activeIdx}">
        <span class="qrp-shortcut">${_esc(r.shortcut)}</span>
        <span class="qrp-title">${_esc(r.title)}</span>
        <span class="qrp-body-preview">${_esc((r.body ?? '').substring(0, 60))}</span>
      </div>
    `).join('');

    _listEl.querySelectorAll('.qrp-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // evita blur no textarea
        _selectIndex(parseInt(el.dataset.idx, 10));
      });
      el.addEventListener('mouseover', () => {
        _activeIdx = parseInt(el.dataset.idx, 10);
        _renderList();
      });
    });
  }

  function _positionNearTextarea() {
    if (!_textarea || !_listEl) return;
    const rect = _textarea.getBoundingClientRect();
    _listEl.style.position   = 'fixed';
    _listEl.style.bottom     = `${window.innerHeight - rect.top + 4}px`;
    _listEl.style.left       = `${rect.left}px`;
    _listEl.style.width      = `${rect.width}px`;
    _listEl.style.zIndex     = '9999';
  }

  // ── Seleção ───────────────────────────────────────────────────

  function _selectIndex(idx) {
    if (idx < 0 || idx >= _filtered.length) return;
    const reply = _filtered[idx];

    // Limpar o gatilho "/" e o filtro do textarea
    if (_textarea) {
      const val    = _textarea.value;
      const slashIdx = val.lastIndexOf('/');
      _textarea.value = slashIdx >= 0 ? val.substring(0, slashIdx) : val;
    }

    hide();
    if (_onSelect) _onSelect(reply);
  }

  // ── Keyboard nav ─────────────────────────────────────────────

  function _onKeydown(e) {
    if (!_visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIdx = Math.min(_activeIdx + 1, _filtered.length - 1);
      _renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIdx = Math.max(_activeIdx - 1, 0);
      _renderList();
    } else if (e.key === 'Enter' && _activeIdx >= 0) {
      e.preventDefault();
      _selectIndex(_activeIdx);
    } else if (e.key === 'Escape') {
      hide();
    }
  }

  // ── Gatilho automático por "/" ────────────────────────────────

  function _onInput() {
    const val   = _textarea?.value ?? '';
    const pos   = _textarea?.selectionStart ?? 0;
    const chunk = val.substring(0, pos);
    const match = chunk.match(/(?:^|\n)(\/[\w]*)$/);

    if (match) {
      const term = match[1];
      show(term);
    } else {
      hide();
    }
  }

  // ── API pública ───────────────────────────────────────────────

  /**
   * Inicializa o picker vinculado a um textarea.
   * @param {HTMLTextAreaElement} textareaEl
   * @param {function} onSelectCallback — recebe o objeto QuickReply selecionado
   */
  function init(textareaEl, onSelectCallback) {
    _textarea = textareaEl;
    _onSelect = onSelectCallback;

    // Criar elemento do painel se ainda não existe
    if (!_listEl) {
      _listEl = document.createElement('div');
      _listEl.id = 'qrp-panel';
      _listEl.className = 'qrp-panel';
      _listEl.setAttribute('role', 'listbox');
      _listEl.setAttribute('aria-label', 'Respostas rápidas');
      _listEl.hidden = true;
      document.body.appendChild(_listEl);
    }

    _textarea.addEventListener('input',   _onInput);
    _textarea.addEventListener('keydown', _onKeydown);
    _textarea.addEventListener('blur',    () => setTimeout(hide, 150));

    // Pré-carregar
    void _loadReplies();
  }

  /**
   * Abre o painel com filtragem opcional.
   * @param {string} [filter] — shortcut parcial (ex: "/sauda")
   */
  async function show(filter = '') {
    if (_replies.length === 0) await _loadReplies();

    const term = filter.replace(/^\//, '').toLowerCase();
    _filtered  = term
      ? _replies.filter((r) =>
          r.shortcut.toLowerCase().includes(term) ||
          r.title.toLowerCase().includes(term),
        )
      : _replies.slice(0, 10); // primeiros 10 sem filtro

    _activeIdx = _filtered.length > 0 ? 0 : -1;
    _visible   = true;

    if (_listEl) {
      _listEl.hidden = false;
      _positionNearTextarea();
      _renderList();
    }
  }

  /** Fecha o painel. */
  function hide() {
    _visible   = false;
    _activeIdx = -1;
    if (_listEl) _listEl.hidden = true;
  }

  /** Desvincula e remove o painel do DOM. */
  function destroy() {
    if (_textarea) {
      _textarea.removeEventListener('input',   _onInput);
      _textarea.removeEventListener('keydown', _onKeydown);
      _textarea.removeEventListener('blur',    hide);
      _textarea = null;
    }
    _listEl?.remove();
    _listEl  = null;
    _replies = [];
    _onSelect = null;
  }

  return { init, show, hide, destroy };
})();

window.QuickReplyPicker = QuickReplyPicker;
