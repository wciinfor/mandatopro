const AuthManager = {
    isAuthenticated: false,
    currentUser: null,      // dados do Supabase auth.user
    userProfile: null,      // dados da tabela profiles

    initialize() {
        console.log('🔐 Inicializando AuthManager (Supabase)...');
        this.setupLoginEvents();
        this.checkSession();
    },

    // ─── Verificar sessão ativa no Supabase ────────────────────────
    async checkSession() {
        try {
            const { data: { session } } = await SupabaseClient.auth.getSession();
            if (session?.user) {
                console.log('🔑 Sessão Supabase ativa:', session.user.email);
                this.currentUser = session.user;
                this.isAuthenticated = true;
                this.showMainApp();
                await App.initializeApp();
                await SupabaseDataManager.bootstrapUserInstances();
                if (typeof ProfileManager !== 'undefined') ProfileManager.loadProfile();
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            console.warn('⚠️ Erro ao verificar sessão:', error);
            this.showLoginScreen();
        }

        // Listener de mudança de sessão (token refresh, logout externo)
        SupabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                this.isAuthenticated = false;
                this.currentUser = null;
                this.forceShowLoginScreen();
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('🔄 Token Supabase renovado automaticamente');
            }
        });
    },

    // ─── Login com email + senha ───────────────────────────────────
    async handleLogin() {
        const email    = document.getElementById('loginEmail')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            this.showLoginAlert('Preencha e-mail e senha.');
            return;
        }

        this.setLoginBtnLoading(true);
        this.hideLoginAlert();

        try {
            const { data, error } = await SupabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                console.warn('❌ Erro Supabase Auth:', error.message);
                const msg = error.message.includes('Invalid login credentials')
                    ? 'E-mail ou senha incorretos.'
                    : error.message.includes('Email not confirmed')
                        ? 'Confirme seu e-mail antes de entrar.'
                        : 'Erro ao autenticar. Tente novamente.';
                this.showLoginAlert(msg);
                return;
            }

            console.log('✅ Login realizado:', data.user.email);
            this.currentUser = data.user;
            this.isAuthenticated = true;
            this.showMainApp();
            await App.initializeApp();
            await SupabaseDataManager.bootstrapUserInstances();
            if (typeof ProfileManager !== 'undefined') ProfileManager.loadProfile();

        } catch (err) {
            console.error('❌ Erro inesperado no login:', err);
            this.showLoginAlert('Erro inesperado. Tente novamente.');
        } finally {
            this.setLoginBtnLoading(false);
        }
    },

    // ─── Recuperação de senha ──────────────────────────────────────
    async handlePasswordReset() {
        const email = document.getElementById('resetEmail')?.value?.trim();
        if (!email) {
            this.showLoginAlert('Informe seu e-mail para recuperação.');
            return;
        }

        try {
            const { error } = await SupabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) throw error;
            this.showSuccess('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
            this.toggleResetPanel(false);
        } catch (err) {
            this.showLoginAlert('Erro ao enviar e-mail. Verifique o endereço.');
        }
    },

    // ─── Logout ────────────────────────────────────────────────────
    handleLogout() {
        this.confirm(
            'Confirmar Logout',
            'Tem certeza que deseja sair?',
            async () => {
                await this.performLogout();
            }
        );
    },

    async performLogout() {
        console.log('👋 Realizando logout...');

        if (typeof ChartManager !== 'undefined') ChartManager.destroy();
        if (typeof TimerManager !== 'undefined')  TimerManager.cleanup();

        await SupabaseClient.auth.signOut();

        this.isAuthenticated = false;
        this.currentUser     = null;
        this.userProfile     = null;

        AppState.instances = [];
        AppState.contacts  = [];

        this.clearLoginForm();
        this.forceShowLoginScreen();

        setTimeout(() => this.showInfo('Logout realizado com sucesso!'), 100);
    },

    // ─── Utilitários de UI ─────────────────────────────────────────
    showLoginAlert(msg) {
        const el = document.getElementById('loginAlert');
        const msgEl = document.getElementById('loginAlertMsg');
        if (el && msgEl) { msgEl.textContent = msg; el.classList.remove('d-none'); }
    },

    hideLoginAlert() {
        const el = document.getElementById('loginAlert');
        if (el) el.classList.add('d-none');
    },

    setLoginBtnLoading(loading) {
        const btn = document.getElementById('loginBtn');
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<span class="spinner-border spinner-border-sm me-2"></span>Entrando...'
            : '<i class="bi bi-box-arrow-in-right me-2"></i>Entrar';
    },

    toggleResetPanel(show) {
        const form  = document.getElementById('loginForm');
        const panel = document.getElementById('resetPasswordPanel');
        if (form)  form.classList.toggle('d-none', show);
        if (panel) panel.classList.toggle('d-none', !show);
    },

    setupLoginEvents() {
        const loginForm = document.getElementById('loginForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const forgotLink  = document.getElementById('forgotPasswordLink');
        const backLink    = document.getElementById('backToLoginLink');
        const sendResetBtn = document.getElementById('sendResetBtn');
        const togglePwdBtn = document.getElementById('togglePassword');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideLoginAlert();
                this.toggleResetPanel(true);
                const emailVal = document.getElementById('loginEmail')?.value?.trim();
                if (emailVal) {
                    const resetEmail = document.getElementById('resetEmail');
                    if (resetEmail) resetEmail.value = emailVal;
                }
            });
        }

        if (backLink) {
            backLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideLoginAlert();
                this.toggleResetPanel(false);
            });
        }

        if (sendResetBtn) {
            sendResetBtn.addEventListener('click', () => this.handlePasswordReset());
        }

        if (togglePwdBtn) {
            togglePwdBtn.addEventListener('click', () => {
                const input = document.getElementById('loginPassword');
                const icon  = document.getElementById('togglePasswordIcon');
                if (!input) return;
                const isHidden = input.type === 'password';
                input.type = isHidden ? 'text' : 'password';
                if (icon) icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
            });
        }
    },

    requireAuth(skipLoginCheck = false) {
        if (skipLoginCheck) return true;
        if (!this.isAuthenticated || !this.currentUser) {
            this.showError('Sessão expirada. Faça login novamente.');
            this.showLoginScreen();
            return false;
        }
        return true;
    },

    // ─── addInstanceToManager (mantido para compatibilidade) ──────
    addInstanceToManager(instanceName, apikey, connectionResult) {
        const existingInstance = AppState.instances.find(inst =>
            inst.name === instanceName && inst.apikey === apikey
        );

        if (!existingInstance) {
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
        } else {
            existingInstance.status = connectionResult === 'open' ? 'connected' : 'disconnected';
            existingInstance.lastCheck = new Date();
        }

        if (typeof InstanceManager !== 'undefined') {
            InstanceManager.saveInstances();
            InstanceManager.updateInstancesList();
        }
    },

    populatePanelCredentials() {
        // Sem instância única de login; deixado para compatibilidade
    },

    clearLoginForm() {
        const fields = ['loginEmail', 'loginPassword', 'resetEmail'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.hideLoginAlert();
        this.toggleResetPanel(false);
    },

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp     = document.getElementById('mainApp');
        if (loginScreen) { loginScreen.classList.remove('hidden'); loginScreen.style.display = 'block'; }
        if (mainApp)     { mainApp.classList.remove('authenticated'); mainApp.style.display = 'none'; }
        this.isAuthenticated = false;
        this.disableMainAppButtons();
        console.log('🔐 Tela de login exibida');
    },

    showMainApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp     = document.getElementById('mainApp');
        if (loginScreen) { loginScreen.classList.add('hidden'); loginScreen.style.display = 'none'; }
        if (mainApp)     { mainApp.classList.add('authenticated'); mainApp.style.display = 'block'; }
        this.isAuthenticated = true;
        if (typeof TimerManager !== 'undefined') TimerManager.initialize();
        this.enableMainAppButtons();
        setTimeout(() => {
            const resumable = ActiveDispatchManager.checkForResumableDispatch();
            if (resumable) ActiveDispatchManager.showResumeModal(resumable);
        }, 2000);
        console.log('🎉 Painel principal exibido');
    },

    forceShowLoginScreen() {
        if (typeof ChartManager !== 'undefined') ChartManager.destroy();
        if (typeof TimerManager  !== 'undefined') TimerManager.cleanup();
        const mainApp     = document.getElementById('mainApp');
        const loginScreen = document.getElementById('loginScreen');
        if (mainApp)     { mainApp.classList.remove('authenticated'); mainApp.style.display = 'none'; }
        if (loginScreen) { loginScreen.classList.remove('hidden'); loginScreen.style.display = 'block'; }
        this.isAuthenticated = false;
        console.log('✅ Logout visual concluído');
    },

    disableMainAppButtons() {
        document.querySelectorAll('#mainApp .btn-whatsapp, #mainApp #pauseButton, #mainApp #stopButton').forEach(btn => {
            btn.disabled = true; btn.style.pointerEvents = 'none';
        });
    },

    enableMainAppButtons() {
        document.querySelectorAll('#mainApp .btn-whatsapp, #mainApp #pauseButton, #mainApp #stopButton').forEach(btn => {
            btn.disabled = false; btn.style.pointerEvents = 'auto';
        });
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

window.AuthManager = AuthManager;
