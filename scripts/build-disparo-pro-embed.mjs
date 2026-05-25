import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'Painel');
const publicRoot = path.join(root, 'public', 'disparo-pro');

function readDotEnv(fileName) {
  const envPath = path.join(root, fileName);
  if (!fs.existsSync(envPath)) return {};

  const values = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function getPublicEnv(key) {
  const localEnv = readDotEnv('.env.local');
  const exampleEnv = readDotEnv('.env.local.example');
  return process.env[key] || localEnv[key] || exampleEnv[key] || '';
}

function copyRecursive(src, dest, options = {}) {
  if (!fs.existsSync(src)) return;
  if (options.ignore?.(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item), options);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function replaceBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) return text;
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function buildHtml() {
  const sourceHtml = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
  let html = sourceHtml;
  const supabaseUrl = getPublicEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  html = replaceBetween(
    html,
    '    <!-- Tela de Login',
    '    <!-- Aplicação Principal com Sidebar -->',
    '    <!-- Tela de login removida: autenticacao feita pelo MandatoPro. -->\n'
  );

  html = html.replace(
    /<script>\s*window\.APP_ENV = \{[\s\S]*?\};\s*<\/script>/,
    `<script>
      window.APP_ENV = {
        SUPABASE_URL: ${JSON.stringify(supabaseUrl)},
        SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey)},
        N8N_WEBHOOK_DISPARO_PRO: "/api/disparos/n8n",
        API_BASE_URL: "",
        MANDATOPRO_EMBED: true,
        MANDATOPRO_CONTACTS_ENDPOINT: "/api/disparos/contatos/export"
      };
    </script>`
  );

  html = html.replace(
    '<script src="frontend/js/auth.js"></script>',
    '<script src="frontend/js/auth.js"></script>\n    <script src="mandatopro-embed.js"></script>'
  );

  html = html.replace(
    '<div id="mainApp" class="main-app">',
    '<div id="mainApp" class="main-app authenticated" style="display:block">'
  );

  html = html.replace(
    '<button type="submit" class="btn btn-whatsapp btn-lg" id="startCampaignBtn">',
    '<button type="button" class="btn btn-whatsapp btn-lg" id="startCampaignBtn">'
  );

  const publicTextReplacements = [
    ['Disparo PRO', 'Mandato Connect'],
    ['Relatório de Disparo', 'Relatório de Comunicação'],
    ['Relatório de Campanha', 'Relatório de Comunicação'],
    ['Confirmar Disparo', 'Confirmar Envio'],
    ['Disparo Interrompido Detectado', 'Envio Interrompido Detectado'],
    ['Novo Disparo', 'Novo Envio'],
    ['Retomar Disparo', 'Retomar Envio'],
    ['Disparo concluído', 'Envio concluído'],
    ['Disparo concluido', 'Envio concluido'],
    ['Disparo agendado', 'Envio agendado'],
    ['Disparo será executado', 'Envio será executado'],
    ['disparo em massa', 'envio para contatos selecionados'],
    ['envio em massa', 'envio para contatos selecionados'],
    ['lista do disparador', 'lista da central de comunicação'],
    ['Sistema de Campanha Inteligente', 'Central de Comunicação Inteligente'],
    ['uso nos disparos', 'uso nos envios'],
    ['usar nos disparos', 'usar nos envios'],
    ['Recuperação de disparo interrompido', 'Recuperação de envio interrompido'],
    ['Outro disparo está em andamento', 'Outro envio está em andamento'],
    ['Executando disparo agendado', 'Executando envio agendado'],
    ['Erro ao executar disparo agendado', 'Erro ao executar envio agendado'],
    ['dados do disparo', 'dados do envio'],
    ['confirmou o disparo', 'confirmou o envio'],
    ['inicie o disparo', 'inicie o envio'],
    ['O disparo foi interrompido', 'O envio foi interrompido']
  ];

  for (const [from, to] of publicTextReplacements) {
    html = html.replaceAll(from, to);
  }

  const instanceFormHtml = `                <div class="card mb-4" id="instanceForm">
                    <div class="card-header bg-gradient-primary text-white">
                        <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Adicionar Instancia</h5>
                    </div>
                    <div class="card-body">
                        <div class="row g-3 align-items-end">
                            <div class="col-md-5">
                                <label for="newInstanceName" class="form-label">Nome da instancia</label>
                                <input type="text" class="form-control" id="newInstanceName" placeholder="Ex: gabinete-fortaleza">
                            </div>
                            <div class="col-md-5">
                                <label for="newInstanceAPIKEY" class="form-label">Token / API key Evolution</label>
                                <input type="password" class="form-control" id="newInstanceAPIKEY" placeholder="Cole o token da instancia">
                            </div>
                            <div class="col-md-2">
                                <button type="button" class="btn btn-primary w-100" id="addInstanceBtn">
                                    <i class="bi bi-plus-lg me-2"></i>Adicionar
                                </button>
                            </div>
                        </div>
                        <small class="text-muted d-block mt-2">A instancia deve existir primeiro na Evolution API. Aqui voce vincula o nome e token para uso nos envios.</small>
                    </div>
                </div>

`;

  html = html.replace(
    /<small class="text-white-50">Inst[\s\S]*?administrador<\/small>/,
    `<small class="text-white-50">Cadastre a instancia criada na Evolution API</small>`
  );

  html = html.replace(
    /(<div class="content-section" id="instancias-section">[\s\S]*?<div class="content-header">[\s\S]*?<\/div>\s*)<div class="card">/,
    `$1${instanceFormHtml}                <div class="card">`
  );

  const assetVersion = Date.now();
  html = html.replaceAll(/(<script src="[^"]+\.js)(?:"\s*><\/script>)/g, `$1?v=${assetVersion}"></script>`);
  html = html.replaceAll(/(<link[^>]+href="[^"]+\.css)(?:"[^>]*>)/g, (match, prefix) => {
    return match.replace(prefix, `${prefix}?v=${assetVersion}`);
  });

  return html;
}

function buildEmbedScript() {
  return `(() => {
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
        const ref = url.replace(/^https?:\\/\\//, '').split('.')[0];
        if (!ref) return '';
        const raw = window.localStorage.getItem(\`sb-\${ref}-auth-token\`);
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
        headers.set('Authorization', \`Bearer \${token}\`);
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
    box.innerHTML = \`
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
    \`;

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
      const response = await fetch(\`/api/disparos/contatos/preview?\${params.toString()}\`, {
        credentials: 'include'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Erro ao calcular contatos');

      const resumo = payload.resumo || {};
      const validos = Number.isFinite(Number(resumo.validos))
        ? \`<span class="text-muted ms-2">(\${resumo.validos} com telefone válido)</span>\`
        : '';
      countBox.innerHTML = \`
        <i class="bi bi-people me-2"></i>
        <strong>\${Number(resumo.total || 0).toLocaleString('pt-BR')}</strong> \${label} encontrados
        \${validos}
      \`;
    } catch (error) {
      countBox.innerHTML = \`<i class="bi bi-exclamation-triangle me-2"></i>\${error.message || 'Erro ao calcular contatos'}\`;
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
      ? new Date(\`\${campaign.data_campanha}T00:00:00\`).toLocaleDateString('pt-BR')
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
        enabled: Boolean(document.getElementById(\`\${msgId}-enabled\`)?.checked),
        text: document.getElementById(\`\${msgId}-text\`)?.value || ''
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

        const enabled = document.getElementById(\`\${msgId}-enabled\`);
        const text = document.getElementById(\`\${msgId}-text\`);
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

  function bindMandatoCampaignPersistence() {
    for (const msgId of ['msg1', 'msg2', 'msg3']) {
      const enabled = document.getElementById(\`\${msgId}-enabled\`);
      const text = document.getElementById(\`\${msgId}-text\`);
      const media = document.getElementById(\`\${msgId}-media\`);

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
        \`Deseja desconectar a instancia "\${instance.name}"?\`,
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
            window.UI?.showSuccess?.(\`Instancia "\${instance.name}" desconectada\`);
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

      window.UiManager?.syncFormFields?.();
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }, true);
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
        const response = await fetch(\`/api/disparos/instancias-runtime?id=\${encodeURIComponent(id)}\`, {
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
    const params = getMandatoContactParams();
    window.UI?.showLoading?.('Importando contatos do MandatoPro...');

    try {
      const response = await fetch(\`\${window.APP_ENV.MANDATOPRO_CONTACTS_ENDPOINT}?\${params.toString()}\`, {
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
      window.UI?.showSuccess?.(\`\${window.AppState.contacts.length} contatos importados do MandatoPro\`);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MandatoProDisparoEmbed = { patchAuth, patchFetchAuth, addMandatoContactsButton, originalInitialize };
})();`;
}

function buildEnvScript() {
  return `// Runtime env loader for the MandatoPro embedded Mandato Connect.
(function () {
  var allowedKeys = {
    SUPABASE_URL: true,
    SUPABASE_ANON_KEY: true,
    N8N_WEBHOOK_DISPARO_PRO: true,
    N8N_WEBHOOK_ASAAS_BILLING: true,
    API_BASE_URL: true,
    MANDATOPRO_EMBED: true,
    MANDATOPRO_CONTACTS_ENDPOINT: true
  };

  var env = window.APP_ENV || window.__ENV__ || {};
  var merged = {};

  Object.keys(allowedKeys).forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      merged[key] = env[key];
    }
  });

  window.APP_ENV = merged;

  window.getAppEnv = function (key) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      return merged[key];
    }
    console.warn('[env] Missing ' + key);
    return '';
  };
})();
`;
}

function patchGeneratedRuntimeScripts() {
  const instancesPath = path.join(publicRoot, 'frontend', 'js', 'modules', 'instances.js');
  if (fs.existsSync(instancesPath)) {
    let instances = fs.readFileSync(instancesPath, 'utf8');
    instances = instances
      .replaceAll('inst.id === instanceId', 'String(inst.id) === String(instanceId)')
      .replaceAll('inst.id !== instanceId', 'String(inst.id) !== String(instanceId)')
      .replaceAll(
        '<button class="btn btn-outline-primary btn-sm check-connection-btn" ',
        '<button type="button" class="btn btn-outline-primary btn-sm check-connection-btn" onclick="InstanceManager.checkConnection(this.dataset.instanceId); return false;" '
      )
      .replaceAll(
        '<button class="btn btn-outline-warning btn-sm show-qr-btn" ',
        '<button type="button" class="btn btn-outline-warning btn-sm show-qr-btn" onclick="InstanceManager.showConnectionModal(this.dataset.instanceId); return false;" '
      )
      .replaceAll(
        '<button class="btn btn-outline-danger btn-sm remove-instance-btn" ',
        '<button type="button" class="btn btn-outline-danger btn-sm remove-instance-btn" onclick="InstanceManager.removeInstance(this.dataset.instanceId); return false;" '
      )
      .replaceAll(
        '<button class="btn btn-outline-secondary btn-sm disconnect-instance-btn" ',
        '<button type="button" class="btn btn-outline-secondary btn-sm disconnect-instance-btn" onclick="InstanceManager.disconnectInstance(this.dataset.instanceId); return false;" '
      )
      .replaceAll(
        '<button class="btn btn-outline-success btn-sm export-contacts-btn" ',
        `<button type="button" class="btn btn-outline-success btn-sm export-contacts-btn" onclick="if (typeof InstanceContactsExporter !== 'undefined') InstanceContactsExporter.exportInstanceContacts(this.dataset.instanceId); return false;" `
      );
    if (!instances.includes('window.InstanceManager = InstanceManager;')) {
      instances += `

window.ConnectionManager = ConnectionManager;
window.InstanceManager = InstanceManager;
if (typeof ConnectionManagerWithLicense !== 'undefined') {
  window.ConnectionManagerWithLicense = ConnectionManagerWithLicense;
}
`;
    }
    fs.writeFileSync(instancesPath, instances, 'utf8');
  }

  const integrationsPath = path.join(publicRoot, 'frontend', 'js', 'modules', 'integrations.js');
  if (fs.existsSync(integrationsPath)) {
    let integrations = fs.readFileSync(integrationsPath, 'utf8');
    if (!integrations.includes('window.PhoneUtils = PhoneUtils;')) {
      integrations += `

if (typeof PhoneUtils !== 'undefined') window.PhoneUtils = PhoneUtils;
if (typeof TimeEstimator !== 'undefined') window.TimeEstimator = TimeEstimator;
`;
    }
    fs.writeFileSync(integrationsPath, integrations, 'utf8');
  }

  const contactsPath = path.join(publicRoot, 'frontend', 'js', 'modules', 'contacts.js');
  if (fs.existsSync(contactsPath)) {
    let contacts = fs.readFileSync(contactsPath, 'utf8');
    if (!contacts.includes('window.ContactManager = ContactManager;')) {
      contacts += `

window.ContactManager = ContactManager;
if (typeof PreviewManager !== 'undefined') window.PreviewManager = PreviewManager;
`;
    }
    fs.writeFileSync(contactsPath, contacts, 'utf8');
  }

  const settingsPath = path.join(publicRoot, 'frontend', 'js', 'modules', 'settings.js');
  if (fs.existsSync(settingsPath)) {
    let settings = fs.readFileSync(settingsPath, 'utf8');
    settings = settings
      .replace(
        'instances: AppState.instances.map(instance => ({\n                ...instance,\n                lastCheck: instance.lastCheck.toISOString()\n            })),',
        `instances: (AppState.instances || []).map(instance => ({
                ...instance,
                lastCheck: instance.lastCheck
                    ? new Date(instance.lastCheck).toISOString()
                    : null
            })),`
      )
      .replace(
        'scheduledDispatches: AppState.scheduledDispatches.map(dispatch => ({\n                ...dispatch,\n                scheduledDateTime: dispatch.scheduledDateTime.toISOString(),\n                createdAt: dispatch.createdAt.toISOString()\n            }))',
        `scheduledDispatches: (AppState.scheduledDispatches || []).map(dispatch => ({
                ...dispatch,
                scheduledDateTime: dispatch.scheduledDateTime
                    ? new Date(dispatch.scheduledDateTime).toISOString()
                    : null,
                createdAt: dispatch.createdAt
                    ? new Date(dispatch.createdAt).toISOString()
                    : null
            }))`
      )
      .replace(
        'input.onchange = (e) => {\n            const file = e.target.files[0];',
        `input.onchange = (e) => {
            const file = e.target.files[0];
            input.remove();`
      )
      .replace(
        '\n        input.click();',
        '\n        input.style.display = \'none\';\n        document.body.appendChild(input);\n        input.click();'
      )
      .replace(
        'AutoSaveManager.clearSessionData();\n\n            AppState.contacts = [];',
        `AutoSaveManager.clearSessionData();
            StorageService.removeLocal('mandatopro_disparo_settings');
            StorageService.removeLocal('mandatopro_disparo_campaign');
            StorageService.removeLocal('mandatopro_disparo_contacts_meta');

            AppState.contacts = [];`
      );
    if (!settings.includes('window.DataManager = DataManager;')) {
      settings = settings.replace(
        '\nfunction startSafeConfiguration()',
        '\nwindow.DataManager = DataManager;\nwindow.ModeloManager = ModeloManager;\n\nfunction startSafeConfiguration()'
      );
    }
    if (!settings.includes('window.SettingsManager = SettingsManager;')) {
      settings = settings.replace(
        '\nSettingsManager.clearSessionData = function ()',
        '\nwindow.SettingsManager = SettingsManager;\n\nSettingsManager.clearSessionData = function ()'
      );
    }
    fs.writeFileSync(settingsPath, settings, 'utf8');
  }

  const uiPath = path.join(publicRoot, 'frontend', 'js', 'ui.js');
  if (fs.existsSync(uiPath)) {
    let ui = fs.readFileSync(uiPath, 'utf8');
    ui = ui.replace(
      "const instanceCount = document.getElementById('activeInstancesCount')?.textContent || '0';",
      "const instanceCount = String(window.AppState?.instances?.length || 0);"
    );
    fs.writeFileSync(uiPath, ui, 'utf8');
  }
}

fs.mkdirSync(publicRoot, { recursive: true });
copyRecursive(path.join(sourceRoot, 'frontend', 'css'), path.join(publicRoot, 'frontend', 'css'));
copyRecursive(path.join(sourceRoot, 'frontend', 'js'), path.join(publicRoot, 'frontend', 'js'), {
  ignore: (src) => {
    const relative = path.relative(path.join(sourceRoot, 'frontend', 'js'), src).replaceAll(path.sep, '/');
    return relative === 'admin.js'
      || relative === 'main copy.js'
      || relative.startsWith('modules/admin');
  }
});
copyRecursive(path.join(sourceRoot, 'frontend', 'assets', 'img'), path.join(publicRoot, 'frontend', 'assets', 'img'));
copyRecursive(
  path.join(sourceRoot, 'frontend', 'assets', 'notiflix', 'dist'),
  path.join(publicRoot, 'frontend', 'assets', 'notiflix', 'dist')
);
copyRecursive(path.join(sourceRoot, 'config'), path.join(publicRoot, 'config'));
copyRecursive(path.join(sourceRoot, 'modelo-planilha.xlsx'), path.join(publicRoot, 'modelo-planilha.xlsx'));
copyRecursive(path.join(sourceRoot, 'relatorio.html'), path.join(publicRoot, 'relatorio.html'));
patchGeneratedRuntimeScripts();

fs.writeFileSync(path.join(publicRoot, 'index.html'), buildHtml(), 'utf8');
fs.writeFileSync(path.join(publicRoot, 'mandatopro-embed.js'), buildEmbedScript(), 'utf8');
fs.writeFileSync(path.join(publicRoot, 'config', 'env.js'), buildEnvScript(), 'utf8');

console.log(`Mandato Connect embed gerado em ${publicRoot}`);
