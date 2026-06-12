// ========================================
// DISPARADOR PRO - MAIN.JS
// ========================================

// Proteção contra atualização indevida do dashboard
Object.defineProperty(window, 'protectTotalContacts', {
    value: function () {
        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            let currentValue = AppState.contacts.length;

            // Observer para detectar mudanças
            const observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                        const newValue = parseInt(totalContactsEl.textContent) || 0;
                        const correctValue = AppState.contacts.length;

                        if (newValue !== correctValue && correctValue > 0) {
                            console.warn(`⚠️ totalContacts foi alterado indevidamente: ${newValue} → ${correctValue}`);
                            totalContactsEl.textContent = correctValue;
                        }
                    }
                });
            });

            observer.observe(totalContactsEl, {
                characterData: true,
                childList: true,
                subtree: true
            });

            console.log('🛡️ Proteção de totalContacts ativada');
        }
    },
    writable: false,
    configurable: false
});

// ========================================
// 1. CONFIGURAÇÕES E CONSTANTES
// ========================================
const APP_CONFIG = {
    webhookUrl: WEBHOOK_URL,
    version: '3.0',
    updateCheckInterval: 5 * 60 * 1000, // 5 minutos
    scheduledCheckInterval: 30000, // 30 segundos
    maxHistoryEntries: 50,
    qrRefreshTime: 30000, // 30 segundos
    webhookConexao: WEBHOOK_URL,
    webhookExportContacts: WEBHOOK_URL
};

const isFileProtocol = window.location.protocol === 'file:';
const supportsBlob = !isFileProtocol && 'URL' in window && 'createObjectURL' in URL;

console.log('🔍 Protocolo atual:', window.location.protocol);
console.log('📁 É protocolo file:', isFileProtocol);
console.log('🔗 Suporte a blob:', supportsBlob);

const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

if (isLocalhost && window.location.protocol.startsWith('http')) {
    console.log('🌐 Servidor local detectado - blob URLs habilitadas');
    window.supportsBlob = true;
} else {
    window.supportsBlob = supportsBlob;
}

const AuthManager = {
    isAuthenticated: false,
    currentUser: null,

    initialize() {
        console.log('🔐 Inicializando sistema de autenticação com controle de licença...');

        // ✅ VERIFICAR LICENÇA ANTES DE QUALQUER COISA
        if (!this.validateLicenseFile()) {
            this.showLicenseError();
            return;
        }

        this.checkSavedCredentials();
        this.setupLoginEvents();
    },

    // ✅ NOVA FUNÇÃO: Validar arquivo de licença
    validateLicenseFile() {
        try {
            if (typeof LICENSE_METADATA === 'undefined') {
                console.error('🚨 Arquivo integracao.js não encontrado ou inválido!');
                return false;
            }

            if (!LICENSE_METADATA.email || !LICENSE_METADATA.licenseKey) {
                console.error('🚨 Dados de licença incompletos!');
                return false;
            }

            console.log('✅ Arquivo de licença válido:', {
                email: LICENSE_METADATA.email,
                version: LICENSE_METADATA.version,
                generatedAt: LICENSE_METADATA.generatedAt
            });

            return true;
        } catch (error) {
            console.error('❌ Erro ao validar licença:', error);
            return false;
        }
    },

    // ✅ NOVA FUNÇÃO: Mostrar erro de licença
    showLicenseError() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');

        if (loginScreen) {
            loginScreen.innerHTML = `
                <div class="login-screen">
                    <div class="login-container">
                        <div class="container">
                            <div class="row justify-content-center">
                                <div class="col-md-6">
                                    <div class="login-card p-5 text-center">
                                        <div class="mb-4">
                                            <i class="bi bi-shield-exclamation" style="font-size: 4rem; color: #dc3545;"></i>
                                        </div>
                                        
                                        <div class="d-grid gap-2">
                                            <button type="button" class="btn btn-primary" onclick="window.open('instalacao.html', '_blank')">
                                                <i class="bi bi-tools me-2"></i>Executar Instalador
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary" onclick="location.reload()">
                                                <i class="bi bi-arrow-clockwise me-2"></i>Recarregar Página
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            loginScreen.style.display = 'block';
        }

        if (mainApp) {
            mainApp.style.display = 'none';
        }
    },

    checkSavedCredentials() {
        const saved = localStorage.getItem('disparador_auth');
        if (saved) {
            try {
                const credentials = JSON.parse(saved);
                if (credentials.instanceName && credentials.apikey) {
                    console.log('🔑 Credenciais salvas encontradas, validando licença...');

                    this.currentUser = {
                        instanceName: credentials.instanceName,
                        apikey: credentials.apikey,
                        connectionStatus: 'unknown',
                        loginTime: new Date()
                    };

                    this.isAuthenticated = true;
                    this.showMainApp();
                    this.populatePanelCredentials();

                    setTimeout(() => {
                        App.initializeApp().then(() => {
                            this.verifyConnectionWithLicense(credentials.instanceName, credentials.apikey);
                        });
                    }, 300);

                    return;
                }
            } catch (error) {
                console.warn('⚠️ Erro ao carregar credenciais salvas:', error);
                localStorage.removeItem('disparador_auth');
            }
        }

        this.showLoginScreen();
    },

    // ✅ FUNÇÃO ATUALIZADA: Login com validação de licença
    async handleLogin() {
        const instanceName = document.getElementById('loginInstanceName')?.value?.trim();
        const apikey = document.getElementById('loginAPIKEY')?.value?.trim();
        const remember = document.getElementById('rememberCredentials')?.checked;

        if (!instanceName || !apikey) {
            this.showError('Preencha nome da instância e APIKEY');
            return;
        }

        await this.verifyAndLoginWithLicense(instanceName, apikey, remember);
    },

    // Login com validação de licença
    async verifyAndLoginWithLicense(instanceName, apikey, remember = false) {
        this.showLoading('Verificando licença e credenciais...');

        try {
            const licenseInfo = this.getLicenseInfo();
            if (!licenseInfo.isValid) {
                this.hideLoading();
                this.showError('❌ Arquivo de licença inválido!');
                return;
            }

            console.log('🔒 Validando com licença:', {
                email: licenseInfo.email,
                instanceName: instanceName
            });

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'login',
                    instanceName: instanceName,
                    instanceAPIKEY: apikey,
                    licenseEmail: licenseInfo.email,
                    licenseKey: licenseInfo.licenseKey
                })
            });

            const data = await response.json();
            this.hideLoading();

            if (data.result === 'license_invalid') {
                this.showError('❌ Licença inválida ou inativa! Entre em contato com o suporte.');
                this.handleLicenseError('invalid');
                return;
            } else if (data.result === 'license_expired') {
                this.showError('❌ Licença expirada! Renove sua assinatura.');
                this.handleLicenseError('expired');
                return;
            } else if (data.result === 'license_not_found') {
                this.showError('❌ Licença não encontrada no sistema!');
                this.handleLicenseError('not_found');
                return;
            } else if (data.result === 'error') {
                this.showError('❌ Credenciais inválidas! Verifique o nome da instância e APIKEY.');
                return;
            }

            console.log('✅ Login realizado com sucesso (licença validada)!');

            this.currentUser = {
                instanceName: instanceName,
                apikey: apikey,
                connectionStatus: data.result === 'open' ? 'connected' : 'disconnected',
                loginTime: new Date(),
                licenseInfo: licenseInfo
            };

            if (remember) {
                localStorage.setItem('disparador_auth', JSON.stringify({
                    instanceName: instanceName,
                    apikey: apikey
                }));
            }

            this.isAuthenticated = true;
            this.populatePanelCredentials();
            this.showMainApp();

            setTimeout(() => {
                App.initializeApp().then(() => {
                    this.addInstanceToManager(instanceName, apikey, data.result);
                });
            }, 200);

        } catch (error) {
            this.hideLoading();
            console.error('❌ Erro no login:', error);
            this.showError('Erro ao verificar credenciais e licença. Tente novamente.');
        }
    },

    // Verificar conexão com licença (para credenciais salvas)
    async verifyConnectionWithLicense(instanceName, apikey) {
        try {
            const licenseInfo = this.getLicenseInfo();
            if (!licenseInfo.isValid) {
                console.warn('⚠️ Licença inválida nas credenciais salvas');
                this.performLogout();
                return;
            }

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verificar_conexao',
                    instanceName: instanceName,
                    instanceAPIKEY: apikey,
                    licenseEmail: licenseInfo.email,
                    licenseKey: licenseInfo.licenseKey
                })
            });

            const data = await response.json();

            if (data.result === 'license_invalid' || data.result === 'license_expired') {
                console.warn('⚠️ Licença invalidada, fazendo logout automático...');
                this.showWarning('Licença inválida ou expirada. Faça login novamente.');
                this.performLogout();
                return;
            }

            if (data.result === 'error') {
                console.warn('⚠️ Credenciais salvas inválidas, fazendo logout...');
                this.performLogout();
                return;
            }

            this.currentUser.connectionStatus = data.result === 'open' ? 'connected' : 'disconnected';
            this.addInstanceToManager(instanceName, apikey, data.result);

        } catch (error) {
            console.warn('⚠️ Erro na verificação de credenciais salvas:', error);
            this.showWarning('Erro ao verificar credenciais salvas. Status do WhatsApp pode estar desatualizado.');
        }
    },

    // Obter informações da licença
    getLicenseInfo() {
        try {
            if (typeof LICENSE_METADATA !== 'undefined' && typeof getLicenseInfo === 'function') {
                return getLicenseInfo();
            } else if (typeof LICENSE_METADATA !== 'undefined') {
                return {
                    email: LICENSE_METADATA.email,
                    licenseKey: LICENSE_METADATA.licenseKey,
                    generatedAt: LICENSE_METADATA.generatedAt,
                    version: LICENSE_METADATA.version,
                    isValid: !!(LICENSE_METADATA.email && LICENSE_METADATA.licenseKey)
                };
            }
            return { isValid: false };
        } catch (error) {
            console.error('❌ Erro ao ler informações da licença:', error);
            return { isValid: false };
        }
    },

    // Tratar erros de licença
    handleLicenseError(errorType) {
        let message = '';
        let title = 'Problema com a Licença';

        switch (errorType) {
            case 'invalid':
                message = 'Sua licença está inativa. Isso pode acontecer se você solicitou reembolso ou sua assinatura foi cancelada.';
                break;
            case 'expired':
                message = 'Sua licença expirou. Renove sua assinatura para continuar usando o sistema.';
                break;
            case 'not_found':
                message = 'A licença não foi encontrada em nosso sistema. Verifique se os dados estão corretos.';
                break;
            default:
                message = 'Houve um problema com sua licença. Entre em contato com o suporte.';
        }

        // Mostrar modal de erro de licença
        setTimeout(() => {
            this.confirm(
                title,
                message,
                () => {
                    // Abrir suporte ou página de renovação
                    window.open('http://wa.me/557131906782?text=Problema com a Licença', '_blank');
                },
                'Suporte',
                'Fechar'
            );
        }, 1000);

        // Limpar credenciais salvas
        localStorage.removeItem('disparador_auth');

        // Forçar logout
        setTimeout(() => {
            this.performLogout();
        }, 2000);
    },

    // Verificar autenticação com licença
    requireAuth(skipLoginCheck = false) {
        if (skipLoginCheck) {
            return true;
        }

        // Verificar se arquivo de licença ainda é válido
        if (!this.validateLicenseFile()) {
            this.showError('Arquivo de licença inválido. Recarregue a página.');
            this.showLicenseError();
            return false;
        }

        if (!this.isAuthenticated || !this.currentUser) {
            this.showError('Sessão expirada. Faça login novamente.');
            this.showLoginScreen();
            return false;
        }

        return true;
    },

    setupLoginEvents() {
        const loginForm = document.getElementById('loginForm');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    },

    addInstanceToManager(instanceName, apikey, connectionResult) {
        const existingInstance = AppState.instances.find(inst =>
            inst.name === instanceName && inst.apikey === apikey
        );

        if (!existingInstance) {
            console.log('📱 Adicionando instância ao gerenciador automaticamente...');

            const newInstance = {
                id: Date.now(),
                name: instanceName,
                apikey: apikey,
                status: connectionResult === 'open' ? 'connected' : 'disconnected',
                qrCode: connectionResult !== 'open' ? connectionResult : null,
                lastCheck: new Date(),
                totalSent: 0,
                successCount: 0,
                errorCount: 0
            };

            AppState.instances.push(newInstance);

            if (typeof InstanceManager !== 'undefined') {
                InstanceManager.saveInstances();
                InstanceManager.updateInstancesList();
            }

            console.log('✅ Instância adicionada automaticamente ao gerenciador');
        } else {
            console.log('📱 Instância já existe no gerenciador');
            existingInstance.status = connectionResult === 'open' ? 'connected' : 'disconnected';
            existingInstance.lastCheck = new Date();

            if (typeof InstanceManager !== 'undefined') {
                InstanceManager.saveInstances();
                InstanceManager.updateInstancesList();
            }
        }
    },

    populatePanelCredentials() {
        setTimeout(() => {
            const instanceNameField = document.getElementById('instanceName');
            const instanceAPIKEYField = document.getElementById('instanceAPIKEY');

            if (instanceNameField && this.currentUser) {
                instanceNameField.value = this.currentUser.instanceName;
            }

            if (instanceAPIKEYField && this.currentUser) {
                instanceAPIKEYField.value = this.currentUser.apikey;
            }
        }, 300);
    },

    handleLogout() {
        this.confirm(
            'Confirmar Logout',
            'Tem certeza que deseja sair? Suas configurações serão mantidas.',
            () => {
                this.performLogout();
            }
        );
    },

    performLogout() {
        console.log('👋 Realizando logout...');

        if (typeof ChartManager !== 'undefined') {
            ChartManager.destroy();
            console.log('📊 ChartManager limpo no logout');
        }

        if (typeof TimerManager !== 'undefined') {
            TimerManager.cleanup();
            console.log('⏱️ TimerManager limpo no logout');
        }

        this.isAuthenticated = false;
        this.currentUser = null;
        this.clearLoginForm();
        this.forceShowLoginScreen();

        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
            this.showInfo('Logout realizado com sucesso!');
        }, 100);
    },

    clearLoginForm() {
        setTimeout(() => {
            const fields = ['loginInstanceName', 'loginAPIKEY'];
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                    console.log(`🧹 Campo ${fieldId} limpo`);
                }
            });

            const rememberCheckbox = document.getElementById('rememberCredentials');
            if (rememberCheckbox) {
                rememberCheckbox.checked = false;
                console.log('🧹 Checkbox "lembrar" desmarcado');
            }
        }, 50);
    },

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');

        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            loginScreen.style.display = 'block';
        }

        if (mainApp) {
            mainApp.classList.remove('authenticated');
            mainApp.style.display = 'none';
        }

        this.isAuthenticated = false;
        this.disableMainAppButtons();

        console.log('🔐 Tela de login exibida');
    },

    showMainApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');

        if (loginScreen) {
            loginScreen.classList.add('hidden');
            loginScreen.style.display = 'none';
        }

        if (mainApp) {
            mainApp.classList.add('authenticated');
            mainApp.style.display = 'block';
        }

        this.isAuthenticated = true;

        if (typeof TimerManager !== 'undefined') {
            TimerManager.initialize();
            console.log('⏱️ TimerManager inicializado após login');
        }

        this.enableMainAppButtons();

        // Verificar se há disparo para retomar
        setTimeout(() => {
            const resumableDispatch = ActiveDispatchManager.checkForResumableDispatch();
            if (resumableDispatch) {
                ActiveDispatchManager.showResumeModal(resumableDispatch);
            }
        }, 2000);

        console.log('🎉 Painel principal exibido - usuário autenticado');
    },

    forceShowLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');

        console.log('🔐 Forçando exibição da tela de login...');

        if (typeof ChartManager !== 'undefined') {
            ChartManager.destroy();
        }

        if (typeof TimerManager !== 'undefined') {
            TimerManager.cleanup();
        }

        if (mainApp) {
            mainApp.classList.remove('authenticated');
            mainApp.style.display = 'none';
            console.log('📱 Painel principal escondido');
        }

        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            loginScreen.style.display = 'block';
            console.log('🔐 Tela de login exibida');
        }

        this.isAuthenticated = false;

        if (document.activeElement) {
            document.activeElement.blur();
        }

        console.log('✅ Logout visual concluído');
    },

    disableMainAppButtons() {
        const submitBtn = document.querySelector('#mainApp button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.pointerEvents = 'none';
        }

        const importantButtons = document.querySelectorAll('#mainApp .btn-whatsapp, #mainApp #pauseButton, #mainApp #stopButton');
        importantButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
        });

        console.log('🔒 Botões do painel principal desabilitados');
    },

    enableMainAppButtons() {
        const submitBtn = document.querySelector('#mainApp button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.pointerEvents = 'auto';
        }

        const importantButtons = document.querySelectorAll('#mainApp .btn-whatsapp, #mainApp #pauseButton, #mainApp #stopButton');
        importantButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
        });

        console.log('🔓 Botões do painel principal habilitados');
    },

    getCurrentUser() {
        return this.currentUser;
    },

    // Métodos auxiliares para UI
    showLoading(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Loading.hourglass(message);
        } else {
            console.log('Loading:', message);
        }
    },

    hideLoading() {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Loading.remove();
        }
    },

    showSuccess(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.success(message);
        } else {
            alert('Sucesso: ' + message);
        }
    },

    showError(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.failure(message);
        } else {
            alert('Erro: ' + message);
        }
    },

    showInfo(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.info(message);
        } else {
            alert('Info: ' + message);
        }
    },

    showWarning(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.warning(message);
        } else {
            alert('Aviso: ' + message);
        }
    },

    confirm(title, message, onConfirm, confirmText = 'Sim', cancelText = 'Cancelar') {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Confirm.show(title, message, confirmText, cancelText, onConfirm, () => { });
        } else {
            if (confirm(title + '\n\n' + message)) {
                onConfirm();
            }
        }
    }
};

// ========================================
// 2. SISTEMA DE VARIAÇÕES ALEATÓRIAS
// ========================================

const RandomTagsSystem = {
    // ✅ Definir todas as variações disponíveis
    variations: {
        oi: [
            'Oi', 'Olá', 'E aí', 'Opa', 'Salve', 'Fala aí', 'Eae', 'Hey', 'Alo'
        ],
        obrigado: [
            'Obrigado', 'Valeu', 'Muito obrigado', 'Obrigadão', 'Vlw', 'Brigadão',
            'Agradeço', 'Thanks', 'Grato', 'Tmj'
        ],
        tchau: [
            'Tchau', 'Até logo', 'Falou', 'Até mais', 'Abraços', 'Um abraço',
            'Até breve', 'Flw', 'Até a próxima', 'Grande abraço'
        ],
        emoticon: [
            '😊', '😁', '👍', '😉', '🙂', '😄', '✨', '🎉', '💪', '🚀',
            '❤️', '🔥', '⭐', '💯', '👏', '🤝', '😍', '🥰', '🎯', '💖'
        ],
        // ✅ Tags existentes mantidas
        nome: ['{nome}'], // Mantém comportamento atual
        saudacao: ['{saudacao}'] // Mantém comportamento atual
    },

    // ✅ Função para obter variação aleatória
    getRandomVariation(tagType) {
        const variations = this.variations[tagType];
        if (!variations || variations.length === 0) {
            console.warn(`⚠️ Tag "${tagType}" não encontrada`);
            return `{${tagType}}`;
        }

        // Se for tag especial (nome/saudacao), retornar como está
        if (tagType === 'nome' || tagType === 'saudacao') {
            return variations[0];
        }

        // Para tags com variações, escolher aleatoriamente
        const randomIndex = Math.floor(Math.random() * variations.length);
        const selected = variations[randomIndex];

        console.log(`🎲 Tag {${tagType}} → "${selected}" (${randomIndex + 1}/${variations.length})`);
        return selected;
    },

    // ✅ Processar todas as tags em uma mensagem
    processAllTags(message) {
        if (!message) return '';

        console.log('🔄 Processando tags na mensagem:', message);

        let processedMessage = message;

        // Processar cada tipo de tag
        Object.keys(this.variations).forEach(tagType => {
            const tagPattern = new RegExp(`\\{${tagType}\\}`, 'g');

            // Substituir cada ocorrência individualmente para garantir aleatoriedade
            processedMessage = processedMessage.replace(tagPattern, () => {
                return this.getRandomVariation(tagType);
            });
        });

        console.log('✅ Mensagem processada:', processedMessage);
        return processedMessage;
    },

    // ✅ Função para preview (mostra uma variação)
    processTagsForPreview(message) {
        return this.processAllTags(message);
    },

    // ✅ Listar todas as tags disponíveis
    getAvailableTags() {
        return Object.keys(this.variations).map(tag => ({
            tag: `{${tag}}`,
            variations: this.variations[tag],
            count: this.variations[tag].length
        }));
    }
};

window.RandomTagsSystem = RandomTagsSystem;

// ========================================
// 2. ESTADO DA APLICAÇÃO
// ========================================
const AppState = {
    contacts: [],
    sendingInProgress: false,
    stopSending: false,
    isPaused: false,
    results: { success: 0, error: 0 },
    chart: null,
    sendingDetails: [],
    sendingHistory: [],
    scheduledDispatches: [],
    estimatedTime: 0,
    startTime: null,
    instances: [],
    activeInstances: [],

    batchPauseEnabled: false,
    batchSize: 10,
    batchPauseDuration: 10,
    currentBatchCount: 0,
    batchPauseActive: false,
    batchTimer: null,
    totalBatches: 0,
    currentBatchNumber: 1,

    // PWA e updates
    registration: null,
    deferredPrompt: null,

    businessHoursEnabled: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
    isWaitingForBusinessHours: false,

    // Multiplas mensagens:
    multipleMessagesEnabled: false,
    messagesConfig: {
        msg1: { enabled: true, text: '', media: null },
        msg2: { enabled: false, text: '', media: null },
        msg3: { enabled: false, text: '', media: null }
    },
};

// Estado do disparo em andamento (salvo em tempo real)
const ActiveDispatchState = {
    isActive: false,
    startedAt: null,
    currentIndex: 0,
    totalContacts: 0,
    successCount: 0,
    errorCount: 0,
    contactsProcessed: [],
    config: null,
    lastUpdateTimestamp: null
};

// ========================================
// GERENCIAMENTO DE DISPARO ATIVO
// ========================================
const ActiveDispatchManager = {
    saveKey: 'active_dispatch_state',

    // Salvar estado atual do disparo
    saveDispatchState(currentIndex, contact) {
        try {
            const state = {
                isActive: true,
                startedAt: AppState.startTime,
                currentIndex: currentIndex,
                totalContacts: AppState.contacts.length,
                successCount: AppState.results.success,
                errorCount: AppState.results.error,
                contactsProcessed: AppState.sendingDetails.map(d => d.phone),
                lastUpdateTimestamp: Date.now(),
                config: {
                    instanceName: document.getElementById('instanceName')?.value || '',
                    instanceAPIKEY: document.getElementById('instanceAPIKEY')?.value || '',
                    minInterval: document.getElementById('minInterval')?.value || '',
                    maxInterval: document.getElementById('maxInterval')?.value || '',
                    ia: document.getElementById('ia')?.value || '',
                },
                currentContact: {
                    name: contact.name,
                    phone: contact.phone
                }
            };

            localStorage.setItem(this.saveKey, JSON.stringify(state));
            console.log(`💾 Estado do disparo salvo: índice ${currentIndex}/${AppState.contacts.length}`);
        } catch (error) {
            console.error('❌ Erro ao salvar estado do disparo:', error);
        }
    },

    // Carregar estado do disparo
    loadDispatchState() {
        try {
            const saved = localStorage.getItem(this.saveKey);
            if (!saved) return null;

            const state = JSON.parse(saved);

            // Verificar se é um disparo recente (últimas 24 horas)
            const hoursSinceLastUpdate = (Date.now() - state.lastUpdateTimestamp) / (1000 * 60 * 60);

            if (hoursSinceLastUpdate > 24) {
                console.log('⏰ Disparo muito antigo (>24h), descartando');
                this.clearDispatchState();
                return null;
            }

            console.log('📖 Estado de disparo anterior encontrado:', {
                currentIndex: state.currentIndex,
                totalContacts: state.totalContacts,
                successCount: state.successCount,
                errorCount: state.errorCount,
                hoursAgo: hoursSinceLastUpdate.toFixed(1)
            });

            return state;
        } catch (error) {
            console.error('❌ Erro ao carregar estado do disparo:', error);
            return null;
        }
    },

    // Limpar estado salvo
    clearDispatchState() {
        localStorage.removeItem(this.saveKey);
        console.log('🗑️ Estado do disparo limpo');
    },

    // Verificar se há disparo para retomar
    checkForResumableDispatch() {
        const state = this.loadDispatchState();

        if (!state || !state.isActive) {
            return null;
        }

        // Verificar se ainda há contatos para processar
        const remainingContacts = state.totalContacts - state.currentIndex;

        if (remainingContacts <= 0) {
            console.log('✅ Disparo anterior já foi concluído');
            this.clearDispatchState();
            return null;
        }

        return state;
    },

    // Mostrar modal de retomada
    showResumeModal(state) {
        const remainingContacts = state.totalContacts - state.currentIndex;
        const progressPercent = ((state.currentIndex / state.totalContacts) * 100).toFixed(1);
        const hoursSinceLastUpdate = ((Date.now() - state.lastUpdateTimestamp) / (1000 * 60 * 60)).toFixed(1);

        const modalContent = `
            <div class="modal fade" id="resumeDispatchModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="bi bi-exclamation-triangle me-2"></i>Disparo Interrompido Detectado
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                Foi detectado um disparo que foi interrompido há <strong>${hoursSinceLastUpdate}h</strong>.
                            </div>

                            <div class="card mb-3">
                                <div class="card-body">
                                    <h6 class="card-title">📊 Progresso Anterior:</h6>
                                    
                                    <div class="row text-center mb-3">
                                        <div class="col-4">
                                            <div class="fw-bold text-primary">${state.currentIndex}</div>
                                            <small class="text-muted">Processados</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-success">${state.successCount}</div>
                                            <small class="text-muted">Sucessos</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-danger">${state.errorCount}</div>
                                            <small class="text-muted">Erros</small>
                                        </div>
                                    </div>

                                    <div class="progress mb-2" style="height: 20px;">
                                        <div class="progress-bar bg-warning" style="width: ${progressPercent}%">
                                            ${progressPercent}%
                                        </div>
                                    </div>

                                    <div class="text-center">
                                        <strong>${remainingContacts} contatos restantes</strong> para processar
                                        <br>
                                        <small class="text-muted">Último contato: ${state.currentContact.name}</small>
                                    </div>
                                </div>
                            </div>

                            <div class="alert alert-warning">
                                <strong><i class="bi bi-question-circle me-2"></i>O que deseja fazer?</strong>
                                <ul class="mb-0 mt-2">
                                    <li><strong>Retomar:</strong> Continua de onde parou (recomendado)</li>
                                    <li><strong>Novo Disparo:</strong> Descarta o progresso e inicia do zero</li>
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="ActiveDispatchManager.startFreshDispatch()">
                                <i class="bi bi-arrow-clockwise me-2"></i>Novo Disparo
                            </button>
                            <button type="button" class="btn btn-success" onclick="ActiveDispatchManager.resumeDispatch()">
                                <i class="bi bi-play-circle me-2"></i>Retomar Disparo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente
        const existingModal = document.getElementById('resumeDispatchModal');
        if (existingModal) existingModal.remove();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('resumeDispatchModal'));
        modal.show();
    },

    // Retomar disparo anterior
    async resumeDispatch() {
        const state = this.loadDispatchState();
        if (!state) {
            UI.showError('Estado do disparo não encontrado');
            return;
        }

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('resumeDispatchModal'));
        if (modal) modal.hide();

        UI.showLoading('Restaurando estado do disparo...');

        try {
            // Restaurar configurações
            if (state.config) {
                const fields = ['instanceName', 'instanceAPIKEY', 'minInterval', 'maxInterval', 'ia'];
                fields.forEach(fieldId => {
                    const element = document.getElementById(fieldId);
                    if (element && state.config[fieldId]) {
                        element.value = state.config[fieldId];
                    }
                });
            }

            // Restaurar estado da aplicação
            AppState.startTime = state.startedAt;
            AppState.results = {
                success: state.successCount,
                error: state.errorCount
            };

            // Filtrar contatos já processados
            const processedPhones = new Set(state.contactsProcessed);
            const remainingContacts = AppState.contacts.filter(
                contact => !processedPhones.has(contact.phone)
            );

            console.log(`📋 Retomando disparo: ${remainingContacts.length} contatos restantes`);

            UI.hideLoading();
            UI.showSuccess(`Retomando disparo com ${remainingContacts.length} contatos restantes`);

            // Aguardar um pouco antes de iniciar
            await Utils.sleep(1000);

            // Iniciar envio com contatos restantes
            this.continueDispatch(remainingContacts, state);

        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro ao retomar disparo:', error);
            UI.showError('Erro ao retomar disparo: ' + error.message);
        }
    },

    // Continuar disparo com contatos restantes
    async continueDispatch(remainingContacts, previousState) {
        // Substituir lista de contatos temporariamente
        const originalContacts = [...AppState.contacts];
        AppState.contacts = remainingContacts;

        // Iniciar envio
        SendingManager.initializeSending();

        // Redirecionar para seção de progresso
        SendingManager.switchToProgressSection();

        const { instanceName, instanceAPIKEY } = Validators.instanceData();
        const ia = document.getElementById('ia')?.value || '';
        const { min: minInterval, max: maxInterval } = Validators.intervals();

        for (let i = 0; i < remainingContacts.length; i++) {
            if (AppState.stopSending) break;

            const contact = remainingContacts[i];
            const globalIndex = previousState.currentIndex + i;

            // Salvar progresso a cada envio
            this.saveDispatchState(globalIndex + 1, contact);

            TimerManager.showSending(contact.name, globalIndex, previousState.totalContacts);
            const messageData = await SendingManager.prepareMessageData(contact);

            await SendingManager.waitWhilePaused();
            if (AppState.stopSending) break;

            await SendingManager.sendMessage(instanceName, instanceAPIKEY, ia, contact, messageData);
            SendingManager.updateProgress(globalIndex);

            // Verificações de pausa
            if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
                UI.showWarning('Horário comercial encerrado. Pausando até próximo período.');
                await BusinessHoursManager.waitForBusinessHours();
                if (AppState.stopSending) break;
            }

            if (BatchManager.shouldPauseBatch(globalIndex)) {
                await BatchManager.startBatchPause();
                if (AppState.stopSending) break;
            }

            // Temporizador para próximo envio
            const isLastMessage = i >= remainingContacts.length - 1;
            if (!isLastMessage && !AppState.stopSending) {
                const delay = Math.random() * (maxInterval * 1000 - minInterval * 1000) + minInterval * 1000;
                TimerManager.startCountdown(delay, globalIndex + 1, previousState.totalContacts);
                await Utils.sleep(delay);
                TimerManager.hide();
            }
        }

        // Restaurar lista original
        AppState.contacts = originalContacts;

        // Limpar estado salvo
        this.clearDispatchState();

        // Finalizar
        SendingManager.finishSending();
    },

    // Iniciar novo disparo (descarta anterior)
    startFreshDispatch() {
        this.clearDispatchState();

        const modal = bootstrap.Modal.getInstance(document.getElementById('resumeDispatchModal'));
        if (modal) modal.hide();

        UI.showSuccess('Disparo anterior descartado. Inicie um novo disparo normalmente.');
    }
};

// Expor globalmente
window.ActiveDispatchManager = ActiveDispatchManager;

// ========================================
// 3. GERENCIAMENTO DE INTERVALOS
// ========================================
const AppIntervals = {
    qrRefresh: null,
    scheduledCheck: null,
    updateCheck: null,

    clear(intervalName) {
        if (this[intervalName]) {
            clearInterval(this[intervalName]);
            this[intervalName] = null;
        }
    },

    clearAll() {
        Object.keys(this).forEach(key => {
            if (key !== 'clear' && key !== 'clearAll' && this[key]) {
                clearInterval(this[key]);
                this[key] = null;
            }
        });
    }
};

// ========================================
// 4. UTILITÁRIOS E HELPERS
// ========================================
const Utils = {
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    },

    // Async wrapper with error handling
    async safeAsyncCall(fn, errorMessage = 'Erro inesperado') {
        try {
            return await fn();
        } catch (error) {
            console.error(errorMessage, error);
            Notiflix.Notify.failure(errorMessage);
            return null;
        }
    },

    // Saudação baseada no horário
    getSaudacao() {
        const hora = new Date().getHours();
        if (hora >= 5 && hora < 12) return "Bom dia";
        if (hora >= 12 && hora < 18) return "Boa tarde";
        return "Boa noite";
    },

    // Formatação de tempo
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    },

    // Formatação de tempo restante
    formatTimeRemaining(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    },

    // Sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // File to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            console.log('🔄 Iniciando conversão para base64:', file.name, file.type);

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    const result = reader.result;
                    if (!result) {
                        throw new Error('Resultado da leitura está vazio');
                    }

                    const base64Data = result.split(',')[1];
                    if (!base64Data) {
                        throw new Error('Dados base64 não encontrados');
                    }

                    console.log('✅ Conversão base64 concluída:', {
                        fileType: file.type,
                        originalSize: file.size,
                        base64Size: base64Data.length
                    });

                    resolve(base64Data);
                } catch (error) {
                    console.error('❌ Erro no processamento do resultado:', error);
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                console.error('❌ Erro na leitura do arquivo:', error);
                reject(new Error('Erro ao ler arquivo: ' + error.message));
            };

            reader.onabort = () => {
                console.error('❌ Leitura do arquivo foi abortada');
                reject(new Error('Leitura do arquivo foi abortada'));
            };

            // ✅ VERIFICAÇÃO ADICIONAL PARA ÁUDIO
            if (file.type.startsWith('audio/')) {
                console.log('🔊 Iniciando leitura de arquivo de áudio...');
            }

            try {
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('❌ Erro ao iniciar leitura:', error);
                reject(error);
            }
        });
    },


    // Format date safely
    safeFormatDate(dateValue) {
        try {
            if (!dateValue) return 'Data inválida';
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            return date.toLocaleString('pt-BR');
        } catch (error) {
            return 'Data inválida';
        }
    },

    // Format time safely
    safeFormatTime(dateValue) {
        try {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            return date.toLocaleTimeString('pt-BR');
        } catch (error) {
            return 'Hora inválida';
        }
    }
};

// ========================================
// 5. VALIDADORES
// ========================================
const Validators = {
    instanceData() {
        const instanceName = document.getElementById('instanceName')?.value?.trim() || '';
        const instanceAPIKEY = document.getElementById('instanceAPIKEY')?.value?.trim() || '';
        return {
            valid: !!(instanceName && instanceAPIKEY),
            instanceName,
            instanceAPIKEY
        };
    },

    intervals() {
        const min = parseInt(document.getElementById('minInterval')?.value || 0);
        const max = parseInt(document.getElementById('maxInterval')?.value || 0);
        return { valid: min <= max && min > 0 && max > 0, min, max };
    },

    contacts() {
        return { valid: AppState.contacts.length > 0, count: AppState.contacts.length };
    },

    messages() {
        // ✅ Cache do resultado por um breve período
        if (this._lastValidation && Date.now() - this._lastValidation.timestamp < 500) {
            console.log('📝 Usando validação cached de mensagens');
            return this._lastValidation.result;
        }

        console.log('📝 Executando validação completa de mensagens...');

        const validation = MultipleMessagesManager.validateMessages();

        // ✅ Cachear resultado
        this._lastValidation = {
            timestamp: Date.now(),
            result: { valid: validation.valid, error: validation.error, type: 'multiple' }
        };

        console.log('📝 Resultado da validação:', validation);
        return this._lastValidation.result;
    },

    schedule() {
        const scheduleDate = document.getElementById('scheduleDate')?.value;
        const scheduleTime = document.getElementById('scheduleTime')?.value;

        if (!scheduleDate || !scheduleTime) {
            return { valid: false, error: 'Data e horário obrigatórios' };
        }

        const [year, month, day] = scheduleDate.split('-');
        const [hour, minute] = scheduleTime.split(':');
        const scheduledDateTime = new Date(year, month - 1, day, hour, minute);
        const minScheduleTime = new Date(Date.now() + 60 * 1000);

        return {
            valid: scheduledDateTime > minScheduleTime,
            scheduledDateTime,
            error: scheduledDateTime <= minScheduleTime ? 'Horário deve ser no futuro' : null
        };
    },

    mail(email) {
        if (!email || !email.trim()) {
            return { valid: true, email: '' }; // E-mail opcional
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const cleanEmail = email.trim().toLowerCase();

        return {
            valid: emailRegex.test(cleanEmail),
            email: cleanEmail,
            error: emailRegex.test(cleanEmail) ? null : 'E-mail inválido'
        };
    }
};

// ========================================
// 6. GERENCIAMENTO DE TELEFONES ATUALIZADO
// ========================================
const PhoneUtils = {
    // Verificar se validação brasileira está ativada
    isBrazilianValidationEnabled() {
        const checkbox = document.getElementById('enableBrazilianValidation');
        return checkbox ? checkbox.checked : true; // Default: ativado
    },

    // Formatar número brasileiro
    formatBrazilianPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        let number = cleaned;

        // Se já começar com 55 e tiver mais de 11 dígitos, manter como está
        if (number.startsWith('55') && number.length > 11) {
            number = cleaned; // Já tem 55, manter
        } else {
            // Remover 55 se existir para processar
            if (number.startsWith('55') && number.length > 11) {
                number = number.substring(2);
            }

            // Adicionar 9 se necessário (celular com DDD válido)
            const validDDDs = [
                '11', '12', '13', '14', '15', '16', '17', '18', '19',
                '21', '22', '24', '27', '28', '31', '32', '33', '34',
                '35', '37', '38', '41', '42', '43', '44', '45', '46',
                '47', '48', '49', '51', '53', '54', '55', '61', '62',
                '64', '63', '65', '66', '67', '68', '69', '71', '73',
                '74', '75', '77', '79', '81', '87', '82', '83', '84',
                '85', '88', '86', '89', '91', '93', '94', '92', '97',
                '95', '96', '98', '99'
            ];

            if (number.length === 10 && validDDDs.includes(number.substring(0, 2))) {
                number = number.substring(0, 2) + '9' + number.substring(2);
            }

            // ✅ SEMPRE ADICIONAR 55 NO INÍCIO
            number = '55' + number;
        }

        return number;
    },

    // Formatar número internacional (básico)
    formatInternationalPhone(phone) {
        // Remove todos os caracteres não numéricos exceto +
        let cleaned = phone.replace(/[^\d+]/g, '');

        return cleaned;
    },

    // Função principal de formatação
    formatPhone(phone) {
        if (!phone) return '';

        if (this.isBrazilianValidationEnabled()) {
            return this.formatBrazilianPhone(phone);
        } else {
            return this.formatInternationalPhone(phone);
        }
    },

    // Validação brasileira (código existente)
    isValidBrazilianPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');

        // Remover 55 temporariamente para validação
        let numberToValidate = cleaned;
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            numberToValidate = cleaned.substring(2);
        }

        const validDDDs = [
            '11', '12', '13', '14', '15', '16', '17', '18', '19',
            '21', '22', '24', '27', '28', '31', '32', '33', '34',
            '35', '37', '38', '41', '42', '43', '44', '45', '46',
            '47', '48', '49', '51', '53', '54', '55', '61', '62',
            '64', '63', '65', '66', '67', '68', '69', '71', '73',
            '74', '75', '77', '79', '81', '87', '82', '83', '84',
            '85', '88', '86', '89', '91', '93', '94', '92', '97',
            '95', '96', '98', '99'
        ];

        // Validar tamanho (deve ter 10 ou 11 dígitos SEM o 55)
        if (numberToValidate.length !== 10 && numberToValidate.length !== 11) {
            return { valid: false, error: 'Telefone brasileiro deve ter 10 ou 11 dígitos' };
        }

        // Validar DDD
        const ddd = numberToValidate.substring(0, 2);
        if (!validDDDs.includes(ddd)) {
            return { valid: false, error: 'DDD inválido' };
        }

        // Validar formato de celular
        if (numberToValidate.length === 11 && numberToValidate[2] !== '9') {
            return { valid: false, error: 'Celular deve começar com 9 após o DDD' };
        }

        // Validar formato de fixo
        if (numberToValidate.length === 10 && numberToValidate[2] === '9') {
            return { valid: false, error: 'Telefone fixo não deve começar com 9' };
        }

        // Verificar dígitos repetidos
        const uniqueDigits = new Set(numberToValidate).size;
        if (uniqueDigits <= 2) {
            return { valid: false, error: 'Número inválido (muitos dígitos repetidos)' };
        }

        // ✅ RETORNAR COM 55 + FORMATAÇÃO
        let finalNumber = numberToValidate;

        // Adicionar 9 se necessário
        if (finalNumber.length === 10 && validDDDs.includes(finalNumber.substring(0, 2))) {
            finalNumber = finalNumber.substring(0, 2) + '9' + finalNumber.substring(2);
        }

        // Adicionar 55
        finalNumber = '55' + finalNumber;

        return { valid: true, formatted: finalNumber };
    },

    // Validação internacional (mais flexível)
    isValidInternationalPhone(phone) {
        const cleaned = this.formatInternationalPhone(phone);

        // Verificações básicas para números internacionais

        // Deve ter pelo menos 7 dígitos (números mais curtos são muito raros)
        const numbersOnly = cleaned.replace(/[^\d]/g, '');
        if (numbersOnly.length < 7) {
            return { valid: false, error: 'Número muito curto (mínimo 7 dígitos)' };
        }

        // Máximo 15 dígitos (padrão ITU-T E.164)
        if (numbersOnly.length > 15) {
            return { valid: false, error: 'Número muito longo (máximo 15 dígitos)' };
        }

        // Verificar se não é só dígitos repetidos
        const uniqueDigits = new Set(numbersOnly).size;
        if (uniqueDigits <= 2 && numbersOnly.length > 4) {
            return { valid: false, error: 'Número inválido (muitos dígitos repetidos)' };
        }

        // Verificar padrões obviamente inválidos
        const invalidPatterns = [
            /^0+$/, // Só zeros
            /^1+$/, // Só uns
            /^12345/, // Sequência simples
            /^11111/, // Repetição
            /^00000/, // Zeros
        ];

        for (const pattern of invalidPatterns) {
            if (pattern.test(numbersOnly)) {
                return { valid: false, error: 'Padrão de número inválido' };
            }
        }

        return { valid: true, formatted: cleaned };
    },

    // Função principal de validação
    isValidPhone(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Número não fornecido' };
        }

        if (this.isBrazilianValidationEnabled()) {
            return this.isValidBrazilianPhone(phone);
        } else {
            return this.isValidInternationalPhone(phone);
        }
    },

    // Função para exibir número formatado
    displayFormattedPhone(phone) {
        if (!phone) return '';

        if (this.isBrazilianValidationEnabled()) {
            return this.displayBrazilianFormattedPhone(phone);
        } else {
            return this.displayInternationalFormattedPhone(phone);
        }
    },

    // Exibir número brasileiro formatado
    displayBrazilianFormattedPhone(phone) {
        let cleaned = phone.replace(/\D/g, '');

        // ✅ REMOVER 55 APENAS PARA DISPLAY
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            cleaned = cleaned.substring(2);
        }

        if (cleaned.length === 11) {
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        } else if (cleaned.length === 10) {
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
        }

        return phone;
    },

    // Exibir número internacional formatado
    displayInternationalFormattedPhone(phone) {
        const cleaned = phone.replace(/[^\d+]/g, '');

        return cleaned;
    },

    // Função para obter informações do modo atual
    getValidationMode() {
        return {
            isBrazilian: this.isBrazilianValidationEnabled(),
            modeName: this.isBrazilianValidationEnabled() ? 'Validação Brasileira' : 'Validação Internacional',
            description: this.isBrazilianValidationEnabled()
                ? 'Valida DDD e formato brasileiro (10-11 dígitos)'
                : 'Aceita números internacionais (7-15 dígitos)'
        };
    }
};

// ========================================
// 7. GERENCIAMENTO DE UI
// ========================================
const UI = {
    showLoading(message = 'Carregando...') {
        Notiflix.Loading.hourglass(message);
    },

    hideLoading() {
        Notiflix.Loading.remove();
    },

    showSuccess(message) {
        Notiflix.Notify.success(message);
    },

    showError(message) {
        Notiflix.Notify.failure(message);
    },

    showWarning(message) {
        Notiflix.Notify.warning(message);
    },

    showInfo(message) {
        Notiflix.Notify.info(message);
    },

    confirm(title, message, onConfirm, onCancel = () => { }) {
        Notiflix.Confirm.show(title, message, 'Sim', 'Cancelar', onConfirm, onCancel);
    },

    alternarTema() {
        const html = document.documentElement;
        const temaAtual = html.getAttribute('data-theme');
        const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', novoTema);

        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = novoTema === 'dark' ? 'bi bi-moon-fill me-2' : 'bi bi-sun-fill me-2';
        }
    }
};

// ========================================
// 8. GERENCIAMENTO DE ESTIMATIVAS DE TEMPO
// ========================================

const TimeEstimator = {
    calculate() {
        if (AppState.contacts.length === 0) return 0;

        const minInterval = parseInt(document.getElementById('minInterval')?.value || 0) * 1000;
        const maxInterval = parseInt(document.getElementById('maxInterval')?.value || 0) * 1000;
        const avgInterval = (minInterval + maxInterval) / 2;

        let totalTime = ((AppState.contacts.length - 1) * avgInterval) + (AppState.contacts.length * 2000);

        // ✅ ADICIONAR TEMPO DAS PAUSAS EM LOTES
        if (AppState.batchPauseEnabled && AppState.batchSize) {
            const batchSize = AppState.batchSize;
            const batchPause = AppState.batchPauseDuration * 60 * 1000;
            const totalBatches = Math.ceil(AppState.contacts.length / batchSize);
            const batchPauses = Math.max(0, totalBatches - 1);

            totalTime += batchPauses * batchPause;

            console.log(`⏱️ Estimativa com lotes: ${totalBatches} lotes, ${batchPauses} pausas de ${AppState.batchPauseDuration}min`);
        }

        // ✅ ADICIONAR TEMPO DE ESPERA PELO HORÁRIO COMERCIAL
        if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
            const waitTime = BusinessHoursManager.getTimeUntilBusinessHours();
            totalTime += waitTime;
            console.log(`⏱️ Adicionando espera pelo horário comercial: ${Utils.formatTime(waitTime)}`);
        }

        return totalTime;
    },

    // ✅ CORREÇÃO: Usar TimeEstimator.calculate() em vez de this.calculate()
    update: Utils.throttle(function () {
        const estimateElement = document.getElementById('timeEstimate');
        if (!estimateElement) return;

        if (AppState.sendingInProgress && AppState.startTime) {
            const elapsed = Date.now() - AppState.startTime;
            const progress = (AppState.results.success + AppState.results.error) / AppState.contacts.length;

            if (progress > 0) {
                const totalEstimated = elapsed / progress;
                const remaining = totalEstimated - elapsed;

                estimateElement.innerHTML = `
                    <div class="row text-center">
                        <div class="col-4">
                            <small class="text-muted">Decorrido</small>
                            <div class="fw-bold">${Utils.formatTime(elapsed)}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Restante</small>
                            <div class="fw-bold text-warning">${Utils.formatTime(Math.max(0, remaining))}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Total Est.</small>
                            <div class="fw-bold">${Utils.formatTime(totalEstimated)}</div>
                        </div>
                    </div>
                `;
            }
        } else if (AppState.contacts.length > 0) {
            // ✅ CORREÇÃO: Usar TimeEstimator.calculate() em vez de this.calculate()
            AppState.estimatedTime = TimeEstimator.calculate();

            let extraInfo = '';
            if (AppState.batchPauseEnabled) {
                const batches = Math.ceil(AppState.contacts.length / AppState.batchSize);
                extraInfo = `<small class="text-muted">Com ${batches} lotes e pausas</small>`;
            }

            estimateElement.innerHTML = `
                <div class="text-center">
                    <small class="text-muted">Tempo Estimado</small>
                    <div class="fw-bold text-info">${Utils.formatTime(AppState.estimatedTime)}</div>
                    <small class="text-muted">Para ${AppState.contacts.length} contatos</small>
                    ${extraInfo}
                </div>
            `;
        } else {
            estimateElement.innerHTML = `
                <div class="text-center text-muted">
                    <small>Importe contatos para ver estimativa</small>
                </div>
            `;
        }
    }, 500)
};

// ========================================
// 9. GERENCIAMENTO DE CONTATOS
// ========================================
const ContactManager = {
    processExcelFile(file) {
        UI.showLoading('Processando arquivo Excel...');

        const reader = new FileReader();
        reader.onload = (e) => {
            Utils.safeAsyncCall(async () => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                const processedContacts = this.processContactData(jsonData);
                const { uniqueContacts, duplicates } = this.removeDuplicates(processedContacts);

                const validContacts = uniqueContacts.filter(c => c.isValid);
                const invalidContacts = uniqueContacts.filter(c => !c.isValid);

                AppState.contacts = validContacts;

                UI.hideLoading();
                this.showProcessingSummary(processedContacts.length, validContacts.length, duplicates.length, invalidContacts.length);
                this.updateContactsList();
                TimeEstimator.update();

                document.getElementById('fileInfo').style.display = 'block';
                UI.showSuccess(`${AppState.contacts.length} contatos importados com sucesso!`);
            }, 'Erro ao processar arquivo Excel');
        };

        reader.onerror = () => {
            UI.hideLoading();
            UI.showError('Erro ao ler o arquivo');
        };

        reader.readAsArrayBuffer(file);
    },

    // Substitua a função processContactData no ContactManager
    processContactData(jsonData) {
        return jsonData.map((row, index) => {
            // ✅ CORREÇÃO: Usar toString() com tratamento de encoding
            const name = this.cleanText(row.Nome || row.nome || row.NOME || row.Name || row.name || row.NAME || '');
            const rawPhone = String(row.Telefone || row.telefone || row.TELEFONE || row.Phone || row.phone || row.PHONE || row.Celular || row.celular || row.CELULAR || '');
            const email = this.cleanText(row.Email || row.email || row.EMAIL || row.EMail || row['E-mail'] || row['e-mail'] || row['E-MAIL'] || '');

            // ✅ USAR A NOVA FUNÇÃO DE VALIDAÇÃO
            const phoneValidation = PhoneUtils.isValidPhone(rawPhone);

            return {
                name,
                phone: phoneValidation.valid ? phoneValidation.formatted : PhoneUtils.formatPhone(rawPhone),
                email,
                rawPhone,
                isValid: phoneValidation.valid,
                error: phoneValidation.error || null,
                row: index + 1,
                validationMode: PhoneUtils.getValidationMode().modeName
            };
        }).filter(contact => contact.name && contact.phone && contact.phone.length >= 4);
    },

    // limpar texto com acentos
    cleanText(text) {
        if (!text) return '';

        // Converter para string e remover espaços extras
        let cleanText = String(text).trim();

        // Normalizar caracteres especiais (remove problemas de encoding)
        try {
            cleanText = cleanText.normalize('NFC');
        } catch (error) {
            console.warn('Erro na normalização de texto:', error);
        }

        return cleanText;
    },

    removeDuplicates(contacts) {
        const seenPhones = new Map();
        const uniqueContacts = [];
        const duplicates = [];

        contacts.forEach(contact => {
            if (seenPhones.has(contact.phone)) {
                duplicates.push({
                    duplicate: contact,
                    original: seenPhones.get(contact.phone),
                    phone: contact.phone
                });
            } else {
                seenPhones.set(contact.phone, contact);
                uniqueContacts.push(contact);
            }
        });

        return { uniqueContacts, duplicates };
    },

    showProcessingSummary(total, valid, duplicates, invalid) {
        const validationMode = PhoneUtils.getValidationMode();

        const summaryText = `
        <div style="text-align: left; line-height: 1.6; padding: 0px 20px">
            <strong>🔧 Modo:</strong> ${validationMode.modeName}<br>
            <strong>📋 Descrição:</strong> ${validationMode.description}<br><br>
            • Total processados: <strong>${total}</strong><br>
            • Contatos válidos: <strong style="color: #28a745;">${valid}</strong><br>
            • Duplicados removidos: <strong style="color: #ffc107;">${duplicates}</strong><br>
            • Inválidos ignorados: <strong style="color: #dc3545;">${invalid}</strong>
        </div>
    `;

        Notiflix.Report.success(
            'Resumo do Processamento',
            summaryText,
            'OK',
            {
                width: '550px',
                //svgSize: '60px',
                messageMaxLength: 3000,
                plainText: false, // ✅ IMPORTANTE: Habilita HTML
                titleFontSize: '22px',
                messageFontSize: '14px'
            }
        );
    },

    // ========================================
    // Atualização do Dashboard de Contatos
    // ========================================

    // Substitua a função updateContactsList no ContactManager
    updateContactsList() {
        const contactsList = document.getElementById('contactsList');
        const contactCount = document.getElementById('contactCount');
        const clearContactsBtn = document.getElementById('clearContactsBtn');
        const exportContactsBtn = document.getElementById('exportContactsBtn');
        const contactBadge = document.getElementById('contactCountBadge');

        console.log('🔄 updateContactsList:', AppState.contacts.length, 'contatos');

        if (!contactsList || !contactCount) return;

        contactCount.textContent = `${AppState.contacts.length} contatos`;

        // ✅ ATUALIZAR DASHBOARD DE CONTATOS
        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            totalContactsEl.textContent = AppState.contacts.length;
            console.log(`📊 Dashboard totalContacts = ${AppState.contacts.length}`);
        }

        if (contactBadge) {
            if (AppState.contacts.length > 0) {
                contactBadge.textContent = AppState.contacts.length;
                contactBadge.style.display = 'inline';
            } else {
                contactBadge.textContent = '0';
                contactBadge.style.display = 'none';
            }
        }

        if (AppState.contacts.length === 0) {
            contactsList.innerHTML = '<p class="text-muted text-center mb-0">Importe um arquivo Excel para visualizar os contatos</p>';
            if (clearContactsBtn) clearContactsBtn.style.display = 'none';
            if (exportContactsBtn) exportContactsBtn.style.display = 'none';
            return;
        }

        if (clearContactsBtn) clearContactsBtn.style.display = 'inline-block';
        if (exportContactsBtn) exportContactsBtn.style.display = 'inline-block';

        contactsList.innerHTML = AppState.contacts.map((contact, index) =>
            `<div class="contact-item">
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">#${index + 1}</small>
                <div>
                    <strong>${contact.name}</strong> - ${PhoneUtils.displayFormattedPhone(contact.phone)}
                    ${contact.email ? `<br><small class="text-muted"><i class="bi bi-envelope me-1"></i>${contact.email}</small>` : ''}
                    ${!contact.isValid ? '<span class="badge bg-warning ms-2">Verificar</span>' : ''}
                </div>
            </div>
        </div>`
        ).join('');

        if (typeof AutoSaveManager !== 'undefined' && !AutoSaveManager.isLoading) {
            AutoSaveManager.saveSessionData();
        }
    },

    updateDashboardContactCount() {
        const totalContactsEl = document.getElementById('totalContactsEl');
        if (totalContactsEl && AppState.contacts.length >= 0) {
            totalContactsEl.textContent = AppState.contacts.length;
            totalContactsEl.setAttribute('data-source', 'contacts');
            totalContactsEl.setAttribute('data-updated', Date.now());
            console.log(`✅ Dashboard: ${AppState.contacts.length} contatos (fonte: ContactManager)`);
        }
    },

    updateDashboard() {
        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            totalContactsEl.textContent = AppState.contacts.length;
            console.log(`📊 Dashboard atualizado: ${AppState.contacts.length} contatos`);
        }
    },

    revalidateContacts() {
        UI.showLoading('Revalidando contatos com novo modo...');

        console.log('🔄 Revalidando contatos com modo:', PhoneUtils.getValidationMode().modeName);

        // Revalidar todos os contatos
        const revalidatedContacts = AppState.contacts.map(contact => {
            const phoneValidation = PhoneUtils.isValidPhone(contact.rawPhone || contact.phone);

            return {
                ...contact,
                phone: phoneValidation.valid ? phoneValidation.formatted : PhoneUtils.formatPhone(contact.rawPhone || contact.phone),
                isValid: phoneValidation.valid,
                error: phoneValidation.error || null,
                validationMode: PhoneUtils.getValidationMode().modeName
            };
        });

        // Separar válidos e inválidos
        const validContacts = revalidatedContacts.filter(c => c.isValid);
        const invalidContacts = revalidatedContacts.filter(c => !c.isValid);

        // Atualizar estado
        AppState.contacts = validContacts;

        UI.hideLoading();

        // Mostrar resultado
        this.showRevalidationSummary(revalidatedContacts.length, validContacts.length, invalidContacts.length);

        // Atualizar interface
        this.updateContactsList();
        TimeEstimator.update();
    },

    showRevalidationSummary(total, valid, invalid) {
        const validationMode = PhoneUtils.getValidationMode();

        const summaryText = `
        🔄 <strong>Revalidação Concluída:</strong><br>
        🔧 <strong>Novo Modo:</strong> ${validationMode.modeName}<br><br>
        • Total revalidados: ${total}<br>
        • Válidos no novo modo: ${valid}<br>
        • Inválidos removidos: ${invalid}
    `;

        Notiflix.Notify.success(summaryText, {
            timeout: 6000,
            width: '400px'
        });
    },

    clear() {
        UI.confirm(
            'Limpar Lista',
            'Tem certeza que deseja remover todos os contatos da lista?',
            () => {
                AppState.contacts = [];
                this.updateContactsList(); // ✅ Isso vai atualizar o badge automaticamente
                document.getElementById('fileInfo').style.display = 'none';
                TimeEstimator.update();

                // ✅ CORREÇÃO ADICIONAL: Garantir que o badge seja limpo
                const contactBadge = document.getElementById('contactCountBadge');
                if (contactBadge) {
                    contactBadge.textContent = '0';
                    contactBadge.style.display = 'none';
                }

                UI.showSuccess('Lista de contatos limpa');
            }
        );
    },
};

// ========================================
// 11. GERENCIAMENTO DE PREVIEW
// ========================================
const PreviewManager = {
    update() {
        const message = document.getElementById('message')?.value || '';
        const mediaFile = document.getElementById('mediaFile')?.files[0];
        const previewContent = document.getElementById('previewContent');

        if (!previewContent) return;

        const hasValidFile = mediaFile &&
            mediaFile.size > 0 &&
            mediaFile.name &&
            mediaFile.type;

        if (!message.trim() && !hasValidFile) {
            previewContent.innerHTML = `
            <div class="preview-placeholder">
                <i class="bi bi-chat-text fs-3 mb-2 d-block"></i>
                Digite uma mensagem para visualizar o preview
            </div>
        `;
            return;
        }

        let exampleName = 'João Silva';
        if (AppState.contacts.length > 0) {
            exampleName = AppState.contacts[0].name;
            this.updateContact(exampleName);
        }

        // ✅ APENAS personalizar (SEM converter para HTML ainda)
        let personalizedMessage = message
            .replace(/{nome}/g, exampleName)
            .replace(/{saudacao}/g, Utils.getSaudacao());

        // ✅ CONVERTER PARA HTML APENAS PARA O PREVIEW
        let previewHTML = '<div class="whatsapp-message text-white">';

        // Processar mídia
        if (hasValidFile) {
            console.log('📎 Adicionando mídia ao preview:', mediaFile.name, mediaFile.type);

            if (mediaFile.type.startsWith('image/')) {
                // ✅ VERIFICAR PROTOCOLO E SUPORTE
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview da imagem');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const imgElement = previewContent.querySelector('.temp-image-placeholder');
                        if (imgElement) {
                            imgElement.outerHTML = `<img src="${e.target.result}" class="whatsapp-media" alt="Preview da imagem">`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    // Placeholder temporário
                    previewHTML += `<div class="temp-image-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <i class="bi bi-image fs-1 text-primary"></i>
                </div>`;
                } else {
                    try {
                        let imageUrl = window.currentMediaURL;
                        if (!imageUrl) {
                            imageUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = imageUrl;
                        }
                        previewHTML += `<img src="${imageUrl}" class="whatsapp-media" alt="Preview da imagem">`;
                    } catch (error) {
                        console.error('❌ Erro ao processar imagem:', error);
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                        <i class="bi bi-image fs-1 text-primary"></i>
                    </div>`;
                    }
                }
            } else if (mediaFile.type.startsWith('video/')) {
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview do vídeo');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const videoElement = previewContent.querySelector('.temp-video-placeholder');
                        if (videoElement) {
                            videoElement.outerHTML = `<video controls class="whatsapp-media" style="max-width: 100%; width: 100%; height: auto; border-radius: 10px;"><source src="${e.target.result}" type="${mediaFile.type}"></video>`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    // Placeholder temporário
                    previewHTML += `<div class="temp-video-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <i class="bi bi-play-circle fs-1 text-primary"></i>
                    </div>`;
                } else {
                    try {
                        let videoUrl = window.currentMediaURL;
                        if (!videoUrl) {
                            videoUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = videoUrl;
                        }
                        previewHTML += `<video controls class="whatsapp-media" style="max-width: 100%; width: 100%; height: auto; border-radius: 10px;"><source src="${videoUrl}" type="${mediaFile.type}"></video>`;
                    } catch (error) {
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                        <i class="bi bi-play-circle fs-1 text-primary"></i>
                        </div>`;
                    }
                }
            } else if (mediaFile.type === 'application/pdf') {
                previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                <div class="text-center">
                    <i class="bi bi-file-pdf fs-1 text-danger"></i>
                    <div class="mt-2 small text-muted">${mediaFile.name}</div>
                </div>
            </div>`;
            } else if (mediaFile.type.startsWith('audio/')) {
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview do áudio');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const audioElement = previewContent.querySelector('.temp-audio-placeholder');
                        if (audioElement) {
                            audioElement.outerHTML = `<audio controls class="whatsapp-media" style="width: 100%; border-radius: 10px;"><source src="${e.target.result}" type="${mediaFile.type}"></audio>`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    // Placeholder temporário
                    previewHTML += `<div class="temp-audio-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 60px;">
            <i class="bi bi-music-note fs-1 text-success"></i>
        </div>`;
                } else {
                    try {
                        let audioUrl = window.currentMediaURL;
                        if (!audioUrl) {
                            audioUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = audioUrl;
                        }
                        previewHTML += `<audio controls class="whatsapp-media" style="width: 100%; border-radius: 10px;"><source src="${audioUrl}" type="${mediaFile.type}"></audio>`;
                    } catch (error) {
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 60px;">
                <i class="bi bi-music-note fs-1 text-success"></i>
            </div>`;
                    }
                }
            } else {
                previewHTML += `<div class="d-flex align-items-center mb-2">
                <i class="bi bi-file-earmark me-2"></i>
                <span>${mediaFile.name}</span>
            </div>`;
            }
        }

        // ✅ CONVERTER PARA HTML SÓ AQUI (apenas para exibição)
        if (message.trim()) {
            const htmlForPreview = personalizedMessage
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // Para preview
                .replace(/_([^_]+)_/g, '<em>$1</em>')           // Para preview
                .replace(/\n/g, '<br>');                        // Para preview

            previewHTML += `<div>${htmlForPreview}</div>`;
        }

        previewHTML += `
        <div class="whatsapp-time text-white">
            ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <i class="bi bi-check2-all"></i>
        </div>
    </div>`;

        previewContent.innerHTML = previewHTML;
    },

    loadImageWithFileReader(file, tempId) {
        const tempElement = document.getElementById(tempId);
        if (!tempElement) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'whatsapp-media';
            img.alt = 'Preview da imagem';
            img.style.cssText = 'max-width: 100%; height: auto; border-radius: 10px;';
            tempElement.parentNode.replaceChild(img, tempElement);
        };
        reader.readAsDataURL(file);
    },

    updateContact(name) {
        const previewAvatar = document.getElementById('previewAvatar');
        const previewContactName = document.getElementById('previewContactName');

        if (previewAvatar) previewAvatar.textContent = name.charAt(0).toUpperCase();
        if (previewContactName) previewContactName.textContent = name;
    }
};

function showMediaPreview(file) {
    const preview = document.getElementById('mediaPreview');
    const content = document.getElementById('mediaPreviewContent');
    const fileName = document.getElementById('mediaFileName');
    const fileSize = document.getElementById('mediaFileSize');

    if (!preview || !content || !fileName || !fileSize) {
        console.warn('⚠️ Elementos de preview não encontrados');
        return;
    }

    // ✅ VALIDAÇÃO DE TAMANHO ANTES DE MOSTRAR PREVIEW
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
        UI.showError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: 16MB`);

        // Limpar o input de arquivo
        const mediaInput = document.getElementById('mediaFile');
        if (mediaInput) {
            mediaInput.value = '';
        }

        // Esconder preview
        preview.style.display = 'none';
        return;
    }

    console.log('📎 Criando preview para:', file.name, file.type, file.size);

    // ✅ LIMPAR CONTEÚDO ANTERIOR
    content.innerHTML = '';

    // ✅ REVOGAR URL ANTERIOR APENAS SE EXISTIR
    if (window.currentMediaURL) {
        URL.revokeObjectURL(window.currentMediaURL);
        window.currentMediaURL = null;
        console.log('🗑️ URL anterior revogada');
    }

    // Mostrar informações do arquivo
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    // ✅ VERIFICAR SE SUPORTA BLOB URLS
    if (!window.supportsBlob && window.location.protocol === 'file:') {
        console.log('⚠️ Blob URLs não suportadas em file://, usando FileReader');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
                img.alt = 'Preview';
                content.appendChild(img);
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
                video.controls = false;
                video.muted = true;
                content.appendChild(video);
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('audio/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const audio = document.createElement('audio');
                audio.src = e.target.result;
                audio.style.cssText = 'width: 50px; height: 30px;';
                audio.controls = true;
                audio.volume = 0.3;
                content.appendChild(audio);
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
            content.innerHTML = '<i class="bi bi-file-pdf fs-2 text-danger"></i>';
        } else {
            content.innerHTML = '<i class="bi bi-file-earmark fs-2 text-secondary"></i>';
        }
    } else {
        // ✅ CRIAR UMA ÚNICA URL E REUTILIZAR
        const fileURL = URL.createObjectURL(file);
        window.currentMediaURL = fileURL;

        console.log('🔗 Nova URL criada:', fileURL);

        // ✅ PREVIEW BASEADO NO TIPO (SEM TIMESTAMP)
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileURL;
            img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
            img.alt = 'Preview';

            img.onload = () => {
                console.log('✅ Imagem carregada no preview lateral:', file.name);
            };

            img.onerror = (error) => {
                console.error('❌ Erro ao carregar imagem no preview lateral:', error);
                content.innerHTML = '<i class="bi bi-image fs-2 text-danger"></i>';
            };

            content.appendChild(img);

        } else if (file.type.startsWith('video/')) {
            content.innerHTML = '<i class="bi bi-play-circle fs-2 text-primary"></i>';

        } else if (file.type.startsWith('audio/')) {
            content.innerHTML = '<i class="bi bi-music-note fs-2 text-success"></i>';

        } else if (file.type === 'application/pdf') {
            content.innerHTML = '<i class="bi bi-file-pdf fs-2 text-danger"></i>';

        } else {
            content.innerHTML = '<i class="bi bi-file-earmark fs-2 text-secondary"></i>';
        }
    }

    preview.style.display = 'block';
    console.log('✅ Preview lateral exibido para:', file.name, file.type);
}

// FUNÇÃO PARA LIMPAR MÍDIA
function clearMedia() {
    console.log('🗑️ Removendo mídia (preservando texto)...');

    // ✅ USAR FUNÇÃO DE LIMPEZA FORÇADA
    forceCleanAllMedia();

    // ✅ ATUALIZAR PREVIEW MANTENDO O TEXTO
    setTimeout(() => {
        const message = document.getElementById('message')?.value || '';

        // ✅ SEMPRE ATUALIZAR COM PreviewManager para manter o texto
        PreviewManager.update();

        console.log('✅ Preview atualizado - texto preservado, mídia removida');

        // ✅ LOG PARA VERIFICAR ESTADO
        const mediaFile = document.getElementById('mediaFile')?.files[0];
        console.log('📊 Estado após limpeza:', {
            temTexto: !!message.trim(),
            temArquivo: !!mediaFile,
            nomeArquivo: mediaFile?.name || 'nenhum'
        });

    }, 200);

    UI.showInfo('Mídia removida - texto preservado');
}

// ========================================
// FUNÇÃO DE LIMPEZA FORÇADA DE MÍDIA (MANTENDO TEXTO)
// ========================================
function forceCleanAllMedia() {
    console.log('🧹 LIMPEZA FORÇADA DE MÍDIA (mantendo texto)');

    // ✅ 1. REVOGAR TODAS AS URLs DE BLOB ATIVAS
    if (window.currentMediaURL) {
        URL.revokeObjectURL(window.currentMediaURL);
        window.currentMediaURL = null;
        console.log('🗑️ URL principal revogada');
    }

    // ✅ 2. LIMPAR PREVIEW LATERAL COMPLETAMENTE
    const mediaPreview = document.getElementById('mediaPreview');
    const mediaContent = document.getElementById('mediaPreviewContent');
    const mediaFileName = document.getElementById('mediaFileName');
    const mediaFileSize = document.getElementById('mediaFileSize');

    if (mediaPreview) {
        mediaPreview.style.display = 'none';
        console.log('✅ Preview lateral escondido');
    }

    if (mediaContent) {
        // Revogar URLs de imagens no preview lateral
        const images = mediaContent.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
            URL.revokeObjectURL(img.src);
            console.log('🗑️ URL de imagem lateral revogada:', img.src);
        });
        mediaContent.innerHTML = '';
        console.log('✅ Conteúdo do preview lateral limpo');
    }

    if (mediaFileName) mediaFileName.textContent = '';
    if (mediaFileSize) mediaFileSize.textContent = '';

    // ✅ 3. LIMPAR APENAS MÍDIA DO PREVIEW PRINCIPAL (MANTER TEXTO)
    const previewContent = document.getElementById('previewContent');
    if (previewContent) {
        // Revogar URLs de mídia no preview principal
        const allMedia = previewContent.querySelectorAll('img[src^="blob:"], video[src^="blob:"], source[src^="blob:"]');
        allMedia.forEach(element => {
            const src = element.src || element.getAttribute('src');
            if (src && src.startsWith('blob:')) {
                URL.revokeObjectURL(src);
                console.log('🗑️ URL do preview principal revogada:', src);
            }
        });

        // ✅ NÃO RESETAR O HTML - deixar o PreviewManager.update() cuidar disso
        console.log('✅ URLs de mídia do preview principal limpas');
    }

    // ✅ 4. RESETAR APENAS CAMPO DE ARQUIVO (NÃO O FORM TODO)
    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) {
        // ✅ NÃO RESETAR O FORM INTEIRO - apenas o campo de arquivo
        mediaFile.value = '';

        // Forçar recriação apenas do input de arquivo
        const parent = mediaFile.parentNode;
        const newInput = mediaFile.cloneNode(true);
        newInput.value = '';
        parent.replaceChild(newInput, mediaFile);

        console.log('✅ Apenas campo de arquivo resetado');

        // ✅ RECRIAR EVENT LISTENER
        setTimeout(() => {
            const resetInput = document.getElementById('mediaFile');
            if (resetInput) {
                resetInput.addEventListener('change', (e) => {
                    console.log('📎 Novo evento change após reset');
                    const file = e.target.files[0];

                    if (file && file.size > 0) {
                        // Limpar qualquer mídia anterior primeiro
                        if (window.currentMediaURL) {
                            URL.revokeObjectURL(window.currentMediaURL);
                            window.currentMediaURL = null;
                        }

                        console.log('📎 Processando novo arquivo:', file.name, file.type);
                        showMediaPreview(file);

                        setTimeout(() => {
                            PreviewManager.update();
                        }, 300);
                    } else {
                        forceCleanAllMedia();
                    }
                });
            }
        }, 100);
    }

    // ✅ 5. LIMPAR VARIÁVEIS GLOBAIS DE MÍDIA
    window.lastProcessedFile = null;
    window.currentMediaURL = null;

    console.log('🧹 LIMPEZA DE MÍDIA CONCLUÍDA (texto preservado)');
}

// ========================================
// 12. GERENCIAMENTO DE CHARTS
// ========================================
const ChartManager = {
    isInitialized: false,

    initialize() {
        // ✅ PREVENIR INICIALIZAÇÃO MÚLTIPLA
        if (this.isInitialized) {
            console.log('⚠️ ChartManager já inicializado, pulando...');
            return;
        }

        const ctx = document.getElementById('resultsChart')?.getContext('2d');
        if (!ctx) {
            console.warn('⚠️ Canvas resultsChart não encontrado');
            return;
        }

        // ✅ DESTRUIR GRÁFICO EXISTENTE SE HOUVER
        if (AppState.chart) {
            try {
                AppState.chart.destroy();
                console.log('🗑️ Gráfico anterior destruído');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico anterior:', error);
            }
            AppState.chart = null;
        }

        try {
            AppState.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Sucesso', 'Erro'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#28a745', '#dc3545'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'white'
                            }
                        }
                    }
                }
            });

            this.isInitialized = true;
            console.log('✅ ChartManager inicializado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao inicializar ChartManager:', error);
            this.isInitialized = false;
        }
    },

    // ✅ FUNÇÃO ORIGINAL update
    update() {
        // Atualizar gráfico principal
        if (AppState.chart && this.isInitialized) {
            try {
                AppState.chart.data.datasets[0].data = [AppState.results.success, AppState.results.error];
                AppState.chart.update('none');
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar gráfico principal:', error);
                this.isInitialized = false;
                this.initialize();
            }
        }

        // ✅ CHAMAR FUNÇÃO DE ATUALIZAÇÃO DOS RESULTADOS
        this.updateResultsChart();
    },

    // ✅ NOVA FUNÇÃO updateResultsChart
    updateResultsChart() {
        const resultsCtx = document.getElementById('resultsChartResults')?.getContext('2d');
        if (!resultsCtx) {
            console.log('⚠️ Canvas resultsChartResults não encontrado');
            return;
        }

        // Destruir gráfico existente se houver
        if (window.resultsChart) {
            try {
                window.resultsChart.destroy();
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico de resultados:', error);
            }
        }

        // Só criar gráfico se houver dados
        const totalData = AppState.results.success + AppState.results.error;
        if (totalData === 0) {
            console.log('📊 Sem dados para gráfico de resultados');
            return;
        }

        try {
            window.resultsChart = new Chart(resultsCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Sucessos', 'Erros'],
                    datasets: [{
                        data: [AppState.results.success, AppState.results.error],
                        backgroundColor: ['#28a745', '#dc3545'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const total = AppState.results.success + AppState.results.error;
                                    const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                    return `${context.label}: ${context.parsed} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });

            console.log('📊 Gráfico de resultados atualizado');
        } catch (error) {
            console.error('❌ Erro ao criar gráfico de resultados:', error);
        }
    },

    // ✅ NOVA FUNÇÃO initializeResultsSection
    initializeResultsSection() {
        console.log('📊 Inicializando seção de resultados...');

        // Verificar se os elementos existem
        const resultsCanvas = document.getElementById('resultsChartResults');
        if (!resultsCanvas) {
            console.warn('⚠️ Canvas resultsChartResults não encontrado');
            return;
        }

        // Inicializar dados se não existirem
        if (!AppState.results.success && !AppState.results.error) {
            AppState.results = { success: 0, error: 0 };
        }

        // Atualizar estatísticas iniciais
        if (typeof SendingManager !== 'undefined' && SendingManager.updateStats) {
            SendingManager.updateStats();
        }

        this.updateResultsChart();

        console.log('✅ Seção de resultados inicializada');
    },

    // ✅ FUNÇÃO destroy
    destroy() {
        if (AppState.chart) {
            try {
                AppState.chart.destroy();
                console.log('🗑️ Gráfico principal destruído no cleanup');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico principal:', error);
            }
            AppState.chart = null;
        }

        if (window.resultsChart) {
            try {
                window.resultsChart.destroy();
                console.log('🗑️ Gráfico de resultados destruído no cleanup');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico de resultados:', error);
            }
            window.resultsChart = null;
        }

        this.isInitialized = false;
    }
};

// ========================================
// 13. GERENCIAMENTO DE ENVIO
// ========================================
const SendingManager = {
    async start() {

        // ✅ Limpar cache de validação
        if (Validators._lastValidation) {
            delete Validators._lastValidation;
        }

        // ✅ Resetar flags de controle
        MultipleMessagesManager._isUpdatingCount = false;
        this._isValidating = false;

        // ✅ ADICIONAR ESTA LINHA NO INÍCIO DO MÉTODO
        if (typeof MultipleMessagesManager !== 'undefined' && MultipleMessagesManager.resetMessageRotation) {
            MultipleMessagesManager.resetMessageRotation();
        }

        // Verificar se estamos na tela de login
        const loginScreen = document.getElementById('loginScreen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (isLoginVisible) {
            console.log('🔐 Tentativa de envio na tela de login ignorada');
            return;
        }

        // Verificar autenticação antes de iniciar
        if (!AuthManager.requireAuth()) {
            return;
        }

        const validation = this.validateBeforeSending();
        if (!validation.valid) {
            UI.showError(validation.error);
            return;
        }

        this.initializeSending();

        // ✅ VERIFICAR HORÁRIO COMERCIAL ANTES DE INICIAR
        if (AppState.businessHoursEnabled) {
            const validation = BusinessHoursManager.validateSettings();
            if (!validation.valid) {
                UI.showError(validation.error);
                return;
            }

            if (!BusinessHoursManager.isWithinBusinessHours()) {
                UI.showInfo('Fora do horário comercial. Aguardando...');
                await BusinessHoursManager.waitForBusinessHours();

                if (AppState.stopSending) return;
            }
        }

        // ✅ NOVA FUNCIONALIDADE: Redirecionar para seção de progresso
        this.switchToProgressSection();

        // Verificar e informar qual modo está sendo usado
        if (AppState.activeInstances.length > 0) {
            UI.showInfo(`Iniciando disparo com ${AppState.activeInstances.length} instância(s) conectada(s)...`);
        } else {
            const instanceName = document.getElementById('instanceName')?.value || 'Manual';
            UI.showInfo(`Iniciando disparo no modo manual com instância: ${instanceName}...`);
        }

        const { instanceName, instanceAPIKEY } = Validators.instanceData();
        const ia = document.getElementById('ia')?.value || '';
        const { min: minInterval, max: maxInterval } = Validators.intervals();

        UI.showInfo('Iniciando disparo em massa...');

        for (let i = 0; i < AppState.contacts.length; i++) {
            if (AppState.stopSending) break;

            const contact = AppState.contacts[i];
            TimerManager.showSending(contact.name, i, AppState.contacts.length);
            //const messageData = await this.prepareMessageData(contact);
            const messageData = await this.prepareMessageData(contact);
            console.log(`🎯 Mensagem preparada para ${contact.name}: "${messageData.messageId}"`);

            await this.waitWhilePaused();
            if (AppState.stopSending) break;

            await this.sendMessage(instanceName, instanceAPIKEY, ia, contact, messageData);
            this.updateProgress(i);

            ActiveDispatchManager.saveDispatchState(i + 1, contact);

            // ✅ VERIFICAR HORÁRIO COMERCIAL A CADA ENVIO
            if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
                UI.showWarning('Horário comercial encerrado. Pausando até próximo período.');
                await BusinessHoursManager.waitForBusinessHours();

                if (AppState.stopSending) break;
            }

            // ✅ VERIFICAR SE DEVE PAUSAR POR LOTE
            if (BatchManager.shouldPauseBatch(i)) {
                console.log(`📦 Fim do lote - pausando...`);
                await BatchManager.startBatchPause();

                // Verificar se foi cancelado durante a pausa
                if (AppState.stopSending) break;
            }

            // ✅ TEMPORIZADOR PARA PRÓXIMO ENVIO (se não for último e não for pausa de lote)
            const isLastMessage = i >= AppState.contacts.length - 1;
            const willPauseBatch = BatchManager.shouldPauseBatch(i);

            if (!isLastMessage && !willPauseBatch && !AppState.stopSending) {
                const delay = Math.random() * (maxInterval * 1000 - minInterval * 1000) + minInterval * 1000;

                console.log(`⏱️ Iniciando temporizador para próximo envio: ${delay}ms`);

                // Mostrar temporizador
                TimerManager.startCountdown(delay, i + 1, AppState.contacts.length);

                // Aguardar o delay
                await Utils.sleep(delay);

                // Esconder temporizador
                TimerManager.hide();
            }

        }

        this.finishSending();

        // Limpar estado do disparo ativo
        ActiveDispatchManager.clearDispatchState();

        BatchManager.reset();
        if (AppState.batchPauseEnabled) {
            BatchManager.updateBatchInfo();
        }
    },

    // ✅ NOVA FUNÇÃO: Alternar para seção de progresso
    switchToProgressSection() {
        console.log('📊 Redirecionando para seção de progresso...');

        // Remover classe active de todos os links da sidebar
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(nav => nav.classList.remove('active'));

        // Esconder todas as seções
        const contentSections = document.querySelectorAll('.content-section');
        contentSections.forEach(section => section.classList.remove('active'));

        // Ativar link do progresso
        const progressNavLink = document.querySelector('.nav-link[data-section="progresso"]');
        if (progressNavLink) {
            progressNavLink.classList.add('active');
        }

        // Mostrar seção de progresso
        const progressSection = document.getElementById('progresso-section');
        if (progressSection) {
            progressSection.classList.add('active');
        }

        // Atualizar título da página
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = 'Progresso';
        }

        // Garantir que os elementos de progresso estejam visíveis
        setTimeout(() => {
            const nextSendTimer = document.getElementById('nextSendTimer');
            if (nextSendTimer) {
                nextSendTimer.style.display = 'block';
            }
        }, 100);

        console.log('✅ Redirecionamento para progresso concluído');
    },

    validateBeforeSending() {
        // ✅ Evitar validação múltipla
        if (this._isValidating) {
            console.log('⚠️ Validação já em andamento...');
            return { valid: false, error: 'Validação em andamento' };
        }

        this._isValidating = true;

        console.log('🔍 Iniciando validação única...');

        try {
            if (AppState.sendingInProgress) {
                return { valid: false, error: 'Envio já está em andamento' };
            }

            const contactsValidation = Validators.contacts();
            if (!contactsValidation.valid) {
                const validationMode = PhoneUtils.getValidationMode();
                return {
                    valid: false,
                    error: `Importe uma lista de contatos primeiro. Modo atual: ${validationMode.modeName}`
                };
            }

            // Verificar instâncias
            const hasActiveInstances = AppState.activeInstances.length > 0;
            const hasLegacyConfig = document.getElementById('instanceName')?.value?.trim() &&
                document.getElementById('instanceAPIKEY')?.value?.trim();

            if (!hasActiveInstances && !hasLegacyConfig) {
                return {
                    valid: false,
                    error: 'Configure pelo menos uma instância WhatsApp conectada ou preencha os campos de instância manual.'
                };
            }

            const intervalsValidation = Validators.intervals();
            if (!intervalsValidation.valid) {
                return { valid: false, error: 'Intervalo mínimo deve ser menor que o máximo' };
            }

            // Validação de mídia...
            const mediaFile = document.getElementById('mediaFile')?.files[0];
            if (mediaFile) {
                const maxSize = 16 * 1024 * 1024;
                if (mediaFile.size > maxSize) {
                    return {
                        valid: false,
                        error: `Arquivo muito grande: ${(mediaFile.size / 1024 / 1024).toFixed(1)}MB. Máximo: 16MB`
                    };
                }
            }

            // ✅ VALIDAÇÃO ÚNICA DE MENSAGENS
            console.log('📝 Validando mensagens (única chamada)...');
            const messagesValidation = Validators.messages();
            if (!messagesValidation.valid) {
                return {
                    valid: false,
                    error: messagesValidation.type === 'multiple'
                        ? 'Configure pelo menos uma mensagem ativa no modo múltiplas mensagens'
                        : 'Digite uma mensagem para enviar'
                };
            }

            // Verificar e-mail se habilitado
            const emailEnabled = document.getElementById('enableEmailSending')?.checked;
            if (emailEnabled) {
                const contactsWithEmail = AppState.contacts.filter(contact => contact.email && contact.email.trim());
                if (contactsWithEmail.length === 0) {
                    return {
                        valid: false,
                        error: 'Envio por e-mail ativado, mas nenhum contato possui e-mail válido.'
                    };
                }

                // ✅ NOVA VALIDAÇÃO: Verificar se assunto está preenchido
                const emailSubject = EmailSubjectManager.getEmailSubject();
                if (!emailSubject) {
                    return {
                        valid: false,
                        error: 'Digite um assunto para o e-mail.'
                    };
                }

                console.log('📧 E-mail habilitado:', {
                    contactsWithEmail: contactsWithEmail.length,
                    subject: emailSubject
                });
            }

            console.log('✅ Validação concluída com sucesso');
            return { valid: true };

        } finally {
            // ✅ Sempre liberar flag
            setTimeout(() => {
                this._isValidating = false;
            }, 100);
        }
    },


    initializeSending() {
        AppState.sendingInProgress = true;
        AppState.startTime = Date.now();
        AppState.stopSending = false;
        AppState.results = { success: 0, error: 0 };
        AppState.sendingDetails = [];
        AppState.isPaused = false;

        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('reportButton').style.display = 'none';
        this.updateStats();
        ChartManager.update();
        this.updatePauseButton();
        document.getElementById('pauseButton').style.display = 'block';
        TimeEstimator.update();

        this.updateStats();
        ChartManager.update();
        this.updatePauseButton();

        BatchManager.reset();
        if (AppState.batchPauseEnabled) {
            BatchManager.updateBatchInfo();
        }

        this.showCurrentSettings();
        TimeEstimator.update();

        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
        }, 300);
    },

    // ✅ NOVA FUNÇÃO PARA APLICAR CONFIGURAÇÕES DURANTE PAUSA
    applyNewSettings() {
        if (!AppState.sendingInProgress || !AppState.isPaused) {
            UI.showWarning('Esta função só funciona durante uma pausa no envio');
            return;
        }

        // Validar novas configurações
        const intervalsValidation = Validators.intervals();
        if (!intervalsValidation.valid) {
            UI.showError('Configure intervalos válidos primeiro');
            return;
        }

        console.log('🔄 Aplicando novas configurações:', {
            oldMin: AppState.minInterval,
            oldMax: AppState.maxInterval,
            newMin: intervalsValidation.min,
            newMax: intervalsValidation.max
        });

        // Aplicar configurações de intervalo
        AppState.minInterval = intervalsValidation.min;
        AppState.maxInterval = intervalsValidation.max;

        // Aplicar configurações de lote se alteradas
        const batchEnabled = document.getElementById('enableBatchPause')?.checked;
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);

        AppState.batchPauseEnabled = batchEnabled;
        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        // ✅ FORÇAR ATUALIZAÇÃO DO DISPLAY
        setTimeout(() => {
            this.showCurrentSettings();
            this.updateActiveConfigDisplay(intervalsValidation);
            TimeEstimator.update();
        }, 100);

        UI.showSuccess('✅ Novas configurações aplicadas! Retome o envio para usar.');

        console.log('✅ Configurações aplicadas com sucesso:', {
            intervals: `${intervalsValidation.min}s - ${intervalsValidation.max}s`,
            batch: batchEnabled ? `${batchSize} msgs, ${batchPause}min` : 'Desabilitado'
        });
    },

    async prepareMessageData(contact) {
        let messageData = '';
        let mediaData = null;
        let mediaInfo = null;
        let selectedMessageId = null;

        const randomMessage = MultipleMessagesManager.getRandomActiveMessage();
        selectedMessageId = randomMessage.id;
        messageData = randomMessage.text;

        if (randomMessage.media) {
            if (randomMessage.media.type === 'url') {
                // ✅ NOVA ABORDAGEM: Enviar URL diretamente para o backend
                console.log('📎 Processando mídia via URL (enviando diretamente):', randomMessage.media.url);

                mediaInfo = {
                    filename: randomMessage.media.filename,
                    mimetype: randomMessage.media.mimetype,
                    url: randomMessage.media.url, // ✅ NOVA propriedade
                    type: 'url' // ✅ Indicar que é URL
                };

                // ✅ NÃO tentar baixar a URL no frontend
                mediaData = null; // O backend irá processar a URL

                console.log('✅ Mídia via URL preparada para envio:', {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    type: mediaInfo.mimetype
                });

            } else {
                // ✅ MÍDIA VIA ARQUIVO (código existente mantido)
                mediaInfo = {
                    filename: randomMessage.media.filename,
                    mimetype: randomMessage.media.mimetype,
                    size: randomMessage.media.size,
                    type: 'file' // ✅ Indicar que é arquivo
                };
                mediaData = randomMessage.media.data;
            }
        }

        if (!messageData.trim() && !mediaData && !mediaInfo?.url) {
            throw new Error('Configure pelo menos uma mensagem com texto ou mídia');
        }

        // ✅ PROCESSAR TAGS BÁSICAS PRIMEIRO
        if (messageData.trim()) {
            messageData = messageData
                .replace(/{nome}/g, contact.name)
                .replace(/{saudacao}/g, Utils.getSaudacao());

            // ✅ PROCESSAR TAGS COM VARIAÇÕES ALEATÓRIAS
            messageData = RandomTagsSystem.processAllTags(messageData);
        }

        return {
            messageData,
            mediaData,
            mediaInfo,
            messageId: selectedMessageId
        };
    },

    async sendMessage(instanceName, instanceAPIKEY, ia, contact, messageDataObj) {
        const { messageData, mediaData, mediaInfo, messageId } = messageDataObj;
        let selectedInstance;
        let currentMedia = null;

        // Selecionar instância
        if (AppState.activeInstances.length > 0) {
            selectedInstance = InstanceManager.getRandomActiveInstance();
            if (!selectedInstance) {
                throw new Error('Nenhuma instância conectada disponível');
            }
            instanceName = selectedInstance.name;
            instanceAPIKEY = selectedInstance.apikey;
        } else {
            selectedInstance = {
                id: 'legacy',
                name: instanceName || 'Instância Manual',
                apikey: instanceAPIKEY || ''
            };
        }

        const currentMessageId = messageId || 'msg1';
        console.log(`📤 Enviando mensagem "${currentMessageId}" para ${contact.name}`);

        const currentMessage = messageData || '';

        if (!currentMessage.trim() && !mediaData && !mediaInfo?.url) {
            throw new Error('Nenhuma mensagem ou mídia para enviar');
        }

        // Preparar mídia
        if (mediaInfo) {
            if (mediaInfo.type === 'url') {
                console.log(`📎 Preparando mídia via URL (${currentMessageId}):`, {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    mimetype: mediaInfo.mimetype
                });

                currentMedia = {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    mimetype: mediaInfo.mimetype,
                    type: 'url',
                    size: null
                };

            } else if (mediaInfo.type === 'file' && mediaData) {
                console.log(`📎 Preparando mídia via arquivo (${currentMessageId}):`, {
                    filename: mediaInfo.filename,
                    mimetype: mediaInfo.mimetype,
                    size: mediaInfo.size,
                    dataLength: mediaData.length
                });

                currentMedia = {
                    filename: mediaInfo.filename,
                    data: mediaData,
                    mimetype: mediaInfo.mimetype,
                    type: 'file',
                    size: mediaInfo.size
                };
            }
        }

        // Preparar mensagem
        let personalizedMessage = currentMessage.trim() ?
            currentMessage
                .replace(/{nome}/g, contact.name)
                .replace(/{saudacao}/g, Utils.getSaudacao())
            : '';

        personalizedMessage = cleanMessageForWhatsApp(personalizedMessage);

        console.log(`📤 Enviando "${currentMessageId}" para ${contact.name}:`, {
            temTexto: !!personalizedMessage,
            temMidia: !!currentMedia,
            tipoMidia: currentMedia?.type || 'nenhuma',
            urlMidia: currentMedia?.url || 'N/A'
        });

        const payload = {
            action: 'enviar_mensagem',
            instanceName,
            instanceAPIKEY,
            ia,
            contact: {
                name: contact.name,
                phone: contact.phone,
                email: contact.email || null
            },
            message: personalizedMessage,
            media: currentMedia,
            sendEmail: !!contact.email && document.getElementById('enableEmailSending')?.checked,
            emailSubject: EmailSubjectManager.processEmailSubject(EmailSubjectManager.getEmailSubject(), contact.name),
            messageId: currentMessageId
        };

        console.log(`📤 Payload "${currentMessageId}" completo:`, {
            action: payload.action,
            instanceName: payload.instanceName,
            contactName: payload.contact.name,
            messageId: payload.messageId,
            hasMessage: !!payload.message,
            hasMedia: !!payload.media
        });

        const sendTime = new Date();

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`📡 Resposta para "${currentMessageId}":`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const responseText = await response.text();
            console.log(`📄 Resposta completa "${currentMessageId}":`, responseText);

            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`❌ Erro ao parsear resposta "${currentMessageId}":`, parseError);
                console.log('📄 Resposta bruta:', responseText);
            }

            // ✅ VERIFICAR SE O NÚMERO NÃO É WHATSAPP (ANTES DE VERIFICAR response.ok)
            if (responseData && responseData.whatsapp === false) {
                console.warn(`⚠️ Número não é WhatsApp: ${contact.phone}`);

                AppState.results.error++;

                if (selectedInstance.id !== 'legacy') {
                    InstanceManager.updateInstanceStats(selectedInstance.id, false);
                }

                AppState.sendingDetails.push({
                    datetime: sendTime,
                    phone: contact.phone,
                    name: contact.name,
                    email: contact.email || '',
                    message: personalizedMessage,
                    instance: selectedInstance.name,
                    instanceId: selectedInstance.id,
                    messageId: currentMessageId,
                    status: 'Erro',
                    error: 'Número não é WhatsApp',
                    errorType: 'not_whatsapp',
                    mediaType: currentMedia?.mimetype || null,
                    mediaUrl: currentMedia?.url || null,
                    sentEmail: false
                });

                UI.showError(`❌ ${contact.name} (${contact.phone}): Número não é WhatsApp`);

                // ✅ Pular para o próximo contato
                return;
            }

            // ✅ VERIFICAR OUTROS ERROS NA RESPOSTA
            if (responseData && responseData.result === 'error') {
                const errorMessage = responseData.message || 'Erro desconhecido';
                console.error(`❌ Erro retornado pelo backend para "${currentMessageId}":`, errorMessage);

                AppState.results.error++;

                if (selectedInstance.id !== 'legacy') {
                    InstanceManager.updateInstanceStats(selectedInstance.id, false);
                }

                AppState.sendingDetails.push({
                    datetime: sendTime,
                    phone: contact.phone,
                    name: contact.name,
                    email: contact.email || '',
                    message: personalizedMessage,
                    instance: selectedInstance.name,
                    instanceId: selectedInstance.id,
                    messageId: currentMessageId,
                    status: 'Erro',
                    error: errorMessage,
                    errorType: 'api_error',
                    mediaType: currentMedia?.mimetype || null,
                    mediaUrl: currentMedia?.url || null,
                    sentEmail: false
                });

                UI.showError(`Erro ao enviar "${currentMessageId}" para ${contact.name}: ${errorMessage}`);

                // ✅ Pular para o próximo contato
                return;
            }

            if (response.ok) {
                AppState.results.success++;

                if (selectedInstance.id !== 'legacy') {
                    InstanceManager.updateInstanceStats(selectedInstance.id, true);
                }

                AppState.sendingDetails.push({
                    datetime: sendTime,
                    phone: contact.phone,
                    name: contact.name,
                    email: contact.email || '',
                    message: personalizedMessage,
                    instance: selectedInstance.name,
                    instanceId: selectedInstance.id,
                    messageId: currentMessageId,
                    status: 'Sucesso',
                    mediaType: currentMedia?.mimetype || null,
                    mediaUrl: currentMedia?.url || null,
                    sentEmail: !!contact.email && payload.sendEmail
                });

                const instanceInfo = AppState.activeInstances.length > 0 ? ` via ${selectedInstance.name}` : '';
                const emailInfo = contact.email && payload.sendEmail ? ' + E-mail' : '';
                const mediaInfo = currentMedia ?
                    ` + ${currentMedia.type === 'url' ? 'URL' : currentMedia.mimetype.split('/')[0]}` : '';
                const messageInfo = ` (${currentMessageId})`;

                UI.showSuccess(`Enviado para ${contact.name}${instanceInfo}${emailInfo}${mediaInfo}${messageInfo}`);
            } else {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }
        } catch (error) {
            AppState.results.error++;

            if (selectedInstance.id !== 'legacy') {
                InstanceManager.updateInstanceStats(selectedInstance.id, false);
            }

            AppState.sendingDetails.push({
                datetime: sendTime,
                phone: contact.phone,
                name: contact.name,
                email: contact.email || '',
                message: personalizedMessage,
                instance: selectedInstance.name,
                instanceId: selectedInstance.id,
                messageId: currentMessageId,
                status: 'Erro',
                error: error.message,
                mediaType: currentMedia?.mimetype || null,
                mediaUrl: currentMedia?.url || null,
                sentEmail: false
            });

            console.error(`❌ Erro detalhado no envio "${currentMessageId}":`, {
                contact: contact.name,
                messageId: currentMessageId,
                error: error.message,
                hasMedia: !!currentMedia,
                mediaType: currentMedia?.type,
                mediaUrl: currentMedia?.url,
                stack: error.stack
            });

            UI.showError(`Erro ao enviar "${currentMessageId}" para ${contact.name} via ${selectedInstance.name}: ${error.message}`);
        }
    },


    updateProgress(currentIndex) {
        const progress = ((currentIndex + 1) / AppState.contacts.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${currentIndex + 1}/${AppState.contacts.length}`;

        // ✅ ATUALIZAR TODAS AS ESTATÍSTICAS
        this.updateStats();
        ChartManager.update();
        TimeEstimator.update();
    },

    updateStats() {
        console.log('📊 updateStats chamado:', {
            timestamp: new Date().toLocaleTimeString(),
            totalSent: AppState.results.success + AppState.results.error
        });

        // Elementos do Dashboard
        const totalSentEl = document.getElementById('totalSent');
        const successCountEl = document.getElementById('successCount');
        const errorCountEl = document.getElementById('errorCount');

        // ✅ REMOVER COMPLETAMENTE qualquer referência a totalContactsEl
        // NÃO mexer no totalContacts de forma alguma aqui!

        // Elementos do Progresso
        const totalSentProgressEl = document.getElementById('totalSentProgress');
        const successCountProgressEl = document.getElementById('successCountProgress');
        const errorCountProgressEl = document.getElementById('errorCountProgress');

        // Elementos dos Resultados
        const totalSentResultsEl = document.getElementById('totalSentResults');
        const successRateEl = document.getElementById('successRate');
        const avgTimeEl = document.getElementById('avgTime');
        const todayDispatchesEl = document.getElementById('todayDispatches');

        // Elementos de Performance
        const messagesPerHourEl = document.getElementById('messagesPerHour');
        const efficiencyEl = document.getElementById('efficiency');
        const listQualityEl = document.getElementById('listQuality');
        const hourlyProgressEl = document.getElementById('hourlyProgress');
        const efficiencyProgressEl = document.getElementById('efficiencyProgress');
        const qualityProgressEl = document.getElementById('qualityProgress');

        // ===== CÁLCULOS =====
        const totalSent = AppState.results.success + AppState.results.error;
        const successRate = totalSent > 0 ? Math.round((AppState.results.success / totalSent) * 100) : 0;

        let avgTime = 0;
        if (AppState.startTime && totalSent > 0) {
            const elapsed = Date.now() - AppState.startTime;
            avgTime = Math.round(elapsed / totalSent / 1000);
        }

        let messagesPerHour = 0;
        if (AppState.startTime && totalSent > 0) {
            const elapsedHours = (Date.now() - AppState.startTime) / (1000 * 60 * 60);
            messagesPerHour = Math.round(totalSent / Math.max(elapsedHours, 0.01));
        }

        let todayDispatches = 0;
        if (AppState.sendingHistory.length > 0) {
            todayDispatches = AppState.sendingHistory.length;
        } else if (AppState.sendingInProgress || totalSent > 0) {
            todayDispatches = 1;
        }

        const efficiency = Math.min(100, successRate * 0.7 + (messagesPerHour > 0 ? 30 : 0));
        const listQuality = successRate;

        // ===== ATUALIZAR APENAS ESTATÍSTICAS DE ENVIO =====
        if (totalSentEl) totalSentEl.textContent = totalSent;
        if (successCountEl) successCountEl.textContent = AppState.results.success;
        if (errorCountEl) errorCountEl.textContent = AppState.results.error;

        if (totalSentProgressEl) totalSentProgressEl.textContent = totalSent;
        if (successCountProgressEl) successCountProgressEl.textContent = AppState.results.success;
        if (errorCountProgressEl) errorCountProgressEl.textContent = AppState.results.error;

        if (totalSentResultsEl) totalSentResultsEl.textContent = totalSent;
        if (successRateEl) successRateEl.textContent = successRate + '%';
        if (avgTimeEl) avgTimeEl.textContent = avgTime > 0 ? avgTime + 's' : '0s';
        if (todayDispatchesEl) todayDispatchesEl.textContent = todayDispatches;

        if (messagesPerHourEl) messagesPerHourEl.textContent = messagesPerHour;
        if (efficiencyEl) efficiencyEl.textContent = Math.round(efficiency) + '%';
        if (listQualityEl) listQualityEl.textContent = listQuality + '%';

        if (hourlyProgressEl) {
            const maxHourly = 120;
            const hourlyPercentage = Math.min(100, (messagesPerHour / maxHourly) * 100);
            hourlyProgressEl.style.width = hourlyPercentage + '%';
        }

        if (efficiencyProgressEl) {
            efficiencyProgressEl.style.width = Math.round(efficiency) + '%';
        }

        if (qualityProgressEl) {
            qualityProgressEl.style.width = listQuality + '%';
        }

        console.log('✅ Stats de envio atualizadas (totalContacts NÃO foi tocado)');
    },

    updateResultsChart() {
        // Gráfico principal (Dashboard)
        if (AppState.chart && this.isInitialized) {
            try {
                AppState.chart.data.datasets[0].data = [AppState.results.success, AppState.results.error];
                AppState.chart.update();
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar gráfico principal:', error);
            }
        }

        // Gráfico da seção Resultados
        const resultsCtx = document.getElementById('resultsChartResults')?.getContext('2d');
        if (resultsCtx) {
            // Destruir gráfico existente se houver
            if (window.resultsChart) {
                window.resultsChart.destroy();
            }

            try {
                window.resultsChart = new Chart(resultsCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Sucessos', 'Erros'],
                        datasets: [{
                            data: [AppState.results.success, AppState.results.error],
                            backgroundColor: ['#28a745', '#dc3545'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 20,
                                    usePointStyle: true,
                                    font: {
                                        size: 12
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const total = AppState.results.success + AppState.results.error;
                                        const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });

                console.log('📊 Gráfico de resultados atualizado');
            } catch (error) {
                console.error('❌ Erro ao criar gráfico de resultados:', error);
            }
        }
    },

    async waitWhilePaused() {
        while (AppState.isPaused && !AppState.stopSending) {
            await Utils.sleep(500);
        }
    },

    stop() {
        AppState.stopSending = true;
        AppState.isPaused = false;
        TimerManager.showStopped();
        // Limpar estado salvo ao parar manualmente
        ActiveDispatchManager.clearDispatchState();
        UI.showWarning('Parando envio...');
    },

    pause() {
        AppState.isPaused = true;
        TimerManager.pause();
        this.updatePauseButton();

        // ✅ ATUALIZAR DISPLAY COM CONFIGURAÇÕES ATUAIS
        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
        }, 100);

        // ✅ MOSTRAR BOTÃO PARA APLICAR CONFIGURAÇÕES SE EXISTIR
        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.style.display = 'inline-block';
        }

        UI.showWarning('Envio pausado - Você pode alterar intervalos e retomar com novas configurações');
    },

    resume() {
        // ✅ VERIFICAR SE CONFIGURAÇÕES MUDARAM
        const validation = Validators.intervals();
        if (!validation.valid) {
            UI.showError('Intervalos inválidos. Configure novamente antes de retomar.');
            return;
        }

        console.log('▶️ Retomando envio com novas configurações:', {
            minInterval: validation.min,
            maxInterval: validation.max,
            batchEnabled: AppState.batchPauseEnabled
        });

        // ✅ APLICAR NOVAS CONFIGURAÇÕES NO ESTADO
        AppState.minInterval = validation.min;
        AppState.maxInterval = validation.max;

        // Aplicar configurações de lote
        const batchEnabled = document.getElementById('enableBatchPause')?.checked;
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);

        AppState.batchPauseEnabled = batchEnabled;
        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        AppState.isPaused = false;
        TimerManager.resume(); // Vai usar as novas configurações
        this.updatePauseButton();

        // ✅ FORÇAR ATUALIZAÇÃO DA INTERFACE VISUAL
        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
            TimeEstimator.update();
        }, 200);

        // ✅ ESCONDER BOTÃO APLICAR CONFIGURAÇÕES SE EXISTIR
        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.style.display = 'none';
        }

        UI.showInfo(`Envio retomado com intervalos: ${validation.min}s - ${validation.max}s`);
    },

    // ✅ NOVA FUNÇÃO PARA ATUALIZAR ESPECIFICAMENTE O CARD AZUL
    updateActiveConfigurationsDisplay() {
        const validation = Validators.intervals();
        if (!validation.valid) return;

        console.log('🔄 Atualizando display de configurações...');

        // ✅ BUSCAR O CARD AZUL ESPECIFICAMENTE
        const alertElements = document.querySelectorAll('.alert-info');
        let configCard = null;

        alertElements.forEach(element => {
            if (element.textContent.includes('Configurações Ativas') ||
                element.textContent.includes('Intervalo:')) {
                configCard = element;
            }
        });

        if (configCard) {
            const newContent = `
            <strong>⚙️ Configurações Ativas:</strong><br>
            Intervalo: ${validation.min}s - ${validation.max}s<br>
            ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
        `;

            configCard.innerHTML = newContent;
            console.log('✅ Card de configurações atualizado:', {
                min: validation.min,
                max: validation.max,
                batch: AppState.batchPauseEnabled
            });
        } else {
            console.warn('⚠️ Card de configurações não encontrado');

            // ✅ CRIAR O CARD SE NÃO EXISTIR
            this.createConfigurationsCard(validation);
        }
    },

    // ✅ FUNÇÃO PARA CRIAR O CARD SE NÃO EXISTIR
    createConfigurationsCard(validation) {
        const progressCard = document.querySelector('.progress-container .card-body');

        if (progressCard) {
            const configDiv = document.createElement('div');
            configDiv.className = 'alert alert-info mt-3';
            configDiv.innerHTML = `
            <strong>⚙️ Configurações Ativas:</strong><br>
            Intervalo: ${validation.min}s - ${validation.max}s<br>
            ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
        `;

            // Inserir antes dos botões
            const buttons = progressCard.querySelector('.d-grid');
            if (buttons) {
                progressCard.insertBefore(configDiv, buttons);
            } else {
                progressCard.appendChild(configDiv);
            }

            console.log('✅ Card de configurações criado');
        }
    },

    showCurrentSettings() {
        const validation = Validators.intervals();
        if (!validation.valid) return;

        // ✅ BUSCAR O ELEMENTO CORRETO QUE EXISTE NA SUA INTERFACE
        const activeConfigDiv = document.querySelector('.alert-info'); // ou o seletor correto

        // Se não encontrar, criar o elemento
        let settingsInfo = document.getElementById('currentSettingsInfo');
        if (!settingsInfo) {
            // Procurar o card de progresso para adicionar as informações
            const progressCard = document.querySelector('.progress-container .card-body');
            if (progressCard) {
                settingsInfo = document.createElement('div');
                settingsInfo.id = 'currentSettingsInfo';
                settingsInfo.className = 'mt-3';
                progressCard.appendChild(settingsInfo);
            }
        }

        if (settingsInfo) {
            settingsInfo.innerHTML = `
            <div class="alert alert-info">
                <strong>⚙️ Configurações Ativas:</strong><br>
                Intervalo: ${validation.min}s - ${validation.max}s<br>
                ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
            </div>
        `;
        }

        // ✅ ATUALIZAR TAMBÉM O CARD AZUL QUE VOCÊ MOSTROU NA IMAGEM
        this.updateActiveConfigDisplay(validation);
    },

    // ✅ NOVA FUNÇÃO PARA ATUALIZAR O CARD AZUL ESPECIFICAMENTE
    updateActiveConfigDisplay(validation) {
        // Procurar o elemento que mostra "Configurações Ativas:" na sua interface
        const configElements = document.querySelectorAll('.alert-info');

        configElements.forEach(element => {
            if (element.textContent.includes('Configurações Ativas:')) {
                element.innerHTML = `
                <strong>⚙️ Configurações Ativas:</strong><br>
                Intervalo: ${validation.min}s - ${validation.max}s<br>
                ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
            `;
            }
        });

        console.log('✅ Display de configurações ativas atualizado:', {
            minInterval: validation.min,
            maxInterval: validation.max,
            batchEnabled: AppState.batchPauseEnabled,
            batchSize: AppState.batchSize,
            batchPause: AppState.batchPauseDuration
        });
    },

    updatePauseButton() {
        const pauseButton = document.getElementById('pauseButton');
        if (!pauseButton) return;

        if (AppState.isPaused) {
            pauseButton.className = 'btn btn-success';
            pauseButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Retomar Envio';
        } else {
            pauseButton.className = 'btn btn-warning';
            pauseButton.innerHTML = '<i class="bi bi-pause-circle me-2"></i>Pausar Envio';
        }
    },

    finishSending() {
        AppState.isPaused = false;
        document.getElementById('pauseButton').style.display = 'none';

        // ✅ CALCULAR DURAÇÃO REAL
        const totalDuration = AppState.startTime ? Date.now() - AppState.startTime : 0;

        console.log('⏱️ Disparo finalizado:', {
            startTime: AppState.startTime ? new Date(AppState.startTime).toLocaleTimeString() : 'N/A',
            endTime: new Date().toLocaleTimeString(),
            duracaoReal: Utils.formatTime(totalDuration),
            totalEnvios: AppState.sendingDetails.length
        });

        TimerManager.showCompleted(AppState.results.success, AppState.results.error, totalDuration);
        AppState.sendingInProgress = false;

        // ✅ ATUALIZAR TODAS AS ESTATÍSTICAS FINAIS
        this.updateStats();
        ChartManager.update();

        const sessionData = {
            instanceName: document.getElementById('instanceName')?.value || '',
            totalContacts: AppState.contacts.length,
            successCount: AppState.results.success,
            errorCount: AppState.results.error,
            duration: totalDuration,
            details: AppState.sendingDetails
        };

        HistoryManager.saveToHistory(sessionData);

        if (AppState.sendingDetails.length > 0) {
            document.getElementById('reportButton').style.display = 'block';
        }

        AppState.startTime = null;

        if (AppState.stopSending) {
            UI.showWarning('Envio interrompido pelo usuário');
        } else {
            UI.showSuccess('Disparo concluído!');
        }
    }
};

// ========================================
// 14. GERENCIAMENTO DE HISTÓRICO
// ========================================
const HistoryManager = {
    saveToHistory(sessionData) {
        const safeDetails = Array.isArray(sessionData.details) ? sessionData.details : [];

        // Coletar informações de instâncias usadas
        const instancesUsed = [...new Set(safeDetails.map(detail => detail.instance || 'Desconhecido'))];
        const instanceName = instancesUsed.length > 1 ?
            `Múltiplas (${instancesUsed.length})` :
            (instancesUsed[0] || sessionData.instanceName || 'Desconhecido');

        // ✅ CORREÇÃO: Usar duração recebida ou calcular melhor
        let calculatedDuration = sessionData.duration || 0; // Priorizar duração recebida

        // Se não tiver duração e houver detalhes, calcular
        if (calculatedDuration === 0 && safeDetails.length > 1) {
            const startTime = safeDetails[0]?.datetime || new Date();
            const endTime = safeDetails[safeDetails.length - 1]?.datetime || new Date();
            calculatedDuration = new Date(endTime) - new Date(startTime);

            // ✅ ADICIONAR um buffer mínimo (tempo de processamento)
            calculatedDuration += safeDetails.length * 500; // 500ms por mensagem de buffer
        }

        // ✅ Se ainda for muito pequeno, usar estimativa baseada na quantidade
        if (calculatedDuration < 1000 && safeDetails.length > 0) {
            calculatedDuration = safeDetails.length * 2000; // 2s por mensagem
        }

        console.log('💾 Salvando no histórico:', {
            duracaoRecebida: sessionData.duration ? Utils.formatTime(sessionData.duration) : 'N/A',
            duracaoCalculada: Utils.formatTime(calculatedDuration),
            totalContatos: sessionData.totalContacts
        });

        const historyEntry = {
            id: Date.now(),
            datetime: new Date(),
            instanceName: instanceName,
            instancesUsed: instancesUsed,
            totalContacts: sessionData.totalContacts || 0,
            successCount: sessionData.successCount || 0,
            errorCount: sessionData.errorCount || 0,
            successRate: sessionData.totalContacts > 0 ? ((sessionData.successCount / sessionData.totalContacts) * 100).toFixed(1) : 0,
            duration: calculatedDuration, // ✅ Usar duração corrigida
            details: safeDetails.map(detail => ({
                ...detail,
                datetime: detail.datetime instanceof Date ? detail.datetime : new Date(detail.datetime || Date.now()),
                instance: detail.instance || 'Desconhecido',
                instanceId: detail.instanceId || null
            }))
        };

        AppState.sendingHistory.unshift(historyEntry);

        if (AppState.sendingHistory.length > APP_CONFIG.maxHistoryEntries) {
            AppState.sendingHistory = AppState.sendingHistory.slice(0, APP_CONFIG.maxHistoryEntries);
        }

        this.updateTable();
    },

    updateTable() {
        const tbody = document.getElementById('historyTableBody');
        const exportBtn = document.getElementById('exportHistoryBtn');

        if (!tbody) return;

        if (AppState.sendingHistory.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    <i class="bi bi-inbox fs-3 d-block mb-2"></i>
                    Nenhum envio realizado ainda
                </td>
            </tr>
        `;
            if (exportBtn) exportBtn.style.display = 'none';
            return;
        }

        if (exportBtn) exportBtn.style.display = 'inline-block';

        tbody.innerHTML = AppState.sendingHistory.map(entry => `
        <tr>
            <td>${Utils.safeFormatDate(entry.datetime)}</td>
            <td><span class="badge bg-info">${entry.instanceName || 'N/A'}</span></td>
            <td>${entry.totalContacts || 0}</td>
            <td><span class="text-success fw-bold">${entry.successCount || 0}</span></td>
            <td><span class="text-danger fw-bold">${entry.errorCount || 0}</span></td>
            <td>
                <span class="badge ${(entry.successRate || 0) >= 80 ? 'bg-success' : (entry.successRate || 0) >= 50 ? 'bg-warning' : 'bg-danger'}">
                    ${entry.successRate || 0}%
                </span>
            </td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-outline-primary btn-sm view-details-btn" data-entry-id="${entry.id}" title="Ver detalhes">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-success btn-sm generate-report-btn" data-entry-id="${entry.id}" title="Relatório Completo">
                        <i class="bi bi-file-earmark-pdf"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm delete-entry-btn" data-entry-id="${entry.id}" title="Excluir">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    },

    viewDetails(entryId) {
        const entry = AppState.sendingHistory.find(h => h.id === entryId);
        if (!entry) return;

        const modalContent = `
        <div class="modal fade" id="historyModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Envio - ${Utils.safeFormatDate(entry.datetime)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Instância:</strong> ${entry.instanceName || 'N/A'}<br>
                                <strong>Total de Contatos:</strong> ${entry.totalContacts || 0}<br>
                                <strong>Taxa de Sucesso:</strong> <span class="badge ${entry.successRate >= 80 ? 'bg-success' : entry.successRate >= 50 ? 'bg-warning' : 'bg-danger'}">${entry.successRate || 0}%</span>
                            </div>
                            <div class="col-md-6">
                                <strong>Sucessos:</strong> <span class="text-success">${entry.successCount || 0}</span><br>
                                <strong>Erros:</strong> <span class="text-danger">${entry.errorCount || 0}</span><br>
                            </div>
                        </div>
                        ${entry.details && entry.details.length > 0 ? `
                            <h6>Detalhes dos Envios:</h6>
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-sm table-striped">
                                    <thead class="table-dark sticky-top">
                                        <tr>
                                            <th>Hora</th>
                                            <th>Nome</th>
                                            <th>Telefone</th>
                                            <th>Instância</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${entry.details.map(detail => `
                                            <tr>
                                                <td>${Utils.safeFormatTime(detail.datetime)}</td>
                                                <td>${detail.name || 'N/A'}</td>
                                                <td>${detail.phone || 'N/A'}</td>
                                                <td>
                                                    <span class="badge bg-info">${detail.instance || 'N/A'}</span>
                                                </td>
                                                <td>
                                                    <span class="badge ${detail.status === 'Sucesso' ? 'bg-success' : 'bg-danger'}">
                                                        ${detail.status || 'N/A'}
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">Detalhes não disponíveis para este envio.</p>'}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

        const existingModal = document.getElementById('historyModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
    },

    deleteEntry(entryId) {
        AppState.sendingHistory = AppState.sendingHistory.filter(h => h.id !== entryId);
        this.updateTable();
        UI.showSuccess('Entrada do histórico removida');
    },

    generateReport(entryId) {
        const entry = AppState.sendingHistory.find(h => h.id === entryId);
        if (!entry) {
            UI.showError('Entrada do histórico não encontrada');
            return;
        }

        if (!entry.details || entry.details.length === 0) {
            UI.showWarning('Não há detalhes suficientes para gerar o relatório');
            return;
        }

        // Usar o mesmo formato do ReportManager
        const instancesUsed = [...new Set(entry.details.map(detail => detail.instance || 'Desconhecido'))];
        const instanceStats = {};

        // Calcular estatísticas por instância
        entry.details.forEach(detail => {
            const instanceName = detail.instance || 'Desconhecido';
            if (!instanceStats[instanceName]) {
                instanceStats[instanceName] = { total: 0, success: 0, error: 0 };
            }
            instanceStats[instanceName].total++;
            if (detail.status === 'Sucesso') {
                instanceStats[instanceName].success++;
            } else {
                instanceStats[instanceName].error++;
            }
        });

        // Usar duração salva ou calcular se não existir
        let reportDuration = entry.duration || 0;
        if (!reportDuration && entry.details.length > 1) {
            const startTime = entry.details[0]?.datetime || new Date();
            const endTime = entry.details[entry.details.length - 1]?.datetime || new Date();
            reportDuration = new Date(endTime) - new Date(startTime);
        }

        const reportData = {
            datetime: entry.datetime,
            instanceName: instancesUsed.length > 1 ? 'Múltiplas Instâncias' : (instancesUsed[0] || 'Desconhecido'),
            instancesUsed: instancesUsed,
            instanceStats: instanceStats,
            totalContacts: entry.totalContacts || 0,
            successCount: entry.successCount || 0,
            errorCount: entry.errorCount || 0,
            duration: reportDuration,
            details: entry.details.map(detail => ({
                datetime: detail.datetime ? detail.datetime.toISOString() : new Date().toISOString(),
                name: detail.name || 'Sem nome',
                phone: detail.phone || 'Sem telefone',
                email: detail.email || '',
                status: detail.status || 'Desconhecido',
                message: detail.message || 'Sem mensagem',
                instance: detail.instance || 'Desconhecido',
                instanceId: detail.instanceId || null
            }))
        };

        // Usar a mesma lógica do ReportManager
        const encodedData = encodeURIComponent(JSON.stringify(reportData));
        const reportUrl = `relatorio.html?data=${encodedData}`;

        if (reportUrl.length > 2000) {
            sessionStorage.setItem('current_report_data', JSON.stringify(reportData));
            window.open('relatorio.html', '_blank');
        } else {
            window.open(reportUrl, '_blank');
        }

        UI.showSuccess('Relatório do histórico aberto em nova aba!');
    },


    clear() {
        UI.confirm(
            'Limpar Histórico',
            'Tem certeza que deseja limpar todo o histórico de envios?',
            () => {
                AppState.sendingHistory = [];
                this.updateTable();
                UI.showSuccess('Histórico limpo com sucesso');
            }
        );
    }
};

// ========================================
// 15. GERENCIAMENTO DE AGENDAMENTO
// ========================================
const ScheduleManager = {
    initialize() {
        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
        const minDate = localDate.toISOString().split('T')[0];

        const scheduleDateInput = document.getElementById('scheduleDate');
        const scheduleTimeInput = document.getElementById('scheduleTime');

        if (scheduleDateInput) {
            scheduleDateInput.min = minDate;
            scheduleDateInput.value = minDate;
        }

        if (scheduleTimeInput) {
            const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
            const timeString = nextHour.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            scheduleTimeInput.value = timeString;
        }

        this.loadScheduledDispatches();
        AppIntervals.scheduledCheck = setInterval(() => this.checkScheduledDispatches(), APP_CONFIG.scheduledCheckInterval);
    },

    scheduleDispatch(dispatchData) {
        const validation = Validators.schedule();
        if (!validation.valid) {
            UI.showError(validation.error);
            return false;
        }

        const scheduledDispatch = {
            id: Date.now(),
            scheduledDateTime: validation.scheduledDateTime,
            dispatchData: dispatchData,
            status: 'agendado',
            createdAt: new Date()
        };

        AppState.scheduledDispatches.push(scheduledDispatch);
        this.saveScheduledDispatches();
        this.updateScheduledTable();

        UI.showSuccess(`Disparo agendado para ${validation.scheduledDateTime.toLocaleString('pt-BR')}`);

        const enableSchedulingCheckbox = document.getElementById('enableScheduling');
        if (enableSchedulingCheckbox) {
            enableSchedulingCheckbox.checked = false;
            this.toggleSchedulingOptions();
        }

        return true;
    },

    checkScheduledDispatches() {
        const now = new Date();

        AppState.scheduledDispatches.forEach(dispatch => {
            if (dispatch.status === 'agendado') {
                const timeUntil = dispatch.scheduledDateTime - now;

                if (timeUntil <= 5 * 60 * 1000 && timeUntil > 4 * 60 * 1000 && !dispatch.warned) {
                    UI.showInfo('Disparo será executado em 5 minutos');
                    dispatch.warned = true;
                    this.saveScheduledDispatches();
                }

                if (timeUntil <= 0) {
                    this.executeScheduledDispatch(dispatch);
                }
            }
        });

        this.updateScheduledTable();
    },

    async executeScheduledDispatch(scheduledDispatch) {
        if (AppState.sendingInProgress) {
            UI.showWarning('Outro disparo está em andamento. Reagendando...');
            scheduledDispatch.scheduledDateTime = new Date(Date.now() + 5 * 60 * 1000);
            this.saveScheduledDispatches();
            return;
        }

        scheduledDispatch.status = 'executando';
        this.updateScheduledTable();

        const data = scheduledDispatch.dispatchData;

        // Aplicar configurações
        const instanceNameInput = document.getElementById('instanceName');
        const instanceAPIKEYInput = document.getElementById('instanceAPIKEY');
        const messageInput = document.getElementById('message');
        const iaInput = document.getElementById('ia');
        const minIntervalInput = document.getElementById('minInterval');
        const maxIntervalInput = document.getElementById('maxInterval');

        if (instanceNameInput) instanceNameInput.value = data.instanceName;
        if (instanceAPIKEYInput) instanceAPIKEYInput.value = data.instanceAPIKEY;
        if (messageInput && !data.multipleMessages) messageInput.value = data.message;
        if (iaInput) iaInput.value = data.ia;
        if (minIntervalInput) minIntervalInput.value = data.minInterval;
        if (maxIntervalInput) maxIntervalInput.value = data.maxInterval;

        if (data.contacts) {
            AppState.contacts = data.contacts;
            ContactManager.updateContactsList();
        }

        UI.showInfo('Executando disparo agendado...');

        try {
            await SendingManager.start();
            scheduledDispatch.status = 'concluído';
        } catch (error) {
            scheduledDispatch.status = 'erro';
            UI.showError('Erro ao executar disparo agendado: ' + error.message);
        }

        this.saveScheduledDispatches();
        this.updateScheduledTable();
    },

    cancelScheduledDispatch(id) {
        UI.confirm(
            'Cancelar Agendamento',
            'Tem certeza que deseja cancelar este agendamento?',
            () => {
                AppState.scheduledDispatches = AppState.scheduledDispatches.filter(d => d.id !== id);
                this.saveScheduledDispatches();
                this.updateScheduledTable();
                UI.showSuccess('Agendamento cancelado');
            }
        );
    },

    updateScheduledTable() {
        const tbody = document.getElementById('scheduledTableBody');
        const section = document.getElementById('scheduledSection');
        const count = document.getElementById('scheduledCount');

        if (!tbody) return;

        const activeSchedules = AppState.scheduledDispatches.filter(d => d.status !== 'concluído');

        if (activeSchedules.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }

        if (section) section.style.display = 'block';
        if (count) count.textContent = activeSchedules.length;

        tbody.innerHTML = activeSchedules.map(dispatch => {
            const now = new Date();
            const timeUntil = dispatch.scheduledDateTime - now;
            const timeRemaining = timeUntil > 0 ? Utils.formatTimeRemaining(timeUntil) : 'Executando...';

            let statusBadge = '';
            switch (dispatch.status) {
                case 'agendado':
                    statusBadge = '<span class="badge bg-primary">Agendado</span>';
                    break;
                case 'executando':
                    statusBadge = '<span class="badge bg-warning">Executando</span>';
                    break;
                case 'erro':
                    statusBadge = '<span class="badge bg-danger">Erro</span>';
                    break;
            }

            return `
                <tr>
                    <td>${dispatch.scheduledDateTime.toLocaleString('pt-BR')}</td>
                    <td><span class="badge bg-info">${dispatch.dispatchData.instanceName}</span></td>
                    <td>${dispatch.dispatchData.contacts ? dispatch.dispatchData.contacts.length : 'N/A'}</td>
                    <td>${timeRemaining}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${dispatch.status === 'agendado' ?
                    `<button class="btn btn-outline-danger btn-sm" onclick="ScheduleManager.cancelScheduledDispatch(${dispatch.id})" title="Cancelar">
                                <i class="bi bi-trash"></i>
                            </button>` :
                    '<span class="text-muted">-</span>'
                }
                    </td>
                </tr>
            `;
        }).join('');
    },

    toggleSchedulingOptions() {
        const checkbox = document.getElementById('enableScheduling');
        const options = document.getElementById('schedulingOptions');

        if (checkbox && options) {
            options.style.display = checkbox.checked ? 'block' : 'none';
        }
    },

    saveScheduledDispatches() {
        const dataToSave = AppState.scheduledDispatches.map(dispatch => ({
            ...dispatch,
            scheduledDateTime: dispatch.scheduledDateTime.toISOString(),
            createdAt: dispatch.createdAt.toISOString()
        }));

        localStorage.setItem('scheduledDispatches', JSON.stringify(dataToSave));
    },

    loadScheduledDispatches() {
        const saved = localStorage.getItem('scheduledDispatches');
        if (saved) {
            const parsed = JSON.parse(saved);
            AppState.scheduledDispatches = parsed.map(dispatch => ({
                ...dispatch,
                scheduledDateTime: new Date(dispatch.scheduledDateTime),
                createdAt: new Date(dispatch.createdAt)
            }));

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            AppState.scheduledDispatches = AppState.scheduledDispatches.filter(d => d.createdAt > weekAgo);

            this.updateScheduledTable();
        }
    },
};

// ========================================
// GERENCIAMENTO DE LOTE
// ========================================

const BatchManager = {
    initialize() {
        console.log('🔧 Inicializando BatchManager...');
        this.setupEventListeners();
    },

    setupEventListeners() {
        const enableBatchPause = document.getElementById('enableBatchPause');
        if (enableBatchPause) {
            enableBatchPause.addEventListener('change', () => {
                console.log('🔄 Checkbox de pausa em lotes alterado:', enableBatchPause.checked);
                this.toggleBatchOptions();
            });
            console.log('✅ Event listener do BatchManager configurado');
        } else {
            console.error('❌ Elemento enableBatchPause não encontrado');
        }

        // Event listeners para os campos de configuração
        const batchSize = document.getElementById('batchSize');
        const batchPauseDuration = document.getElementById('batchPauseDuration');

        if (batchSize) {
            batchSize.addEventListener('input', () => {
                AppState.batchSize = parseInt(batchSize.value || 10);
                this.updateBatchInfo();
                TimeEstimator.update();
            });
        }

        if (batchPauseDuration) {
            batchPauseDuration.addEventListener('input', () => {
                AppState.batchPauseDuration = parseInt(batchPauseDuration.value || 10);
                this.updateBatchInfo();
                TimeEstimator.update();
            });
        }
    },

    toggleBatchOptions() {
        const checkbox = document.getElementById('enableBatchPause');
        const options = document.getElementById('batchPauseOptions');

        console.log('🔄 Alternando opções de lote...', {
            checkbox: !!checkbox,
            options: !!options,
            checked: checkbox?.checked
        });

        if (checkbox && options) {
            AppState.batchPauseEnabled = checkbox.checked;
            options.style.display = checkbox.checked ? 'block' : 'none';

            if (checkbox.checked) {
                console.log('✅ Pausa em lotes ativada');
                this.updateBatchInfo();
                UI.showSuccess('Pausa em lotes ativada!');
            } else {
                console.log('❌ Pausa em lotes desativada');
                UI.showInfo('Pausa em lotes desativada');
            }

            TimeEstimator.update();
        } else {
            console.error('❌ Elementos não encontrados:', {
                checkbox: !!checkbox,
                options: !!options
            });
        }
    },

    updateBatchInfo() {
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);
        const totalContacts = AppState.contacts.length;

        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        if (totalContacts > 0) {
            AppState.totalBatches = Math.ceil(totalContacts / batchSize);
            console.log(`📦 Configuração atualizada: ${AppState.totalBatches} lotes de ${batchSize} mensagens, pausa de ${batchPause}min`);
        }
    },

    shouldPauseBatch(currentIndex) {
        if (!AppState.batchPauseEnabled) return false;

        const batchSize = AppState.batchSize;
        const isEndOfBatch = (currentIndex + 1) % batchSize === 0;
        const notLastMessage = currentIndex < AppState.contacts.length - 1;

        console.log(`🔍 Verificando pausa: índice ${currentIndex}, lote ${batchSize}, fim do lote: ${isEndOfBatch}, não é última: ${notLastMessage}`);

        return isEndOfBatch && notLastMessage;
    },

    async startBatchPause() {
        const pauseDuration = AppState.batchPauseDuration;
        const pauseMs = pauseDuration * 60 * 1000;

        AppState.batchPauseActive = true;
        AppState.currentBatchNumber++;

        console.log(`⏸️ Iniciando pausa entre lotes: ${pauseDuration} minutos`);

        this.showBatchStatus(pauseMs);
        UI.showWarning(`Pausa entre lotes ativa: ${pauseDuration} minutos`);

        return new Promise((resolve) => {
            AppState.batchTimer = setTimeout(() => {
                AppState.batchPauseActive = false;
                this.hideBatchStatus();
                UI.showInfo('Pausa entre lotes finalizada - continuando envio...');
                console.log('▶️ Pausa entre lotes finalizada');
                resolve();
            }, pauseMs);
        });
    },

    showBatchStatus(pauseMs) {
        const statusDiv = document.getElementById('batchStatus');
        const currentBatch = document.getElementById('currentBatch');
        const countdown = document.getElementById('batchCountdown');
        const progressBar = document.getElementById('batchProgressBar');
        const timeRemaining = document.getElementById('batchTimeRemaining');

        if (statusDiv) statusDiv.style.display = 'block';
        if (currentBatch) currentBatch.textContent = AppState.currentBatchNumber - 1;

        // Countdown timer
        let remainingTime = pauseMs;
        const updateInterval = setInterval(() => {
            if (!AppState.batchPauseActive) {
                clearInterval(updateInterval);
                return;
            }

            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (countdown) countdown.textContent = timeString;
            if (timeRemaining) timeRemaining.textContent = timeString;

            const progress = ((pauseMs - remainingTime) / pauseMs) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;

            remainingTime -= 1000;

            if (remainingTime < 0) {
                clearInterval(updateInterval);
            }
        }, 1000);
    },

    hideBatchStatus() {
        const statusDiv = document.getElementById('batchStatus');
        if (statusDiv) statusDiv.style.display = 'none';

        if (AppState.batchTimer) {
            clearTimeout(AppState.batchTimer);
            AppState.batchTimer = null;
        }
    },

    reset() {
        AppState.currentBatchCount = 0;
        AppState.currentBatchNumber = 1;
        AppState.batchPauseActive = false;
        this.hideBatchStatus();
        console.log('🔄 BatchManager resetado');
    }
};

// ========================================
// GERENCIAMENTO DE HORÁRIO COMERCIAL
// ========================================
const BusinessHoursManager = {
    initialize() {
        console.log('🕐 Inicializando BusinessHoursManager...');
        this.setupEventListeners();
        this.loadSettings();
    },

    setupEventListeners() {
        const enableCheckbox = document.getElementById('enableBusinessHours');
        const options = document.getElementById('businessHoursOptions');

        if (enableCheckbox) {
            enableCheckbox.addEventListener('change', (e) => {
                AppState.businessHoursEnabled = e.target.checked;
                if (options) {
                    options.style.display = e.target.checked ? 'block' : 'none';
                }
                this.saveSettings();
                TimeEstimator.update();
            });
        }

        // Salvar quando horários mudarem
        const startInput = document.getElementById('businessHoursStart');
        const endInput = document.getElementById('businessHoursEnd');

        if (startInput) {
            startInput.addEventListener('change', () => {
                AppState.businessHoursStart = startInput.value;
                this.saveSettings();
                TimeEstimator.update();
            });
        }

        if (endInput) {
            endInput.addEventListener('change', () => {
                AppState.businessHoursEnd = endInput.value;
                this.saveSettings();
                TimeEstimator.update();
            });
        }
    },

    // Verificar se está dentro do horário comercial
    isWithinBusinessHours() {
        if (!AppState.businessHoursEnabled) {
            return true; // Se desabilitado, sempre permite
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Em minutos

        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return currentTime >= startTime && currentTime < endTime;
    },

    // Calcular tempo até próximo horário comercial
    getTimeUntilBusinessHours() {
        if (!AppState.businessHoursEnabled) {
            return 0;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        // Se está antes do início
        if (currentTime < startTime) {
            const minutesUntilStart = startTime - currentTime;
            return minutesUntilStart * 60 * 1000; // Converter para ms
        }

        // Se está depois do fim (precisa esperar até amanhã)
        if (currentTime >= endTime) {
            const minutesInDay = 24 * 60;
            const minutesUntilTomorrow = minutesInDay - currentTime + startTime;
            return minutesUntilTomorrow * 60 * 1000;
        }

        return 0;
    },

    // Aguardar até horário comercial
    async waitForBusinessHours() {
        if (!AppState.businessHoursEnabled || this.isWithinBusinessHours()) {
            return; // Não precisa esperar
        }

        AppState.isWaitingForBusinessHours = true;
        const waitTime = this.getTimeUntilBusinessHours();

        console.log(`🕐 Aguardando horário comercial: ${Utils.formatTime(waitTime)}`);

        // Mostrar no TimerManager
        this.showBusinessHoursWait(waitTime);

        // Aguardar (com verificação a cada minuto)
        const startWait = Date.now();
        while (!this.isWithinBusinessHours() && !AppState.stopSending) {
            const elapsed = Date.now() - startWait;
            const remaining = Math.max(0, waitTime - elapsed);

            // Atualizar display a cada segundo
            this.updateBusinessHoursDisplay(remaining);

            // Verificar a cada 1 segundo
            await Utils.sleep(1000);

            // Verificar se foi pausado ou parado
            await SendingManager.waitWhilePaused();
        }

        AppState.isWaitingForBusinessHours = false;

        if (!AppState.stopSending) {
            UI.showSuccess('✅ Horário comercial iniciado - retomando envios');
        }
    },

    // Mostrar aguardando horário comercial
    showBusinessHoursWait(waitTime) {
        const timerElement = document.getElementById('nextSendTimer');
        if (!timerElement) return;

        const nextStart = new Date(Date.now() + waitTime);
        const formattedTime = nextStart.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        TimerManager.currentState = 'business-hours-wait';
        TimerManager.updateDisplay('Aguardando...', 'warning', 'warning');
        TimerManager.updateLabel('Fora do horário comercial:');
        TimerManager.updateDetails(`Aguardando até ${formattedTime} para continuar`);
        TimerManager.updateProgress(0, 'warning');
    },

    // Atualizar display durante espera
    updateBusinessHoursDisplay(remaining) {
        const countdownElement = document.getElementById('timerCountdown');
        if (!countdownElement) return;

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        let display;
        if (hours > 0) {
            display = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            display = `${minutes}m ${seconds}s`;
        } else {
            display = `${seconds}s`;
        }

        countdownElement.textContent = display;
        countdownElement.className = 'badge bg-warning fs-6';

        // Atualizar detalhes
        const nextStart = new Date(Date.now() + remaining);
        const formattedTime = nextStart.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        TimerManager.updateDetails(`Aguardando até ${formattedTime} para continuar`);
    },

    // Salvar configurações
    saveSettings() {
        const settings = {
            enabled: AppState.businessHoursEnabled,
            start: AppState.businessHoursStart,
            end: AppState.businessHoursEnd
        };
        localStorage.setItem('business_hours_settings', JSON.stringify(settings));
    },

    // Carregar configurações
    loadSettings() {
        const saved = localStorage.getItem('business_hours_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            AppState.businessHoursEnabled = settings.enabled;
            AppState.businessHoursStart = settings.start;
            AppState.businessHoursEnd = settings.end;

            // Atualizar interface
            const enableCheckbox = document.getElementById('enableBusinessHours');
            const startInput = document.getElementById('businessHoursStart');
            const endInput = document.getElementById('businessHoursEnd');
            const options = document.getElementById('businessHoursOptions');

            if (enableCheckbox) enableCheckbox.checked = settings.enabled;
            if (startInput) startInput.value = settings.start;
            if (endInput) endInput.value = settings.end;
            if (options) options.style.display = settings.enabled ? 'block' : 'none';
        }
    },

    // Validar configuração
    validateSettings() {
        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (endTime <= startTime) {
            return {
                valid: false,
                error: 'Horário de término deve ser maior que horário de início'
            };
        }

        return { valid: true };
    },

    reset() {
        AppState.isWaitingForBusinessHours = false;
    }
};

// Expor globalmente
window.BusinessHoursManager = BusinessHoursManager;


// ========================================
// 16. GERENCIAMENTO DE CONEXÃO WHATSAPP
// ========================================
const ConnectionManager = {
    async checkConnection() {
        const validation = Validators.instanceData();
        if (!validation.valid) {
            UI.showError('Preencha o nome da instância e a APIKEY primeiro');
            return;
        }

        let modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal'));
        if (!modal) {
            modal = new bootstrap.Modal(document.getElementById('connectionModal'));
        }

        this.resetConnectionModal();
        modal.show();

        await this.performConnectionCheck(validation.instanceName, validation.instanceAPIKEY);
    },

    resetConnectionModal() {
        const statusDiv = document.getElementById('connectionStatus');
        const recheckBtn = document.getElementById('recheckConnection');

        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Verificando...</span>
                </div>
                <p class="mt-2">Verificando status da conexão...</p>
            `;
        }

        if (recheckBtn) {
            recheckBtn.style.display = 'none';
        }
    },

    async performConnectionCheck(instanceName, instanceAPIKEY) {
        try {
            const response = await fetch(WEBHOOK_URL, { // ✅ Mudado
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verificar_conexao', // ✅ Adicionado
                    instanceName,
                    instanceAPIKEY
                })
            });

            const data = await response.json();
            this.displayConnectionStatus(data, instanceName, instanceAPIKEY);

        } catch (error) {
            this.displayConnectionError(error.message);
        }
    },

    displayConnectionStatus(data, instanceName, instanceAPIKEY) {
        const statusDiv = document.getElementById('connectionStatus');
        const recheckBtn = document.getElementById('recheckConnection');

        AppIntervals.clear('qrRefresh');

        if (!statusDiv) return;

        if (data.result === 'error') {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-x-circle-fill fs-1 text-danger d-block mb-3"></i>
                    <h4>⚠️ Instância não encontrada!</h4>
                    <p class="mb-0">Verifique se as informações estão corretas.</p>
                </div>
            `;
            if (recheckBtn) recheckBtn.style.display = 'none';
            return;
        }

        if (data.result === 'open') {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill fs-1 text-success d-block mb-3"></i>
                    <h4>✅ WhatsApp Conectado!</h4>
                    <p class="mb-0">Sua instância está conectada e pronta para enviar mensagens.</p>
                </div>
            `;
            if (recheckBtn) recheckBtn.style.display = 'none';
        } else {
            this.displayQRCode(data.result, instanceName, instanceAPIKEY);
            if (recheckBtn) recheckBtn.style.display = 'inline-block';
        }
    },

    displayQRCode(qrCodeBase64, instanceName, instanceAPIKEY) {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;

        let countdown = 30;

        const updateQRDisplay = () => {
            statusDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle-fill fs-1 text-warning d-block mb-3"></i>
                    <h4>📱 WhatsApp Desconectado</h4>
                    <p>Escaneie o QR Code abaixo com seu WhatsApp:</p>
                </div>
                
                <div class="qr-code-container mb-3 position-relative">
                    <img src="${qrCodeBase64}" 
                         alt="QR Code WhatsApp" 
                         class="img-fluid border rounded" 
                         style="max-width: 300px;">
                    <div class="position-absolute top-0 end-0 badge bg-secondary">
                        ${countdown}s
                    </div>
                </div>
                
                <div class="alert alert-info text-start">
                    <h6><i class="bi bi-info-circle me-2"></i>Como conectar:</h6>
                    <ol class="mb-0">
                        <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                        <li>Toque em <strong>Mais opções</strong> (⋮) ou <strong>Configurações</strong></li>
                        <li>Selecione <strong>Aparelhos conectados</strong></li>
                        <li>Toque em <strong>Conectar um aparelho</strong></li>
                        <li>Escaneie o <strong>QR Code</strong> acima</li>
                        <li>Aguarde a confirmação da conexão</li>
                    </ol>
                </div>
            `;
        };

        updateQRDisplay();

        AppIntervals.qrRefresh = setInterval(async () => {
            countdown--;

            if (countdown <= 0) {
                UI.showLoading('Atualizando QR Code...');
                try {
                    const response = await fetch(WEBHOOK_URL, { // ✅ Mudado
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'verificar_conexao', // ✅ Adicionado
                            instanceName,
                            instanceAPIKEY
                        })
                    });
                    const data = await response.json();
                    UI.hideLoading();

                    if (data.result === 'open') {
                        this.displayConnectionStatus(data, instanceName, instanceAPIKEY);
                    } else {
                        qrCodeBase64 = data.result;
                        countdown = 30;
                        updateQRDisplay();
                    }
                } catch (error) {
                    UI.hideLoading();
                    countdown = 30;
                    updateQRDisplay();
                }
            } else {
                const badge = statusDiv.querySelector('.badge');
                if (badge) badge.textContent = `${countdown}s`;
            }
        }, 1000);
    },

    displayConnectionError(errorMessage) {
        const statusDiv = document.getElementById('connectionStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-1 text-danger d-block mb-3"></i>
                    <h4>❌ Erro de Conexão</h4>
                    <p class="mb-0">Erro: ${errorMessage}</p>
                </div>
            `;
        }
    }
};

// ========================================
// 17. GERENCIAMENTO DE RELATÓRIOS
// ========================================
const ReportManager = {
    generatePDFReport() {
        if (AppState.sendingDetails.length === 0) {
            UI.showWarning('Não há dados para gerar relatório');
            return;
        }

        // ✅ CORREÇÃO: Usar duração real do disparo
        let reportDuration = 0;

        // Primeiro tentar pegar a duração salva no histórico mais recente
        if (AppState.sendingHistory.length > 0) {
            const latestHistory = AppState.sendingHistory[0]; // O mais recente está no início
            reportDuration = latestHistory.duration || 0;
            console.log('📊 Usando duração do histórico:', Utils.formatTime(reportDuration));
        }

        // Se não tiver no histórico, calcular baseado nos timestamps reais
        if (reportDuration === 0 && AppState.sendingDetails.length > 1) {
            const startTime = AppState.sendingDetails[0]?.datetime;
            const endTime = AppState.sendingDetails[AppState.sendingDetails.length - 1]?.datetime;

            if (startTime && endTime) {
                reportDuration = new Date(endTime) - new Date(startTime);
                console.log('📊 Duração calculada pelos timestamps:', Utils.formatTime(reportDuration));
            }
        }

        // Se ainda for 0, usar um valor mínimo
        if (reportDuration === 0) {
            reportDuration = AppState.sendingDetails.length * 2000; // 2s por mensagem (estimativa)
            console.log('📊 Usando duração estimada:', Utils.formatTime(reportDuration));
        }

        console.log('📊 Gerando relatório:', {
            totalEnvios: AppState.sendingDetails.length,
            duracaoFinal: Utils.formatTime(reportDuration),
            sucessos: AppState.results.success,
            erros: AppState.results.error
        });

        // resto do código permanece igual...
        const instancesUsed = [...new Set(AppState.sendingDetails.map(detail => detail.instance))];
        const instanceStats = {};

        AppState.sendingDetails.forEach(detail => {
            const instanceName = detail.instance || 'Desconhecido';
            if (!instanceStats[instanceName]) {
                instanceStats[instanceName] = { total: 0, success: 0, error: 0 };
            }
            instanceStats[instanceName].total++;
            if (detail.status === 'Sucesso') {
                instanceStats[instanceName].success++;
            } else {
                instanceStats[instanceName].error++;
            }
        });

        const reportData = {
            datetime: new Date().toISOString(),
            instanceName: instancesUsed.length > 1 ? 'Múltiplas Instâncias' : (instancesUsed[0] || 'Desconhecido'),
            instancesUsed: instancesUsed,
            instanceStats: instanceStats,
            totalContacts: AppState.sendingDetails.length,
            successCount: AppState.results.success,
            errorCount: AppState.results.error,
            duration: reportDuration, // ✅ Usar duração corrigida
            details: AppState.sendingDetails.map(detail => ({
                datetime: detail.datetime ? detail.datetime.toISOString() : new Date().toISOString(),
                name: detail.name || 'Sem nome',
                phone: detail.phone || 'Sem telefone',
                email: detail.email || '',
                status: detail.status || 'Desconhecido',
                message: detail.message || 'Sem mensagem',
                instance: detail.instance || 'Desconhecido',
                instanceId: detail.instanceId || null,
                mediaType: detail.mediaType || null,
                sentEmail: detail.sentEmail || false
            }))
        };

        if (reportData.details.length === 0) {
            UI.showError('Erro: Nenhum detalhe de envio encontrado');
            return;
        }

        const encodedData = encodeURIComponent(JSON.stringify(reportData));
        const reportUrl = `relatorio.html?data=${encodedData}`;

        if (reportUrl.length > 2000) {
            sessionStorage.setItem('current_report_data', JSON.stringify(reportData));
            window.open('relatorio.html', '_blank');
        } else {
            window.open(reportUrl, '_blank');
        }

        UI.showSuccess('Relatório aberto em nova aba!');
    }
};

// ========================================
// 18. GERENCIAMENTO DE EXPORT/IMPORT
// ========================================
const DataManager = {
    exportHistoryToExcel() {
        if (AppState.sendingHistory.length === 0) {
            UI.showWarning('Não há histórico para exportar');
            return;
        }

        // ✅ ATUALIZADO: Incluir coluna Instância
        const exportData = [['Data/Hora', 'Instância Geral', 'Total Contatos', 'Sucessos', 'Erros', 'Taxa Sucesso (%)', 'Detalhes dos Envios']];

        AppState.sendingHistory.forEach(entry => {
            exportData.push([
                entry.datetime.toLocaleString('pt-BR'),
                entry.instanceName,
                entry.totalContacts,
                entry.successCount,
                entry.errorCount,
                entry.successRate,
                ''
            ]);

            if (entry.details && entry.details.length > 0) {
                exportData.push(['', '', '', '', '', '', 'DETALHES:']);
                // ✅ ATUALIZADO: Incluir coluna Instância nos detalhes
                exportData.push(['', 'Hora', 'Nome', 'Telefone', 'Instância', 'Status', 'Mensagem']);

                entry.details.forEach(detail => {
                    exportData.push([
                        '',
                        detail.datetime.toLocaleTimeString('pt-BR'),
                        detail.name,
                        detail.phone,
                        detail.instance || 'N/A', // ✅ NOVO: Coluna da instância
                        detail.status,
                        detail.message.length > 50 ? detail.message.substring(0, 50) + '...' : detail.message
                    ]);
                });

                exportData.push(['', '', '', '', '', '', '']);
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);

        // ✅ ATUALIZADO: Ajustar largura das colunas (incluindo nova coluna)
        ws['!cols'] = [
            { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
            { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 40 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Envios');

        const now = new Date();
        const fileName = `historico-disparador-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;

        XLSX.writeFile(wb, fileName);
        UI.showSuccess('Histórico exportado com sucesso!');
    },

    exportContactsToExcel() {
        if (AppState.contacts.length === 0) {
            UI.showWarning('Não há contatos para exportar');
            return;
        }

        // ✅ ATUALIZADO: Incluir coluna de e-mail
        const exportData = [['Nome', 'Telefone', 'E-mail', 'Telefone Formatado', 'Status']];

        AppState.contacts.forEach(contact => {
            exportData.push([
                contact.name,
                contact.phone,
                contact.email || '', // ✅ NOVO: Coluna de e-mail
                PhoneUtils.displayFormattedPhone(contact.phone),
                contact.isValid ? 'Válido' : 'Verificar'
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);

        // ✅ ATUALIZADO: Ajustar largura das colunas
        ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 10 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Lista de Contatos');

        const fileName = `contatos-disparador-${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.writeFile(wb, fileName);
        UI.showSuccess('Lista de contatos exportada!');
    },

    exportBackupData() {
        const backupData = {
            version: APP_CONFIG.version,
            exportDate: new Date().toISOString(),
            history: AppState.sendingHistory,
            contacts: AppState.contacts,
            instances: AppState.instances.map(instance => ({
                ...instance,
                lastCheck: instance.lastCheck.toISOString(),
            })),

            settings: {
                instanceName: document.getElementById('instanceName')?.value || '',
                instanceAPIKEY: document.getElementById('instanceAPIKEY')?.value || '',
                ia: document.getElementById('ia')?.value || '',
                minInterval: document.getElementById('minInterval')?.value || '',
                maxInterval: document.getElementById('maxInterval')?.value || '',
                emailSubject: document.getElementById('emailSubject')?.value || '' // ✅ NOVO
            },


            // ✅ SEMPRE INCLUIR configurações de múltiplas mensagens
            multipleMessages: {
                enabled: true, // ✅ SEMPRE true
                config: {
                    msg1: {
                        enabled: AppState.messagesConfig.msg1.enabled,
                        text: AppState.messagesConfig.msg1.text,
                        media: AppState.messagesConfig.msg1.media
                    },
                    msg2: {
                        enabled: AppState.messagesConfig.msg2.enabled,
                        text: AppState.messagesConfig.msg2.text,
                        media: AppState.messagesConfig.msg2.media
                    },
                    msg3: {
                        enabled: AppState.messagesConfig.msg3.enabled,
                        text: AppState.messagesConfig.msg3.text,
                        media: AppState.messagesConfig.msg3.media
                    }
                }
            },
            scheduledDispatches: AppState.scheduledDispatches.map(dispatch => ({
                ...dispatch,
                scheduledDateTime: dispatch.scheduledDateTime.toISOString(),
                createdAt: dispatch.createdAt.toISOString()
            }))
            // ✅ REMOVIDO: media (modo simples)
        };

        // ✅ REMOVIDO: Toda lógica de backup de mídia do modo simples
        this.downloadBackup(backupData);
    },


    downloadBackup(backupData) {
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `backup-disparador-${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        UI.showSuccess('Backup completo criado com sucesso!');
    },

    importBackupData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);

                    if (!backupData.version || !backupData.exportDate) {
                        throw new Error('Arquivo de backup inválido');
                    }

                    UI.confirm(
                        'Importar Backup',
                        `Deseja importar o backup de ${new Date(backupData.exportDate).toLocaleString('pt-BR')}?<br><br>
                        <strong>Isso substituirá:</strong><br>
                        • Histórico de envios<br>
                        • Lista de contatos<br>
                        • Configurações da instância<br>
                        • Mensagem e mídia salvas`,
                        () => this.restoreBackupData(backupData)
                    );

                } catch (error) {
                    UI.showError('Erro ao ler backup: ' + error.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    },

    async restoreBackupData(backupData) {
        try {
            // Importar histórico
            if (backupData.history && Array.isArray(backupData.history)) {
                AppState.sendingHistory = backupData.history.map(entry => ({
                    ...entry,
                    datetime: new Date(entry.datetime),
                    details: entry.details?.map(detail => ({
                        ...detail,
                        datetime: new Date(detail.datetime),
                        instance: detail.instance || 'Desconhecido',
                        instanceId: detail.instanceId || null
                    })) || []
                }));
                HistoryManager.updateTable();
            }

            // Importar contatos
            if (backupData.contacts && Array.isArray(backupData.contacts)) {
                AppState.contacts = backupData.contacts;
                ContactManager.updateContactsList();
                TimeEstimator.update();
            }

            // ✅ CORREÇÃO: Importar instâncias
            if (backupData.instances && Array.isArray(backupData.instances)) {
                AppState.instances = backupData.instances.map(instance => ({
                    ...instance,
                    lastCheck: new Date(instance.lastCheck || Date.now()),
                    status: 'disconnected',
                    totalSent: instance.totalSent || 0,
                    successCount: instance.successCount || 0,
                    errorCount: instance.errorCount || 0
                }));

                InstanceManager.saveInstances();
                InstanceManager.updateInstancesList();

                setTimeout(() => {
                    if (AppState.instances.length > 0) {
                        UI.confirm(
                            'Verificar Conexões',
                            `${AppState.instances.length} instância(s) foram restauradas.<br><br>Deseja verificar o status de conexão de todas agora?`,
                            () => InstanceManager.recheckAllInstancesAfterRestore(),
                            () => UI.showInfo('Você pode verificar as conexões manualmente mais tarde')
                        );
                    }
                }, 1500);
            }

            // Importar agendamentos
            if (backupData.scheduledDispatches && Array.isArray(backupData.scheduledDispatches)) {
                AppState.scheduledDispatches = backupData.scheduledDispatches.map(dispatch => ({
                    ...dispatch,
                    scheduledDateTime: new Date(dispatch.scheduledDateTime),
                    createdAt: new Date(dispatch.createdAt)
                }));
                ScheduleManager.updateScheduledTable();
            }

            // Importar configurações básicas (SEM mensagem simples)
            if (backupData.settings) {
                const editorReady = await this.initializeRichEditorSafely();
                if (editorReady) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const fields = [
                    'instanceName', 'instanceAPIKEY', 'ia', 'minInterval', 'maxInterval', 'emailSubject'
                ];

                fields.forEach(fieldId => {
                    const element = document.getElementById(fieldId);
                    if (element && backupData.settings[fieldId]) {
                        element.value = backupData.settings[fieldId];
                    }
                });

                TimeEstimator.update();
            }

            // ✅ SEMPRE importar configuração de múltiplas mensagens
            if (backupData.multipleMessages) {
                // Sempre ativar múltiplas mensagens
                AppState.multipleMessagesEnabled = true;
                AppState.messagesConfig = backupData.multipleMessages.config || AppState.messagesConfig;

                // ✅ REMOVER: Código do toggle switch (não existe mais)

                // Verificar se o gerenciador existe antes de usar
                if (typeof MultipleMessagesManager !== 'undefined' &&
                    MultipleMessagesManager.toggleMessageModes) {
                    MultipleMessagesManager.toggleMessageModes();
                    MultipleMessagesManager.updateActiveMessagesInfo();
                }

                // Restaurar textos e mídias das mensagens
                ['msg1', 'msg2', 'msg3'].forEach(msgId => {
                    const config = AppState.messagesConfig[msgId];
                    if (config) {
                        const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
                        const textInput = document.getElementById(`${msgId}-text`);

                        if (enabledCheckbox) enabledCheckbox.checked = config.enabled;
                        if (textInput) textInput.value = config.text || '';

                        // Restaurar mídia de cada mensagem
                        if (config.media && config.media.data) {
                            this.restoreMultipleMessageMedia(msgId, config.media);
                        }
                    }
                });
            } else {
                // ✅ FALLBACK: Se backup antigo, garantir modo múltiplas ativo
                console.log('📦 Backup antigo detectado - ativando modo múltiplas mensagens');
                AppState.multipleMessagesEnabled = true;
                AppState.messagesConfig.msg1.enabled = true;

                if (typeof MultipleMessagesManager !== 'undefined') {
                    MultipleMessagesManager.toggleMessageModes();
                    MultipleMessagesManager.updateActiveMessagesInfo();
                }
            }

            UI.showSuccess('Backup restaurado com sucesso!');

        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            UI.showError('Erro ao restaurar backup: ' + error.message);
        }
    },

    restoreMultipleMessageMedia(msgId, mediaData) {
        try {
            console.log(`📎 Restaurando mídia para ${msgId}:`, {
                filename: mediaData.filename,
                mimetype: mediaData.mimetype,
                hasData: !!mediaData.data
            });

            // ✅ CONVERTER BASE64 PARA BLOB E DEPOIS PARA FILE
            const base64Data = mediaData.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mediaData.mimetype });
            const file = new File([blob], mediaData.filename, { type: mediaData.mimetype });

            // ✅ DEFINIR NO INPUT DE ARQUIVO
            const mediaInput = document.getElementById(`${msgId}-media`);
            if (mediaInput) {
                const fileList = {
                    0: file,
                    length: 1,
                    item: function (index) { return this[index]; }
                };

                Object.defineProperty(mediaInput, 'files', {
                    value: fileList,
                    configurable: true
                });

                // ✅ DISPARAR EVENTO CHANGE PARA ATUALIZAR O INPUT VISUAL
                const changeEvent = new Event('change', { bubbles: true });
                mediaInput.dispatchEvent(changeEvent);

                // ✅ SALVAR NO ESTADO
                AppState.messagesConfig[msgId].media = {
                    filename: mediaData.filename,
                    data: mediaData.data, // Manter base64
                    mimetype: mediaData.mimetype,
                    size: mediaData.size
                };

                // ✅ MOSTRAR PREVIEW APÓS UM DELAY
                setTimeout(() => {
                    MultipleMessagesManager.showMediaPreview(msgId, file);
                    MultipleMessagesManager.updateMainPreview(msgId);
                }, 200);

                console.log(`✅ Mídia de ${msgId} restaurada: ${mediaData.filename}`);
            }

        } catch (error) {
            console.error(`❌ Erro ao restaurar mídia de ${msgId}:`, error);
            UI.showWarning(`Erro ao restaurar mídia da ${msgId}: ${mediaData.filename}`);
        }
    },

    restoreSettings(settings) {
        // ✅ ATUALIZADO: Sem campo 'message'
        const fields = [
            'instanceName', 'instanceAPIKEY', 'ia', 'minInterval', 'maxInterval'
        ];

        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && settings[fieldId]) {
                element.value = settings[fieldId];
            }
        });

        // ✅ REMOVIDO: Toda lógica do editor rico para mensagem simples

        TimeEstimator.update();
    },

    initializeRichEditorSafely() {
        return new Promise((resolve) => {
            // Verificar se o elemento existe
            const editorElement = document.getElementById('richTextEditor');
            if (!editorElement) {
                console.warn('⚠️ Elemento richTextEditor não encontrado');
                resolve(false);
                return;
            }

            // Verificar se já existe uma instância
            if (window.richTextEditor && typeof window.richTextEditor.setValue === 'function') {
                console.log('✅ Editor rico já inicializado');
                resolve(true);
                return;
            }

            // Tentar inicializar
            try {
                if (typeof RichTextEditor !== 'undefined') {
                    window.richTextEditor = new RichTextEditor('richTextEditor');
                    console.log('✅ Editor rico inicializado com sucesso');
                    resolve(true);
                } else {
                    console.warn('⚠️ Classe RichTextEditor não disponível');
                    resolve(false);
                }
            } catch (error) {
                console.error('❌ Erro ao inicializar editor rico:', error);
                resolve(false);
            }
        });
    },

};

// ========================================
// 19. GERENCIAMENTO DE CONFIGURAÇÕES
// ========================================

const SettingsManager = {
    // Manter apenas loadSaved() sem auto-save
    loadSaved() {
        console.log('📄 Carregando configurações salvas...');

        const saved = localStorage.getItem('disparador_settings');
        if (saved) {
            console.log('📄 Configurações antigas encontradas no localStorage');
        }
    },

    // Manter métodos de limpeza para compatibilidade
    clearSavedSettings() {
        UI.confirm(
            'Limpar Dados do Navegador',
            'Deseja limpar todos os dados salvos no navegador?<br><br>' +
            '<strong>Isso irá limpar:</strong><br>' +
            '• Cache do navegador<br>' +
            '• Configurações temporárias<br>' +
            '• Arquivos em cache',
            () => {
                // Limpar localStorage
                localStorage.clear();

                // Limpar sessionStorage
                sessionStorage.clear();

                UI.showSuccess('Dados do navegador limpos com sucesso!');

                // Sugerir recarregar a página
                setTimeout(() => {
                    UI.confirm(
                        'Recarregar Página',
                        'Deseja recarregar a página para aplicar as mudanças?',
                        () => window.location.reload()
                    );
                }, 1000);
            }
        );
    }


};

SettingsManager.clearSessionData = function () {
    UI.confirm(
        'Limpar Dados da Sessão',
        'Deseja limpar todos os dados salvos da sessão atual?<br><br>' +
        '<strong>Isso irá remover:</strong><br>' +
        '• Lista de contatos atual<br>' +
        '• Mensagens configuradas<br>' +
        '• Estatísticas e resultados<br>' +
        '• Histórico recente<br><br>' +
        '<small class="text-warning">Esta ação não pode ser desfeita!</small>',
        () => {
            AutoSaveManager.clearSessionData();

            // Limpar dados da aplicação
            AppState.contacts = [];
            AppState.results = { success: 0, error: 0 };
            AppState.sendingHistory = [];

            if (AppState.messagesConfig) {
                AppState.messagesConfig = {
                    msg1: { enabled: true, text: '', media: null },
                    msg2: { enabled: false, text: '', media: null },
                    msg3: { enabled: false, text: '', media: null }
                };
            }

            // Atualizar interface
            ContactManager.updateContactsList();
            if (typeof SendingManager !== 'undefined') {
                SendingManager.updateStats();
            }
            if (typeof HistoryManager !== 'undefined') {
                HistoryManager.updateTable();
            }

            UI.showSuccess('Dados da sessão limpos com sucesso!');

            // Sugerir recarregar
            setTimeout(() => {
                UI.confirm(
                    'Recarregar Página',
                    'Deseja recarregar a página para garantir que tudo foi limpo?',
                    () => window.location.reload()
                );
            }, 1000);
        }
    );
};

function validateMediaFile() {
    const mediaFile = document.getElementById('mediaFile');
    const preview = document.getElementById('mediaPreview');

    if (!mediaFile || !mediaFile.files || mediaFile.files.length === 0) {
        // Não há arquivo - esconder preview de mídia
        if (preview) {
            preview.style.display = 'none';
        }
        return false;
    }

    const file = mediaFile.files[0];
    if (!file || file.size === 0) {
        // Arquivo inválido - esconder preview
        if (preview) {
            preview.style.display = 'none';
        }
        return false;
    }

    return true;
}


// ========================================
// 26. GERENCIAMENTO DE MÚLTIPLAS INSTÂNCIAS
// ========================================

const InstanceManager = {

    isInitialized: false,

    initialize() {
        console.log('🔧 Inicializando InstanceManager corrigido...');

        this.loadInstances();
        this.updateInstancesList();

        // Verificação automática periódica (reduzida para evitar spam)
        setInterval(() => {
            if (AppState.instances.length > 0 && !AppState.sendingInProgress) {
                this.autoCheckConnections();
            }
        }, 10 * 60 * 1000); // A cada 10 minutos (em vez de 5)

        // Aguardar o DOM estar pronto e configurar eventos
        setTimeout(() => {
            const addInstanceBtn = document.getElementById('addInstanceBtn');
            // if (addInstanceBtn) {
            //     addInstanceBtn.addEventListener('click', () => this.addInstance());
            // }

            if (addInstanceBtn) {
                // ✅ CORREÇÃO: Usar referência armazenada para poder remover corretamente
                if (this.addInstanceHandler) {
                    addInstanceBtn.removeEventListener('click', this.addInstanceHandler);
                }
                this.addInstanceHandler = () => this.addInstance();
                addInstanceBtn.addEventListener('click', this.addInstanceHandler);
            }

            // Event delegation para os botões dos cards de instância
            document.addEventListener('click', (e) => {
                const instanceButton = e.target.closest('.check-connection-btn, .show-qr-btn, .edit-instance-btn, .remove-instance-btn, .export-contacts-btn');

                if (instanceButton) {
                    e.preventDefault();
                    e.stopPropagation();

                    const instanceId = parseInt(instanceButton.dataset.instanceId);
                    if (!instanceId) return;

                    if (instanceButton.classList.contains('check-connection-btn')) {
                        this.checkConnection(instanceId);
                    } else if (instanceButton.classList.contains('show-qr-btn')) {
                        this.showConnectionModal(instanceId);
                    } else if (instanceButton.classList.contains('edit-instance-btn')) {
                        this.editInstance(instanceId);
                    } else if (instanceButton.classList.contains('remove-instance-btn')) {
                        this.removeInstance(instanceId);
                    } else if (instanceButton.classList.contains('export-contacts-btn')) {
                        if (typeof InstanceContactsExporter !== 'undefined') {
                            InstanceContactsExporter.exportInstanceContacts(instanceId);
                        }
                    }
                }
            });
        }, 100);

        // ✅ Marcar como inicializado
        this.isInitialized = true;
    },

    loadInstances() {
        const saved = localStorage.getItem('disparador_instances');

        console.log('📖 Carregando instâncias do localStorage:', {
            hasData: !!saved,
            dataLength: saved ? saved.length : 0
        });

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                AppState.instances = parsed.map(instance => ({
                    ...instance,
                    lastCheck: new Date(instance.lastCheck)
                }));

                console.log('✅ Instâncias carregadas:', {
                    count: AppState.instances.length,
                    instances: AppState.instances.map(i => ({ id: i.id, name: i.name }))
                });

            } catch (error) {
                console.warn('❌ Erro ao carregar instâncias salvas:', error);
                AppState.instances = [];
                // ✅ LIMPAR localStorage corrompido
                localStorage.removeItem('disparador_instances');
            }
        } else {
            AppState.instances = [];
            console.log('📱 Nenhuma instância salva encontrada');
        }
    },

    updateInstancesList() {
        const instancesList = document.getElementById('instancesList');
        if (!instancesList) {
            console.warn('⚠️ Elemento instancesList não encontrado');
            return;
        }

        if (AppState.instances.length === 0) {
            instancesList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-server fs-3 d-block mb-2"></i>
                    Nenhuma instância cadastrada
                </div>
            `;
            return;
        }

        instancesList.innerHTML = AppState.instances.map(instance => `
            <div class="col-md-6 col-lg-3 mb-3">
                <div class="card instance-card ${instance.status}" style="position: relative;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">${instance.name}</h6>
                            <span class="badge status-badge ${this.getStatusBadgeClass(instance.status)}">
                                ${this.getStatusText(instance.status)}
                            </span>
                        </div>
                        
                        <p class="card-text small text-muted mb-2">
                            <i class="bi bi-key me-1"></i>
                            APIKEY: ••••${instance.apikey.slice(-4)}
                        </p>
                        
                        <div class="row text-center mb-3">
                            <div class="col-4">
                                <small class="text-muted">Total</small>
                                <div class="fw-bold">${instance.totalSent || 0}</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Sucesso</small>
                                <div class="fw-bold text-success">${instance.successCount || 0}</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Erro</small>
                                <div class="fw-bold text-danger">${instance.errorCount || 0}</div>
                            </div>
                        </div>
                        
                        <div class="instance-actions">
                            <button class="btn btn-outline-primary btn-sm check-connection-btn" 
                                    data-instance-id="${instance.id}"
                                    title="Verificar conexão">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            
                            ${instance.status === 'connected' ? `
                                <button class="btn btn-outline-success btn-sm export-contacts-btn" 
                                        data-instance-id="${instance.id}"
                                        title="Importar/Exportar contatos WhatsApp">
                                    <i class="bi bi-people"></i>
                                </button>
                            ` : ''}
                            
                            ${instance.status === 'disconnected' ? `
                                <button class="btn btn-outline-warning btn-sm show-qr-btn" 
                                        data-instance-id="${instance.id}"
                                        title="Conectar">
                                    <i class="bi bi-qr-code"></i>
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-outline-danger btn-sm remove-instance-btn" 
                                    data-instance-id="${instance.id}"
                                    title="Remover">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        
                        <small class="text-muted">
                            Última verificação: ${Utils.safeFormatTime(instance.lastCheck)}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');

        // Organizar em grid
        instancesList.innerHTML = `<div class="row">${instancesList.innerHTML}</div>`;

        this.updateActiveInstances();
    },

    updateActiveInstances() {
        AppState.activeInstances = AppState.instances.filter(inst => inst.status === 'connected');

        const activeCount = document.getElementById('activeInstancesCount');
        if (activeCount) {
            activeCount.textContent = AppState.activeInstances.length;
        }
    },

    getRandomActiveInstance() {
        this.updateActiveInstances();

        if (AppState.activeInstances.length === 0) {
            console.warn('⚠️ Nenhuma instância ativa disponível');
            return null;
        }

        const randomIndex = Math.floor(Math.random() * AppState.activeInstances.length);
        const selectedInstance = AppState.activeInstances[randomIndex];

        console.log(`🔄 Instância selecionada: ${selectedInstance.name} (${randomIndex + 1}/${AppState.activeInstances.length})`);

        return selectedInstance;
    },

    updateInstanceStats(instanceId, success = true) {
        const instance = AppState.instances.find(inst => inst.id === instanceId);
        if (!instance) return;

        instance.totalSent = (instance.totalSent || 0) + 1;

        if (success) {
            instance.successCount = (instance.successCount || 0) + 1;
        } else {
            instance.errorCount = (instance.errorCount || 0) + 1;
        }

        this.saveInstances();
        this.updateInstancesList();
    },

    saveInstances() {
        try {
            const dataToSave = AppState.instances.map(instance => ({
                ...instance,
                lastCheck: instance.lastCheck.toISOString()
            }));

            console.log('💾 Salvando instâncias:', {
                count: dataToSave.length,
                instances: dataToSave.map(i => ({ id: i.id, name: i.name }))
            });

            localStorage.setItem('disparador_instances', JSON.stringify(dataToSave));

            // ✅ VERIFICAÇÃO: Confirmar que foi salvo
            const saved = localStorage.getItem('disparador_instances');
            const parsed = JSON.parse(saved);

            console.log('✅ Confirmação do salvamento:', {
                savedCount: parsed.length,
                matchesState: parsed.length === AppState.instances.length
            });

        } catch (error) {
            console.error('❌ Erro ao salvar instâncias:', error);
            UI.showError('Erro ao salvar alterações das instâncias');
        }
    },

    getStatusBadgeClass(status) {
        switch (status) {
            case 'connected': return 'bg-success';
            case 'disconnected': return 'bg-warning';
            case 'connecting': return 'bg-info';
            case 'error': return 'bg-danger';
            default: return 'bg-secondary';
        }
    },

    getStatusText(status) {
        switch (status) {
            case 'connected': return 'Conectado';
            case 'disconnected': return 'Desconectado';
            case 'connecting': return 'Conectando...';
            case 'error': return 'Erro';
            default: return 'Desconhecido';
        }
    },

    async addInstance() {
        const nameInput = document.getElementById('newInstanceName');
        const apikeyInput = document.getElementById('newInstanceAPIKEY');

        const name = nameInput?.value?.trim();
        const apikey = apikeyInput?.value?.trim();

        if (!name || !apikey) {
            UI.showError('Preencha nome e APIKEY da instância');
            return;
        }

        if (AppState.instances.find(inst => inst.name === name)) {
            UI.showError('Já existe uma instância com este nome');
            return;
        }

        UI.showLoading('Verificando conexão da instância...');

        try {
            const connectionStatus = await this.checkInstanceConnectionWithLicense(name, apikey);

            const newInstance = {
                id: Date.now(),
                name: name,
                apikey: apikey,
                status: connectionStatus.status,
                qrCode: connectionStatus.qrCode || null,
                lastCheck: new Date(),
                totalSent: 0,
                successCount: 0,
                errorCount: 0
            };

            AppState.instances.push(newInstance);
            this.saveInstances();
            this.updateInstancesList();

            nameInput.value = '';
            apikeyInput.value = '';

            const collapse = bootstrap.Collapse.getInstance(document.getElementById('instanceForm'));
            if (collapse) collapse.hide();

            UI.hideLoading();

            if (connectionStatus.status === 'connected') {
                UI.showSuccess(`Instância "${name}" conectada com sucesso!`);
                this.updateActiveInstances();
            } else if (connectionStatus.status === 'disconnected') {
                UI.showWarning(`Instância "${name}" adicionada, mas está desconectada`);
                this.showConnectionModal(newInstance);
            } else {
                UI.showError(`Problema ao adicionar instância "${name}": ${connectionStatus.message || 'Erro desconhecido'}`);
            }

        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro detalhado ao verificar instância:', error);
            UI.showError('Erro ao verificar instância: ' + error.message);
        }
    },

    async checkInstanceConnectionWithLicense(instanceName, instanceAPIKEY) {
        try {
            console.log('🔒 Verificando instância:', {
                instanceName
            });

            const payload = {
                action: 'verificar_conexao',
                instanceName: instanceName,
                instanceAPIKEY: instanceAPIKEY
            };

            console.log('📡 Enviando payload para verificação:', {
                action: payload.action,
                instanceName: payload.instanceName
            });

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('📥 Response recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const responseText = await response.text();
            console.log('📄 Response text:', responseText);

            if (!responseText || responseText.trim() === '') {
                console.error('❌ Resposta vazia do servidor');
                return {
                    status: 'error',
                    message: 'Servidor retornou resposta vazia'
                };
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ Erro ao fazer parse da resposta:', parseError);
                return {
                    status: 'error',
                    message: 'Resposta inválida do servidor'
                };
            }

            console.log('📊 Dados processados:', data);

            if (data.result === 'error') {
                return { status: 'error', message: data.message || 'Instância não encontrada' };
            }

            if (data.result === 'open') {
                return { status: 'connected' };
            }

            if (data.result && data.result.startsWith('data:image')) {
                return { status: 'disconnected', qrCode: data.result };
            }

            return { status: 'disconnected', message: 'Status desconhecido da instância' };

        } catch (error) {
            console.error('❌ Erro na verificação da instância:', error);

            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                return {
                    status: 'error',
                    message: 'Erro de conectividade - verifique se o webhook está acessível'
                };
            }

            return { status: 'error', message: error.message || 'Erro desconhecido ao verificar instância' };
        }
    },

    async checkConnection(instanceId) {
        const instance = AppState.instances.find(inst => inst.id === instanceId);
        if (!instance) return;

        UI.showLoading('Verificando conexão...');

        try {
            const connectionStatus = await this.checkInstanceConnectionWithLicense(instance.name, instance.apikey);

            instance.status = connectionStatus.status;
            instance.qrCode = connectionStatus.qrCode || null;
            instance.lastCheck = new Date();

            this.saveInstances();
            this.updateInstancesList();

            UI.hideLoading();

            if (connectionStatus.status === 'connected') {
                UI.showSuccess(`Instância "${instance.name}" está conectada!`);
            } else if (connectionStatus.status === 'disconnected') {
                UI.showWarning(`Instância "${instance.name}" está desconectada`);
                if (connectionStatus.qrCode) {
                    this.showConnectionModal(instance);
                }
            } else {
                UI.showError(`Erro na instância "${instance.name}": ${connectionStatus.message || 'Erro desconhecido'}`);
            }
        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro ao verificar conexão:', error);
            UI.showError('Erro ao verificar conexão: ' + error.message);
        }
    },

    showConnectionModal(instanceData) {
        const instance = typeof instanceData === 'number' ?
            AppState.instances.find(inst => inst.id === instanceData) : instanceData;

        if (!instance) return;

        const modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal')) ||
            new bootstrap.Modal(document.getElementById('connectionModal'));

        const modalTitle = document.querySelector('#connectionModal .modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="bi bi-whatsapp me-2"></i>Conectar - ${instance.name}`;
        }

        modal.show();

        // ✅ NOVO: Usar função específica que inclui licença
        this.performConnectionCheckForInstance(instance);
    },

    async performConnectionCheckForInstance(instance) {
        try {
            console.log('🔒 Verificando conexão da instância (sem licença):', {
                instanceName: instance.name
            });

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    action: 'verificar_conexao',
                    instanceName: instance.name,
                    instanceAPIKEY: instance.apikey
                })
            });

            console.log('📥 Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const responseText = await response.text();

            if (!responseText || responseText.trim() === '') {
                ConnectionManager.displayConnectionError('Servidor retornou resposta vazia');
                return;
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ Erro ao fazer parse:', parseError);
                ConnectionManager.displayConnectionError('Resposta inválida do servidor');
                return;
            }

            // ✅ USAR DISPLAY SEM VALIDAÇÃO DE LICENÇA
            ConnectionManager.displayConnectionStatus(data, instance.name, instance.apikey);

        } catch (error) {
            console.error('❌ Erro ao verificar conexão:', error);
            ConnectionManager.displayConnectionError(error.message);
        }
    },

    removeInstance(instanceId) {
        const instance = AppState.instances.find(inst => inst.id === instanceId);
        if (!instance) return;

        UI.confirm(
            'Remover Instância',
            `Tem certeza que deseja remover a instância "${instance.name}"?`,
            () => {
                console.log('🗑️ Removendo instância:', {
                    id: instanceId,
                    name: instance.name,
                    beforeCount: AppState.instances.length
                });

                // ✅ CORREÇÃO 1: Remover do array global
                AppState.instances = AppState.instances.filter(inst => inst.id !== instanceId);

                console.log('📊 Após remoção:', {
                    afterCount: AppState.instances.length,
                    remainingInstances: AppState.instances.map(i => ({ id: i.id, name: i.name }))
                });

                // ✅ CORREÇÃO 2: Forçar salvamento imediato
                this.saveInstances();

                // ✅ CORREÇÃO 3: Verificar se foi salvo corretamente
                const savedData = localStorage.getItem('disparador_instances');
                console.log('💾 Dados salvos no localStorage:', savedData);

                // ✅ CORREÇÃO 4: Atualizar interface imediatamente
                this.updateInstancesList();
                this.updateActiveInstances();

                // ✅ CORREÇÃO 5: Verificar se foi removida das instâncias ativas
                const activeInstance = AppState.activeInstances.find(inst => inst.id === instanceId);
                if (activeInstance) {
                    console.warn('⚠️ Instância ainda estava nas ativas, removendo...');
                    AppState.activeInstances = AppState.activeInstances.filter(inst => inst.id !== instanceId);
                }

                UI.showSuccess(`Instância "${instance.name}" removida`);

                // ✅ CORREÇÃO 6: Log para debug
                console.log('✅ Remoção concluída:', {
                    totalInstances: AppState.instances.length,
                    activeInstances: AppState.activeInstances.length
                });
            }
        );
    },

    editInstance(instanceId) {
        const instance = AppState.instances.find(inst => inst.id === instanceId);
        if (!instance) return;

        const newName = prompt('Novo nome da instância:', instance.name);
        if (newName && newName.trim() && newName !== instance.name) {
            instance.name = newName.trim();
            this.saveInstances();
            this.updateInstancesList();
            UI.showSuccess('Nome da instância atualizado');
        }
    },

    async autoCheckConnections() {
        if (AppState.instances.length === 0) return;

        console.log('🔄 Verificação automática de instâncias...');

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const instancesToCheck = AppState.instances.filter(instance =>
            instance.lastCheck < fifteenMinutesAgo
        );

        if (instancesToCheck.length === 0) {
            console.log('📱 Todas as instâncias foram verificadas recentemente');
            return;
        }

        for (const instance of instancesToCheck) {
            try {
                // ✅ CHAMAR FUNÇÃO SEM VALIDAÇÃO DE LICENÇA
                const connectionStatus = await this.checkInstanceConnectionWithLicense(instance.name, instance.apikey);

                if (instance.status !== connectionStatus.status) {
                    console.log(`📡 Status da instância ${instance.name}: ${instance.status} → ${connectionStatus.status}`);
                    instance.status = connectionStatus.status;
                }

                instance.lastCheck = new Date();
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.warn(`⚠️ Erro ao verificar ${instance.name}:`, error);
                instance.status = 'error';
                instance.lastCheck = new Date();
            }
        }

        this.saveInstances();
        this.updateInstancesList();

        console.log(`✅ Verificação automática concluída (${instancesToCheck.length} instâncias)`);
    },

    async recheckAllInstancesAfterRestore() {
        if (AppState.instances.length === 0) return;

        UI.showLoading('Verificando conexão das instâncias restauradas...');

        for (const instance of AppState.instances) {
            try {
                const connectionStatus = await this.checkInstanceConnectionWithLicense(instance.name, instance.apikey);
                instance.status = connectionStatus.status;
                instance.qrCode = connectionStatus.qrCode || null;
                instance.lastCheck = new Date();
            } catch (error) {
                instance.status = 'error';
            }

            await Utils.sleep(2000); // Pausa entre verificações
        }

        this.saveInstances();
        this.updateInstancesList();
        UI.hideLoading();

        const connectedCount = AppState.instances.filter(i => i.status === 'connected').length;

        if (connectedCount > 0) {
            UI.showSuccess(`${connectedCount} instância(s) conectada(s) e pronta(s) para uso!`);
        } else {
            UI.showWarning('Nenhuma instância está conectada. Verifique as conexões manualmente.');
        }
    }
};

const ConnectionManagerWithLicense = {
    async checkConnection() {
        // Verificar se há licença válida
        const licenseInfo = AuthManager.getLicenseInfo();
        if (!licenseInfo.isValid) {
            UI.showError('Licença inválida! Não é possível verificar conexão.');
            return;
        }

        const validation = Validators.instanceData();
        if (!validation.valid) {
            UI.showError('Preencha o nome da instância e a APIKEY primeiro');
            return;
        }

        let modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal'));
        if (!modal) {
            modal = new bootstrap.Modal(document.getElementById('connectionModal'));
        }

        this.resetConnectionModal();
        modal.show();

        await this.performConnectionCheckWithLicense(validation.instanceName, validation.instanceAPIKEY);
    },

    async performConnectionCheckWithLicense(instanceName, instanceAPIKEY) {
        try {
            const licenseInfo = AuthManager.getLicenseInfo();
            if (!licenseInfo.isValid) {
                this.displayConnectionError('Licença inválida');
                return;
            }

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verificar_conexao', // ✅ Action correta
                    instanceName,
                    instanceAPIKEY,
                    licenseEmail: licenseInfo.email,
                    licenseKey: licenseInfo.licenseKey
                })
            });

            const responseText = await response.text();

            if (!responseText || responseText.trim() === '') {
                this.displayConnectionError('Servidor retornou resposta vazia');
                return;
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                this.displayConnectionError('Resposta inválida do servidor');
                return;
            }

            this.displayConnectionStatusWithLicense(data, instanceName, instanceAPIKEY);

        } catch (error) {
            this.displayConnectionError(error.message);
        }
    },

    displayConnectionStatusWithLicense(data, instanceName, instanceAPIKEY) {
        const statusDiv = document.getElementById('connectionStatus');
        const recheckBtn = document.getElementById('recheckConnection');

        AppIntervals.clear('qrRefresh');

        if (!statusDiv) return;

        if (data.result === 'license_invalid') {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-shield-x fs-1 text-danger d-block mb-3"></i>
                    <h4>🔒 Licença Inválida!</h4>
                    <p class="mb-0">Sua licença está inativa ou expirada.</p>
                </div>
            `;
            if (recheckBtn) recheckBtn.style.display = 'none';
            return;
        }

        if (data.result === 'error') {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-x-circle-fill fs-1 text-danger d-block mb-3"></i>
                    <h4>⚠️ Instância não encontrada!</h4>
                    <p class="mb-0">Verifique se as informações estão corretas.</p>
                </div>
            `;
            if (recheckBtn) recheckBtn.style.display = 'inline-block';
            return;
        }

        if (data.result === 'open') {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill fs-1 text-success d-block mb-3"></i>
                    <h4>✅ WhatsApp Conectado!</h4>
                    <p class="mb-0">Sua instância está conectada e pronta para enviar mensagens.</p>
                </div>
            `;
            if (recheckBtn) recheckBtn.style.display = 'none';
        } else {
            this.displayQRCodeWithLicense(data.result, instanceName, instanceAPIKEY);
            if (recheckBtn) recheckBtn.style.display = 'inline-block';
        }
    },

    displayQRCodeWithLicense(qrCodeBase64, instanceName, instanceAPIKEY) {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;

        let countdown = 30;

        const updateQRDisplay = () => {
            statusDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle-fill fs-1 text-warning d-block mb-3"></i>
                <h4>📱 WhatsApp Desconectado</h4>
                <p>Escaneie o QR Code abaixo com seu WhatsApp:</p>
            </div>
            
            <div class="qr-code-container mb-3 position-relative">
                <img src="${qrCodeBase64}" 
                     alt="QR Code WhatsApp" 
                     class="img-fluid border rounded" 
                     style="max-width: 300px;">
                <div class="position-absolute top-0 end-0 badge bg-secondary">
                    ${countdown}s
                </div>
            </div>
            
            <div class="alert alert-info text-start">
                <h6><i class="bi bi-info-circle me-2"></i>Como conectar:</h6>
                <ol class="mb-0">
                    <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                    <li>Toque em <strong>Mais opções</strong> (⋮) ou <strong>Configurações</strong></li>
                    <li>Selecione <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Escaneie o <strong>QR Code</strong> acima</li>
                    <li>Aguarde a confirmação da conexão</li>
                </ol>
            </div>
        `;
        };

        updateQRDisplay();

        AppIntervals.qrRefresh = setInterval(async () => {
            countdown--;

            if (countdown <= 0) {
                UI.showLoading('Atualizando QR Code...');
                try {
                    // ✅ NOVO: Obter dados de licença para atualização do QR
                    const licenseInfo = AuthManager.getLicenseInfo();
                    if (!licenseInfo.isValid) {
                        UI.hideLoading();
                        this.displayConnectionError('Licença inválida durante atualização do QR Code');
                        return;
                    }

                    console.log('🔄 Atualizando QR Code com licença:', {
                        instanceName,
                        licenseEmail: licenseInfo.email
                    });

                    const response = await fetch(WEBHOOK_URL, { // ✅ Usar WEBHOOK_URL
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'verificar_conexao', // ✅ Mesma action
                            instanceName,
                            instanceAPIKEY,
                            licenseEmail: licenseInfo.email,
                            licenseKey: licenseInfo.licenseKey
                        })
                    });

                    const responseText = await response.text();
                    UI.hideLoading();

                    if (!responseText || responseText.trim() === '') {
                        countdown = 30;
                        updateQRDisplay();
                        return;
                    }

                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('❌ Erro ao fazer parse da resposta do QR:', parseError);
                        countdown = 30;
                        updateQRDisplay();
                        return;
                    }

                    if (data.result === 'open') {
                        this.displayConnectionStatusWithLicense(data, instanceName, instanceAPIKEY);
                    } else if (data.result && data.result.startsWith('data:image')) {
                        qrCodeBase64 = data.result;
                        countdown = 30;
                        updateQRDisplay();
                    } else {
                        console.warn('⚠️ Resposta inesperada na atualização do QR:', data);
                        countdown = 30;
                        updateQRDisplay();
                    }
                } catch (error) {
                    UI.hideLoading();
                    console.error('❌ Erro ao atualizar QR Code:', error);
                    countdown = 30;
                    updateQRDisplay();
                }
            } else {
                const badge = statusDiv.querySelector('.badge');
                if (badge) badge.textContent = `${countdown}s`;
            }
        }, 1000);
    },



    resetConnectionModal() {
        const statusDiv = document.getElementById('connectionStatus');
        const recheckBtn = document.getElementById('recheckConnection');

        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Verificando...</span>
                </div>
                <p class="mt-2">Verificando status da conexão e licença...</p>
            `;
        }

        if (recheckBtn) {
            recheckBtn.style.display = 'none';
        }
    },

    displayConnectionError(errorMessage) {
        const statusDiv = document.getElementById('connectionStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-1 text-danger d-block mb-3"></i>
                    <h4>❌ Erro de Conexão</h4>
                    <p class="mb-0">Erro: ${errorMessage}</p>
                </div>
            `;
        }
    }
};

// ✅ Sobrescrever ConnectionManager original
Object.assign(ConnectionManager, ConnectionManagerWithLicense);

console.log('✅ InstanceManager corrigido carregado com sistema de licença!');

// ========================================
// 19B. GERENCIAMENTO DE MÚLTIPLAS MENSAGENS
// ========================================
const MultipleMessagesManager = {
    initialize() {
        console.log('🔧 Inicializando MultipleMessagesManager...');

        //Flag para evitar verificações múltiplas
        _isUpdatingCount: false,

            // Sempre ativar modo múltiplas mensagens
            AppState.multipleMessagesEnabled = true;

        // Garantir que msg1 sempre está ativada
        AppState.messagesConfig.msg1.enabled = true;

        // ✅ DEBUG: Verificar se elementos existem
        const multipleMode = document.getElementById('multipleMessagesMode');
        const previewContainer = document.getElementById('previewContainer');
        const previewContent = document.getElementById('previewContent');

        console.log('🔍 Elementos encontrados:', {
            multipleMode: !!multipleMode,
            previewContainer: !!previewContainer,
            previewContent: !!previewContent
        });

        // Event listeners para as abas
        this.setupTabListeners();

        // Event listeners para os campos de mensagem
        this.setupMessageListeners();

        // Mostrar modo múltiplas
        this.toggleMessageModes();

        // Inicializar estado
        this.updateActiveMessagesInfo();
    },

    // ✅ SUBSTITUIR função toggleMessageModes completa
    toggleMessageModes() {
        // Sempre ativar modo múltiplas mensagens
        const multipleMode = document.getElementById('multipleMessagesMode');
        const previewContainer = document.getElementById('previewContainer');

        if (multipleMode) {
            multipleMode.style.display = 'block';
            console.log('✅ Modo múltiplas mensagens ativado');
        }

        if (previewContainer) {
            previewContainer.style.display = 'block';
            console.log('✅ Preview container ativado');
        }

        // Atualizar preview da primeira mensagem
        setTimeout(() => {
            console.log('🔄 Atualizando preview inicial...');
            this.updateMainPreview('msg1');
        }, 100);

        this.updateActiveMessagesInfo();
    },

    setupTabListeners() {
        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            const tab = document.getElementById(`${msgId}-tab`);
            if (tab) {
                tab.addEventListener('click', () => {
                    setTimeout(() => this.updateMainPreview(msgId), 100);
                });
            }
        });
    },

    setupMediaEvents(msgId) {
        // Radio buttons para tipo de mídia
        const fileRadio = document.getElementById(`${msgId}-media-file`);
        const urlRadio = document.getElementById(`${msgId}-media-url`);
        const fileContainer = document.getElementById(`${msgId}-file-container`);
        const urlContainer = document.getElementById(`${msgId}-url-container`);

        // Input de arquivo
        const fileInput = document.getElementById(`${msgId}-media`);

        // Input de URL
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const testUrlBtn = document.getElementById(`${msgId}-test-url`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (fileRadio && urlRadio) {
            // Toggle entre arquivo e URL
            fileRadio.addEventListener('change', () => {
                if (fileRadio.checked) {
                    fileContainer.style.display = 'block';
                    urlContainer.style.display = 'none';
                    this.clearMediaUrl(msgId);
                }
            });

            urlRadio.addEventListener('change', () => {
                if (urlRadio.checked) {
                    fileContainer.style.display = 'none';
                    urlContainer.style.display = 'block';
                    this.clearMediaFile(msgId);
                }
            });
        }

        // Event listener para arquivo local (mantém o existente)
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleMediaChange(msgId, e.target.files[0]);
            });
        }

        // Event listeners para URL
        if (urlInput) {
            urlInput.addEventListener('input', () => {
                this.validateMediaUrl(msgId, urlInput.value);
            });

            urlInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.validateMediaUrl(msgId, e.target.value);
                }, 100);
            });
        }

        if (testUrlBtn) {
            testUrlBtn.addEventListener('click', () => {
                this.testMediaUrl(msgId);
            });
        }
    },

    // Validar URL de mídia
    validateMediaUrl(msgId, url) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (!url || !url.trim()) {
            urlPreview.style.display = 'none';
            AppState.messagesConfig[msgId].media = null;
            this.updateActiveMessagesInfo();
            return;
        }

        // Validação básica de URL
        try {
            new URL(url);
        } catch (error) {
            this.showUrlValidation(msgId, false, 'URL inválida');
            return;
        }

        // Verificar se é um tipo de arquivo suportado
        const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf'];
        const urlLower = url.toLowerCase();
        const isSupported = supportedExtensions.some(ext => urlLower.includes(ext));

        if (!isSupported) {
            this.showUrlValidation(msgId, false, 'Tipo de arquivo não detectado');
        } else {
            this.showUrlValidation(msgId, true, 'URL válida');
            this.previewMediaUrl(msgId, url);
        }
    },

    // Mostrar resultado da validação
    showUrlValidation(msgId, isValid, message) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);

        // Remover classes anteriores
        urlInput.classList.remove('is-valid', 'is-invalid');

        // Adicionar nova classe
        urlInput.classList.add(isValid ? 'is-valid' : 'is-invalid');

        // Mostrar feedback
        let feedback = urlInput.parentNode.querySelector('.url-validation-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'url-validation-feedback mt-1';
            urlInput.parentNode.appendChild(feedback);
        }

        feedback.className = `url-validation-feedback mt-1 ${isValid ? 'url-validation-success' : 'url-validation-error'}`;
        feedback.textContent = message;
    },

    // Preview da URL
    previewMediaUrl(msgId, url) {
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (!urlPreview || !urlPreviewContent) return;

        // Detectar tipo de mídia pela URL
        const urlLower = url.toLowerCase();
        let previewHTML = '';

        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif')) {
            previewHTML = `
            <img src="${url}" class="url-preview-image me-2" alt="Preview" 
                 onload="this.style.display='block'" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div style="display: none;">
                <i class="bi bi-image url-preview-icon text-primary"></i>
                <span>Imagem: ${this.getFileName(url)}</span>
            </div>
        `;
        } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
            previewHTML = `
            <i class="bi bi-play-circle url-preview-icon text-primary"></i>
            <div>
                <strong>Vídeo:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else if (urlLower.includes('.mp3') || urlLower.includes('.wav') || urlLower.includes('.ogg')) {
            previewHTML = `
            <i class="bi bi-music-note url-preview-icon text-success"></i>
            <div>
                <strong>Áudio:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else if (urlLower.includes('.pdf')) {
            previewHTML = `
            <i class="bi bi-file-pdf url-preview-icon text-danger"></i>
            <div>
                <strong>PDF:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else {
            previewHTML = `
            <i class="bi bi-link-45deg url-preview-icon text-secondary"></i>
            <div>
                <strong>Arquivo:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        }

        urlPreviewContent.innerHTML = previewHTML;
        urlPreview.style.display = 'block';

        // Salvar no estado
        AppState.messagesConfig[msgId].media = {
            type: 'url',
            url: url,
            filename: this.getFileName(url),
            mimetype: this.getMimeTypeFromUrl(url)
        };

        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    // Testar URL
    async testMediaUrl(msgId) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const url = urlInput.value.trim();

        if (!url) {
            UI.showWarning('Digite uma URL primeiro');
            return;
        }

        UI.showLoading('Testando URL...');

        try {
            const response = await fetch(url, { method: 'HEAD' });
            UI.hideLoading();

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');

                let sizeText = '';
                if (contentLength) {
                    const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(1);
                    sizeText = ` (${sizeMB}MB)`;
                }

                UI.showSuccess(`✅ URL acessível! Tipo: ${contentType || 'Desconhecido'}${sizeText}`);
                this.previewMediaUrl(msgId, url);
            } else {
                UI.showError(`❌ URL não acessível (${response.status})`);
            }
        } catch (error) {
            UI.hideLoading();
            UI.showError('❌ Erro ao acessar URL: ' + error.message);
        }
    },

    // Limpar URL
    clearMediaUrl(msgId) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);

        if (urlInput) urlInput.value = '';
        if (urlPreview) urlPreview.style.display = 'none';

        AppState.messagesConfig[msgId].media = null;
        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    // Limpar arquivo
    clearMediaFile(msgId) {
        const fileInput = document.getElementById(`${msgId}-media`);
        const filePreview = document.getElementById(`${msgId}-media-preview`);

        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';

        AppState.messagesConfig[msgId].media = null;
        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    // Utilitários
    getFileName(url) {
        try {
            return url.split('/').pop().split('?')[0] || 'arquivo';
        } catch (error) {
            return 'arquivo';
        }
    },

    getMimeTypeFromUrl(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
        if (urlLower.includes('.png')) return 'image/png';
        if (urlLower.includes('.gif')) return 'image/gif';
        if (urlLower.includes('.mp4')) return 'video/mp4';
        if (urlLower.includes('.mp3')) return 'audio/mpeg';
        if (urlLower.includes('.wav')) return 'audio/wav';
        if (urlLower.includes('.pdf')) return 'application/pdf';
        return 'application/octet-stream';
    },

    setupMessageListeners() {
        // ✅ Criar versão debounced da função de atualização
        const debouncedUpdate = this.debounce(() => {
            this.updateActiveMessagesInfo();
        }, 300);

        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            // Checkbox de ativação
            const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', (e) => {
                    AppState.messagesConfig[msgId].enabled = e.target.checked;
                    debouncedUpdate();
                    this.updateMessageStatus(msgId);
                    this.updateMainPreview(msgId);
                });
            }

            // Campo de texto com editor rico
            const textInput = document.getElementById(`${msgId}-text`);
            if (textInput) {
                textInput.addEventListener('input', (e) => {
                    AppState.messagesConfig[msgId].text = e.target.value;
                    debouncedUpdate();
                    this.updateMainPreview(msgId);
                    this.updateMessageStatus(msgId);
                    this.updateCharCounter(msgId);
                });
            }

            // ✅ NOVO: Configurar eventos de mídia
            this.setupMediaEvents(msgId);

            // Inicializar editor rico para cada mensagem
            this.initializeRichTextEditor(msgId);
        });
    },


    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // ✅ NOVA FUNÇÃO PARA VERIFICAR DURAÇÃO DO VÍDEO

    async handleMediaChange(msgId, file) {
        if (file) {
            console.log('📎 Processando arquivo para:', msgId, file.name, file.type);

            // Validações existentes...
            if (file.type.startsWith('video/')) {
                const maxVideoSize = 10 * 1024 * 1024;
                if (file.size > maxVideoSize) {
                    UI.showError(`Vídeo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo para vídeos: 10MB`);
                    const mediaInput = document.getElementById(`${msgId}-media`);
                    if (mediaInput) mediaInput.value = '';
                    return;
                }

                const videoDuration = await this.getVideoDuration(file);
                if (videoDuration > 300) {
                    UI.showError(`Vídeo muito longo: ${Math.round(videoDuration)}s. Máximo: 5 minutos`);
                    const mediaInput = document.getElementById(`${msgId}-media`);
                    if (mediaInput) mediaInput.value = '';
                    return;
                }
            }

            const maxSize = 16 * 1024 * 1024;
            if (file.size > maxSize && !file.type.startsWith('video/')) {
                UI.showError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: 16MB`);
                const mediaInput = document.getElementById(`${msgId}-media`);
                if (mediaInput) mediaInput.value = '';
                return;
            }

            try {
                const mediaData = await Utils.fileToBase64(file);

                AppState.messagesConfig[msgId].media = {
                    filename: file.name,
                    data: mediaData,
                    mimetype: file.type,
                    size: file.size
                };

                this.showMediaPreview(msgId, file);
                setTimeout(() => this.updateMainPreview(msgId), 200);

            } catch (error) {
                console.error('❌ Erro ao processar arquivo:', error);
                UI.showError('Erro ao processar arquivo: ' + error.message);
            }
        } else {
            console.log('🗑️ Removendo mídia de:', msgId);
            AppState.messagesConfig[msgId].media = null;
            this.hideMediaPreview(msgId);
            this.updateMainPreview(msgId);
        }

        // ✅ CHAMAR APENAS UMA VEZ ao final
        this.updateActiveMessagesInfo();
        this.updateMessageStatus(msgId);
    },

    getVideoDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };

            video.onerror = () => {
                resolve(0); // Se der erro, assumir que é válido
            };

            video.src = URL.createObjectURL(file);
        });
    },

    showMediaPreview(msgId, file) {
        const preview = document.getElementById(`${msgId}-media-preview`);
        if (!preview) return;

        console.log('📎 Criando preview lateral para:', file.name, file.type);

        let previewHTML = '';

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${e.target.result}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;" alt="Preview">
                    <div class="ms-2">
                        <div class="fw-bold">${file.name}</div>
                        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
                preview.style.display = 'block';

                // ✅ ATUALIZAR PREVIEW PRINCIPAL APÓS CARREGAR IMAGEM
                setTimeout(() => this.updateMainPreview(msgId), 100);
            };
            reader.readAsDataURL(file);
            return; // ✅ IMPORTANTE: Sair aqui para não executar o resto

        } else if (file.type.startsWith('video/')) {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-play-circle fs-2 text-primary"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else if (file.type === 'application/pdf') {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-file-pdf fs-2 text-danger"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else if (file.type.startsWith('audio/')) {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-music-note fs-2 text-success"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-file-earmark fs-2 text-secondary"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        }

        if (previewHTML) {
            preview.innerHTML = previewHTML;
            preview.style.display = 'block';
        }
    },

    hideMediaPreview(msgId) {
        const preview = document.getElementById(`${msgId}-media-preview`);
        if (preview) {
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    },

    clearMedia(msgId) {
        AppState.messagesConfig[msgId].media = null;

        const mediaInput = document.getElementById(`${msgId}-media`);
        if (mediaInput) {
            mediaInput.value = '';
        }

        this.hideMediaPreview(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        UI.showInfo('Mídia removida');
    },

    updateMainPreview(currentMsgId) {
        const config = AppState.messagesConfig[currentMsgId];
        const previewBody = document.getElementById('previewContent');
        const currentPreviewMessage = document.getElementById('currentPreviewMessage');
        const previewAvatar = document.getElementById('previewAvatar');
        const previewContactName = document.getElementById('previewContactName');

        if (!previewBody || !currentPreviewMessage) return;

        let exampleName = 'João Silva';
        if (AppState.contacts.length > 0) {
            exampleName = AppState.contacts[0].name;
        }

        if (previewAvatar) previewAvatar.textContent = exampleName.charAt(0).toUpperCase();
        if (previewContactName) previewContactName.textContent = exampleName;

        const msgNumber = currentMsgId.replace('msg', '');
        const isEnabled = config.enabled;
        const hasContent = config.text.trim() || config.media;

        currentPreviewMessage.textContent = `Mensagem ${msgNumber}`;
        currentPreviewMessage.className = `badge ${isEnabled && hasContent ? 'bg-success' : isEnabled ? 'bg-warning' : 'bg-secondary'}`;

        if (!isEnabled) {
            previewBody.innerHTML = `
                <div class="preview-placeholder">
                    <i class="bi bi-x-circle fs-3 mb-2 d-block"></i>
                    Mensagem ${msgNumber} está desativada
                </div>
            `;
            return;
        }

        if (!hasContent) {
            previewBody.innerHTML = `
                <div class="preview-placeholder">
                    <i class="bi bi-chat-text fs-3 mb-2 d-block"></i>
                    Configure a mensagem ${msgNumber} para visualizar
                </div>
            `;
            return;
        }

        let previewHTML = '<div class="whatsapp-message text-white">';

        // Processar mídia (código existente...)
        if (config.media) {
            if (config.media.type === 'url') {
                // Mídia via URL
                const url = config.media.url;
                const urlLower = url.toLowerCase();

                if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif')) {
                    previewHTML += `<img src="${url}" class="whatsapp-media" alt="Preview da imagem">`;
                } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
                    previewHTML += `<video controls class="whatsapp-media"><source src="${url}" type="${config.media.mimetype}"></video>`;
                } else if (urlLower.includes('.mp3') || urlLower.includes('.wav') || urlLower.includes('.ogg')) {
                    previewHTML += `<audio controls class="whatsapp-media" style="width: 100%;"><source src="${url}" type="${config.media.mimetype}"></audio>`;
                } else if (urlLower.includes('.pdf')) {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-file-pdf fs-1 text-danger"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                } else {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-link-45deg fs-1 text-primary"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                }
            } else {
                // Mídia via arquivo (código existente)
                if (config.media.mimetype.startsWith('image/')) {
                    const imageData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<img src="${imageData}" class="whatsapp-media" alt="Preview da imagem">`;
                } else if (config.media.mimetype.startsWith('video/')) {
                    const videoData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<video controls class="whatsapp-media"><source src="${videoData}" type="${config.media.mimetype}"></video>`;
                } else if (config.media.mimetype.startsWith('audio/')) {
                    const audioData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<audio controls class="whatsapp-media" style="width: 100%;"><source src="${audioData}" type="${config.media.mimetype}"></audio>`;
                } else if (config.media.mimetype === 'application/pdf') {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-file-pdf fs-1 text-danger"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                }
            }
        }

        // ✅ PROCESSAR TEXTO COM TAGS ALEATÓRIAS
        if (config.text.trim()) {
            let personalizedMessage = config.text
                .replace(/{nome}/g, exampleName)
                .replace(/{saudacao}/g, Utils.getSaudacao());

            // ✅ PROCESSAR NOVAS TAGS COM VARIAÇÕES PARA PREVIEW
            personalizedMessage = RandomTagsSystem.processTagsForPreview(personalizedMessage);

            // Aplicar formatação WhatsApp
            personalizedMessage = personalizedMessage
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            previewHTML += `<div>${personalizedMessage}</div>`;
        }

        previewHTML += `
            <div class="whatsapp-time text-white">
                ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <i class="bi bi-check2-all"></i>
            </div>
        </div>`;

        previewBody.innerHTML = previewHTML;
    },

    updateMessageStatus(msgId) {
        const config = AppState.messagesConfig[msgId];
        const statusBadge = document.getElementById(`${msgId}-status`);

        if (!statusBadge) return;

        const hasContent = config.text.trim() || config.media;
        const isComplete = config.enabled && hasContent;

        if (config.enabled && !hasContent) {
            statusBadge.style.display = 'inline';
            statusBadge.className = 'badge bg-warning ms-2';
            statusBadge.textContent = '!';
            statusBadge.title = 'Mensagem ativa mas sem conteúdo';
        } else {
            statusBadge.style.display = 'none';
        }
    },

    updateActiveMessagesInfo() {
        // ✅ Evitar execução múltipla simultânea
        if (this._isUpdatingCount) {
            console.log('🔄 Verificação já em andamento, pulando...');
            return;
        }

        this._isUpdatingCount = true;

        console.log('🔢 Atualizando contador de mensagens ativas...');

        // ✅ VERIFICAR ESTADO ATUAL DAS MENSAGENS
        const messages = AppState.messagesConfig;
        console.log('📊 Estado atual das mensagens:', {
            msg1: { enabled: messages.msg1.enabled, hasText: !!messages.msg1.text.trim(), hasMedia: !!messages.msg1.media },
            msg2: { enabled: messages.msg2.enabled, hasText: !!messages.msg2.text.trim(), hasMedia: !!messages.msg2.media },
            msg3: { enabled: messages.msg3.enabled, hasText: !!messages.msg3.text.trim(), hasMedia: !!messages.msg3.media }
        });

        // Contar mensagens que estão ativas E têm conteúdo
        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => {
                const isEnabled = config.enabled;
                const hasContent = config.text.trim() || config.media;
                return isEnabled && hasContent;
            });

        const activeCount = activeMessages.length;
        console.log('📈 Total de mensagens ativas com conteúdo:', activeCount);

        const infoElement = document.getElementById('activeMessagesCount');
        if (infoElement) {
            const text = `${activeCount} mensagem${activeCount !== 1 ? 's' : ''} ativa${activeCount !== 1 ? 's' : ''}`;
            infoElement.textContent = text;
            console.log('✅ Contador atualizado:', text);
        }

        // Atualizar cor do badge baseado no status
        const badgeElement = document.getElementById('activeMessagesInfo');
        if (badgeElement) {
            if (activeCount === 0) {
                badgeElement.className = 'alert alert-warning mt-3';
            } else {
                badgeElement.className = 'alert alert-success mt-3';
            }
        }

        // Atualizar status de cada mensagem individual
        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            this.updateMessageStatus(msgId);
        });

        // ✅ Liberar flag após processamento
        setTimeout(() => {
            this._isUpdatingCount = false;
        }, 100);

        console.log('🎯 Contador de mensagens ativas atualizado:', activeCount);
    },

    getRandomActiveMessage() {
        const activeMessages = Object.entries(AppState.messagesConfig)
            .filter(([id, config]) => config.enabled && (config.text.trim() || config.media));

        console.log('🔍 Mensagens ativas disponíveis:', activeMessages.map(([id]) => id));

        if (activeMessages.length === 0) {
            throw new Error('Nenhuma mensagem ativa configurada');
        }

        if (activeMessages.length === 1) {
            console.log(`📝 Apenas 1 mensagem ativa: ${activeMessages[0][0]}`);
            const [messageId, messageConfig] = activeMessages[0];
            return {
                id: messageId,
                text: messageConfig.text || '',
                media: messageConfig.media
            };
        }

        // ✅ SISTEMA DE ROTAÇÃO EQUILIBRADA
        // Inicializar ou recuperar histórico de uso
        if (!window.messageUsageHistory) {
            window.messageUsageHistory = {};
        }

        // Contar quantas vezes cada mensagem foi usada
        const usageCounts = {};
        activeMessages.forEach(([id]) => {
            usageCounts[id] = window.messageUsageHistory[id] || 0;
        });

        console.log('📊 Histórico de uso atual:', usageCounts);

        // Encontrar a(s) mensagem(ns) menos usada(s)
        const minUsage = Math.min(...Object.values(usageCounts));
        const leastUsedMessages = activeMessages.filter(([id]) => usageCounts[id] === minUsage);

        console.log(`📈 Mensagens menos usadas (${minUsage} usos):`, leastUsedMessages.map(([id]) => id));

        // Se há várias mensagens com o mesmo uso mínimo, escolher aleatoriamente entre elas
        const randomIndex = Math.floor(Math.random() * leastUsedMessages.length);
        const [selectedId, selectedConfig] = leastUsedMessages[randomIndex];

        // ✅ INCREMENTAR CONTADOR E MANTER HISTÓRICO COMPLETO
        window.messageUsageHistory[selectedId] = (window.messageUsageHistory[selectedId] || 0) + 1;

        // Garantir que todas as mensagens ativas estejam no histórico
        activeMessages.forEach(([id]) => {
            if (!(id in window.messageUsageHistory)) {
                window.messageUsageHistory[id] = 0;
            }
        });

        console.log(`🎯 Mensagem "${selectedId}" selecionada (${randomIndex + 1}/${leastUsedMessages.length} candidatas)`);
        console.log('📊 Novo histórico completo:', window.messageUsageHistory);

        return {
            id: selectedId,
            text: selectedConfig.text || '',
            media: selectedConfig.media
        };
    },

    validateMessages() {
        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => config.enabled);

        if (activeMessages.length === 0) {
            return { valid: false, error: 'Ative pelo menos uma mensagem' };
        }

        const validMessages = activeMessages.filter(config =>
            config.text.trim() || config.media
        );

        if (validMessages.length === 0) {
            return { valid: false, error: 'Configure conteúdo para pelo menos uma mensagem ativa' };
        }

        return { valid: true };
    },

    initializeRichTextEditor(msgId) {
        const boldBtn = document.getElementById(`${msgId}BoldBtn`);
        const italicBtn = document.getElementById(`${msgId}ItalicBtn`);
        const clearBtn = document.getElementById(`${msgId}ClearFormatBtn`);

        // Tags existentes
        const nameBtn = document.getElementById(`${msgId}NameBtn`);
        const greetingBtn = document.getElementById(`${msgId}GreetingBtn`);

        // ✅ NOVAS TAGS COM VARIAÇÕES
        const helloBtn = document.getElementById(`${msgId}HelloBtn`);
        const thanksBtn = document.getElementById(`${msgId}ThanksBtn`);
        const byeBtn = document.getElementById(`${msgId}ByeBtn`);
        const emoticonBtn = document.getElementById(`${msgId}EmoticonBtn`);

        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        // Event listeners para formatação
        if (boldBtn) boldBtn.addEventListener('click', () => this.toggleFormat(msgId, 'bold'));
        if (italicBtn) italicBtn.addEventListener('click', () => this.toggleFormat(msgId, 'italic'));
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearFormatting(msgId));

        // Event listeners para tags existentes
        if (nameBtn) nameBtn.addEventListener('click', () => this.insertTag(msgId, 'nome'));
        if (greetingBtn) greetingBtn.addEventListener('click', () => this.insertTag(msgId, 'saudacao'));

        // ✅ NOVOS EVENT LISTENERS PARA TAGS COM VARIAÇÕES
        if (helloBtn) helloBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'oi'));
        if (thanksBtn) thanksBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'obrigado'));
        if (byeBtn) byeBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'tchau'));
        if (emoticonBtn) emoticonBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'emoticon'));

        // Event listeners para textarea
        textarea.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(msgId, e));
        textarea.addEventListener('select', () => this.updateToolbarState(msgId));
        textarea.addEventListener('click', () => this.updateToolbarState(msgId));

        this.updateCharCounter(msgId);
    },

    // ✅ NOVA FUNÇÃO para inserir tags com variações
    insertRandomTag(msgId, tagType) {
        const tag = `{${tagType}}`;
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        // Inserir a tag
        const newValue = value.slice(0, start) + tag + value.slice(end);
        textarea.value = newValue;
        AppState.messagesConfig[msgId].text = newValue;

        // Posicionar cursor após a tag
        const newPosition = start + tag.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        // Animação especial
        this.animateTagButton(msgId, tagType);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        // ✅ Mostrar preview da variação escolhida
        const previewVariation = RandomTagsSystem.getRandomVariation(tagType);
        UI.showInfo(`Tag {${tagType}} inserida → Preview: "${previewVariation}"`);

        console.log(`✅ Tag {${tagType}} inserida em ${msgId} na posição ${start}`);
    },

    insertTag(msgId, tagType) {
        const tags = {
            'nome': '{nome}',
            'saudacao': '{saudacao}'
        };

        const tag = tags[tagType];
        if (!tag) return;

        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        // Inserir a tag
        const newValue = value.slice(0, start) + tag + value.slice(end);
        textarea.value = newValue;
        AppState.messagesConfig[msgId].text = newValue;

        // Posicionar cursor após a tag
        const newPosition = start + tag.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        // Animação especial para tags
        this.animateTagButton(msgId, tagType);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        console.log(`✅ Tag {${tagType}} inserida em ${msgId} na posição ${start}`);
    },

    // NOVO MÉTODO PARA ANIMAÇÃO DE TAGS
    animateTagButton(msgId, tagType) {
        let button;
        switch (tagType) {
            case 'nome':
                button = document.getElementById(`${msgId}NameBtn`);
                break;
            case 'saudacao':
                button = document.getElementById(`${msgId}GreetingBtn`);
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    },

    toggleFormat(msgId, type) {
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (selectedText.length === 0) {
            this.insertFormatMarkers(msgId, type);
        } else {
            this.wrapSelectedText(msgId, type, selectedText, start, end);
        }

        this.animateButton(msgId, type);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
    },

    insertFormatMarkers(msgId, type) {
        const markers = { 'bold': '*', 'italic': '_' };
        const marker = markers[type];
        const textarea = document.getElementById(`${msgId}-text`);

        const start = textarea.selectionStart;
        const value = textarea.value;

        const newValue = value.slice(0, start) + marker + marker + value.slice(start);
        textarea.value = newValue;

        const newPosition = start + marker.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        // Atualizar estado
        AppState.messagesConfig[msgId].text = newValue;
    },

    wrapSelectedText(msgId, type, selectedText, start, end) {
        const markers = { 'bold': '*', 'italic': '_' };
        const marker = markers[type];
        const textarea = document.getElementById(`${msgId}-text`);

        const beforeText = textarea.value.substring(Math.max(0, start - marker.length), start);
        const afterText = textarea.value.substring(end, Math.min(textarea.value.length, end + marker.length));

        let newValue;
        if (beforeText === marker && afterText === marker) {
            // Remover formatação existente
            newValue = textarea.value.slice(0, start - marker.length) +
                selectedText +
                textarea.value.slice(end + marker.length);
            textarea.setSelectionRange(start - marker.length, end - marker.length);
        } else {
            // Adicionar formatação
            newValue = textarea.value.slice(0, start) +
                marker + selectedText + marker +
                textarea.value.slice(end);
            textarea.setSelectionRange(start, end + (marker.length * 2));
        }

        textarea.value = newValue;
        textarea.focus();

        // Atualizar estado
        AppState.messagesConfig[msgId].text = newValue;
    },

    clearFormatting(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        let text = textarea.value;
        text = text.replace(/\*([^*]+)\*/g, '$1'); // Remove *bold*
        text = text.replace(/_([^_]+)_/g, '$1');   // Remove _italic_

        textarea.value = text;
        AppState.messagesConfig[msgId].text = text;

        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.animateButton(msgId, 'clear');
    },

    updateCharCounter(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        const counter = document.getElementById(`${msgId}CharCounter`);

        if (!textarea || !counter) return;

        const currentLength = textarea.value.length;
        const maxLength = textarea.maxLength || 4096;

        counter.textContent = `${currentLength}/${maxLength}`;

        if (currentLength > maxLength * 0.9) {
            counter.style.color = '#dc3545';
        } else if (currentLength > maxLength * 0.8) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#6c757d';
        }
    },

    updateToolbarState(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        const boldBtn = document.getElementById(`${msgId}BoldBtn`);
        const italicBtn = document.getElementById(`${msgId}ItalicBtn`);

        if (!textarea || !boldBtn || !italicBtn) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end) {
            const text = textarea.value;
            const beforeCursor = text.substring(0, start);

            const boldMatches = beforeCursor.split('*').length - 1;
            const inBold = boldMatches % 2 === 1;

            const italicMatches = beforeCursor.split('_').length - 1;
            const inItalic = italicMatches % 2 === 1;

            boldBtn.classList.toggle('active', inBold);
            italicBtn.classList.toggle('active', inItalic);
        } else {
            const beforeText = textarea.value.substring(Math.max(0, start - 1), start);
            const afterText = textarea.value.substring(end, Math.min(textarea.value.length, end + 1));

            boldBtn.classList.toggle('active', beforeText === '*' && afterText === '*');
            italicBtn.classList.toggle('active', beforeText === '_' && afterText === '_');
        }
    },

    handleKeyboardShortcuts(msgId, e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.toggleFormat(msgId, 'bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.toggleFormat(msgId, 'italic');
                    break;
                // NOVOS ATALHOS PARA TAGS
                case 'n':
                    if (e.shiftKey) { // Ctrl+Shift+N para {nome}
                        e.preventDefault();
                        this.insertTag(msgId, 'nome');
                    }
                    break;
                case 'g':
                    if (e.shiftKey) { // Ctrl+Shift+G para {saudacao}
                        e.preventDefault();
                        this.insertTag(msgId, 'saudacao');
                    }
                    break;
            }
        }
    },

    animateButton(msgId, type) {
        let button;
        switch (type) {
            case 'bold':
                button = document.getElementById(`${msgId}BoldBtn`);
                break;
            case 'italic':
                button = document.getElementById(`${msgId}ItalicBtn`);
                break;
            case 'clear':
                button = document.getElementById(`${msgId}ClearFormatBtn`);
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    },

    getRandomActiveMessage() {
        const activeMessages = Object.entries(AppState.messagesConfig)
            .filter(([id, config]) => config.enabled && (config.text.trim() || config.media));

        console.log('🔍 Mensagens ativas disponíveis:', activeMessages.map(([id]) => id));

        if (activeMessages.length === 0) {
            throw new Error('Nenhuma mensagem ativa configurada');
        }

        if (activeMessages.length === 1) {
            console.log(`📝 Apenas 1 mensagem ativa: ${activeMessages[0][0]}`);
            const [messageId, messageConfig] = activeMessages[0];
            return {
                id: messageId,
                text: messageConfig.text || '',
                media: messageConfig.media
            };
        }

        // Inicializar ou recuperar histórico de uso
        if (!window.messageUsageHistory) {
            window.messageUsageHistory = {};
        }

        // Contar quantas vezes cada mensagem foi usada
        const usageCounts = {};
        activeMessages.forEach(([id]) => {
            usageCounts[id] = window.messageUsageHistory[id] || 0;
        });

        console.log('📊 Histórico de uso atual:', usageCounts);

        // Encontrar a(s) mensagem(ns) menos usada(s)
        const minUsage = Math.min(...Object.values(usageCounts));
        const leastUsedMessages = activeMessages.filter(([id]) => usageCounts[id] === minUsage);

        console.log(`📈 Mensagens menos usadas (${minUsage} usos):`, leastUsedMessages.map(([id]) => id));

        // Se há várias mensagens com o mesmo uso mínimo, escolher aleatoriamente entre elas
        const randomIndex = Math.floor(Math.random() * leastUsedMessages.length);
        const [selectedId, selectedConfig] = leastUsedMessages[randomIndex];

        // Incrementar contador de uso
        window.messageUsageHistory[selectedId] = (window.messageUsageHistory[selectedId] || 0) + 1;

        console.log(`🎯 Mensagem "${selectedId}" selecionada (${randomIndex + 1}/${leastUsedMessages.length} candidatas)`);
        console.log('📊 Novo histórico de uso:', window.messageUsageHistory);

        return {
            id: selectedId,
            text: selectedConfig.text || '',
            media: selectedConfig.media
        };
    },

    resetMessageRotation() {
        window.messageUsageHistory = {};
        console.log('🔄 Histórico de rotação de mensagens resetado');
    },
};

// Expor globalmente
window.MultipleMessagesManager = MultipleMessagesManager;


// ========================================
// 20. GERENCIAMENTO PWA
// ========================================
const PWAManager = {
    initialize() {
        // Verificar se está rodando em HTTPS ou localhost
        if (this.canRegisterServiceWorker()) {
            this.registerServiceWorker();
        } else {
            console.log('⚠️ Service Worker não disponível (requer HTTPS ou localhost)');
        }

        this.setupInstallPrompt();
    },

    canRegisterServiceWorker() {
        // Verificar se está em HTTPS, localhost ou file://
        const isHTTPS = location.protocol === 'https:';
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isFile = location.protocol === 'file:';

        return 'serviceWorker' in navigator && (isHTTPS || isLocalhost) && !isFile;
    },

    async registerServiceWorker() {
        try {
            // Para protocolo file://, não tentar registrar SW
            if (location.protocol === 'file:') {
                console.log('📁 Protocolo file:// detectado - Service Worker desabilitado');
                return;
            }

            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker registrado com sucesso');

            AppState.registration = registration;

            // ✅ APENAS registrar - SEM notificações de atualização
            this.setupBasicCaching(registration);

        } catch (error) {
            console.log('⚠️ SW registration failed:', error.message);
        }
    },

    setupBasicCaching(registration) {
        // Apenas setup básico para cache offline - sem notificações
        registration.addEventListener('updatefound', () => {
            console.log('🔄 Nova versão encontrada (silencioso)');
            const newWorker = registration.installing;

            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('🆕 Nova versão instalada (background)');
                            // ✅ NÃO mostrar banner - deixar atualizar naturalmente
                        } else {
                            console.log('✅ App instalado e pronto para usar offline');
                            this.showOfflineReady();
                        }
                    }
                });
            }
        });
    },

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            AppState.deferredPrompt = e;
            this.showInstallButton();
        });

        // Detectar quando o app foi instalado
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA foi instalado');
            AppState.deferredPrompt = null;
            UI.showSuccess('App instalado com sucesso!');
        });
    },

    showInstallButton() {
        // Evitar múltiplos botões
        if (document.getElementById('pwa-install-btn')) return;

        const installButton = document.createElement('button');
        installButton.id = 'pwa-install-btn';
        installButton.className = 'btn btn-success btn-sm position-fixed';
        installButton.style.cssText = 'bottom: 20px; left: 20px; z-index: 1050; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        installButton.innerHTML = '<i class="bi bi-download me-2"></i>Instalar App';

        installButton.addEventListener('click', async () => {
            if (AppState.deferredPrompt) {
                try {
                    AppState.deferredPrompt.prompt();
                    const { outcome } = await AppState.deferredPrompt.userChoice;

                    if (outcome === 'accepted') {
                        console.log('✅ Usuário aceitou instalação');
                    } else {
                        console.log('❌ Usuário rejeitou instalação');
                    }

                    AppState.deferredPrompt = null;
                    installButton.remove();
                } catch (error) {
                    console.error('Erro na instalação:', error);
                    installButton.remove();
                }
            }
        });

        document.body.appendChild(installButton);

        // Auto-remover após 15 segundos
        setTimeout(() => {
            if (installButton.parentNode) {
                installButton.remove();
            }
        }, 15000);
    },

    showOfflineReady() {
        UI.showSuccess('App pronto para usar offline!');
    },

    cleanup() {
        try {
            // Limpar botão de instalação se existir
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.remove();
            }

            console.log('🧹 PWA cleanup concluído');
        } catch (error) {
            console.warn('⚠️ Erro durante PWA cleanup:', error);
        }
    },

    // ✅ MÉTODO SIMPLES para verificação manual (sem banner)
    checkForUpdates() {
        if (AppState.registration) {
            UI.showLoading('Verificando atualizações...');

            AppState.registration.update().then(() => {
                setTimeout(() => {
                    UI.hideLoading();
                    UI.showInfo('Verificação concluída. Se houver atualizações, serão aplicadas automaticamente.');
                }, 2000);
            }).catch((error) => {
                UI.hideLoading();
                console.warn('Erro ao verificar atualizações:', error);
                UI.showWarning('Não foi possível verificar atualizações');
            });
        } else {
            UI.showInfo('Service Worker não disponível');
        }
    }
};

// ========================================
// 21. GERENCIAMENTO DE EVENTOS
// ========================================
const EventManager = {
    setupFileUpload() {
        console.log('🔧 Configurando upload de arquivos...');

        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('excelFile');

        if (!fileUploadArea || !fileInput) {
            console.error('❌ Elementos não encontrados:', {
                fileUploadArea: !!fileUploadArea,
                fileInput: !!fileInput
            });
            return;
        }

        console.log('✅ Elementos encontrados, configurando eventos...');

        // Prevenir comportamento padrão
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, this.preventDefaults, false);
            fileUploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight da área de drop
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, this.highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, this.unhighlight, false);
        });

        // Handle dropped files
        fileUploadArea.addEventListener('drop', this.handleDrop, false);
        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', this.handleFileSelect);

        fileInput.addEventListener('change', this.handleFileSelect);
        console.log('✅ Event listener change configurado');
    },

    setupFormEvents() {
        console.log('🔧 Configurando eventos do formulário...');

        const bulkForm = document.getElementById('bulkForm');
        //console.log('📝 Formulário encontrado:', bulkForm);

        if (bulkForm) {
            bulkForm.addEventListener('submit', (e) => {
                console.log('🚀 Evento submit capturado!', e);
                this.handleFormSubmit(e);
            });
        }

        // Event listener direto no botão de submit
        const submitButton = document.querySelector('#mainApp button[type="submit"]');
        console.log('🔘 Botão submit do painel principal encontrado:', !!submitButton);

        if (submitButton) {
            submitButton.addEventListener('click', (e) => {
                console.log('🔘 Clique direto no botão do painel principal capturado!');

                // Executar a lógica de envio diretamente
                e.preventDefault();

                // ✅ VERIFICAR AUTENTICAÇÃO 
                if (!AuthManager.requireAuth()) {
                    console.log('❌ Usuário não autenticado');
                    return;
                }

                console.log('🔍 Verificando se envio está em andamento...');
                if (AppState.sendingInProgress) {
                    console.log('⚠️ Envio já em andamento');
                    UI.showWarning('Envio já está em andamento');
                    return;
                }

                console.log('🔍 Validando antes do envio...');
                const validation = SendingManager.validateBeforeSending();
                console.log('📊 Resultado da validação:', validation);

                if (!validation.valid) {
                    console.log('❌ Validação falhou:', validation.error);
                    UI.showError(validation.error);
                    return;
                }

                const isScheduled = document.getElementById('enableScheduling')?.checked;
                console.log('📅 Agendado?', isScheduled);

                if (isScheduled) {
                    console.log('📅 Executando agendamento...');
                    const dispatchData = FormManager.collectDispatchData();
                    ScheduleManager.scheduleDispatch(dispatchData);
                } else {
                    console.log('🚀 Mostrando diálogo de confirmação...');
                    FormManager.showConfirmationDialog();
                }
            });
        }

        // Botões principais
        const stopButton = document.getElementById('stopButton');
        const pauseButton = document.getElementById('pauseButton');
        const reportButton = document.getElementById('reportButton');

        if (stopButton) stopButton.addEventListener('click', () => SendingManager.stop());
        if (pauseButton) pauseButton.addEventListener('click', this.handlePauseToggle);
        if (reportButton) reportButton.addEventListener('click', () => ReportManager.generatePDFReport());

        // Conexão WhatsApp - BOTÃO PRINCIPAL (não dos cards)
        const checkConnectionBtn = document.getElementById('checkConnectionBtn');
        const recheckConnection = document.getElementById('recheckConnection');

        if (checkConnectionBtn) {
            checkConnectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ConnectionManager.checkConnection();
            });
        }

        if (recheckConnection) {
            recheckConnection.addEventListener('click', (e) => {
                e.preventDefault();
                ConnectionManager.checkConnection();
            });
        }

        // Agendamento
        const enableScheduling = document.getElementById('enableScheduling');
        if (enableScheduling) {
            enableScheduling.addEventListener('change', () => ScheduleManager.toggleSchedulingOptions());
        }

        // Limpeza e gerenciamento
        const clearHistoryButton = document.getElementById('clearHistoryButton');
        const clearContactsBtn = document.getElementById('clearContactsBtn');

        if (clearHistoryButton) clearHistoryButton.addEventListener('click', () => HistoryManager.clear());
        if (clearContactsBtn) clearContactsBtn.addEventListener('click', () => ContactManager.clear());

        // Export/Import
        this.setupExportImportEvents();

        // ✅ NOVO: Configuração de validação
        const enableBrazilianValidation = document.getElementById('enableBrazilianValidation');
        if (enableBrazilianValidation) {
            enableBrazilianValidation.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                const mode = isEnabled ? 'Validação Brasileira' : 'Validação Internacional';

                console.log('🔧 Modo de validação alterado:', mode);

                // Mostrar notificação sobre a mudança
                if (isEnabled) {
                    UI.showInfo('✅ Validação brasileira ativada - Números serão validados com DDD brasileiro');
                } else {
                    UI.showSuccess('🌍 Validação internacional ativada - Aceita números de qualquer país');
                }

                // Se já existem contatos, perguntar se quer revalidar
                if (AppState.contacts.length > 0) {
                    setTimeout(() => {
                        UI.confirm(
                            'Revalidar Contatos',
                            `Modo de validação alterado para: ${mode}<br><br>Deseja revalidar os ${AppState.contacts.length} contatos existentes com o novo modo?`,
                            () => {
                                ContactManager.revalidateContacts();
                            }
                        );
                    }, 1000);
                }
            });
        }
    },

    setupExportImportEvents() {
        const events = [
            { id: 'exportHistoryBtn', handler: () => DataManager.exportHistoryToExcel() },
            { id: 'exportContactsBtn', handler: () => DataManager.exportContactsToExcel() },
            { id: 'exportBackupBtn', handler: () => DataManager.exportBackupData() },
            { id: 'importBackupBtn', handler: () => DataManager.importBackupData() },
            { id: 'clearSettingsBtn', handler: () => SettingsManager.clearSavedSettings() },
            { id: 'downloadModelBtn', handler: () => ModeloManager.downloadModel() }
        ];

        events.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        });
    },

    setupAutoSave() {
        //EventManager.setupAutoSave = function () {
        // Inicializar o novo sistema de auto-save
        AutoSaveManager.initialize();
        console.log('✅ Sistema de auto-save avançado ativado');
        //};
    },

    setupPreviewEvents() {
        const messageField = document.getElementById('message');
        const mediaFileField = document.getElementById('mediaFile');

        if (messageField) {
            messageField.addEventListener('input', () => {
                PreviewManager.update();
            });
        }

        if (mediaFileField) {
            mediaFileField.addEventListener('change', (e) => {
                console.log('📎 Evento change no campo de mídia');

                const file = e.target.files[0];

                if (file && file.size > 0) {
                    console.log('📎 Arquivo selecionado:', file.name, file.type);

                    // ✅ PROCESSAR SEQUENCIALMENTE
                    showMediaPreview(file);

                    // ✅ DELAY SIMPLES
                    setTimeout(() => {
                        PreviewManager.update();
                    }, 200);

                } else {
                    console.log('📎 Nenhum arquivo válido');

                    // ✅ LIMPEZA SIMPLES
                    const preview = document.getElementById('mediaPreview');
                    if (preview) preview.style.display = 'none';

                    PreviewManager.update();
                }
            });
        }

        // Event listener para o botão de limpar mídia
        const clearMediaBtn = document.getElementById('clearMediaBtn');
        if (clearMediaBtn) {
            clearMediaBtn.addEventListener('click', clearMedia);
        }

        // Atualizar estimativas quando intervalos mudarem
        const minInterval = document.getElementById('minInterval');
        const maxInterval = document.getElementById('maxInterval');

        if (minInterval) minInterval.addEventListener('input', TimeEstimator.update);
        if (maxInterval) maxInterval.addEventListener('input', TimeEstimator.update);
    },

    forceCleanAndUpdate() {
        console.log('🧹 Limpeza forçada do preview...');

        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            // Limpar tudo
            const allMedia = previewContent.querySelectorAll('img, video, source');
            allMedia.forEach(element => {
                const src = element.src || element.getAttribute('src');
                if (src && src.startsWith('blob:')) {
                    URL.revokeObjectURL(src);
                }
            });

            // Forçar atualização
            this.update();
        }
    },

    setupDelegatedEvents() {
        // Event delegation para botões do histórico (somente uma vez)
        const historyTable = document.getElementById('historyTable');

        if (historyTable) {
            historyTable.addEventListener('click', (e) => {
                // Verificar se o clique veio de um botão de ação
                const viewBtn = e.target.closest('.view-details-btn');
                const reportBtn = e.target.closest('.generate-report-btn');
                const deleteBtn = e.target.closest('.delete-entry-btn');

                if (viewBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(viewBtn.dataset.entryId);
                    HistoryManager.viewDetails(entryId);
                } else if (reportBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(reportBtn.dataset.entryId);
                    HistoryManager.generateReport(entryId);
                } else if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(deleteBtn.dataset.entryId);
                    HistoryManager.deleteEntry(entryId);
                }
            });
        }
    },

    setupModalCleanup() {
        const connectionModal = document.getElementById('connectionModal');
        if (connectionModal) {
            connectionModal.addEventListener('hidden.bs.modal', () => {
                AppIntervals.clear('qrRefresh');
            });
        }
    },

    // Event handlers
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    highlight(e) {
        e.currentTarget.classList.add('dragover');
    },

    unhighlight(e) {
        e.currentTarget.classList.remove('dragover');
    },

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];

            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel' ||
                file.name.toLowerCase().endsWith('.xlsx') ||
                file.name.toLowerCase().endsWith('.xls')) {
                ContactManager.processExcelFile(file);
            } else {
                UI.showError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
            }
        }
    },

    handleFileSelect(e) {
        console.log('📁 Evento change capturado');

        const file = e.target.files[0];

        if (!file) {
            console.log('❌ Nenhum arquivo selecionado');
            return;
        }

        console.log('📊 Processando arquivo selecionado:', {
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024).toFixed(2)} KB`
        });

        // ✅ VALIDAÇÃO ROBUSTA
        const isExcelFile =
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel' ||
            file.name.toLowerCase().endsWith('.xlsx') ||
            file.name.toLowerCase().endsWith('.xls');

        if (isExcelFile) {
            console.log('✅ Arquivo Excel válido - processando...');
            ContactManager.processExcelFile(file);
        } else {
            console.log('❌ Arquivo inválido:', file.type);
            UI.showError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
            e.target.value = ''; // Limpar seleção para permitir nova tentativa
        }
    },

    handleFormSubmit(e) {
        console.log('📋 handleFormSubmit chamado', e);

        // Verificar se o clique veio de um botão de instância
        if (e.target && e.target.closest('.instance-card')) {
            console.log('❌ Clique veio de card de instância, ignorando');
            return;
        }

        e.preventDefault();
        console.log('✅ preventDefault executado no handleFormSubmit');

        // ✅ VERIFICAR AUTENTICAÇÃO APENAS se não estivermos na tela de login
        const loginScreen = document.getElementById('loginScreen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (!isLoginVisible && !AuthManager.requireAuth()) {
            console.log('❌ Usuário não autenticado no form submit');
            return;
        }

        // Se estamos na tela de login, não processar como envio de mensagem
        if (isLoginVisible) {
            console.log('🔐 Tela de login ativa, ignorando form submit');
            return;
        }

        if (AppState.sendingInProgress) {
            console.log('⚠️ Envio já em andamento');
            UI.showWarning('Envio já está em andamento');
            return;
        }

        console.log('🔍 Validando antes do envio...');
        const validation = SendingManager.validateBeforeSending();
        console.log('📊 Resultado da validação:', validation);

        if (!validation.valid) {
            console.log('❌ Validação falhou:', validation.error);
            UI.showError(validation.error);
            return;
        }

        const isScheduled = document.getElementById('enableScheduling')?.checked;
        console.log('📅 Agendado?', isScheduled);

        if (isScheduled) {
            console.log('📅 Executando agendamento...');
            const dispatchData = FormManager.collectDispatchData();
            ScheduleManager.scheduleDispatch(dispatchData);
        } else {
            console.log('🚀 Mostrando diálogo de confirmação...');
            FormManager.showConfirmationDialog();
        }
    },

    handlePauseToggle() {
        if (AppState.isPaused) {
            SendingManager.resume();
        } else {
            SendingManager.pause();
        }
    },

    clearMediaCache() {
        console.log('🧹 Limpeza completa de cache de mídia...');

        // Limpar URLs de blob antigas
        if (window.currentMediaURL) {
            URL.revokeObjectURL(window.currentMediaURL);
            window.currentMediaURL = null;
        }

        // ✅ LIMPAR TODAS AS URLS DE BLOB EXISTENTES (FORÇADO)
        if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
            // Tentar limpar URLs órfãs (método experimental)
            for (let i = 0; i < 100; i++) {
                try {
                    URL.revokeObjectURL(`blob:${window.location.origin}/${i}`);
                } catch (e) {
                    // Ignorar erros
                }
            }
        }

        // Limpar campos de mídia
        const mediaFile = document.getElementById('mediaFile');
        if (mediaFile) {
            mediaFile.value = '';
            // ✅ RESETAR TIPO DO INPUT
            mediaFile.type = '';
            mediaFile.type = 'file';
        }

        // Limpar preview de mídia
        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) {
            mediaPreview.style.display = 'none';
        }

        const mediaContent = document.getElementById('mediaPreviewContent');
        if (mediaContent) {
            mediaContent.innerHTML = '';
        }

        console.log('🗑️ Cache de mídia completamente limpo na inicialização');
    }
};

// ✅ FUNÇÃO GLOBAL para botão de limpar
function clearMediaUrl(msgId) {
    if (typeof MultipleMessagesManager !== 'undefined') {
        MultipleMessagesManager.clearMediaUrl(msgId);
    }
}

// ========================================
// 22. GERENCIAMENTO DE FORMULÁRIO
// ========================================
const FormManager = {
    collectDispatchData() {
        const validation = Validators.instanceData();

        return {
            instanceName: validation.instanceName || 'Múltiplas Instâncias',
            instanceAPIKEY: validation.instanceAPIKEY || '',
            activeInstancesCount: AppState.activeInstances.length,
            instancesUsed: AppState.activeInstances.map(inst => ({
                id: inst.id,
                name: inst.name
            })),
            multipleMessages: {
                enabled: true,
                config: AppState.messagesConfig
            },
            ia: document.getElementById('ia')?.value || '',
            minInterval: parseInt(document.getElementById('minInterval')?.value || 0),
            maxInterval: parseInt(document.getElementById('maxInterval')?.value || 0),
            contacts: [...AppState.contacts],
        };
    },

    // ✅ SUBSTITUIR função showConfirmationDialog completa
    showConfirmationDialog() {
        console.log('🔍 Coletando dados do disparo...');

        const instanceName = document.getElementById('instanceName')?.value || 'Instâncias Múltiplas';

        // ✅ ATUALIZADO: Contar mensagens ativas
        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => config.enabled && (config.text.trim() || config.media));

        const messageCount = activeMessages.length;
        const messagePreview = activeMessages.length > 0 ?
            activeMessages[0].text.substring(0, 50) + (activeMessages[0].text.length > 50 ? '...' : '') :
            'Sem mensagem configurada';

        const confirmText = `
        <div class="text-start">
            <h6>Confirme os dados do disparo</h6>
            <p><strong>Instância:</strong> ${instanceName}</p>
            <p><strong>Contatos:</strong> ${AppState.contacts.length}</p>
            <p><strong>Mensagens ativas:</strong> ${messageCount}</p>
            <p><strong>Preview:</strong> ${messagePreview}</p>
        </div>
    `;

        console.log('🔍 Mostrando diálogo de confirmação...');
        UI.confirm(
            'Confirmar Disparo',
            confirmText,
            () => {
                console.log('✅ Usuário confirmou o disparo');
                SendingManager.start();
            }
        );
    }
};

// ========================================
// 23. INICIALIZAÇÃO DA APLICAÇÃO
// ========================================
const App = {
    async initialize() {
        try {
            console.log('🚀 Iniciando Disparador PRO...');

            // ✅ LIMPAR QUALQUER GRÁFICO EXISTENTE GLOBALMENTE
            if (typeof Chart !== 'undefined') {
                Chart.getChart('resultsChart')?.destroy();
            }

            AuthManager.initialize();
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            alert('Erro ao inicializar aplicação: ' + error.message);
        }
    },

    async initializeApp() {
        try {
            console.log('🔧 Inicializando aplicação principal...');

            // ✅ LIMPAR COMPONENTES EXISTENTES ANTES DE REINICIALIZAR
            if (typeof ChartManager !== 'undefined') {
                ChartManager.destroy();
            }

            const originalUpdateStats = SendingManager.updateStats;
            SendingManager.updateStats = function () {
                console.log('⏸️ updateStats bloqueado durante inicialização');
            };

            await this.unregisterServiceWorkers();
            this.clearMediaCache();

            // ✅ PROTEÇÃO: Marcar como carregando ANTES de inicializar auto-save
            if (typeof AutoSaveManager !== 'undefined') {
                AutoSaveManager.isLoading = true;
            }

            // ✅ Inicializar auto-save ANTES dos outros componentes
            AutoSaveManager.initialize();

            Notiflix.Notify.init({
                position: 'right-top',
                distance: '20px',
                timeout: 4000,
            });

            ChartManager.initialize();
            EventManager.setupFileUpload();
            EventManager.setupFormEvents();
            EventManager.setupPreviewEvents();
            EventManager.setupDelegatedEvents();
            EventManager.setupModalCleanup();

            ScheduleManager.initialize();
            SettingsManager.loadSaved();
            PWAManager.initialize();
            InstanceManager.initialize();
            BatchManager.initialize();
            BusinessHoursManager.initialize();
            EmailSubjectManager.initialize();

            // ... resto do código ...

            setTimeout(() => {
                if (document.getElementById('richTextEditor') && !window.richTextEditor) {
                    window.richTextEditor = new RichTextEditor('richTextEditor');
                    console.log('✅ Editor de texto rico inicializado');
                }

                if (!window.multipleMessagesInitialized) {
                    MultipleMessagesManager.initialize();
                    window.multipleMessagesInitialized = true;
                    console.log('✅ MultipleMessagesManager inicializado');
                }
            }, 1000);

            setTimeout(() => {
                if (typeof ChartManager !== 'undefined') {
                    ChartManager.initializeResultsSection();
                }
            }, 1500);

            // ✅ LIBERAR FLAG DE CARREGAMENTO APÓS TUDO INICIALIZAR
            setTimeout(() => {
                if (typeof AutoSaveManager !== 'undefined') {
                    AutoSaveManager.isLoading = false;
                    console.log('✅ Flag isLoading liberada após inicialização completa');
                }
            }, 3000); // ✅ 3 segundos após inicialização

            console.log('✅ Disparador PRO inicializado com sucesso!');

            setTimeout(() => {
                SendingManager.updateStats = originalUpdateStats;
                console.log('✅ updateStats reabilitado');
            }, 3000);

            setTimeout(() => {
                if (typeof window.protectTotalContacts === 'function') {
                    window.protectTotalContacts();
                }
            }, 2000);

        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
        }
    },

    async unregisterServiceWorkers() {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();

                for (const registration of registrations) {
                    console.log('🗑️ Desregistrando Service Worker...');
                    await registration.unregister();
                }

                if (registrations.length > 0) {
                    console.log('✅ Service Workers removidos');
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover Service Workers:', error);
        }
    },

    clearMediaCache() {
        // Limpar URLs de blob antigas
        if (window.currentMediaURL) {
            URL.revokeObjectURL(window.currentMediaURL);
            window.currentMediaURL = null;
        }

        // Limpar campos de mídia
        const mediaFile = document.getElementById('mediaFile');
        if (mediaFile) {
            mediaFile.value = '';
        }

        // Limpar preview de mídia
        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) {
            mediaPreview.style.display = 'none';
        }

        console.log('🗑️ Cache de mídia limpo na inicialização');
    }
};

// ========================================
// 24. FUNÇÕES GLOBAIS (para compatibilidade)
// ========================================

// Funções expostas globalmente para uso em onclick dos elementos HTML
window.alternarTema = UI.alternarTema;
window.ScheduleManager = ScheduleManager;
window.PWAManager = PWAManager;
window.checkForUpdates = PWAManager.checkForUpdates;
window.SettingsManager = SettingsManager;
window.showMediaPreview = showMediaPreview;
window.clearMedia = clearMedia;
window.AuthManager = AuthManager;


// ========================================
// 25. INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    App.initialize();
});

// Cleanup ao fechar a página
window.addEventListener('beforeunload', () => {
    // Revogar URLs antes de fechar
    if (window.currentMediaURL) {
        URL.revokeObjectURL(window.currentMediaURL);
        window.currentMediaURL = null;
        console.log('🗑️ URLs limpas ao fechar página');
    }

    AppIntervals.clearAll();
});

// Expor estado para debugging (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.AppState = AppState;
    window.APP_CONFIG = APP_CONFIG;
}

const MultipleMessagesManagerFixed = {
    initialize() {
        console.log('🔧 Inicializando MultipleMessagesManager...');

        const toggleSwitch = document.getElementById('enableMultipleMessages');
        const singleMode = document.getElementById('singleMessageMode');
        const multipleMode = document.getElementById('multipleMessagesMode');

        if (!toggleSwitch) {
            console.warn('⚠️ Elemento enableMultipleMessages não encontrado. Recurso de múltiplas mensagens não disponível.');
            // Criar elemento placeholder se necessário
            return;
        }

        if (!singleMode) {
            console.warn('⚠️ Elemento singleMessageMode não encontrado.');
            return;
        }

        if (!multipleMode) {
            console.warn('⚠️ Elemento multipleMessagesMode não encontrado.');
            return;
        }

        console.log('✅ Elementos de múltiplas mensagens encontrados');

        toggleSwitch.addEventListener('change', (e) => {
            AppState.multipleMessagesEnabled = e.target.checked;

            if (AppState.multipleMessagesEnabled) {
                singleMode.style.display = 'none';
                multipleMode.style.display = 'block';
                setTimeout(() => this.updateMainPreview('msg1'), 100);
            } else {
                singleMode.style.display = 'block';
                multipleMode.style.display = 'none';
                if (typeof PreviewManager !== 'undefined') {
                    PreviewManager.update();
                }
            }
        });

        this.setupMessageListeners();
        this.setupTabListeners();
        this.updateActiveMessagesInfo();
    }
};

// ========================================
// EDITOR DE TEXTO RICO ATUALIZADO COM TAGS
// ========================================
class RichTextEditor {
    constructor(editorId) {
        this.editor = document.getElementById(editorId);
        this.textarea = this.editor.querySelector('.rich-text-area');
        this.charCounter = this.editor.querySelector('.char-counter');
        this.boldBtn = document.getElementById('boldBtn');
        this.italicBtn = document.getElementById('italicBtn');
        this.clearFormatBtn = document.getElementById('clearFormatBtn');

        // NOVOS BOTÕES DE TAGS
        this.nameBtn = document.getElementById('nameBtn');
        this.greetingBtn = document.getElementById('greetingBtn');

        this.init();
    }

    init() {
        // Event listeners para os botões de formatação - COM VERIFICAÇÃO DE EXISTÊNCIA
        if (this.boldBtn) {
            this.boldBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFormat('bold');
            });
        }

        if (this.italicBtn) {
            this.italicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFormat('italic');
            });
        }

        if (this.clearFormatBtn) {
            this.clearFormatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearFormatting();
            });
        }

        // Event listeners para os botões de tags - COM VERIFICAÇÃO DE EXISTÊNCIA
        if (this.nameBtn) {
            this.nameBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.insertTag('nome');
            });
        }

        if (this.greetingBtn) {
            this.greetingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.insertTag('saudacao');
            });
        }

        // Event listeners para o textarea
        if (this.textarea) {
            this.textarea.addEventListener('input', () => {
                this.updateCharCounter();
                PreviewManager.update();
            });
            this.textarea.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
            this.textarea.addEventListener('select', () => this.updateToolbarState());
            this.textarea.addEventListener('click', () => this.updateToolbarState());
        }

        // Inicializar contador
        this.updateCharCounter();
    }

    toggleFormat(type) {
        console.log('🔍 ANTES da formatação:', this.textarea.value);

        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.textarea.value.substring(start, end);

        if (selectedText.length === 0) {
            this.insertFormatMarkers(type);
        } else {
            this.wrapSelectedText(type, selectedText, start, end);
        }

        console.log('🔍 DEPOIS da formatação:', this.textarea.value);

        this.animateButton(type);
        this.updateCharCounter();
        PreviewManager.update(); // Atualizar preview do WhatsApp
    }

    // NOVO MÉTODO PARA INSERIR TAGS
    insertTag(tagType) {
        const tags = {
            'nome': '{nome}',
            'saudacao': '{saudacao}'
        };

        const tag = tags[tagType];
        if (!tag) return;

        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        // Inserir a tag
        const newValue = value.slice(0, start) + tag + value.slice(end);
        this.textarea.value = newValue;

        // Posicionar cursor após a tag
        const newPosition = start + tag.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();

        // Animação especial para tags
        this.animateTagButton(tagType);
        this.updateCharCounter();
        PreviewManager.update();

        console.log(`✅ Tag {${tagType}} inserida na posição ${start}`);
    }

    insertFormatMarkers(type) {
        const markers = {
            'bold': '*',
            'italic': '_'
        };

        const marker = markers[type];
        const start = this.textarea.selectionStart;
        const value = this.textarea.value;

        // ✅ INSERIR APENAS UM MARCADOR DE CADA LADO
        const newValue = value.slice(0, start) + marker + marker + value.slice(start);
        this.textarea.value = newValue;

        // Posicionar cursor entre os marcadores
        const newPosition = start + marker.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();
    }

    wrapSelectedText(type, selectedText, start, end) {
        const markers = {
            'bold': '*',
            'italic': '_'
        };

        const marker = markers[type];

        // Verificar se o texto já está formatado
        const beforeText = this.textarea.value.substring(Math.max(0, start - marker.length), start);
        const afterText = this.textarea.value.substring(end, Math.min(this.textarea.value.length, end + marker.length));

        if (beforeText === marker && afterText === marker) {
            // Remover formatação existente
            const newValue =
                this.textarea.value.slice(0, start - marker.length) +
                selectedText +
                this.textarea.value.slice(end + marker.length);

            this.textarea.value = newValue;
            this.textarea.setSelectionRange(start - marker.length, end - marker.length);
        } else {
            // Adicionar formatação
            const newValue =
                this.textarea.value.slice(0, start) +
                marker + selectedText + marker +
                this.textarea.value.slice(end);

            this.textarea.value = newValue;
            this.textarea.setSelectionRange(start, end + (marker.length * 2));
        }

        this.textarea.focus();
    }

    clearFormatting() {
        let text = this.textarea.value;

        // Remover marcadores de formatação (mas manter tags)
        text = text.replace(/\*([^*]+)\*/g, '$1'); // Remove *bold*
        text = text.replace(/_([^_]+)_/g, '$1');   // Remove _italic_

        this.textarea.value = text;
        this.updateCharCounter();
        PreviewManager.update();
        this.animateButton('clear');
    }

    updateCharCounter() {
        const currentLength = this.textarea.value.length;
        const maxLength = this.textarea.maxLength || 4096;

        this.charCounter.textContent = `${currentLength}/${maxLength}`;

        // Mudar cor quando próximo do limite
        if (currentLength > maxLength * 0.9) {
            this.charCounter.style.color = '#dc3545';
        } else if (currentLength > maxLength * 0.8) {
            this.charCounter.style.color = '#ffc107';
        } else {
            this.charCounter.style.color = '#6c757d';
        }
    }

    updateToolbarState() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        if (start === end) {
            // Cursor em posição específica - verificar se está dentro de formatação
            const text = this.textarea.value;
            const beforeCursor = text.substring(0, start);

            // Contar asteriscos antes do cursor
            const boldMatches = beforeCursor.split('*').length - 1;
            const inBold = boldMatches % 2 === 1;

            // Contar underscores antes do cursor
            const italicMatches = beforeCursor.split('_').length - 1;
            const inItalic = italicMatches % 2 === 1;

            if (this.boldBtn) this.boldBtn.classList.toggle('active', inBold);
            if (this.italicBtn) this.italicBtn.classList.toggle('active', inItalic);
        } else {
            // Texto selecionado - verificar se já está formatado
            const beforeText = this.textarea.value.substring(Math.max(0, start - 1), start);
            const afterText = this.textarea.value.substring(end, Math.min(this.textarea.value.length, end + 1));

            if (this.boldBtn) this.boldBtn.classList.toggle('active', beforeText === '*' && afterText === '*');
            if (this.italicBtn) this.italicBtn.classList.toggle('active', beforeText === '_' && afterText === '_');
        }
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.toggleFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.toggleFormat('italic');
                    break;
                // NOVOS ATALHOS PARA TAGS
                case 'n':
                    if (e.shiftKey) { // Ctrl+Shift+N para {nome}
                        e.preventDefault();
                        this.insertTag('nome');
                    }
                    break;
                case 'g':
                    if (e.shiftKey) { // Ctrl+Shift+G para {saudacao}
                        e.preventDefault();
                        this.insertTag('saudacao');
                    }
                    break;
            }
        }
    }

    animateButton(type) {
        let button;
        switch (type) {
            case 'bold':
                button = this.boldBtn;
                break;
            case 'italic':
                button = this.italicBtn;
                break;
            case 'clear':
                button = this.clearFormatBtn;
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    }

    // NOVA ANIMAÇÃO ESPECIAL PARA BOTÕES DE TAG
    animateTagButton(tagType) {
        let button;
        switch (tagType) {
            case 'nome':
                button = this.nameBtn;
                break;
            case 'saudacao':
                button = this.greetingBtn;
                break;
        }

        if (button) {
            button.classList.add('tag-inserted');
            setTimeout(() => button.classList.remove('tag-inserted'), 600);
        }
    }

    // Métodos públicos para integração
    getValue() {
        return this.textarea.value;
        // ✅ GARANTIR que retorna formatação WhatsApp pura
        return cleanMessageForWhatsApp(value);
    }

    setValue(value) {
        this.textarea.value = value;
        this.updateCharCounter();
        PreviewManager.update();
    }

    focus() {
        this.textarea.focus();
    }

    insertText(text) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        const newValue = value.slice(0, start) + text + value.slice(end);
        this.textarea.value = newValue;

        const newPosition = start + text.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();

        this.updateCharCounter();
        PreviewManager.update();
    }

    validateWhatsAppFormatting(text) {
        // Remove espaços desnecessários ao redor dos marcadores
        text = text.replace(/\*\s+/g, '*');      // Remove espaço após *
        text = text.replace(/\s+\*/g, '*');      // Remove espaço antes de *
        text = text.replace(/_\s+/g, '_');       // Remove espaço após _
        text = text.replace(/\s+_/g, '_');       // Remove espaço antes de _

        // Validar pares de marcadores
        const asteriskCount = (text.match(/\*/g) || []).length;
        const underscoreCount = (text.match(/_/g) || []).length;

        // Se não há pares, remover marcadores órfãos
        if (asteriskCount % 2 !== 0) {
            console.warn('⚠️ Marcadores de negrito ímpares detectados');
        }
        if (underscoreCount % 2 !== 0) {
            console.warn('⚠️ Marcadores de itálico ímpares detectados');
        }

        return text;
    }
}

// ========================================
// FUNÇÃO DE LIMPEZA DE FORMATAÇÃO PARA WHATSAPP
// ========================================
function cleanMessageForWhatsApp(message) {
    if (!message) return '';

    console.log('🧹 Limpando mensagem para WhatsApp:', message);

    // Remove qualquer HTML que possa ter vazado
    let cleanMessage = message
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')   // <strong> → *texto*
        .replace(/<em>(.*?)<\/em>/g, '_$1_')           // <em> → _texto_
        .replace(/<i>(.*?)<\/i>/g, '_$1_')             // <i> → _texto_
        .replace(/<b>(.*?)<\/b>/g, '*$1*')             // <b> → *texto*
        .replace(/<br>/g, '\n')                        // <br> → quebra
        .replace(/<[^>]*>/g, '');                      // Remove outras tags HTML

    // Garantir que a formatação WhatsApp está correta
    cleanMessage = cleanMessage
        .replace(/\*\*([^*]+)\*\*/g, '*$1*')  // **texto** → *texto*
        .replace(/__([^_]+)__/g, '_$1_');     // __texto__ → _texto_

    console.log('✅ Mensagem limpa:', cleanMessage);

    return cleanMessage;
}

// ========================================
// GERENCIAMENTO DE PLANILHA MODELO
// ========================================
const ModeloManager = {
    // Gerar planilha modelo usando SheetJS
    generateModelExcel() {
        console.log('📊 Gerando planilha modelo...');

        try {
            // Dados de exemplo para a planilha
            const dadosExemplo = [
                ['Nome', 'Telefone', 'E-mail'],
                ['João Silva', '11987654321', 'joao@email.com'],
                ['Maria Santos', '11976543210', 'maria@email.com'],
                ['Pedro Oliveira', '11965432109', 'pedro@email.com'],
                ['Ana Costa', '11954321098', 'ana@email.com'],
                ['Carlos Ferreira', '11943210987', 'carlos@email.com']
            ];

            // Criar workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(dadosExemplo);

            // Configurar largura das colunas
            ws['!cols'] = [
                { wch: 20 }, // Nome
                { wch: 15 }, // Telefone  
                { wch: 25 }  // E-mail
            ];

            // Estilizar cabeçalho (se suportado)
            const headerRange = XLSX.utils.decode_range('A1:C1');
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;

                // Adicionar estilo básico ao cabeçalho
                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
            }

            // Adicionar planilha ao workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

            // Fazer download
            XLSX.writeFile(wb, 'modelo-planilha.xlsx');

            UI.showSuccess('Planilha modelo baixada com sucesso!');

        } catch (error) {
            console.error('❌ Erro ao gerar planilha modelo:', error);
            UI.showError('Erro ao gerar planilha modelo: ' + error.message);
        }
    },

    // Método alternativo - download de arquivo estático
    downloadStaticModel() {
        console.log('📊 Baixando planilha modelo estática...');

        try {
            // Criar link para download
            const link = document.createElement('a');
            link.href = './modelo-planilha.xlsx';
            link.download = 'modelo-planilha.xlsx';
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            UI.showSuccess('Download da planilha modelo iniciado!');

        } catch (error) {
            console.error('❌ Erro ao baixar planilha modelo:', error);
            // Se falhar, usar método de geração
            this.generateModelExcel();
        }
    },

    // Verificar se arquivo modelo existe e escolher método
    async downloadModel() {
        try {
            // Tentar verificar se arquivo estático existe
            const response = await fetch('./modelo-planilha.xlsx', { method: 'HEAD' });

            if (response.ok) {
                // Arquivo existe, fazer download estático
                this.downloadStaticModel();
            } else {
                // Arquivo não existe, gerar dinamicamente
                this.generateModelExcel();
            }
        } catch (error) {
            // Se der erro na verificação, gerar dinamicamente
            console.log('📊 Arquivo modelo não encontrado, gerando dinamicamente...');
            this.generateModelExcel();
        }
    }
};

// Função para configurar intervalos seguros automaticamente
function startSafeConfiguration() {
    // Configurar intervalos seguros
    const minIntervalInput = document.getElementById('minInterval');
    const maxIntervalInput = document.getElementById('maxInterval');

    if (minIntervalInput && maxIntervalInput) {
        minIntervalInput.value = '60';  // 60 segundos mínimo
        maxIntervalInput.value = '120'; // 120 segundos máximo

        // Atualizar estimativas
        TimeEstimator.update();

        // Configurar pausa em lotes se existir
        const batchCheckbox = document.getElementById('enableBatchPause');
        const batchSize = document.getElementById('batchSize');
        const batchPause = document.getElementById('batchPauseDuration');

        if (batchCheckbox && batchSize && batchPause) {
            batchCheckbox.checked = true;
            batchSize.value = '10';  // 10 mensagens por lote
            batchPause.value = '10'; // 10 minutos de pausa

            // Ativar configuração de lotes
            if (BatchManager && BatchManager.toggleBatchOptions) {
                BatchManager.toggleBatchOptions();
            }
        }

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('safetyTipsModal'));
        if (modal) {
            modal.hide();
        }

        UI.showSuccess('✅ Configurações seguras aplicadas! Intervalos: 60-120s, Lotes: 10 msgs com pausa de 10min');
    } else {
        UI.showError('❌ Não foi possível aplicar as configurações automáticas');
    }
}

// Função para mostrar dicas contextuais
function showSafetyTip(tip) {
    const tips = {
        intervals: 'Configure intervalos entre 60-120 segundos para evitar bloqueios. Intervalos muito baixos podem resultar em ban.',
        batch: 'Use pausas automáticas a cada 10 envios para simular comportamento humano e evitar detecção.',
        schedule: 'Agende envios para horários comerciais (9h-18h) e evite finais de semana para melhor engajamento.',
        contacts: 'Sempre valide números antes do envio. Números inválidos podem prejudicar sua reputação.',
        message: 'Personalize mensagens com {nome} e use IA para variações. Mensagens genéricas têm menor engajamento.'
    };

    if (tips[tip]) {
        UI.showInfo(tips[tip]);
    }
}

// Adicionar tooltips de segurança aos campos
function addSafetyTooltips() {
    // Tooltip para intervalos
    const minInterval = document.getElementById('minInterval');
    const maxInterval = document.getElementById('maxInterval');

    if (minInterval && maxInterval) {
        minInterval.setAttribute('title', 'Recomendado: mínimo 60 segundos para evitar bloqueios');
        maxInterval.setAttribute('title', 'Recomendado: máximo 120 segundos para simular comportamento natural');

        // Validação em tempo real
        minInterval.addEventListener('input', function () {
            const value = parseInt(this.value);
            if (value < 60) {
                this.style.borderColor = '#ffc107';
                showSafetyTip('intervals');
            } else {
                this.style.borderColor = '';
            }
        });

        maxInterval.addEventListener('input', function () {
            const value = parseInt(this.value);
            if (value < 60) {
                this.style.borderColor = '#dc3545';
                showSafetyTip('intervals');
            } else {
                this.style.borderColor = '';
            }
        });
    }
}

// Inicializar tooltips ao carregar
document.addEventListener('DOMContentLoaded', function () {
    // Aguardar um pouco para garantir que outros scripts carregaram
    setTimeout(() => {
        addSafetyTooltips();
    }, 1000);
});

// ========================================
// GERENCIAMENTO DE TEMPORIZADOR SEMPRE VISÍVEL
// ========================================
const TimerManager = {
    timerInterval: null,
    startTime: null,
    duration: 0,
    isPaused: false,
    currentState: 'idle', // idle, countdown, paused, batch-pause, sending, completed

    initialize() {
        console.log('⏱️ Inicializando TimerManager...');

        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.style.display = 'block';
        }

        this.showIdle();
    },

    // Estado: Aguardando/Inativo
    showIdle() {
        this.currentState = 'idle';
        this.updateDisplay('Aguardando...', 'info', 'secondary');
        this.updateLabel('Status do envio:');
        this.updateDetails('Configure uma lista de contatos e inicie o disparo');
        this.updateProgress(0, 'secondary');
        this.clear();
    },

    // Estado: Preparando envio
    showPreparing() {
        this.currentState = 'preparing';
        this.updateDisplay('Preparando...', 'info', 'primary');
        this.updateLabel('Preparando envio:');
        this.updateDetails('Validando dados e iniciando disparo em massa');
        this.updateProgress(0, 'primary');
    },

    // Estado: Enviando mensagem
    showSending(contactName, currentIndex, total) {
        this.currentState = 'sending';
        this.updateDisplay('Enviando...', 'warning', 'warning');
        this.updateLabel('Enviando para:');
        this.updateDetails(`${contactName} (${currentIndex + 1}/${total})`);
        this.updateProgress(100, 'warning');
    },

    // Estado: Contagem regressiva para próximo envio
    startCountdown(durationMs, currentIndex, total) {
        this.currentState = 'countdown';
        this.duration = durationMs;
        this.startTime = Date.now();
        this.isPaused = false;

        this.updateLabel('Próximo envio em:');
        this.updateDetails(`Aguardando intervalo de segurança (${currentIndex + 1}/${total})`);
        this.updateTimerClass('info');

        this.clear();
        this.timerInterval = setInterval(() => {
            this.updateCountdown();
        }, 100);

        this.updateCountdown();
    },

    // Estado: Pausa de lote
    startBatchPause(durationMs, batchNumber, totalBatches) {
        this.currentState = 'batch-pause';
        this.duration = durationMs;
        this.startTime = Date.now();
        this.isPaused = false;

        this.updateLabel('Pausa entre lotes:');
        this.updateDetails(`Lote ${batchNumber}/${totalBatches} - Pausa para evitar bloqueios`);
        this.updateTimerClass('warning');

        this.clear();
        this.timerInterval = setInterval(() => {
            this.updateCountdown();
        }, 100);

        this.updateCountdown();
    },

    // Estado: Pausado pelo usuário
    showPaused() {
        this.currentState = 'paused';
        this.isPaused = true;
        this.updateDisplay('PAUSADO', 'secondary', 'secondary');
        this.updateLabel('Envio pausado:');
        this.updateDetails('Clique em "Retomar Envio" para continuar');
        this.updateProgress(50, 'secondary');
    },

    // Estado: Finalizado
    showCompleted(successCount, errorCount, totalTime) {
        this.currentState = 'completed';
        this.clear();

        const successRate = totalTime ? ((successCount / (successCount + errorCount)) * 100).toFixed(1) : 0;

        this.updateDisplay('Concluído!', 'success', 'success');
        this.updateLabel('Disparo finalizado:');
        this.updateDetails(`${successCount} sucessos, ${errorCount} erros (${successRate}% sucesso) em ${Utils.formatTime(totalTime)}`);
        this.updateProgress(100, 'success');

        // Voltar ao idle após 10 segundos
        setTimeout(() => {
            if (this.currentState === 'completed') {
                this.showIdle();
            }
        }, 10000);
    },

    // Estado: Erro/Interrompido
    showStopped() {
        this.currentState = 'stopped';
        this.clear();
        this.updateDisplay('Interrompido', 'danger', 'danger');
        this.updateLabel('Envio interrompido:');
        this.updateDetails('O disparo foi interrompido pelo usuário');
        this.updateProgress(0, 'danger');

        // Voltar ao idle após 5 segundos
        setTimeout(() => {
            if (this.currentState === 'stopped') {
                this.showIdle();
            }
        }, 5000);
    },

    // Atualizar contagem regressiva
    updateCountdown() {
        if (this.isPaused) return;

        const now = Date.now();
        const elapsed = now - this.startTime;
        const remaining = Math.max(0, this.duration - elapsed);

        if (remaining <= 0) {
            this.finish();
            return;
        }

        // Atualizar display do tempo
        const seconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

        const countdownElement = document.getElementById('timerCountdown');
        if (countdownElement) {
            countdownElement.textContent = display;

            // Mudar cor conforme tempo restante
            if (seconds <= 5) {
                countdownElement.className = 'badge bg-danger fs-6';
            } else if (seconds <= 10) {
                countdownElement.className = 'badge bg-warning fs-6';
            } else {
                const bgClass = this.currentState === 'batch-pause' ? 'bg-warning' : 'bg-primary';
                countdownElement.className = `badge ${bgClass} fs-6`;
            }
        }

        // Atualizar barra de progresso
        const percentage = ((this.duration - remaining) / this.duration) * 100;
        this.updateProgress(percentage, this.currentState === 'batch-pause' ? 'warning' : 'primary');
    },

    // Métodos auxiliares para atualizar elementos
    updateDisplay(text, alertClass, badgeClass) {
        const countdownElement = document.getElementById('timerCountdown');
        const timerElement = document.getElementById('nextSendTimer');

        if (countdownElement) {
            countdownElement.textContent = text;
            countdownElement.className = `badge bg-${badgeClass} fs-6`;
        }

        if (timerElement) {
            timerElement.className = `alert alert-${alertClass}`;
        }
    },

    updateLabel(text) {
        const labelElement = document.getElementById('timerLabel');
        if (labelElement) {
            labelElement.textContent = text;
        }
    },

    updateDetails(text) {
        const detailsElement = document.getElementById('timerDetails');
        if (detailsElement) {
            detailsElement.textContent = text;
        }
    },

    updateProgress(percentage, colorClass) {
        const progressElement = document.getElementById('timerProgress');
        if (progressElement) {
            progressElement.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            progressElement.className = `progress-bar bg-${colorClass}`;
        }
    },

    updateTimerClass(alertClass) {
        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.className = `alert alert-${alertClass}`;
        }
    },

    // Pausar contagem regressiva
    pause() {
        if (this.currentState === 'countdown' || this.currentState === 'batch-pause') {
            this.isPaused = true;
            this.showPaused();
        }
    },

    // ✅ SUBSTITUA ESTA FUNÇÃO NO TimerManager
    resume() {
        if (this.currentState === 'paused') {
            this.isPaused = false;

            // ✅ NOVO: Verificar se intervalos mudaram durante a pausa
            const currentMinInterval = parseInt(document.getElementById('minInterval')?.value || 0) * 1000;
            const currentMaxInterval = parseInt(document.getElementById('maxInterval')?.value || 0) * 1000;

            // Calcular novo intervalo com as configurações atuais
            const newDelay = Math.random() * (currentMaxInterval - currentMinInterval) + currentMinInterval;

            console.log('▶️ Retomando com configurações atuais:', {
                minInterval: `${currentMinInterval / 1000}s`,
                maxInterval: `${currentMaxInterval / 1000}s`,
                newDelay: `${(newDelay / 1000).toFixed(1)}s`
            });

            // Usar novo intervalo calculado
            this.startTime = Date.now();
            this.duration = newDelay;
            this.currentState = 'countdown';
            this.updateLabel('Próximo envio em:');
            this.updateDetails('Envio retomado - usando configurações atuais');
            this.updateTimerClass('info');

            UI.showInfo(`Envio retomado com intervalo de ${(newDelay / 1000).toFixed(1)}s`);
        }
    },

    finish() {
        this.clear();
    },

    clear() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    hide() {
        if (this.currentState !== 'countdown' && this.currentState !== 'batch-pause' && this.currentState !== 'sending') {
            this.showIdle();
        }
    },

    startSendTimer(durationMs) {
        this.startCountdown(durationMs, 0, AppState.contacts.length);
    },

    cleanup() {
        console.log('🧹 Limpando TimerManager...');

        this.clear();
        this.currentState = 'idle';
        this.isPaused = false;
        this.duration = 0;
        this.startTime = null;

        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }

        this.updateDisplay('', 'secondary', 'secondary');
        this.updateProgress(0, 'secondary');

        console.log('✅ TimerManager limpo');
    },
};

// ========================================
// 1. GERENCIADOR DE EXPORTAÇÃO DE CONTATOS
// ========================================

const InstanceContactsExporter = {

    isExporting: false,

    async exportInstanceContacts(instanceId) {
        if (this.isExporting) {
            console.log('⚠️ Exportação já em andamento, ignorando chamada duplicada');
            return;
        }

        this.isExporting = true;

        const instance = AppState.instances.find(inst => inst.id === instanceId);
        if (!instance) {
            this.isExporting = false;
            UI.showError('Instância não encontrada');
            return;
        }

        console.log('📋 Iniciando exportação de contatos da instância:', {
            id: instance.id,
            name: instance.name,
            apikey: `••••${instance.apikey.slice(-4)}`
        });

        UI.showLoading('Buscando contatos da instância WhatsApp...');

        try {
            const requestBody = {
                action: 'exportar_contatos',
                instanceName: instance.name,
                instanceAPIKEY: instance.apikey,
                instanceId: instance.id
            };

            console.log('📤 Enviando requisição para:', WEBHOOK_URL);
            console.log('📋 Dados da requisição:', {
                action: requestBody.action,
                instanceName: requestBody.instanceName,
                instanceId: requestBody.instanceId,
                apikey: `••••${requestBody.instanceAPIKEY.slice(-4)}`
            });

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: {
                    contentType: response.headers.get('content-type')
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contactsData = await response.json();

            console.log('📊 Dados recebidos:', {
                isArray: Array.isArray(contactsData),
                length: Array.isArray(contactsData) ? contactsData.length : 'N/A',
                type: typeof contactsData,
                sample: Array.isArray(contactsData) && contactsData.length > 0 ? contactsData[0] : null
            });

            UI.hideLoading();

            if (!Array.isArray(contactsData)) {
                console.error('❌ Resposta inválida - não é array:', contactsData);
                throw new Error('Resposta inválida do servidor - dados não são uma lista');
            }

            if (contactsData.length === 0) {
                UI.showWarning(`Nenhum contato encontrado na instância "${instance.name}"`);
                return;
            }

            console.log(`✅ ${contactsData.length} contatos recebidos da instância "${instance.name}"`);

            this.showExportOptions(contactsData, instance.name);

        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro completo ao exportar contatos:', {
                message: error.message,
                stack: error.stack,
                instanceId: instance.id,
                instanceName: instance.name
            });

            if (error.message.includes('404')) {
                UI.showError(`Instância "${instance.name}" não encontrada no servidor WhatsApp`);
            } else if (error.message.includes('401') || error.message.includes('403')) {
                UI.showError(`APIKEY da instância "${instance.name}" é inválida ou sem permissão`);
            } else if (error.message.includes('500')) {
                UI.showError(`Erro interno do servidor ao acessar "${instance.name}"`);
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                UI.showError('Erro de conectividade - verifique sua conexão com a internet');
            } else {
                UI.showError(`Erro ao buscar contatos de "${instance.name}": ${error.message}`);
            }
        } finally {
            this.isExporting = false;
        }
    },

    // Mostrar opções para o usuário escolher
    showExportOptions(contactsData, instanceName) {
        const modalContent = `
            <div class="modal fade" id="exportOptionsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-gradient-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-download me-2"></i>Contatos da Instância: ${instanceName}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                <strong>${contactsData.length} contatos</strong> encontrados na instância WhatsApp.
                                Escolha como deseja processar estes contatos:
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card border-success h-100">
                                        <div class="card-body text-center">
                                            <i class="bi bi-list-ul fs-1 text-success mb-3"></i>
                                            <h6 class="card-title">Importar para Lista</h6>
                                            <p class="card-text small">
                                                Adiciona os contatos diretamente à lista do disparador, 
                                                aplicando todas as validações e formatações automáticas.
                                            </p>
                                            <button class="btn btn-success w-100" onclick="InstanceContactsExporter.importToContactsList('${instanceName}')">
                                                <i class="bi bi-arrow-down-circle me-2"></i>Importar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="card border-primary h-100">
                                        <div class="card-body text-center">
                                            <i class="bi bi-file-earmark-excel fs-1 text-primary mb-3"></i>
                                            <h6 class="card-title">Baixar Excel</h6>
                                            <p class="card-text small">
                                                Gera um arquivo Excel com todos os contatos 
                                                para uso externo ou backup.
                                            </p>
                                            <button class="btn btn-primary w-100" onclick="InstanceContactsExporter.downloadExcel('${instanceName}')">
                                                <i class="bi bi-download me-2"></i>Baixar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <div class="alert alert-warning">
                                    <strong><i class="bi bi-exclamation-triangle me-2"></i>Importante:</strong>
                                    <ul class="mb-0 mt-2">
                                        <li>A importação aplicará as validações de número configuradas</li>
                                        <li>Números inválidos serão filtrados automaticamente</li>
                                        <li>A lista atual será <strong>substituída</strong> pelos novos contatos</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const existingModal = document.getElementById('exportOptionsModal');
        if (existingModal) {
            const existingInstance = bootstrap.Modal.getInstance(existingModal);
            if (existingInstance) {
                existingInstance.dispose();
            }
            existingModal.remove();
            console.log('🗑️ Modal anterior removido');
        }

        // Limpar dados temporários anteriores
        this.clearTempData();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Armazenar dados temporariamente com timestamp
        window.tempContactsData = contactsData;
        window.tempInstanceName = instanceName;
        window.tempDataTimestamp = Date.now();

        // Configurar limpeza automática quando modal fechar
        const modalElement = document.getElementById('exportOptionsModal');
        const modal = new bootstrap.Modal(modalElement);

        // Event listener para limpar dados quando modal fechar
        modalElement.addEventListener('hidden.bs.modal', () => {
            console.log('🧹 Modal fechado, limpando dados temporários...');
            this.clearTempData();
            // ✅ GARANTIR que flag seja liberada quando modal fechar
            this.isExporting = false;
            setTimeout(() => {
                if (modalElement && modalElement.parentNode) {
                    modalElement.remove();
                }
            }, 300);
        });

        // Mostrar modal
        modal.show();
    },

    // limpar dados temporários
    clearTempData() {
        if (typeof window.tempContactsData !== 'undefined') {
            delete window.tempContactsData;
        }
        if (typeof window.tempInstanceName !== 'undefined') {
            delete window.tempInstanceName;
        }
        if (typeof window.tempDataTimestamp !== 'undefined') {
            delete window.tempDataTimestamp;
        }
        console.log('🗑️ Dados temporários limpos');
    },

    async importToContactsList(instanceName) {
        // ✅ Validar se dados ainda são válidos (não muito antigos)
        const maxAge = 5 * 60 * 1000; // 5 minutos
        if (!window.tempContactsData || !window.tempDataTimestamp ||
            (Date.now() - window.tempDataTimestamp) > maxAge) {
            UI.showError('Dados expiraram. Tente exportar novamente.');
            this.clearTempData();
            return;
        }

        const contactsData = window.tempContactsData;
        console.log('📋 Importando contatos para a lista do disparador...');

        // ✅ Fechar modal E limpar dados
        const modal = bootstrap.Modal.getInstance(document.getElementById('exportOptionsModal'));
        if (modal) {
            modal.hide();
        }
        this.clearTempData();

        UI.showLoading('Processando e validando contatos...');

        try {
            // Processar contatos com validação completa
            const processedContacts = this.processContactsForImport(contactsData);

            // Aplicar validações do sistema
            const { validContacts, invalidContacts } = this.validateContactsForImport(processedContacts);

            if (validContacts.length === 0) {
                UI.hideLoading();
                UI.showError('Nenhum contato válido encontrado após as validações');
                return;
            }

            // Confirmar substituição da lista atual
            if (AppState.contacts.length > 0) {
                UI.hideLoading();

                UI.confirm(
                    'Substituir Lista Atual',
                    `Você possui <strong>${AppState.contacts.length} contatos</strong> na lista atual.<br><br>` +
                    `Deseja substituir por <strong>${validContacts.length} contatos</strong> da instância "${instanceName}"?<br><br>` +
                    `<small class="text-muted">Esta ação não pode ser desfeita.</small>`,
                    () => {
                        this.replaceContactsList(validContacts, invalidContacts, instanceName);
                    }
                );
            } else {
                UI.hideLoading();
                this.replaceContactsList(validContacts, invalidContacts, instanceName);
            }

        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro ao importar contatos:', error);
            UI.showError('Erro ao processar contatos: ' + error.message);
        }
    },


    // Processar contatos para importação
    processContactsForImport(contactsData) {
        return contactsData
            .filter(contact => contact.telefone && contact.telefone.trim())
            .map((contact, index) => {
                const name = contact.nome && contact.nome.trim() ? contact.nome.trim() : `Contato ${index + 1}`;
                const rawPhone = contact.telefone.trim();

                return {
                    name: name,
                    rawPhone: rawPhone,
                    email: '', // WhatsApp não fornece email
                    source: 'WhatsApp'
                };
            });
    },

    // Validar contatos usando o sistema existente
    validateContactsForImport(contacts) {
        const validContacts = [];
        const invalidContacts = [];

        contacts.forEach((contact, index) => {
            // Usar o sistema de validação existente
            const phoneValidation = PhoneUtils.isValidPhone(contact.rawPhone);

            const processedContact = {
                name: contact.name,
                phone: phoneValidation.valid ? phoneValidation.formatted : PhoneUtils.formatPhone(contact.rawPhone),
                email: contact.email || '',
                rawPhone: contact.rawPhone,
                isValid: phoneValidation.valid,
                error: phoneValidation.error || null,
                row: index + 1,
                validationMode: PhoneUtils.getValidationMode().modeName,
                source: 'WhatsApp'
            };

            if (phoneValidation.valid) {
                validContacts.push(processedContact);
            } else {
                invalidContacts.push(processedContact);
            }
        });

        return { validContacts, invalidContacts };
    },

    // Substituir lista de contatos
    replaceContactsList(validContacts, invalidContacts, instanceName) {
        console.log(`📋 Substituindo lista por ${validContacts.length} contatos da instância ${instanceName}`);

        // Remover duplicatas (mesmo telefone)
        const { uniqueContacts, duplicates } = ContactManager.removeDuplicates(validContacts);

        // Atualizar estado global
        AppState.contacts = uniqueContacts;

        // Atualizar interface
        ContactManager.updateContactsList();
        TimeEstimator.update();

        // Mostrar arquivo importado
        document.getElementById('fileInfo').style.display = 'block';
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
            fileInfo.innerHTML = `
                <span class="badge bg-success">
                    <i class="bi bi-whatsapp me-1"></i>
                    ${uniqueContacts.length} contatos importados da instância ${instanceName}
                </span>
            `;
        }

        // Mostrar resumo detalhado
        this.showImportSummary(
            validContacts.length,
            uniqueContacts.length,
            duplicates.length,
            invalidContacts.length,
            instanceName
        );

        UI.showSuccess(`✅ ${uniqueContacts.length} contatos importados da instância "${instanceName}"!`);
    },

    // Mostrar resumo da importação
    showImportSummary(totalValid, finalCount, duplicates, invalid, instanceName) {
        const validationMode = PhoneUtils.getValidationMode();

        const summaryText = `
            <div style="text-align: left; line-height: 1.6; padding: 0px 20px">
                <strong>📱 Instância:</strong> ${instanceName}<br>
                <strong>🔧 Modo:</strong> ${validationMode.modeName}<br>
                <strong>📋 Descrição:</strong> ${validationMode.description}<br><br>
                • Total processados: <strong>${totalValid + invalid}</strong><br>
                • Contatos válidos: <strong style="color: #28a745;">${totalValid}</strong><br>
                • Duplicados removidos: <strong style="color: #ffc107;">${duplicates}</strong><br>
                • Inválidos ignorados: <strong style="color: #dc3545;">${invalid}</strong><br>
                • <strong>Final na lista: <span style="color: #007bff;">${finalCount}</span></strong>
            </div>
        `;

        Notiflix.Report.success(
            'Importação Concluída',
            summaryText,
            'OK',
            {
                width: '550px',
                messageMaxLength: 3000,
                plainText: false,
                titleFontSize: '22px',
                messageFontSize: '14px'
            }
        );
    },

    // Baixar Excel (método original)
    downloadExcel(instanceName) {
        // ✅ Validar se dados ainda são válidos
        if (!window.tempContactsData || !window.tempDataTimestamp ||
            (Date.now() - window.tempDataTimestamp) > (5 * 60 * 1000)) {
            UI.showError('Dados expiraram. Tente exportar novamente.');
            this.clearTempData();
            return;
        }

        const contactsData = window.tempContactsData;

        // ✅ Fechar modal E limpar dados
        const modal = bootstrap.Modal.getInstance(document.getElementById('exportOptionsModal'));
        if (modal) {
            modal.hide();
        }
        this.clearTempData();

        // Usar método original
        this.processAndExportContacts(contactsData, instanceName);
    },

    processAndExportContacts(contactsData, instanceName) {
        console.log('📊 Processando contatos para Excel...');

        try {
            // Filtrar e processar contatos
            const processedContacts = contactsData
                .filter(contact => contact.telefone && contact.telefone.trim()) // Só contatos com telefone
                .map(contact => {
                    const name = contact.nome && contact.nome.trim() ? contact.nome.trim() : 'Sem nome';
                    const phone = this.formatPhone(contact.telefone);
                    const displayPhone = this.formatPhoneForDisplay(phone);

                    return {
                        nome: name,
                        telefone: phone,
                        telefoneFormatado: displayPhone
                    };
                });

            if (processedContacts.length === 0) {
                UI.showWarning('Nenhum contato válido encontrado');
                return;
            }

            // Preparar dados para Excel
            const excelData = [
                ['Nome', 'Telefone', 'Telefone Formatado', 'Status'],
                ...processedContacts.map(contact => [
                    contact.nome,
                    contact.telefone,
                    contact.telefoneFormatado,
                    'WhatsApp'
                ])
            ];

            // Criar workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(excelData);

            // Configurar largura das colunas
            ws['!cols'] = [
                { wch: 25 }, // Nome
                { wch: 18 }, // Telefone
                { wch: 20 }, // Telefone Formatado
                { wch: 12 }  // Status
            ];

            // Estilizar cabeçalho
            const headerRange = XLSX.utils.decode_range('A1:D1');
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;

                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "E3F2FD" } },
                    border: {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" }
                    }
                };
            }

            // Adicionar planilha ao workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Contatos WhatsApp');

            // Gerar nome do arquivo
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const sanitizedInstanceName = instanceName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `contatos_${sanitizedInstanceName}_${dateStr}_${timeStr}.xlsx`;

            // Fazer download
            XLSX.writeFile(wb, fileName);

            console.log(`✅ Excel gerado: ${fileName}`);

            UI.showSuccess(`✅ ${processedContacts.length} contatos exportados para: ${fileName}`);

            // Mostrar resumo
            this.showExportSummary(contactsData.length, processedContacts.length, instanceName);

        } catch (error) {
            console.error('❌ Erro ao gerar Excel:', error);
            UI.showError('Erro ao gerar arquivo Excel: ' + error.message);
        }
    },

    // Formatar telefone (remover caracteres especiais)
    formatPhone(phone) {
        if (!phone) return '';

        // Remover todos os caracteres não numéricos
        const cleaned = phone.replace(/\D/g, '');

        // Se já tem código do país (55), manter
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            return cleaned;
        }

        // Se não tem, assumir que é brasileiro e adicionar 55
        return '55' + cleaned;
    },

    // Formatar telefone para exibição
    formatPhoneForDisplay(phone) {
        if (!phone) return '';

        const cleaned = phone.replace(/\D/g, '');

        // Remover 55 temporariamente para formatação visual
        let displayNumber = cleaned;
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            displayNumber = cleaned.substring(2);
        }

        // Formatar como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
        if (displayNumber.length === 11) {
            return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 7)}-${displayNumber.substring(7)}`;
        } else if (displayNumber.length === 10) {
            return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 6)}-${displayNumber.substring(6)}`;
        }

        return phone;
    },

    // Mostrar resumo da exportação
    showExportSummary(totalReceived, totalExported, instanceName) {
        const filtered = totalReceived - totalExported;

        const summaryText = `
            <div style="text-align: left; line-height: 1.6; padding: 0px 20px">
                <strong>📱 Instância:</strong> ${instanceName}<br><br>
                • Total recebidos: <strong>${totalReceived}</strong><br>
                • Contatos válidos: <strong style="color: #28a745;">${totalExported}</strong><br>
                ${filtered > 0 ? `• Filtrados (sem telefone): <strong style="color: #ffc107;">${filtered}</strong><br>` : ''}
                <br>
                <strong>✅ Arquivo Excel gerado com sucesso!</strong>
            </div>
        `;

        Notiflix.Report.success(
            'Exportação Concluída',
            summaryText,
            'OK',
            {
                width: '450px',
                messageMaxLength: 3000,
                plainText: false,
                titleFontSize: '22px',
                messageFontSize: '14px'
            }
        );
    },

    // Seletor de instância para importação rápida
    showInstanceSelector() {
        const connectedInstances = AppState.instances.filter(inst => inst.status === 'connected');

        if (connectedInstances.length === 0) {
            UI.showWarning('Nenhuma instância conectada encontrada');
            return;
        }

        if (connectedInstances.length === 1) {
            // Se só há uma instância, importar diretamente
            this.exportInstanceContacts(connectedInstances[0].id);
            return;
        }

        // Mostrar seletor se há múltiplas instâncias
        const modalContent = `
            <div class="modal fade" id="instanceSelectorModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-gradient-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-whatsapp me-2"></i>Escolher Instância
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Selecione a instância WhatsApp para importar os contatos:</p>
                            
                            <div class="list-group">
                                ${connectedInstances.map(instance => `
                                    <a href="#" class="list-group-item list-group-item-action" 
                                       onclick="InstanceContactsExporter.selectInstanceForImport(${instance.id})">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${instance.name}</h6>
                                                <small class="text-muted">••••${instance.apikey.slice(-4)}</small>
                                            </div>
                                            <span class="badge bg-success">Conectado</span>
                                        </div>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const existingModal = document.getElementById('instanceSelectorModal');
        if (existingModal) existingModal.remove();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('instanceSelectorModal'));
        modal.show();
    },

    // Selecionar instância para importação
    selectInstanceForImport(instanceId) {
        // Fechar modal seletor
        const modal = bootstrap.Modal.getInstance(document.getElementById('instanceSelectorModal'));
        if (modal) modal.hide();

        // Executar importação
        this.exportInstanceContacts(instanceId);
    },
    async exportAllInstancesContacts() {
        const connectedInstances = AppState.instances.filter(inst => inst.status === 'connected');

        if (connectedInstances.length === 0) {
            UI.showWarning('Nenhuma instância conectada encontrada');
            return;
        }

        UI.confirm(
            'Exportar Todos os Contatos',
            `Deseja exportar os contatos de todas as ${connectedInstances.length} instâncias conectadas?<br><br>` +
            `<small>Serão gerados ${connectedInstances.length} arquivos Excel separados.</small>`,
            async () => {
                UI.showLoading('Exportando contatos de todas as instâncias...');

                let successCount = 0;
                let totalContacts = 0;

                for (const instance of connectedInstances) {
                    try {
                        console.log(`📋 Exportando contatos da instância: ${instance.name}`);

                        const response = await fetch(APP_CONFIG.webhookExportContacts, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                instanceName: instance.name,
                                instanceAPIKEY: instance.apikey
                            })
                        });

                        if (response.ok) {
                            const contactsData = await response.json();
                            if (Array.isArray(contactsData) && contactsData.length > 0) {
                                this.processAndExportContacts(contactsData, instance.name);
                                successCount++;
                                totalContacts += contactsData.length;
                            }
                        }

                        // Pequena pausa entre requisições
                        await new Promise(resolve => setTimeout(resolve, 1000));

                    } catch (error) {
                        console.error(`❌ Erro ao exportar ${instance.name}:`, error);
                    }
                }

                UI.hideLoading();

                if (successCount > 0) {
                    UI.showSuccess(`✅ Contatos exportados de ${successCount}/${connectedInstances.length} instâncias (${totalContacts} contatos total)`);
                } else {
                    UI.showError('Nenhuma instância teve contatos exportados com sucesso');
                }
            }
        );
    }
};

// ========================================
// 2. ATUALIZAR O INSTANCEMANAGER PARA INCLUIR BOTÃO
// ========================================

// Função para atualizar a lista de instâncias (adicionar ao InstanceManager.updateInstancesList)
const updateInstancesListWithExportButton = function () {
    const instancesList = document.getElementById('instancesList');
    if (!instancesList) {
        console.warn('⚠️ Elemento instancesList não encontrado');
        return;
    }

    if (AppState.instances.length === 0) {
        instancesList.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-server fs-3 d-block mb-2"></i>
                Nenhuma instância cadastrada
            </div>
        `;
        return;
    }

    instancesList.innerHTML = AppState.instances.map(instance => `
        <div class="col-md-6 col-lg-3 mb-3">
            <div class="card instance-card ${instance.status}" style="position: relative;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${instance.name}</h6>
                        <span class="badge status-badge ${InstanceManager.getStatusBadgeClass(instance.status)}">
                            ${InstanceManager.getStatusText(instance.status)}
                        </span>
                    </div>
                    
                    <p class="card-text small text-muted mb-2">
                        <i class="bi bi-key me-1"></i>
                        APIKEY: ••••${instance.apikey.slice(-4)}
                    </p>
                    
                    <div class="row text-center mb-3">
                        <div class="col-4">
                            <small class="text-muted">Total</small>
                            <div class="fw-bold">${instance.totalSent || 0}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Sucesso</small>
                            <div class="fw-bold text-success">${instance.successCount || 0}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Erro</small>
                            <div class="fw-bold text-danger">${instance.errorCount || 0}</div>
                        </div>
                    </div>
                    
                    <div class="instance-actions">
                        <button class="btn btn-outline-primary btn-sm check-connection-btn" 
                                data-instance-id="${instance.id}"
                                title="Verificar conexão">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        
                        ${instance.status === 'connected' ? `
                            <button class="btn btn-outline-success btn-sm export-contacts-btn" 
                                    data-instance-id="${instance.id}"
                                    title="Importar/Exportar contatos WhatsApp">
                                <i class="bi bi-people"></i>
                            </button>
                        ` : ''}
                        
                        ${instance.status === 'disconnected' ? `
                            <button class="btn btn-outline-warning btn-sm show-qr-btn" 
                                    data-instance-id="${instance.id}"
                                    title="Conectar">
                                <i class="bi bi-qr-code"></i>
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-outline-danger btn-sm remove-instance-btn" 
                                data-instance-id="${instance.id}"
                                title="Remover">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    
                    <small class="text-muted">
                        Última verificação: ${Utils.safeFormatTime(instance.lastCheck)}
                    </small>
                </div>
            </div>
        </div>
    `).join('');

    // Organizar em grid
    instancesList.innerHTML = `<div class="row">${instancesList.innerHTML}</div>`;

    this.updateActiveInstances();
};

// ========================================
// 3. EVENTOS E INTEGRAÇÃO
// ========================================

// Adicionar ao event delegation do InstanceManager
document.addEventListener('click', (e) => {
    const instanceButton = e.target.closest('.export-contacts-btn');

    if (instanceButton) {
        e.preventDefault();
        e.stopPropagation();

        if (InstanceContactsExporter.isExporting) {
            console.log('⚠️ Exportação já em andamento, ignorando clique');
            return;
        }

        const instanceId = parseInt(instanceButton.dataset.instanceId);
        if (instanceId) {
            setTimeout(() => {
                InstanceContactsExporter.exportInstanceContacts(instanceId);
            }, 100);
        }
    }
});

// ========================================
// 4. INTEGRAÇÃO COM MENU EXISTENTE
// ========================================

// Adicionar botão no menu principal (onde está "Exportar Contatos")
const addExportInstanceContactsButton = function () {
    const exportContactsBtn = document.getElementById('exportContactsBtn');

    if (exportContactsBtn && exportContactsBtn.parentNode) {
        // Criar botão para importar de todas as instâncias
        const importAllBtn = document.createElement('button');
        importAllBtn.type = 'button';
        importAllBtn.className = 'btn btn-outline-success btn-sm me-1';
        importAllBtn.id = 'importAllInstanceContactsBtn';
        importAllBtn.title = 'Importar contatos de uma instância WhatsApp';
        importAllBtn.innerHTML = '<i class="bi bi-whatsapp me-1"></i>WhatsApp';
        importAllBtn.style.display = 'none'; // Inicialmente oculto

        // Inserir antes do botão existente
        exportContactsBtn.parentNode.insertBefore(importAllBtn, exportContactsBtn);

        // Event listener
        importAllBtn.addEventListener('click', () => {
            InstanceContactsExporter.showInstanceSelector();
        });

        console.log('✅ Botão de importação de instâncias adicionado');
    }
};

// ========================================
// 5. INICIALIZAÇÃO
// ========================================

// Adicionar à inicialização do InstanceManager
const initializeInstanceContactsExporter = function () {
    console.log('🔧 Inicializando InstanceContactsExporter...');

    // Sobrescrever a função updateInstancesList do InstanceManager
    if (typeof InstanceManager !== 'undefined') {
        const originalUpdateFunction = InstanceManager.updateInstancesList;
        InstanceManager.updateInstancesList = updateInstancesListWithExportButton;
        console.log('✅ Função updateInstancesList atualizada com botão de exportação');
    }

    // Adicionar botão no menu principal
    setTimeout(() => {
        addExportInstanceContactsButton();

        // Mostrar/ocultar botão baseado em instâncias conectadas
        const updateButtonVisibility = () => {
            const importAllBtn = document.getElementById('importAllInstanceContactsBtn');
            const connectedInstances = AppState.instances.filter(inst => inst.status === 'connected');

            if (importAllBtn) {
                importAllBtn.style.display = connectedInstances.length > 0 ? 'inline-block' : 'none';
            }
        };

        // Atualizar visibilidade periodicamente
        setInterval(updateButtonVisibility, 2000);
        updateButtonVisibility();

    }, 1000);
};

// Auto-inicializar quando script carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInstanceContactsExporter);
} else {
    initializeInstanceContactsExporter();
}

// Expor para uso global
window.InstanceContactsExporter = InstanceContactsExporter;


// ========================================
// GERENCIAMENTO DO CAMPO DE ASSUNTO DO E-MAIL
// ========================================
const EmailSubjectManager = {
    initialize() {
        console.log('📧 Inicializando EmailSubjectManager...');

        const enableEmailCheckbox = document.getElementById('enableEmailSending');
        const subjectContainer = document.getElementById('emailSubjectContainer');

        if (enableEmailCheckbox && subjectContainer) {
            // Event listener para mostrar/ocultar campo de assunto
            enableEmailCheckbox.addEventListener('change', (e) => {
                this.toggleSubjectField(e.target.checked);
            });

            // Inicializar estado
            this.toggleSubjectField(enableEmailCheckbox.checked);

            console.log('✅ EmailSubjectManager inicializado');
        } else {
            console.warn('⚠️ Elementos de e-mail não encontrados:', {
                checkbox: !!enableEmailCheckbox,
                container: !!subjectContainer
            });
        }
    },

    toggleSubjectField(show) {
        const subjectContainer = document.getElementById('emailSubjectContainer');
        const subjectInput = document.getElementById('emailSubject');

        if (subjectContainer) {
            subjectContainer.style.display = show ? 'block' : 'none';

            // Se mostrar, focar no campo após um delay
            if (show && subjectInput) {
                setTimeout(() => {
                    subjectInput.focus();
                }, 200);
            }

            // Se ocultar, limpar o campo
            if (!show && subjectInput) {
                subjectInput.value = '';
            }
        }
    },

    getEmailSubject() {
        const subjectInput = document.getElementById('emailSubject');
        const enableEmail = document.getElementById('enableEmailSending')?.checked;

        if (!enableEmail || !subjectInput) {
            return '';
        }

        return subjectInput.value.trim();
    },

    processEmailSubject(subject, contactName) {
        if (!subject) return 'Mensagem'; // Assunto padrão

        // Processar tags básicas
        let processedSubject = subject
            .replace(/{nome}/g, contactName)
            .replace(/{saudacao}/g, Utils.getSaudacao());

        // Processar tags com variações (se disponível)
        if (typeof RandomTagsSystem !== 'undefined') {
            processedSubject = RandomTagsSystem.processAllTags(processedSubject);
        }

        return processedSubject.trim() || 'Mensagem';
    }
};

window.EmailSubjectManager = EmailSubjectManager;

// Sincronizar dados entre Dashboard e Resultados
function updateResultsSection() {
    // Copiar dados do dashboard para resultados
    const totalSent = document.getElementById('totalSent')?.textContent || '0';
    const successCount = document.getElementById('successCount')?.textContent || '0';
    const errorCount = document.getElementById('errorCount')?.textContent || '0';

    // Atualizar seção resultados
    const totalSentResults = document.getElementById('totalSentResults');
    if (totalSentResults) totalSentResults.textContent = totalSent;

    // Calcular taxa de sucesso
    const total = parseInt(totalSent) || 0;
    const success = parseInt(successCount) || 0;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;

    const successRateEl = document.getElementById('successRate');
    if (successRateEl) successRateEl.textContent = rate + '%';

    // Duplicar gráfico
    const originalChart = document.getElementById('resultsChart');
    const resultsChart = document.getElementById('resultsChartResults');
    if (originalChart && resultsChart && window.Chart) {
        // Copiar configuração do gráfico original
    }
}

// Chamar a cada atualização
setInterval(updateResultsSection, 2000);

window.clearMediaUrl = function (msgId) {
    if (typeof MultipleMessagesManager !== 'undefined') {
        MultipleMessagesManager.clearMediaUrl(msgId);
    }
};

// ========================================
// SISTEMA DE AUTO-SAVE MELHORADO
// ========================================

const AutoSaveManager = {
    saveKey: 'disparador_session_data',
    debounceTimeout: null,
    isLoading: false,

    initialize() {
        console.log('💾 Inicializando sistema de auto-save...');

        // Carregar dados salvos ao inicializar
        this.loadSessionData();

        // Configurar salvamento automático
        this.setupAutoSave();

        // Salvar antes de fechar a página
        window.addEventListener('beforeunload', () => {
            this.saveSessionDataSync();
        });

        // ✅ ADICIONAR ESTA LINHA
        setTimeout(() => {
            this.updateDashboardStorageCard();
        }, 2000);

        console.log('✅ Sistema de auto-save inicializado');
    },

    loadSessionData() {
        try {
            console.log('📖 Carregando dados da sessão...');

            const savedData = localStorage.getItem(this.saveKey);
            if (!savedData) {
                console.log('📝 Nenhum dado de sessão encontrado');
                return;
            }

            const sessionData = JSON.parse(savedData);
            this.isLoading = true;

            // Restaurar contatos
            if (sessionData.contacts && Array.isArray(sessionData.contacts)) {
                AppState.contacts = [...sessionData.contacts];
                console.log(`📋 ${AppState.contacts.length} contatos restaurados`);

                setTimeout(() => {
                    if (typeof ContactManager !== 'undefined') {
                        ContactManager.updateContactsList();
                        TimeEstimator.update();
                    }
                }, 500);

                const fileInfo = document.getElementById('fileInfo');
                if (fileInfo) {
                    fileInfo.style.display = 'block';
                    fileInfo.innerHTML = `
                    <span class="badge bg-info">
                        <i class="bi bi-clock-history me-1"></i>
                        ${AppState.contacts.length} contatos da sessão anterior
                    </span>
                `;
                }
            }

            // Restaurar mensagens
            if (sessionData.messagesConfig) {
                console.log('💬 Restaurando configuração de mensagens...');
                AppState.multipleMessagesEnabled = true;
                AppState.messagesConfig = {
                    msg1: sessionData.messagesConfig.msg1 || { enabled: true, text: '', media: null },
                    msg2: sessionData.messagesConfig.msg2 || { enabled: false, text: '', media: null },
                    msg3: sessionData.messagesConfig.msg3 || { enabled: false, text: '', media: null }
                };

                setTimeout(() => {
                    ['msg1', 'msg2', 'msg3'].forEach(msgId => {
                        const config = AppState.messagesConfig[msgId];
                        const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
                        const textInput = document.getElementById(`${msgId}-text`);

                        if (enabledCheckbox) enabledCheckbox.checked = config.enabled;
                        if (textInput) textInput.value = config.text || '';

                        if (config.media && config.media.data) {
                            this.restoreMessageMedia(msgId, config.media);
                        }
                    });

                    setTimeout(() => {
                        if (typeof MultipleMessagesManager !== 'undefined') {
                            MultipleMessagesManager.updateActiveMessagesInfo();
                            MultipleMessagesManager.updateMainPreview('msg1');
                        }
                    }, 500);
                }, 1500);
            }

            // Restaurar resultados
            if (sessionData.results) {
                AppState.results = sessionData.results;
                console.log('📊 Resultados restaurados:', AppState.results);

                setTimeout(() => {
                    if (typeof SendingManager !== 'undefined') {
                        SendingManager.updateStats();
                    }
                    if (typeof ChartManager !== 'undefined') {
                        ChartManager.update();
                    }
                }, 1000);
            }

            // Restaurar histórico
            if (sessionData.sendingHistory && Array.isArray(sessionData.sendingHistory)) {
                AppState.sendingHistory = sessionData.sendingHistory.map(entry => ({
                    ...entry,
                    datetime: new Date(entry.datetime),
                    details: entry.details?.map(detail => ({
                        ...detail,
                        datetime: new Date(detail.datetime)
                    })) || []
                }));

                setTimeout(() => {
                    if (typeof HistoryManager !== 'undefined') {
                        HistoryManager.updateTable();
                    }
                }, 600);
            }

            // Restaurar configurações
            if (sessionData.settings) {
                const fields = [
                    'minInterval', 'maxInterval', 'ia',
                    'enableBrazilianValidation', 'enableEmailSending', 'emailSubject'
                ];

                setTimeout(() => {
                    fields.forEach(fieldId => {
                        const element = document.getElementById(fieldId);
                        if (element && sessionData.settings[fieldId] !== undefined) {
                            if (element.type === 'checkbox') {
                                element.checked = sessionData.settings[fieldId];
                            } else {
                                element.value = sessionData.settings[fieldId];
                            }
                        }
                    });
                    TimeEstimator.update();
                }, 200);
            }

            setTimeout(() => {
                this.isLoading = false;
                console.log('✅ Dados da sessão carregados completamente');
            }, 3000);

        } catch (error) {
            this.isLoading = false;
            console.error('❌ Erro ao carregar dados da sessão:', error);
            localStorage.removeItem(this.saveKey);
        }
    },

    // Restaurar mídia de uma mensagem
    restoreMessageMedia(msgId, mediaData) {
        try {
            console.log(`📎 Restaurando mídia para ${msgId}:`, {
                filename: mediaData.filename,
                mimetype: mediaData.mimetype,
                hasData: !!mediaData.data
            });

            // Converter base64 para File para compatibilidade
            const base64Data = mediaData.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mediaData.mimetype });
            const file = new File([blob], mediaData.filename, { type: mediaData.mimetype });

            // Definir no input de arquivo
            const mediaInput = document.getElementById(`${msgId}-media`);
            if (mediaInput) {
                // Criar FileList simulado
                const fileList = {
                    0: file,
                    length: 1,
                    item: function (index) { return this[index]; }
                };

                Object.defineProperty(mediaInput, 'files', {
                    value: fileList,
                    configurable: true
                });

                // Mostrar preview
                setTimeout(() => {
                    if (typeof MultipleMessagesManager !== 'undefined') {
                        MultipleMessagesManager.showMediaPreview(msgId, file);
                    }
                }, 100);

                console.log(`✅ Mídia de ${msgId} restaurada: ${mediaData.filename}`);
            }

        } catch (error) {
            console.error(`❌ Erro ao restaurar mídia de ${msgId}:`, error);
        }
    },

    // Salvar dados da sessão (com debounce)
    saveSessionData() {
        // Não salvar se estamos carregando dados
        if (this.isLoading) {
            return;
        }

        // Debounce para evitar salvamentos excessivos
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.saveSessionDataNow();
        }, 1000); // 1 segundo de delay
    },

    // Salvar imediatamente
    saveSessionDataNow() {
        try {
            const sessionData = {
                savedAt: new Date().toISOString(),
                version: APP_CONFIG.version,

                // Lista de contatos
                contacts: AppState.contacts || [],

                // Configuração de múltiplas mensagens
                messagesConfig: AppState.messagesConfig || {
                    msg1: { enabled: true, text: '', media: null },
                    msg2: { enabled: false, text: '', media: null },
                    msg3: { enabled: false, text: '', media: null }
                },

                // Resultados e estatísticas
                results: AppState.results || { success: 0, error: 0 },

                // Histórico (últimos 10 para não ocupar muito espaço)
                sendingHistory: (AppState.sendingHistory || []).slice(0, 10).map(entry => ({
                    ...entry,
                    datetime: entry.datetime?.toISOString() || new Date().toISOString(),
                    details: (entry.details || []).map(detail => ({
                        ...detail,
                        datetime: detail.datetime?.toISOString() || new Date().toISOString()
                    }))
                })),

                // Configurações básicas
                settings: {
                    minInterval: document.getElementById('minInterval')?.value || '',
                    maxInterval: document.getElementById('maxInterval')?.value || '',
                    ia: document.getElementById('ia')?.value || '',
                    enableBrazilianValidation: document.getElementById('enableBrazilianValidation')?.checked || true,
                    enableEmailSending: document.getElementById('enableEmailSending')?.checked || false,
                    emailSubject: document.getElementById('emailSubject')?.value || ''
                }
            };

            // Salvar no localStorage
            localStorage.setItem(this.saveKey, JSON.stringify(sessionData));

            console.log('💾 Dados da sessão salvos:', {
                contacts: sessionData.contacts.length,
                messagesActive: Object.values(sessionData.messagesConfig).filter(m => m.enabled).length,
                resultsTotal: sessionData.results.success + sessionData.results.error,
                historyEntries: sessionData.sendingHistory.length,
                timestamp: new Date().toLocaleTimeString()
            });

            this.updateDashboardStorageCard();

        } catch (error) {
            console.error('❌ Erro ao salvar dados da sessão:', error);
        }
    },

    // Salvamento síncrono para beforeunload
    saveSessionDataSync() {
        if (this.isLoading) return;

        try {
            this.saveSessionDataNow();
        } catch (error) {
            console.error('❌ Erro no salvamento síncrono:', error);
        }
    },

    // Configurar auto-save
    setupAutoSave() {

        // ✅ Verificar se a função existe antes de fazer override
        if (typeof ContactManager !== 'undefined' && ContactManager.updateContactsList) {
            const originalUpdateContactsList = ContactManager.updateContactsList.bind(ContactManager);
            ContactManager.updateContactsList = function () {
                originalUpdateContactsList();
                AutoSaveManager.saveSessionData();
            };
        }

        // ✅ O mesmo para SendingManager
        if (typeof SendingManager !== 'undefined' && SendingManager.updateStats) {
            const originalUpdateStats = SendingManager.updateStats.bind(SendingManager);
            SendingManager.updateStats = function () {
                originalUpdateStats();
                AutoSaveManager.saveSessionData();
            };
        }

        // ✅ O mesmo para HistoryManager
        if (typeof HistoryManager !== 'undefined' && HistoryManager.saveToHistory) {
            const originalSaveToHistory = HistoryManager.saveToHistory.bind(HistoryManager);
            HistoryManager.saveToHistory = function (sessionData) {
                originalSaveToHistory(sessionData);
                AutoSaveManager.saveSessionData();
            };
        }

        // Salvar quando contatos mudarem
        const originalUpdateContactsList = ContactManager.updateContactsList;
        ContactManager.updateContactsList = function () {
            originalUpdateContactsList.call(this);
            AutoSaveManager.saveSessionData();
        };

        // Salvar quando estatísticas mudarem
        const originalUpdateStats = SendingManager.updateStats;
        SendingManager.updateStats = function () {
            originalUpdateStats.call(this);
            AutoSaveManager.saveSessionData();
        };

        // Salvar quando histórico mudar
        const originalSaveToHistory = HistoryManager.saveToHistory;
        HistoryManager.saveToHistory = function (sessionData) {
            originalSaveToHistory.call(this, sessionData);
            AutoSaveManager.saveSessionData();
        };

        // Observar mudanças nos campos de configuração
        const configFields = [
            'minInterval', 'maxInterval', 'ia',
            'enableBrazilianValidation', 'enableEmailSending', 'emailSubject'
        ];

        configFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.saveSessionData();
                });
            }
        });

        // Observar mudanças nas mensagens (se MultipleMessagesManager existir)
        setTimeout(() => {
            ['msg1', 'msg2', 'msg3'].forEach(msgId => {
                const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
                const textInput = document.getElementById(`${msgId}-text`);

                if (enabledCheckbox) {
                    enabledCheckbox.addEventListener('change', () => {
                        AppState.messagesConfig[msgId].enabled = enabledCheckbox.checked;
                        this.saveSessionData();
                    });
                }

                if (textInput) {
                    textInput.addEventListener('input', Utils.debounce(() => {
                        AppState.messagesConfig[msgId].text = textInput.value;
                        this.saveSessionData();
                    }, 2000)); // 2 segundos de delay para texto
                }
            });
        }, 1000);

        console.log('✅ Auto-save configurado para todos os campos relevantes');
    },

    // Limpar dados salvos
    clearSessionData() {
        try {
            localStorage.removeItem(this.saveKey);
            console.log('🗑️ Dados da sessão limpos');
        } catch (error) {
            console.error('❌ Erro ao limpar dados da sessão:', error);
        }
    },

    // Verificar tamanho dos dados salvos
    getStorageInfo() {
        try {
            const data = localStorage.getItem(this.saveKey);
            if (!data) return { exists: false };

            const sizeKB = (new Blob([data]).size / 1024).toFixed(2);
            const parsed = JSON.parse(data);

            return {
                exists: true,
                sizeKB: sizeKB,
                contacts: parsed.contacts?.length || 0,
                messages: Object.values(parsed.messagesConfig || {}).filter(m => m.enabled).length,
                history: parsed.sendingHistory?.length || 0,
                savedAt: parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : 'N/A'
            };
        } catch (error) {
            console.error('❌ Erro ao verificar storage:', error);
            return { exists: false, error: error.message };
        }
    },

    updateDashboardStorageCard() {
        const storageInfo = this.getStorageInfo();

        if (!storageInfo.exists) {
            // Remove o card se não há dados salvos
            const existingCard = document.getElementById('storage-indicator-card');
            if (existingCard) {
                existingCard.remove();
            }
            return;
        }

        // Encontrar onde inserir o card
        const dashboardCards = document.querySelector('#dashboard-section .row');
        if (!dashboardCards) return;

        // Verificar se já existe
        let storageCard = document.getElementById('storage-indicator-card');

        if (!storageCard) {
            // Criar card se não existe
            const cardHTML = `
            <div class="col-lg-3 col-md-6 mb-4" id="storage-indicator-card">
                <div class="card border-info">
                    <div class="card-body text-center">
                        <i class="bi bi-database fs-1 text-info mb-2"></i>
                        <h6 id="storage-size" class="mb-0">${storageInfo.sizeKB} KB</h6>
                        <small>Dados Salvos</small>
                        <div class="mt-2">
                            <small class="text-muted">
                                ${storageInfo.contacts} contatos<br>
                                ${storageInfo.messages} mensagens
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;

            dashboardCards.insertAdjacentHTML('beforeend', cardHTML);
        } else {
            // Atualizar dados existentes
            const sizeElement = document.getElementById('storage-size');
            const detailsElement = storageCard.querySelector('.text-muted');

            if (sizeElement) {
                sizeElement.textContent = storageInfo.sizeKB + ' KB';
            }
            if (detailsElement) {
                detailsElement.innerHTML = `${storageInfo.contacts} contatos<br>${storageInfo.messages} mensagens`;
            }
        }
    },
};

window.AutoSaveManager = AutoSaveManager;

console.log('✅ Sistema de auto-save avançado carregado!');

// Função para mostrar informações de storage (debug)
window.showStorageInfo = function () {
    const info = AutoSaveManager.getStorageInfo();

    if (!info.exists) {
        UI.showInfo('Nenhum dado de sessão salvo encontrado');
        return;
    }

    const message = `
        <div style="text-align: left;">
            <strong>💾 Informações do Storage:</strong><br><br>
            • Tamanho: ${info.sizeKB} KB<br>
            • Contatos: ${info.contacts}<br>
            • Mensagens ativas: ${info.messages}<br>
            • Entradas no histórico: ${info.history}<br>
            • Salvo em: ${info.savedAt}
        </div>
    `;

    Notiflix.Report.info('Storage Info', message, 'OK', {
        width: '400px',
        plainText: false
    });
};

