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
          <div class="col-md-2">
            <label class="form-label">Busca</label>
            <input id="mandatoBusca" class="form-control" placeholder="Nome">
          </div>
          <div class="col-md-1">
            <label class="form-label">Limite</label>
            <input id="mandatoLimite" type="number" class="form-control" value="1000" min="1" max="5000">
          </div>
          <div class="col-md-2">
            <button id="mandatoImportBtn" type="button" class="btn btn-primary w-100">
              <i class="bi bi-cloud-download me-2"></i>Importar
            </button>
          </div>
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
    document.getElementById('mandatoImportBtn')?.addEventListener('click', importMandatoContacts);
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
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const cidade = document.getElementById('mandatoCidade')?.value || '';
    const bairro = document.getElementById('mandatoBairro')?.value || '';
    const search = document.getElementById('mandatoBusca')?.value || '';
    const limit = document.getElementById('mandatoLimite')?.value || '1000';
    const campanhaId = origem === 'eleitores'
      ? document.getElementById('mandatoCampanha')?.value || ''
      : '';

    const params = new URLSearchParams({ origem, cidade, bairro, search, limit, campanhaId });
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
    bindMandatoInstanceActions();
    setTimeout(bindMandatoInstanceForm, 500);
    setTimeout(bindMandatoInstanceForm, 1800);
    setTimeout(patchInstanceManagerActions, 500);
    setTimeout(patchInstanceManagerInit, 500);
    setTimeout(patchUiBadges, 1200);
    setTimeout(patchInstanceManagerActions, 1200);
    setTimeout(patchInstanceManagerInit, 1200);
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
