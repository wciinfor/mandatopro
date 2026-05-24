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
      const result = await window.SupabaseClient?.auth?.getSession?.();
      return result?.data?.session?.access_token || '';
    } catch {
      return '';
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

    document.getElementById('mandatoImportBtn')?.addEventListener('click', importMandatoContacts);
  }

  function getInstanceManager() {
    try {
      if (typeof InstanceManager !== 'undefined') return InstanceManager;
    } catch {
      return null;
    }
    return window.InstanceManager || null;
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

    window.SupabaseDataManager.loadUserInstances = async function loadMandatoInstances() {
      try {
        const response = await fetch('/api/disparos/instancias-runtime');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || 'Erro ao carregar instancias');

        window.AppState.instances = (payload.data || []).map((instance) => ({
          ...instance,
          lastCheck: instance.lastCheck ? new Date(instance.lastCheck) : new Date()
        }));

        window.StorageService?.setLocalJson?.('disparador_instances', window.AppState.instances);
        window.InstanceManager?.updateInstancesList?.();
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
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const cidade = document.getElementById('mandatoCidade')?.value || '';
    const bairro = document.getElementById('mandatoBairro')?.value || '';
    const search = document.getElementById('mandatoBusca')?.value || '';
    const limit = document.getElementById('mandatoLimite')?.value || '1000';

    const params = new URLSearchParams({ origem, cidade, bairro, search, limit });
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

      window.ContactManager?.updateContactsList?.();
      window.TimeEstimator?.update?.();
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

  function init() {
    patchFetchAuth();
    patchAuth();
    patchNavigation();
    patchInstancePersistence();
    setTimeout(bindMandatoInstanceForm, 500);
    setTimeout(bindMandatoInstanceForm, 1800);
    setTimeout(addMandatoContactsButton, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MandatoProDisparoEmbed = { patchAuth, patchFetchAuth, addMandatoContactsButton, originalInitialize };
})();