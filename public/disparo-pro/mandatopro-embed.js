(() => {
  const originalInitialize = window.AuthManager?.initialize?.bind(window.AuthManager);
  const originalFetch = window.fetch.bind(window);

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
      // Perfil interno removido do embed MandatoPro.
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
        const key = `sb-${ref}-auth-token`;
        const raw = window.localStorage.getItem(key);
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

      return originalFetch(input, {
        ...init,
        headers,
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

    return new URLSearchParams({ origem, cidade, bairro, search, limit, campanhaId });
  }

  function bindMandatoFilterPreview() {
    const fields = ['mandatoOrigem', 'mandatoCampanha', 'mandatoCidade', 'mandatoBairro', 'mandatoBusca', 'mandatoLimite'];
    for (const id of fields) {
      const element = document.getElementById(id);
      if (!element || element.dataset.mandatoPreviewBound === 'true') continue;

      element.dataset.mandatoPreviewBound = 'true';
      const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventName, scheduleMandatoContactsPreview);
    }
  }

  function scheduleMandatoContactsPreview() {
    clearTimeout(window.__mandatoContactsPreviewTimer);
    window.__mandatoContactsPreviewTimer = setTimeout(updateMandatoContactsPreview, 450);
  }

  async function updateMandatoContactsPreview() {
    const countBox = document.getElementById('mandatoContactsCount');
    if (!countBox) return;

    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const label = origem === 'eleitores' ? 'eleitores' : origem === 'liderancas' ? 'lideranças' : 'funcionários';
    countBox.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Calculando quantidade...';

    try {
      const params = getMandatoContactParams({ preview: true });
      params.set('countOnly', 'true');
      const response = await fetch(`/api/disparos/contatos/preview?${params.toString()}`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao calcular contatos');

      const resumo = payload.resumo || {};
      const validos = Number.isFinite(Number(resumo.validos))
        ? `<span class="text-muted ms-2">(${resumo.validos} com telefone válido)</span>`
        : '';
      countBox.innerHTML = `
        <i class="bi bi-people me-2"></i>
        <strong>${Number(resumo.total || 0).toLocaleString('pt-BR')}</strong> ${label} encontrados
        ${validos}
      `;
    } catch (error) {
      countBox.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${error.message || 'Erro ao calcular contatos'}`;
    }
  }

  function updateMandatoCampaignFilterState() {
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const campanhaSelect = document.getElementById('mandatoCampanha');
    if (!campanhaSelect) return;

    const enabled = origem === 'eleitores';
    campanhaSelect.disabled = !enabled;
    if (!enabled) campanhaSelect.value = '';
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
      console.error('Erro ao salvar configuracoes do Disparo PRO:', error);
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
      console.error('Erro ao restaurar configuracoes do Disparo PRO:', error);
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
      console.error('Erro ao salvar campanha do Disparo PRO:', error);
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
      console.error('Erro ao restaurar campanha do Disparo PRO:', error);
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
      console.error('Erro ao salvar contatos do Disparo PRO:', error);
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
      console.error('Erro ao restaurar contatos do Disparo PRO:', error);
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
      console.error('Erro ao limpar contatos persistidos do Disparo PRO:', error);
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
    const active = total;

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

    const originalUpdateInstancesList = manager.updateInstancesList?.bind(manager);
    if (typeof originalUpdateInstancesList === 'function') {
      manager.updateInstancesList = function updateMandatoInstancesList(...args) {
        const result = originalUpdateInstancesList(...args);
        setTimeout(updateMandatoInstanceBadges, 0);
        return result;
      };
    }
  }

  function patchInstanceManagerInit() {
    const manager = getInstanceManager();
    if (!manager || manager.__mandatoInitPatched) return;

    manager.__mandatoInitPatched = true;
    const originalInitialize = manager.initialize?.bind(manager);
    const originalLoadInstances = manager.loadInstances?.bind(manager);

    if (typeof originalInitialize !== 'function') return;

    if (typeof originalLoadInstances === 'function') {
      manager.loadInstances = function loadMandatoInstances(...args) {
        if (window.APP_ENV?.MANDATOPRO_EMBED && window.AppState?.__mandatoLoaded) {
          return;
        }
        return originalLoadInstances(...args);
      };
    }

    manager.initialize = async function initializeMandatoInstanceManager(...args) {
      const result = await originalInitialize(...args);
      if (window.SupabaseDataManager?.loadUserInstances) {
        setTimeout(() => window.SupabaseDataManager.loadUserInstances(), 400);
      }
      return result;
    };
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
      const button = event.target.closest?.('.check-connection-btn, .show-qr-btn, .remove-instance-btn, .edit-instance-btn');
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

      window.UiManager?.syncFormFields?.();
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }, true);
  }

  function patchInstancePersistence() {
    if (!window.SupabaseDataManager || window.SupabaseDataManager.__mandatoPatched) return;

    window.SupabaseDataManager.__mandatoPatched = true;

    const ensureInstancesRendered = (attempt = 0) => {
      if (window.InstanceManager?.updateInstancesList && document.getElementById('instancesList')) {
        window.InstanceManager.updateInstancesList();
        updateMandatoInstanceBadges();
        return;
      }
      if (attempt < 15) {
        setTimeout(() => ensureInstancesRendered(attempt + 1), 200);
      }
    };

    window.SupabaseDataManager.loadUserInstances = async function loadMandatoInstances(retryCount = 0) {
      if (!window.AppState || !Array.isArray(window.AppState.instances)) {
        if (retryCount < 10) {
          setTimeout(() => this.loadUserInstances(retryCount + 1), 200);
        }
        return;
      }
      try {
        let storageInstances = [];
        const rawLocal = window.localStorage?.getItem('disparador_instances');
        const parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
        if (Array.isArray(parsedLocal)) {
          storageInstances = parsedLocal;
        } else {
          const parsed = window.StorageService?.getLocalJson?.('disparador_instances');
          if (Array.isArray(parsed)) storageInstances = parsed;
        }

        const localInstances = window.AppState?.instances?.length
          ? window.AppState.instances
          : storageInstances;
        const response = await fetch('/api/disparos/instancias-runtime', {
          credentials: 'include'
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar instancias');

        const remoteInstances = payload.data || [];
        if (remoteInstances.length === 0 && localInstances.length > 0) {
          window.AppState.instances = localInstances.map((instance) => ({
            ...instance,
            lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
          }));
          window.AppState.__mandatoLoaded = true;
          ensureInstancesRendered();
          await Promise.allSettled(window.AppState.instances.map((instance) => this.saveInstance(instance)));
          return;
        }

        if (remoteInstances.length === 0) {
          ensureInstancesRendered();
          return;
        }

        window.AppState.instances = remoteInstances.map((instance) => ({
          ...instance,
          lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
        }));
        window.AppState.__mandatoLoaded = true;

        window.StorageService?.setLocalJson?.('disparador_instances', window.AppState.instances);
        ensureInstancesRendered();
      } catch (error) {
        console.error('Erro ao carregar instancias do MandatoPro:', error);

        let storageInstances = [];
        const rawLocal = window.localStorage?.getItem('disparador_instances');
        const parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
        if (Array.isArray(parsedLocal)) {
          storageInstances = parsedLocal;
        } else {
          const parsed = window.StorageService?.getLocalJson?.('disparador_instances');
          if (Array.isArray(parsed)) storageInstances = parsed;
        }

        if (storageInstances.length > 0) {
          window.AppState.instances = storageInstances.map((instance) => ({
            ...instance,
            lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
          }));
          window.AppState.__mandatoLoaded = true;
          ensureInstancesRendered();
        }
      }
    };

    window.SupabaseDataManager.saveInstance = async function saveMandatoInstance(instance) {
      try {
        const response = await fetch('/api/disparos/instancias-runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(instance)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Erro ao salvar instancia');

        if (payload.data) {
          instance.id = payload.data.id;
          instance._supabaseId = payload.data._supabaseId;
          instance.lastCheck = payload.data.lastCheck ? new Date(payload.data.lastCheck) : instance.lastCheck;
          window.InstanceManager?.updateInstancesList?.();
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
          method: 'DELETE',
          credentials: 'include'
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
    const params = getMandatoContactParams();
    window.UI?.showLoading?.('Importando contatos do MandatoPro...');

    try {
      const response = await fetch(`${window.APP_ENV.MANDATOPRO_CONTACTS_ENDPOINT}?${params.toString()}`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao importar contatos');

      window.AppState.contacts = (payload.data || []).map((contact, index) => ({
        name: contact.name,
        phone: contact.phone,
        email: contact.email || '',
        rawPhone: contact.phone,
        isValid: Boolean(contact.phone),
        error: null,
        row: index + 1,
        source: contact.source,
        sourceId: contact.sourceId
      }));

      getContactManager()?.updateContactsList?.();
      getTimeEstimator()?.update?.();
      saveMandatoContactsState();
      window.UI?.hideLoading?.();
      window.UI?.showSuccess?.(`${window.AppState.contacts.length} contatos importados do MandatoPro`);
    } catch (error) {
      window.UI?.hideLoading?.();
      window.UI?.showError?.(error.message || 'Erro ao importar contatos do MandatoPro');
    }
  }

  function patchNavigation() {
    const originalOnEnter = window.InboxModule?.onEnter;
    if (window.InboxModule && typeof originalOnEnter === 'function') {
      window.InboxModule.onEnter = function onEnterMandatoEmbed(...args) {
        return originalOnEnter.apply(this, args);
      };
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
    patchInstanceManagerInit();
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
    setTimeout(patchInstanceManagerInit, 500);
    setTimeout(patchMandatoContactsPersistence, 500);
    setTimeout(loadMandatoContactsState, 900);
    setTimeout(patchUiBadges, 1200);
    setTimeout(patchInstanceManagerActions, 1200);
    setTimeout(patchInstanceManagerInit, 1200);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MandatoProDisparoEmbed = { patchAuth, patchFetchAuth, addMandatoContactsButton, originalInitialize };
})();
