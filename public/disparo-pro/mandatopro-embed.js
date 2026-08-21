(() => {
  const originalInitialize = window.AuthManager?.initialize?.bind(window.AuthManager);
  const originalFetch = window.fetch.bind(window);

  document.body?.classList?.add('mandatopro-embedded');

  function getMandatoUser() {
    try {
      return JSON.parse(window.localStorage.getItem('usuario') || 'null');
    } catch {
      return null;
    }
  }

  function patchAuth() {
    if (!window.AuthManager) return;

    window.AuthManager.initialize = async function initializeMandatoEmbed() {
      const user = getMandatoUser() || { id: 'mandatopro', email: 'mandatopro@local' };
      this.currentUser = user;
      this.userProfile = user;
      this.isAuthenticated = true;
      this.showMainApp();
      await window.App?.initializeApp?.();
      if (typeof window.SupabaseDataManager?.loadUserInstances === 'function') {
        await window.SupabaseDataManager.loadUserInstances();
      }
      if (typeof window.ProfileManager?.loadProfile === 'function') {
        window.ProfileManager.loadProfile();
      }
    };

    window.AuthManager.requireAuth = () => true;
    window.AuthManager.showLoginScreen = function showMandatoMainApp() {
      this.showMainApp();
    };
    window.AuthManager.forceShowLoginScreen = function forceMandatoMainApp() {
      this.showMainApp();
    };
    window.AuthManager.handleLogout = function redirectMandatoLogout() {
      window.top.location.href = '/login';
    };
  }

  async function getAccessToken() {
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashToken = hashParams.get('mandato_token');
      if (hashToken) return hashToken;
    } catch {
      // Ignora hash invalido e tenta o cliente Supabase do iframe.
    }

    try {
      const result = await window.SupabaseClient?.auth?.getSession?.();
      return result?.data?.session?.access_token || '';
    } catch {
      try {
        const url = window.APP_ENV?.SUPABASE_URL || '';
        const ref = url.replace(/^https?:\/\//, '').split('.')[0];
        if (!ref) return '';
        const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.access_token || '';
      } catch {
        return '';
      }
    }
  }

  function patchFetchAuth() {
    window.fetch = async function fetchMandatoPro(input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (!url.startsWith('/api/disparos/')) {
        return originalFetch(input, init);
      }

      const token = await getAccessToken();
      const headers = new Headers(init.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      let body = init.body;
      if ((url.includes('/api/disparos/enviar') || url.includes('/api/disparos/n8n')) && typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          if (parsed?.action === 'enviar_mensagem') {
            const templateSelect = document.getElementById('mandatoTemplateSelect');
            const beneficioInput = document.getElementById('mandatoBeneficioInput');
            const parlamentarSelect = document.getElementById('mandatoParlamentarSelect');

            if (templateSelect && templateSelect.value) {
              parsed.templateName = templateSelect.value;
              parsed.beneficio = beneficioInput?.value?.trim() || 'Óculos';
              parsed.servico = parsed.beneficio;
              if (parlamentarSelect && parlamentarSelect.value) {
                parsed.parlamentar = {
                  nome: parlamentarSelect.value
                };
                parsed.nomeParlamentar = parlamentarSelect.value;
              }
              body = JSON.stringify(parsed);
            }
          }
        } catch {
          // Mantém body original
        }
      }

      return originalFetch(input, {
        ...init,
        headers,
        body,
        credentials: init.credentials || 'include'
      });
    };
  }

  function addMandatoContactsButton() {
    const contactsSection = document.getElementById('contatos-section');
    if (!contactsSection || document.getElementById('mandatoProContactsBox')) return;

    const box = document.createElement('div');
    box.id = 'mandatoProContactsBox';
    box.className = 'card mb-4 border-primary';
    box.innerHTML = `
      <div class="card-header bg-primary text-white">
        <h5 class="mb-0"><i class="bi bi-database me-2"></i>Base MandatoPro</h5>
      </div>
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-md-3">
            <label class="form-label">Origem</label>
            <select id="mandatoOrigem" class="form-control">
              <option value="eleitores">Eleitores</option>
              <option value="liderancas">Lideranças</option>
              <option value="funcionarios">Funcionários</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Campanha</label>
            <select id="mandatoCampanha" class="form-control">
              <option value="">Todas as campanhas</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Presen&ccedil;a</label>
            <select id="mandatoPresencaCampanha" class="form-control">
              <option value="">Todos</option>
              <option value="presentes">Presentes na campanha</option>
              <option value="ausentes">Ausentes na campanha</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Cidade</label>
            <input id="mandatoCidade" class="form-control" placeholder="Cidade">
          </div>
          <div class="col-md-2">
            <label class="form-label">Bairro</label>
            <input id="mandatoBairro" class="form-control" placeholder="Bairro">
          </div>
          <div class="col-md-1">
            <label class="form-label">Limite</label>
            <input id="mandatoLimite" type="number" class="form-control" value="1000" min="1" max="50000">
          </div>
          <div class="col-md-10">
            <label class="form-label">Busca por nome</label>
            <input id="mandatoBusca" class="form-control" placeholder="Digite o nome do eleitor">
          </div>
          <div class="col-md-2">
            <button id="mandatoImportBtn" type="button" class="btn btn-primary w-100">
              <i class="bi bi-cloud-download me-2"></i>Importar
            </button>
          </div>
        </div>
        <div id="mandatoContactsCount" class="alert alert-light border mt-3 mb-0 py-2">
          <i class="bi bi-people me-2"></i>Use os filtros para calcular a quantidade de contatos.
        </div>
        <small class="text-muted d-block mt-2">Importa contatos direto da base do MandatoPro, mantendo o CSV/Excel disponivel.</small>
      </div>
    `;

    const header = contactsSection.querySelector('.content-header');
    header?.insertAdjacentElement('afterend', box);

    const origemSelect = document.getElementById('mandatoOrigem');
    origemSelect?.addEventListener('change', updateMandatoCampaignFilterState);
    updateMandatoCampaignFilterState();
    loadMandatoCampaigns();
    bindMandatoFilterPreview();
    updateMandatoContactsPreview();
    document.getElementById('mandatoImportBtn')?.addEventListener('click', importMandatoContacts);
  }

  function getMandatoContactParams({ preview = false } = {}) {
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const cidade = document.getElementById('mandatoCidade')?.value || '';
    const bairro = document.getElementById('mandatoBairro')?.value || '';
    const search = document.getElementById('mandatoBusca')?.value || '';
    const limit = preview ? '50000' : document.getElementById('mandatoLimite')?.value || '1000';
    const campanhaId = origem === 'eleitores'
      ? document.getElementById('mandatoCampanha')?.value || ''
      : '';
    const presencaCampanha = origem === 'eleitores' && campanhaId
      ? document.getElementById('mandatoPresencaCampanha')?.value || ''
      : '';

    return new URLSearchParams({ origem, cidade, bairro, search, limit, campanhaId, presencaCampanha });
  }

  function bindMandatoFilterPreview() {
    const fields = ['mandatoOrigem', 'mandatoCampanha', 'mandatoPresencaCampanha', 'mandatoCidade', 'mandatoBairro', 'mandatoBusca', 'mandatoLimite'];
    for (const id of fields) {
      const element = document.getElementById(id);
      if (!element || element.dataset.mandatoPreviewBound === 'true') continue;

      element.dataset.mandatoPreviewBound = 'true';
      const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventName, scheduleMandatoContactsPreview);
      if (id === 'mandatoCampanha') {
        element.addEventListener('change', updateMandatoCampaignFilterState);
      }
    }
  }

  function scheduleMandatoContactsPreview() {
    clearTimeout(window.__mandatoContactsPreviewTimer);
    window.__mandatoContactsPreviewTimer = setTimeout(updateMandatoContactsPreview, 450);
  }

  async function updateMandatoContactsPreview() {
    const countBox = document.getElementById('mandatoContactsCount');
    const importBtn = document.getElementById('mandatoImportBtn');
    if (!countBox) return;

    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const label = origem === 'eleitores' ? 'eleitores' : origem === 'liderancas' ? 'lideranças' : 'funcionários';
    countBox.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Calculando quantidade...';
    if (importBtn && !importBtn.dataset.importing) {
      importBtn.disabled = true;
    }

    try {
      const params = getMandatoContactParams({ preview: true });
      const response = await fetch(`/api/disparos/contatos/preview?${params.toString()}`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao calcular contatos');

      const contatos = Array.isArray(payload.data) ? payload.data : [];
      const resumo = payload.resumo || {};

      let encontrados = Number(resumo.total || contatos.length || 0);
      let aptos = 0;
      let semTelefone = 0;
      let invalidosFormat = 0;
      let compartilhados = 0;

      if (contatos.length > 0) {
        for (const c of contatos) {
          const hasValidPhone = Boolean(c.telefoneNormalizado || (c.valido && c.phone));
          if (hasValidPhone || c.duplicado) {
            aptos++;
            if (c.duplicado || c.motivoInvalido === 'Telefone duplicado') {
              compartilhados++;
            }
          } else {
            if (!c.telefoneOriginal || c.motivoInvalido === 'Telefone ausente ou incompleto') {
              semTelefone++;
            } else {
              invalidosFormat++;
            }
          }
        }
      } else {
        aptos = Number(resumo.validos || 0);
        compartilhados = Number(resumo.duplicados || 0);
        const naoEnviadosTotal = Math.max(0, encontrados - aptos);
        semTelefone = naoEnviadosTotal;
      }

      const naoEnviados = Math.max(0, encontrados - aptos);
      const hasContacts = aptos > 0;

      if (importBtn && !importBtn.dataset.importing) {
        importBtn.disabled = !hasContacts;
      }

      countBox.className = 'alert alert-light border mt-3 mb-0 p-3';
      countBox.innerHTML = `
        <div class="d-flex flex-column gap-2">
          <div class="d-flex align-items-center justify-content-between pb-2 border-bottom">
            <span class="fw-bold text-dark fs-6">
              <i class="bi bi-people-fill text-primary me-2"></i>👥 ${encontrados.toLocaleString('pt-BR')} ${label} encontrados
            </span>
          </div>
          <div class="row g-2 text-center my-1">
            <div class="col-6">
              <div class="p-2 rounded bg-success-subtle border border-success-subtle text-success-emphasis">
                <span class="d-block fw-bold fs-5">✓ ${aptos.toLocaleString('pt-BR')}</span>
                <small class="fw-semibold">aptos para envio</small>
              </div>
            </div>
            <div class="col-6">
              <div class="p-2 rounded bg-warning-subtle border border-warning-subtle text-warning-emphasis">
                <span class="d-block fw-bold fs-5">⚠ ${naoEnviados.toLocaleString('pt-BR')}</span>
                <small class="fw-semibold">não serão enviados</small>
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap justify-content-around text-muted small pt-1 border-top">
            <span>Sem telefone: <strong class="text-dark">${semTelefone.toLocaleString('pt-BR')}</strong></span>
            <span class="text-secondary">|</span>
            <span>Inválidos: <strong class="text-dark">${invalidosFormat.toLocaleString('pt-BR')}</strong></span>
            <span class="text-secondary">|</span>
            <span>Tel. Compartilhado: <strong class="text-dark">${compartilhados.toLocaleString('pt-BR')}</strong></span>
          </div>
        </div>
      `;
    } catch (error) {
      if (importBtn && !importBtn.dataset.importing) {
        importBtn.disabled = true;
      }
      countBox.className = 'alert alert-danger border mt-3 mb-0 py-2';
      countBox.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${error.message || 'Erro ao calcular contatos'}`;
    }
  }

  function updateMandatoCampaignFilterState() {
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const campanhaSelect = document.getElementById('mandatoCampanha');
    const presencaSelect = document.getElementById('mandatoPresencaCampanha');
    if (!campanhaSelect) return;

    const enabled = origem === 'eleitores';
    campanhaSelect.disabled = !enabled;
    if (!enabled) campanhaSelect.value = '';

    if (presencaSelect) {
      const presencaEnabled = enabled && Boolean(campanhaSelect.value);
      presencaSelect.disabled = !presencaEnabled;
      if (!presencaEnabled) presencaSelect.value = '';
    }
  }

  function formatMandatoCampaignLabel(campaign) {
    const date = campaign.data_campanha
      ? new Date(`${campaign.data_campanha}T00:00:00`).toLocaleDateString('pt-BR')
      : '';
    const place = campaign.municipio || campaign.local || '';
    return [campaign.nome, place, date].filter(Boolean).join(' - ');
  }

  async function loadMandatoCampaigns() {
    const campanhaSelect = document.getElementById('mandatoCampanha');
    if (!campanhaSelect || campanhaSelect.dataset.loaded === 'true') return;

    try {
      const response = await fetch('/api/disparos/contatos/campanhas?limit=200', {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao listar campanhas');

      campanhaSelect.innerHTML = '<option value="">Todas as campanhas</option>';
      for (const campaign of payload.data || []) {
        const option = document.createElement('option');
        option.value = campaign.id;
        option.textContent = formatMandatoCampaignLabel(campaign);
        campanhaSelect.appendChild(option);
      }
      campanhaSelect.dataset.loaded = 'true';
      updateMandatoContactsPreview();
    } catch (error) {
      console.error('Erro ao carregar campanhas no filtro MandatoPro:', error);
    }
  }

  function getContactManager() {
    try {
      if (typeof ContactManager !== 'undefined') return ContactManager;
    } catch {
      return null;
    }
    return window.ContactManager || null;
  }

  function getTimeEstimator() {
    try {
      if (typeof TimeEstimator !== 'undefined') return TimeEstimator;
    } catch {
      return null;
    }
    return window.TimeEstimator || null;
  }

  function getDataManager() {
    try {
      if (typeof DataManager !== 'undefined') return DataManager;
    } catch {
      return null;
    }
    return window.DataManager || null;
  }

  function getModeloManager() {
    try {
      if (typeof ModeloManager !== 'undefined') return ModeloManager;
    } catch {
      return null;
    }
    return window.ModeloManager || null;
  }

  function getSettingsManager() {
    try {
      if (typeof SettingsManager !== 'undefined') return SettingsManager;
    } catch {
      return null;
    }
    return window.SettingsManager || null;
  }

  function getBatchManager() {
    try {
      if (typeof BatchManager !== 'undefined') return BatchManager;
    } catch {
      return null;
    }
    return window.BatchManager || null;
  }

  function getBusinessHoursManager() {
    try {
      if (typeof BusinessHoursManager !== 'undefined') return BusinessHoursManager;
    } catch {
      return null;
    }
    return window.BusinessHoursManager || null;
  }

  function getScheduleManager() {
    try {
      if (typeof ScheduleManager !== 'undefined') return ScheduleManager;
    } catch {
      return null;
    }
    return window.ScheduleManager || null;
  }

  const MANDATO_SETTINGS_KEY = 'mandatopro_disparo_settings';
  const MANDATO_SETTINGS_FIELDS = [
    'minInterval',
    'maxInterval',
    'ia',
    'enableBrazilianValidation',
    'enableEmailSending',
    'emailSubject',
    'enableBatchPause',
    'batchSize',
    'batchPauseDuration',
    'enableBusinessHours',
    'businessHoursStart',
    'businessHoursEnd',
    'enableScheduling',
    'scheduleDate',
    'scheduleTime'
  ];
  const MANDATO_CAMPAIGN_KEY = 'mandatopro_disparo_campaign';

  function readMandatoField(id) {
    const element = document.getElementById(id);
    if (!element) return undefined;
    if (element.type === 'checkbox') return element.checked;
    return element.value;
  }

  function writeMandatoField(id, value) {
    const element = document.getElementById(id);
    if (!element || value === undefined || value === null) return;

    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
    } else {
      element.value = String(value);
    }
  }

  function collectMandatoSettings() {
    return MANDATO_SETTINGS_FIELDS.reduce((acc, id) => {
      const value = readMandatoField(id);
      if (value !== undefined) acc[id] = value;
      return acc;
    }, {});
  }

  function applyMandatoConfigToggles() {
    getBatchManager()?.toggleBatchOptions?.();
    getBusinessHoursManager()?.toggleOptions?.();
    getScheduleManager()?.toggleSchedulingOptions?.();
    getTimeEstimator()?.update?.();
    window.UiManager?.syncFormFields?.();
  }

  function saveMandatoSettingsState() {
    try {
      const settings = collectMandatoSettings();
      window.StorageService?.setLocalJson?.(MANDATO_SETTINGS_KEY, {
        settings,
        savedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao salvar configuracoes do Mandato Connect:', error);
    }
  }

  function restoreMandatoSettingsState() {
    try {
      const saved = window.StorageService?.getLocalJson?.(MANDATO_SETTINGS_KEY);
      if (!saved?.settings) return;

      for (const id of MANDATO_SETTINGS_FIELDS) {
        writeMandatoField(id, saved.settings[id]);
      }

      if (window.AppState) {
        window.AppState.batchPauseEnabled = Boolean(saved.settings.enableBatchPause);
        window.AppState.batchSize = Number(saved.settings.batchSize || window.AppState.batchSize || 10);
        window.AppState.batchPauseDuration = Number(saved.settings.batchPauseDuration || window.AppState.batchPauseDuration || 10);
        window.AppState.businessHoursEnabled = Boolean(saved.settings.enableBusinessHours);
        window.AppState.businessHoursStart = saved.settings.businessHoursStart || window.AppState.businessHoursStart || '08:00';
        window.AppState.businessHoursEnd = saved.settings.businessHoursEnd || window.AppState.businessHoursEnd || '18:00';
      }

      applyMandatoConfigToggles();
    } catch (error) {
      console.error('Erro ao restaurar configuracoes do Mandato Connect:', error);
    }
  }

  function bindMandatoSettingsPersistence() {
    for (const id of MANDATO_SETTINGS_FIELDS) {
      const element = document.getElementById(id);
      if (!element || element.dataset.mandatoSettingsBound === 'true') continue;

      element.dataset.mandatoSettingsBound = 'true';
      const eventName = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventName, () => {
        if (id === 'enableBatchPause' || id === 'enableBusinessHours' || id === 'enableScheduling') {
          setTimeout(applyMandatoConfigToggles, 0);
        }
        saveMandatoSettingsState();
      });
    }
  }

  function getMultipleMessagesManager() {
    try {
      if (typeof MultipleMessagesManager !== 'undefined') return MultipleMessagesManager;
    } catch {
      return null;
    }
    return window.MultipleMessagesManager || null;
  }

  function collectMandatoCampaignState() {
    const messagesConfig = {};
    for (const msgId of ['msg1', 'msg2', 'msg3']) {
      messagesConfig[msgId] = {
        ...(window.AppState?.messagesConfig?.[msgId] || {}),
        enabled: Boolean(document.getElementById(`${msgId}-enabled`)?.checked),
        text: document.getElementById(`${msgId}-text`)?.value || ''
      };
    }

    return {
      messagesConfig,
      savedAt: new Date().toISOString()
    };
  }

  function saveMandatoCampaignState() {
    try {
      const state = collectMandatoCampaignState();
      window.StorageService?.setLocalJson?.(MANDATO_CAMPAIGN_KEY, state);
    } catch (error) {
      console.error('Erro ao salvar campanha do Mandato Connect:', error);
    }
  }

  function restoreMandatoCampaignState() {
    try {
      const saved = window.StorageService?.getLocalJson?.(MANDATO_CAMPAIGN_KEY);
      if (!saved?.messagesConfig || !window.AppState) return;

      window.AppState.multipleMessagesEnabled = true;
      for (const msgId of ['msg1', 'msg2', 'msg3']) {
        const config = saved.messagesConfig[msgId] || {};
        window.AppState.messagesConfig[msgId] = {
          ...(window.AppState.messagesConfig[msgId] || {}),
          ...config,
          enabled: Boolean(config.enabled),
          text: config.text || ''
        };

        const enabled = document.getElementById(`${msgId}-enabled`);
        const text = document.getElementById(`${msgId}-text`);
        if (enabled) enabled.checked = Boolean(config.enabled);
        if (text) {
          text.value = config.text || '';
          text.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const media = window.AppState.messagesConfig[msgId].media;
        if (media?.filename && media?.data) {
          const manager = getMultipleMessagesManager();
          if (manager?.restoreMessageMedia) {
            manager.restoreMessageMedia(msgId, media);
          }
        }
      }

      const manager = getMultipleMessagesManager();
      manager?.updateActiveMessagesInfo?.();
      manager?.updateMainPreview?.('msg1');
      window.AutoSaveManager?.saveSessionData?.();
    } catch (error) {
      console.error('Erro ao restaurar campanha do Mandato Connect:', error);
    }
  }

  function addMandatoTemplateBox() {
    const editorCard = document.querySelector('#campanha-section .card-body');
    if (!editorCard || document.getElementById('mandatoTemplateContainer')) return;

    const container = document.createElement('div');
    container.id = 'mandatoTemplateContainer';
    container.className = 'card mb-4 border-info';
    container.innerHTML = `
      <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
        <h6 class="mb-0"><i class="bi bi-file-earmark-check me-2"></i>Template Oficial WhatsApp (Meta HSM / YCloud)</h6>
        <span class="badge bg-light text-dark">Opcional</span>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label fw-bold">Modelo de Template Homologado</label>
            <select id="mandatoTemplateSelect" class="form-control">
              <option value="">Nenhum (Mensagem de Texto Livre)</option>
              <option value="aviso_beneficio_eleitor">Aviso de Benefício (aviso_beneficio_eleitor)</option>
            </select>
            <small class="text-muted">Garante entrega fora da janela de 24h.</small>
          </div>
          <div class="col-md-4" id="mandatoParlamentarWrapper" style="display: none;">
            <label class="form-label fw-bold">Parlamentar / Mandato ({{2}})</label>
            <select id="mandatoParlamentarSelect" class="form-control">
              <option value="">Carregando...</option>
            </select>
            <small class="text-muted">Identidade utilizada no disparo.</small>
          </div>
          <div class="col-md-4" id="mandatoBeneficioWrapper" style="display: none;">
            <label class="form-label fw-bold">Benefício / Serviço ({{3}})</label>
            <input type="text" id="mandatoBeneficioInput" class="form-control" placeholder="Ex: Óculos, Atendimento médico" value="Óculos">
            <small class="text-muted">Substituído na variável {{3}}.</small>
          </div>
        </div>
        <div id="mandatoTemplatePreviewAlert" class="alert alert-success mt-3 mb-0" style="display: none;">
          <i class="bi bi-info-circle me-2"></i><strong>Estrutura Oficial:</strong> 
          <span id="mandatoTemplatePreviewText">"Olá, {{1}}! Mandato informa que seu benefício (Óculos) já está disponível. Obrigado!"</span>
        </div>
      </div>
    `;

    editorCard.insertBefore(container, editorCard.firstChild);
    bindMandatoTemplateEvents();
    loadMandatoParlamentaresOptions();
  }

  async function loadMandatoParlamentaresOptions() {
    const parlamentarSelect = document.getElementById('mandatoParlamentarSelect');
    if (!parlamentarSelect) return;

    try {
      const response = await fetch('/api/configuracoes');
      if (!response.ok) return;
      const json = await response.json();
      const list = json?.data?.parlamentares || [];

      if (list.length > 0) {
        parlamentarSelect.innerHTML = list
          .filter(p => p.ativo !== false)
          .map(p => `<option value="${p.nome}" ${p.padrao ? 'selected' : ''}>${p.nome}${p.cargo ? ' (' + p.cargo + ')' : ''}</option>`)
          .join('');
      } else if (json?.data?.nomeParlamentar) {
        parlamentarSelect.innerHTML = `<option value="${json.data.nomeParlamentar}" selected>${json.data.nomeParlamentar}</option>`;
      } else {
        parlamentarSelect.innerHTML = `<option value="Mandato" selected>Mandato</option>`;
      }

      // Trigger update UI
      document.getElementById('mandatoTemplateSelect')?.dispatchEvent(new Event('change'));
    } catch {
      parlamentarSelect.innerHTML = `<option value="Mandato" selected>Mandato</option>`;
    }
  }

  function bindMandatoTemplateEvents() {
    const templateSelect = document.getElementById('mandatoTemplateSelect');
    const beneficioWrapper = document.getElementById('mandatoBeneficioWrapper');
    const beneficioInput = document.getElementById('mandatoBeneficioInput');
    const parlamentarWrapper = document.getElementById('mandatoParlamentarWrapper');
    const parlamentarSelect = document.getElementById('mandatoParlamentarSelect');
    const previewAlert = document.getElementById('mandatoTemplatePreviewAlert');
    const previewText = document.getElementById('mandatoTemplatePreviewText');

    if (!templateSelect || templateSelect.dataset.mandatoTemplateBound === 'true') return;
    templateSelect.dataset.mandatoTemplateBound = 'true';

    function updateTemplateUi() {
      const isTemplate = templateSelect.value === 'aviso_beneficio_eleitor';
      if (beneficioWrapper) beneficioWrapper.style.display = isTemplate ? 'block' : 'none';
      if (parlamentarWrapper) parlamentarWrapper.style.display = isTemplate ? 'block' : 'none';
      if (previewAlert) previewAlert.style.display = isTemplate ? 'block' : 'none';

      if (isTemplate) {
        const ben = beneficioInput?.value?.trim() || 'Óculos';
        const parl = parlamentarSelect?.value?.trim() || 'Mandato';
        if (previewText) {
          previewText.textContent = `Olá, {{1}}! ${parl} informa que seu benefício (${ben}) já está disponível. Obrigado!`;
        }

        // Preenche o campo de texto da Mensagem 1 como espelho visual
        const textMsg1 = document.getElementById('msg1-text');
        if (textMsg1) {
          textMsg1.value = `Olá, {nome}! ${parl} informa que seu benefício (${ben}) já está disponível. Obrigado!`;
          textMsg1.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    templateSelect.addEventListener('change', updateTemplateUi);
    if (beneficioInput) {
      beneficioInput.addEventListener('input', updateTemplateUi);
    }
    if (parlamentarSelect) {
      parlamentarSelect.addEventListener('change', updateTemplateUi);
    }
  }

  function bindMandatoCampaignPersistence() {
    for (const msgId of ['msg1', 'msg2', 'msg3']) {
      const enabled = document.getElementById(`${msgId}-enabled`);
      const text = document.getElementById(`${msgId}-text`);
      const media = document.getElementById(`${msgId}-media`);

      if (enabled && enabled.dataset.mandatoCampaignBound !== 'true') {
        enabled.dataset.mandatoCampaignBound = 'true';
        enabled.addEventListener('change', () => setTimeout(saveMandatoCampaignState, 50));
      }

      if (text && text.dataset.mandatoCampaignBound !== 'true') {
        text.dataset.mandatoCampaignBound = 'true';
        text.addEventListener('input', () => {
          clearTimeout(window.__mandatoCampaignSaveTimer);
          window.__mandatoCampaignSaveTimer = setTimeout(saveMandatoCampaignState, 300);
        });
      }

      if (media && media.dataset.mandatoCampaignBound !== 'true') {
        media.dataset.mandatoCampaignBound = 'true';
        media.addEventListener('change', () => setTimeout(saveMandatoCampaignState, 900));
      }
    }

    const manager = getMultipleMessagesManager();
    if (manager && !manager.__mandatoCampaignPatched) {
      manager.__mandatoCampaignPatched = true;
      for (const method of ['updateActiveMessagesInfo', 'clearMedia']) {
        const original = manager[method]?.bind(manager);
        if (typeof original !== 'function') continue;
        manager[method] = function patchedMandatoCampaignMethod(...args) {
          const result = original(...args);
          setTimeout(saveMandatoCampaignState, 0);
          return result;
        };
      }
    }
  }

  function openMandatoContactsDb() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('mandatopro_disparo', 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveMandatoContactsState() {
    if (!window.indexedDB || !window.AppState) return;

    try {
      const db = await openMandatoContactsDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('state', 'readwrite');
        transaction.objectStore('state').put({
          contacts: window.AppState.contacts || [],
          savedAt: new Date().toISOString()
        }, 'contacts');
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();

      try {
        window.StorageService?.setLocalJson?.('mandatopro_disparo_contacts_meta', {
          contacts: window.AppState.contacts?.length || 0,
          savedAt: new Date().toISOString()
        });
      } catch {
        // IndexedDB remains the source of truth for large contact lists.
      }
    } catch (error) {
      console.error('Erro ao salvar contatos do Mandato Connect:', error);
    }
  }

  async function loadMandatoContactsState() {
    if (!window.indexedDB || !window.AppState) return;
    if (Array.isArray(window.AppState.contacts) && window.AppState.contacts.length > 0) return;

    try {
      const db = await openMandatoContactsDb();
      const saved = await new Promise((resolve, reject) => {
        const transaction = db.transaction('state', 'readonly');
        const request = transaction.objectStore('state').get('contacts');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();

      if (!Array.isArray(saved?.contacts) || saved.contacts.length === 0) return;

      window.AppState.contacts = saved.contacts;
      getContactManager()?.updateContactsList?.();
      getTimeEstimator()?.update?.();
    } catch (error) {
      console.error('Erro ao restaurar contatos do Mandato Connect:', error);
    }
  }

  async function clearMandatoContactsState() {
    try {
      window.StorageService?.removeLocal?.('mandatopro_disparo_contacts_meta');

      if (!window.indexedDB) return;
      const db = await openMandatoContactsDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('state', 'readwrite');
        transaction.objectStore('state').delete('contacts');
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      console.error('Erro ao limpar contatos persistidos do Mandato Connect:', error);
    }
  }

  function patchMandatoContactsPersistence() {
    const manager = getContactManager();
    if (!manager || manager.__mandatoPersistencePatched) return;

    manager.__mandatoPersistencePatched = true;
    const originalUpdateContactsList = manager.updateContactsList?.bind(manager);
    if (typeof originalUpdateContactsList === 'function') {
      manager.updateContactsList = function updateMandatoContactsList(...args) {
        const result = originalUpdateContactsList(...args);
        setTimeout(saveMandatoContactsState, 0);
        return result;
      };
    }
  }

  function getInstanceManager() {
    try {
      if (typeof InstanceManager !== 'undefined') return InstanceManager;
    } catch {
      return null;
    }
    return window.InstanceManager || null;
  }

  function updateMandatoInstanceBadges() {
    const total = window.AppState?.instances?.length || 0;
    const active = window.AppState?.activeInstances?.length
      || (window.AppState?.instances || []).filter((instance) => instance.status === 'connected').length;

    const instanceBadge = document.getElementById('instanceCountBadge');
    if (instanceBadge) {
      instanceBadge.textContent = String(total);
      instanceBadge.style.display = 'inline';
    }

    const activeCount = document.getElementById('activeInstancesCount');
    if (activeCount) {
      activeCount.textContent = String(active);
    }
  }

  function resolveMandatoInstance(instanceId) {
    return (window.AppState?.instances || []).find((instance) => String(instance.id) === String(instanceId)) || null;
  }

  function patchInstanceManagerActions() {
    const manager = getInstanceManager();
    if (!manager || manager.__mandatoActionsPatched) return;

    manager.__mandatoActionsPatched = true;

    const originalCheckConnection = manager.checkConnection?.bind(manager);
    if (typeof originalCheckConnection === 'function') {
      manager.checkConnection = function checkMandatoConnection(instanceId) {
        const instance = resolveMandatoInstance(instanceId);
        return originalCheckConnection(instance ? instance.id : instanceId);
      };
    }

    const originalRemoveInstance = manager.removeInstance?.bind(manager);
    if (typeof originalRemoveInstance === 'function') {
      manager.removeInstance = function removeMandatoInstance(instanceId) {
        const instance = resolveMandatoInstance(instanceId);
        return originalRemoveInstance(instance ? instance.id : instanceId);
      };
    }

    const originalEditInstance = manager.editInstance?.bind(manager);
    if (typeof originalEditInstance === 'function') {
      manager.editInstance = function editMandatoInstance(instanceId) {
        const instance = resolveMandatoInstance(instanceId);
        return originalEditInstance(instance ? instance.id : instanceId);
      };
    }

    manager.disconnectInstance = function disconnectMandatoInstance(instanceId) {
      const instance = resolveMandatoInstance(instanceId);
      if (!instance) return;

      window.UI?.confirm?.(
        'Desconectar instancia',
        `Deseja desconectar a instancia "${instance.name}"?`,
        async () => {
          window.UI?.showLoading?.('Desconectando instancia...');

          try {
            const response = await fetch('/api/disparos/instancias-runtime/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ id: instance.id })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload?.message || 'Erro ao desconectar instancia');
            }

            instance.status = 'disconnected';
            instance.qrCode = null;
            instance.lastCheck = new Date();
            window.StorageService?.setLocalJson?.('disparador_instances', window.AppState.instances);
            manager.updateInstancesList?.();
            manager.updateActiveInstances?.();
            updateMandatoInstanceBadges();
            window.UI?.showSuccess?.(`Instancia "${instance.name}" desconectada`);
          } catch (error) {
            console.error('Erro ao desconectar instancia do MandatoPro:', error);
            window.UI?.showError?.(error.message || 'Erro ao desconectar instancia');
          } finally {
            window.UI?.hideLoading?.();
          }
        }
      );
    };

    const originalUpdateInstancesList = manager.updateInstancesList?.bind(manager);
    if (typeof originalUpdateInstancesList === 'function') {
      manager.updateInstancesList = function updateMandatoInstancesList(...args) {
        const result = originalUpdateInstancesList(...args);
        setTimeout(updateMandatoInstanceBadges, 0);
        return result;
      };
    }
  }

  function patchUiBadges() {
    if (!window.UI || window.UI.__mandatoBadgesPatched) return;
    const originalUpdateBadges = window.UI.updateBadges?.bind(window.UI);
    window.UI.__mandatoBadgesPatched = true;
    window.UI.updateBadges = function updateMandatoBadges(...args) {
      originalUpdateBadges?.(...args);
      updateMandatoInstanceBadges();
    };
  }

  function bindMandatoInstanceActions() {
    if (window.__mandatoInstanceActionsBound) return;
    window.__mandatoInstanceActionsBound = true;

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('.check-connection-btn, .show-qr-btn, .disconnect-instance-btn, .remove-instance-btn, .edit-instance-btn');
      if (!button) return;

      const instanceId = button.dataset.instanceId;
      if (!instanceId) return;

      const manager = getInstanceManager();
      if (!manager) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.classList.contains('check-connection-btn') && typeof manager.checkConnection === 'function') {
        manager.checkConnection(instanceId);
      } else if (button.classList.contains('show-qr-btn') && typeof manager.showConnectionModal === 'function') {
        const instance = resolveMandatoInstance(instanceId);
        manager.showConnectionModal(instance || instanceId);
      } else if (button.classList.contains('disconnect-instance-btn') && typeof manager.disconnectInstance === 'function') {
        manager.disconnectInstance(instanceId);
      } else if (button.classList.contains('remove-instance-btn') && typeof manager.removeInstance === 'function') {
        manager.removeInstance(instanceId);
      } else if (button.classList.contains('edit-instance-btn') && typeof manager.editInstance === 'function') {
        manager.editInstance(instanceId);
      }
    }, true);
  }

  function bindMandatoInstanceForm() {
    const button = document.getElementById('addInstanceBtn');
    if (!button || button.dataset.mandatoBound === 'true') return;

    button.dataset.mandatoBound = 'true';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const manager = getInstanceManager();
      if (!manager || typeof manager.addInstance !== 'function') {
        window.UI?.showError?.('Modulo de instancias ainda nao carregado. Atualize a pagina e tente novamente.');
        return;
      }

      await manager.addInstance();
    }, true);
  }

  function bindMandatoContactsActions() {
    if (window.__mandatoContactsActionsBound) return;
    window.__mandatoContactsActionsBound = true;

    document.addEventListener('click', (event) => {
      const downloadModelBtn = event.target.closest?.('#downloadModelBtn');
      const exportContactsBtn = event.target.closest?.('#exportContactsBtn');
      const clearContactsBtn = event.target.closest?.('#clearContactsBtn');
      const fileUploadArea = event.target.closest?.('#fileUploadArea');

      if (downloadModelBtn) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getModeloManager()?.downloadModel?.();
      } else if (exportContactsBtn) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getDataManager()?.exportContactsToExcel?.();
      } else if (clearContactsBtn) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getContactManager()?.clear?.();
        setTimeout(saveMandatoContactsState, 300);
      } else if (fileUploadArea && event.target.id !== 'excelFile') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        document.getElementById('excelFile')?.click();
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target?.id !== 'excelFile') return;

      const file = event.target.files?.[0];
      if (file) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        getContactManager()?.processExcelFile?.(file);
        setTimeout(saveMandatoContactsState, 1500);
      }
    }, true);
  }

  function bindMandatoBackupActions() {
    if (window.__mandatoBackupActionsBound) return;
    window.__mandatoBackupActionsBound = true;

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.(
        '#exportBackupBtn, #importBackupBtn, #showStorageInfoBtn, #clearSessionDataBtn, #clearSettingsBtn'
      );
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.id === 'exportBackupBtn') {
        getDataManager()?.exportBackupData?.();
      } else if (button.id === 'importBackupBtn') {
        getDataManager()?.importBackupData?.();
      } else if (button.id === 'showStorageInfoBtn') {
        window.showStorageInfo?.();
      } else if (button.id === 'clearSessionDataBtn') {
        getSettingsManager()?.clearSessionData?.();
        setTimeout(clearMandatoContactsState, 300);
      } else if (button.id === 'clearSettingsBtn') {
        getSettingsManager()?.clearSavedSettings?.();
        setTimeout(clearMandatoContactsState, 300);
      }
    }, true);
  }

  function bindMandatoStartCampaign() {
    const button = document.getElementById('startCampaignBtn');
    const form = document.getElementById('bulkForm');
    if (!button || !form || button.dataset.mandatoBound === 'true') return;

    button.type = 'button';
    button.dataset.mandatoBound = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      startMandatoCampaign(form);
    }, true);
  }

  function startMandatoCampaign(form) {
    window.UiManager?.syncFormFields?.();

    try {
      if (typeof EventManager !== 'undefined' && typeof EventManager.handleFormSubmit === 'function') {
        EventManager.handleFormSubmit({
          target: form,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {}
        });
        return;
      }

      if (typeof SendingManager !== 'undefined' && typeof FormManager !== 'undefined') {
        if (window.AppState?.sendingInProgress) {
          if (typeof UI !== 'undefined') UI.showWarning('Envio ja esta em andamento');
          return;
        }

        const validation = SendingManager.validateBeforeSending?.();
        if (!validation?.valid) {
          if (typeof UI !== 'undefined') UI.showError(validation?.error || 'Nao foi possivel iniciar a campanha');
          return;
        }

        const templateSelect = document.getElementById('mandatoTemplateSelect');
        const beneficioInput = document.getElementById('mandatoBeneficioInput');
        const parlamentarSelect = document.getElementById('mandatoParlamentarSelect');
        const isTemplate = templateSelect && templateSelect.value === 'aviso_beneficio_eleitor';
        const beneficio = beneficioInput?.value?.trim() || 'Óculos';
        const parlamentar = parlamentarSelect?.value?.trim() || 'Mandato';

        const isScheduled = document.getElementById('enableScheduling')?.checked;
        if (isScheduled && typeof ScheduleManager !== 'undefined') {
          const dispatchData = FormManager.collectDispatchData();
          ScheduleManager.scheduleDispatch(dispatchData);
        } else if (isTemplate) {
          const confirmHtml = `
            <div class="text-start">
              <h6 class="text-success mb-2"><i class="bi bi-patch-check-fill me-2"></i>Envio via Template Oficial WhatsApp</h6>
              <p class="mb-1"><strong>Template:</strong> <code>aviso_beneficio_eleitor</code> (UTILITY)</p>
              <p class="mb-1"><strong>Parlamentar ({{2}}):</strong> <span class="badge bg-info text-dark">${parlamentar}</span></p>
              <p class="mb-1"><strong>Benefício/Serviço ({{3}}):</strong> <span class="badge bg-primary">${beneficio}</span></p>
              <p class="mb-1"><strong>Total de Contatos:</strong> ${window.AppState?.contacts?.length || 0}</p>
              <p class="mb-1"><strong>Entrega garantida fora da janela de 24h:</strong> <span class="text-success fw-bold">SIM</span></p>
              <div class="alert alert-light border mt-2 mb-0 p-2 small">
                <strong>Preview:</strong> "Olá, {{1}}! ${parlamentar} informa que seu benefício (${beneficio}) já está disponível. Obrigado!"
              </div>
            </div>
          `;
          window.UI?.confirm?.('Confirmar Disparo de Template', confirmHtml, () => {
            SendingManager.start();
          });
        } else {
          FormManager.showConfirmationDialog();
        }
        return;
      }

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    } catch (error) {
      console.error('Erro ao iniciar campanha no Mandato Connect:', error);
      if (typeof UI !== 'undefined') {
        UI.showError(error?.message || 'Erro ao iniciar campanha');
      } else {
        alert(error?.message || 'Erro ao iniciar campanha');
      }
    }
  }

  function patchInstancePersistence() {
    if (!window.SupabaseDataManager || window.SupabaseDataManager.__mandatoPatched) return;

    window.SupabaseDataManager.__mandatoPatched = true;

    window.SupabaseDataManager.loadUserInstances = async function loadMandatoInstances() {
      try {
        const localInstances = window.AppState?.instances?.length
          ? window.AppState.instances
          : (window.StorageService?.getLocalJson?.('disparador_instances') || []);
        const response = await fetch('/api/disparos/instancias-runtime');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar instancias');

        const remoteInstances = payload.data || [];
        if (remoteInstances.length === 0 && localInstances.length > 0) {
          window.AppState.instances = localInstances.map((instance) => ({
            ...instance,
            lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
          }));
          window.InstanceManager?.updateInstancesList?.();
          updateMandatoInstanceBadges();
          await Promise.allSettled(window.AppState.instances.map((instance) => this.saveInstance(instance)));
          return;
        }

        window.AppState.instances = remoteInstances.map((instance) => ({
          ...instance,
          lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
        }));

        window.StorageService?.setLocalJson?.('disparador_instances', window.AppState.instances);
        window.InstanceManager?.updateInstancesList?.();
        updateMandatoInstanceBadges();
      } catch (error) {
        console.error('Erro ao carregar instancias do MandatoPro:', error);
      }
    };

    window.SupabaseDataManager.saveInstance = async function saveMandatoInstance(instance) {
      try {
        const response = await fetch('/api/disparos/instancias-runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(instance)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Erro ao salvar instancia');

        if (payload.data) {
          instance.id = payload.data.id;
          instance._supabaseId = payload.data._supabaseId;
          instance.lastCheck = payload.data.lastCheck ? new Date(payload.data.lastCheck) : instance.lastCheck;
        }
        updateMandatoInstanceBadges();
        return payload.data?._supabaseId || payload.data?.id || null;
      } catch (error) {
        console.error('Erro ao salvar instancia no MandatoPro:', error);
        window.UI?.showError?.(error.message || 'Erro ao salvar instancia');
        return null;
      }
    };

    window.SupabaseDataManager.deleteInstance = async function deleteMandatoInstance(id) {
      if (!id) return;
      try {
        const response = await fetch(`/api/disparos/instancias-runtime?id=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'Erro ao remover instancia');
        }
      } catch (error) {
        console.error('Erro ao remover instancia no MandatoPro:', error);
      }
    };
  }

  async function importMandatoContacts() {
    const importBtn = document.getElementById('mandatoImportBtn');
    const originalContent = importBtn ? importBtn.innerHTML : '<i class="bi bi-cloud-download me-2"></i>Importar';

    if (importBtn) {
      importBtn.dataset.importing = 'true';
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
    }

    const params = getMandatoContactParams();
    window.UI?.showLoading?.('Importando contatos do MandatoPro...');

    try {
      const response = await fetch(`/api/disparos/contatos/preview?${params.toString()}`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao importar contatos');

      const rawList = Array.isArray(payload.data) ? payload.data : [];

      const contatosValidos = rawList.filter((contact) => {
        const phone = contact.telefoneNormalizado || contact.phone || '';
        return Boolean(phone);
      });

      window.AppState.contacts = contatosValidos.map((contact, index) => {
        const phone = contact.telefoneNormalizado || contact.phone || '';
        return {
          name: contact.nome || contact.name || 'Sem nome',
          phone: phone,
          email: contact.email || '',
          rawPhone: contact.telefoneOriginal || contact.rawPhone || phone,
          isValid: Boolean(phone),
          error: null,
          row: index + 1,
          source: contact.origem || contact.source || 'eleitor',
          sourceId: contact.origemId || contact.sourceId || null
        };
      });

      getContactManager()?.updateContactsList?.();
      getTimeEstimator()?.update?.();
      saveMandatoContactsState();
      window.UI?.hideLoading?.();
      window.UI?.showSuccess?.(`${window.AppState.contacts.length} contatos importados do MandatoPro`);
    } catch (error) {
      window.UI?.hideLoading?.();
      window.UI?.showError?.(error.message || 'Erro ao importar contatos do MandatoPro');
    } finally {
      if (importBtn) {
        delete importBtn.dataset.importing;
        importBtn.disabled = false;
        importBtn.innerHTML = originalContent;
      }
    }
  }

  function patchNavigation() {
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'mandato-connect:navigate') return;
      navigateMandatoSection(event.data.section);
    });

    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      navigateMandatoSection(params.get('section') || 'dashboard');
    }, 500);
  }

  function hideOpenModals() {
    document.querySelectorAll('.modal.show').forEach((modalElement) => {
      window.bootstrap?.Modal?.getInstance(modalElement)?.hide();
    });
  }

  function navigateMandatoSection(section = 'dashboard') {
    const normalized = String(section || 'dashboard');

    if (normalized === 'novidades') {
      hideOpenModals();
      window.bootstrap?.Modal?.getOrCreateInstance?.(document.getElementById('changelogModal'))?.show();
      return;
    }

    if (normalized === 'seguranca') {
      hideOpenModals();
      window.bootstrap?.Modal?.getOrCreateInstance?.(document.getElementById('safetyTipsModal'))?.show();
      return;
    }

    const selector = `.nav-link[data-section="${CSS.escape(normalized)}"]`;
    const link = document.querySelector(selector);
    if (link) {
      hideOpenModals();
      link.click();
    }
  }

  function patchServiceWorker() {
    if (!window.PWAManager || window.PWAManager.__mandatoPatched) return;
    window.PWAManager.__mandatoPatched = true;
    window.PWAManager.canRegisterServiceWorker = () => false;
    window.PWAManager.registerServiceWorker = async () => null;
  }

  function init() {
    patchFetchAuth();
    patchAuth();
    patchNavigation();
    patchServiceWorker();
    patchInstancePersistence();
    patchUiBadges();
    patchInstanceManagerActions();
    patchMandatoContactsPersistence();
    restoreMandatoSettingsState();
    bindMandatoSettingsPersistence();
    bindMandatoCampaignPersistence();
    bindMandatoInstanceActions();
    bindMandatoContactsActions();
    bindMandatoBackupActions();
    bindMandatoStartCampaign();
    setTimeout(bindMandatoInstanceForm, 500);
    setTimeout(bindMandatoInstanceForm, 1800);
    setTimeout(bindMandatoStartCampaign, 500);
    setTimeout(bindMandatoStartCampaign, 1800);
    setTimeout(restoreMandatoSettingsState, 700);
    setTimeout(bindMandatoSettingsPersistence, 700);
    setTimeout(restoreMandatoCampaignState, 900);
    setTimeout(bindMandatoCampaignPersistence, 900);
    setTimeout(patchInstanceManagerActions, 500);
    setTimeout(patchMandatoContactsPersistence, 500);
    setTimeout(loadMandatoContactsState, 900);
    setTimeout(patchUiBadges, 1200);
    setTimeout(patchInstanceManagerActions, 1200);
    setTimeout(patchMandatoContactsPersistence, 1200);
    setTimeout(restoreMandatoSettingsState, 1800);
    setTimeout(bindMandatoSettingsPersistence, 1800);
    setTimeout(restoreMandatoCampaignState, 2000);
    setTimeout(bindMandatoCampaignPersistence, 2000);
    setTimeout(loadMandatoContactsState, 1800);
    setTimeout(updateMandatoInstanceBadges, 1600);
    setTimeout(updateMandatoInstanceBadges, 3000);
    setInterval(updateMandatoInstanceBadges, 1000);
    setTimeout(addMandatoContactsButton, 1200);
    setTimeout(addMandatoContactsButton, 2500);
    setInterval(addMandatoContactsButton, 3000);
    setTimeout(addMandatoTemplateBox, 1200);
    setTimeout(addMandatoTemplateBox, 2500);
    setInterval(addMandatoTemplateBox, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MandatoProDisparoEmbed = { patchAuth, patchFetchAuth, addMandatoContactsButton, originalInitialize };
})();