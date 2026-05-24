// ========================================
// PROFILE MANAGER
// ========================================
const ProfileManager = {
    _profile: null,

    async loadProfile() {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return;

            const { data, error } = await SupabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            this._profile = data;
            AuthManager.userProfile = data;
            this._renderHeader();
        } catch (err) {
            console.error('❌ Erro ao carregar perfil:', err);
        }
    },

    _renderHeader() {
        const nameEl = document.getElementById('userDisplayName');
        const planEl = document.getElementById('userPlanBadge');
        const name = this._profile?.full_name || AuthManager.currentUser?.email?.split('@')[0] || 'Usuário';
        if (nameEl) nameEl.textContent = name;
        if (planEl) {
            const plan = this._profile?.plan || 'free';
            const labels = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
            const colors = { free: 'bg-secondary', pro: 'bg-warning text-dark', enterprise: 'bg-danger' };
            planEl.textContent = labels[plan] || plan;
            planEl.className = `badge ms-1 ${colors[plan] || 'bg-secondary'}`;
        }
    },

    openModal() {
        const user = AuthManager.currentUser;
        if (!user) return;

        const nameEl = document.getElementById('profileName');
        const emailEl = document.getElementById('profileEmail');
        const planEl = document.getElementById('profilePlan');
        const nameInput = document.getElementById('profileNameInput');
        const alertEl = document.getElementById('profileAlert');

        if (nameEl) nameEl.textContent = this._profile?.full_name || '—';
        if (emailEl) emailEl.textContent = user.email || '—';
        if (nameInput) nameInput.value = this._profile?.full_name || '';
        if (alertEl) alertEl.className = 'd-none';

        if (planEl) {
            const plan = this._profile?.plan || 'free';
            const labels = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
            const colors = { free: 'bg-secondary', pro: 'bg-warning text-dark', enterprise: 'bg-danger' };
            planEl.textContent = labels[plan] || plan;
            planEl.className = `badge fs-6 ${colors[plan] || 'bg-secondary'}`;
        }

        const modal = new bootstrap.Modal(document.getElementById('profileModal'));
        modal.show();
    },

    async saveName() {
        const nameInput = document.getElementById('profileNameInput');
        const saveBtn = document.getElementById('profileSaveBtn');
        const name = nameInput?.value?.trim();

        if (!name) { this._showAlert('Informe seu nome.', 'danger'); return; }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
        }

        try {
            const userId = AuthManager.currentUser?.id;
            const { error } = await SupabaseClient
                .from('profiles')
                .update({ full_name: name, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;

            if (this._profile) this._profile.full_name = name;
            this._renderHeader();

            const nameEl = document.getElementById('profileName');
            if (nameEl) nameEl.textContent = name;

            this._showAlert('Nome atualizado com sucesso!', 'success');
        } catch (err) {
            this._showAlert('Erro ao salvar: ' + err.message, 'danger');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Salvar';
            }
        }
    },

    _showAlert(msg, type) {
        const alertEl = document.getElementById('profileAlert');
        if (!alertEl) return;
        alertEl.textContent = msg;
        alertEl.className = `alert alert-${type} py-2 mt-2`;
    }
};

window.ProfileManager = ProfileManager;
