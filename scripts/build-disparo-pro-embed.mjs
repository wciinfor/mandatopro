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
                        <small class="text-muted d-block mt-2">A instancia deve existir primeiro na Evolution API. Aqui voce vincula o nome e token para uso nos disparos.</small>
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
    \`;

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

  async function importMandatoContacts() {
    const origem = document.getElementById('mandatoOrigem')?.value || 'eleitores';
    const cidade = document.getElementById('mandatoCidade')?.value || '';
    const bairro = document.getElementById('mandatoBairro')?.value || '';
    const search = document.getElementById('mandatoBusca')?.value || '';
    const limit = document.getElementById('mandatoLimite')?.value || '1000';

    const params = new URLSearchParams({ origem, cidade, bairro, search, limit });
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

      window.ContactManager?.updateContactsList?.();
      window.TimeEstimator?.update?.();
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

  function init() {
    patchFetchAuth();
    patchAuth();
    patchNavigation();
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
})();`;
}

function buildEnvScript() {
  return `// Runtime env loader for the MandatoPro embedded Disparo PRO.
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
copyRecursive(path.join(sourceRoot, 'service-worker.js'), path.join(publicRoot, 'service-worker.js'));

fs.writeFileSync(path.join(publicRoot, 'index.html'), buildHtml(), 'utf8');
fs.writeFileSync(path.join(publicRoot, 'mandatopro-embed.js'), buildEmbedScript(), 'utf8');
fs.writeFileSync(path.join(publicRoot, 'config', 'env.js'), buildEnvScript(), 'utf8');

console.log(`Disparo PRO embed gerado em ${publicRoot}`);
