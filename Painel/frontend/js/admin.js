/**
 * Disparo PRO — Admin Panel JS
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_LABELS  = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
const PLAN_COLORS  = { free: 'secondary', pro: 'warning', enterprise: 'danger' };
const STATUS_LABELS = { paid: 'Pago', pending: 'Pendente', overdue: 'Inadimplente', cancelled: 'Cancelado' };
const STATUS_COLORS = { paid: 'success', pending: 'warning', overdue: 'danger', cancelled: 'secondary' };

function planBadge(plan) {
    return `<span class="badge bg-${PLAN_COLORS[plan] || 'secondary'}">${PLAN_LABELS[plan] || plan}</span>`;
}
function statusBadge(status) {
    return `<span class="badge bg-${STATUS_COLORS[status] || 'secondary'}">${STATUS_LABELS[status] || status}</span>`;
}
function fmtDate(val) {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('pt-BR');
}
function fmtCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const readEnv = (key) => {
    if (typeof getAppEnv === 'function') return getAppEnv(key);
    if (window.APP_ENV && window.APP_ENV[key]) return window.APP_ENV[key];
    console.warn('[env] Missing ' + key);
    return '';
};

const ENV = {
    N8N_WEBHOOK_ASAAS_BILLING: readEnv('N8N_WEBHOOK_ASAAS_BILLING')
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const AdminAuth = {
    currentUser: null,

    async init() {
        const { data: { session } } = await SupabaseClient.auth.getSession();
        if (session?.user) {
            await this._checkAdmin(session.user);
        } else {
            this._showLogin();
        }

        document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });

        document.getElementById('adminLogoutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    },

    async login() {
        const email    = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const btn      = document.getElementById('adminLoginBtn');
        const alert    = document.getElementById('adminLoginAlert');

        alert.className = 'alert alert-danger d-none';
        btn.disabled    = true;
        btn.innerHTML   = '<span class="spinner-border spinner-border-sm me-2"></span>Entrando...';

        try {
            const { data, error } = await SupabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await this._checkAdmin(data.user);
        } catch (err) {
            alert.textContent = 'E-mail ou senha incorretos.';
            alert.className   = 'alert alert-danger py-2';
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Entrar';
        }
    },

    async _checkAdmin(user) {
        const { data: profile } = await SupabaseClient
            .from('profiles')
            .select('is_admin, full_name')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            const alert = document.getElementById('adminLoginAlert');
            alert.textContent = 'Acesso negado. Você não tem permissão de administrador.';
            alert.className   = 'alert alert-danger py-2';
            await SupabaseClient.auth.signOut();
            return;
        }

        this.currentUser = user;
        document.getElementById('adminUserEmail').textContent = user.email;
        this._showPanel();
        AdminNav.goTo('overview');
    },

    async logout() {
        await SupabaseClient.auth.signOut();
        location.reload();
    },

    _showLogin() {
        document.getElementById('adminLoginScreen').classList.remove('d-none');
        document.getElementById('adminPanel').classList.add('d-none');
    },

    _showPanel() {
        document.getElementById('adminLoginScreen').classList.add('d-none');
        document.getElementById('adminPanel').classList.remove('d-none');
    }
};

// ─── Navegação ────────────────────────────────────────────────────────────────
const AdminNav = {
    init() {
        document.querySelectorAll('.admin-nav').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.goTo(link.dataset.section);
            });
        });
    },

    goTo(section) {
        // Atualizar links
        document.querySelectorAll('.admin-nav').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.admin-nav[data-section="${section}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Atualizar seções
        document.querySelectorAll('.admin-section').forEach(s => s.classList.add('d-none'));
        const activeSection = document.getElementById(`section-${section}`);
        if (activeSection) activeSection.classList.remove('d-none');

        // Atualizar título
        const titles = { overview: 'Visão Geral', users: 'Usuários', payments: 'Financeiro' };
        document.getElementById('adminPageTitle').textContent = titles[section] || section;

        // Carregar dados
        if (section === 'overview') AdminOverview.load();
        if (section === 'users')    AdminUsers.load();
        if (section === 'payments') AdminPayments.load();
    }
};

// ─── Visão Geral ──────────────────────────────────────────────────────────────
const AdminOverview = {
    async load() {
        // Buscar profiles
        const { data: profiles } = await AdminClient
            .from('profiles')
            .select('id, full_name, plan, is_active, created_at')
            .order('created_at', { ascending: false });

        const total  = profiles?.length || 0;
        const active = profiles?.filter(p => p.is_active).length || 0;

        document.getElementById('statTotalUsers').textContent = total;
        document.getElementById('statActiveUsers').textContent = active;

        // Buscar inadimplentes
        const { count: overdue } = await AdminClient
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'overdue');
        document.getElementById('statOverdue').textContent = overdue || 0;

        // Receita do mês atual (pagamentos paid)
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: paidThisMonth } = await AdminClient
            .from('payments')
            .select('amount')
            .eq('status', 'paid')
            .gte('paid_at', firstDay);
        const revenue = (paidThisMonth || []).reduce((s, p) => s + Number(p.amount), 0);
        document.getElementById('statRevenue').textContent = fmtCurrency(revenue);

        // Tabela recentes (5 primeiros)
        const tbody = document.getElementById('overviewRecentUsers');
        if (!profiles?.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum usuário</td></tr>`;
            return;
        }
        tbody.innerHTML = profiles.slice(0, 5).map(p => `
            <tr>
                <td>${p.full_name || '—'}</td>
                <td><small class="text-muted">—</small></td>
                <td>${planBadge(p.plan)}</td>
                <td><span class="badge bg-${p.is_active ? 'success' : 'danger'}">${p.is_active ? 'Ativo' : 'Inativo'}</span></td>
                <td>${fmtDate(p.created_at)}</td>
            </tr>
        `).join('');
    }
};

// AdminUsers moved to frontend/js/modules/admin/users.js

// AdminPayments moved to frontend/js/modules/admin/payments.js

// AdminBilling moved to frontend/js/modules/admin/billing.js

// ─── Filtros com reload ───────────────────────────────────────────────────────
// ─── Máscaras de input ────────────────────────────────────────────────────────
function maskPhone(el) {
    let v = el.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    else if (v.length > 0) v = v.replace(/(\d{0,2})/, '($1');
    el.value = v;
}

function maskCpf(el) {
    let v = el.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    el.value = v;
}

document.addEventListener('DOMContentLoaded', async () => {
    const paymentsRefreshBtn = document.getElementById('paymentsRefreshBtn');
    if (paymentsRefreshBtn) {
        paymentsRefreshBtn.addEventListener('click', () => AdminPayments.load());
    }

    const createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', () => AdminUsers.create());
    }

    const addInstanceRowBtn = document.getElementById('addInstanceRowBtn');
    if (addInstanceRowBtn) {
        addInstanceRowBtn.addEventListener('click', () => AdminUsers.addInstanceRow());
    }

    const editUserSaveBtn = document.getElementById('editUserSaveBtn');
    if (editUserSaveBtn) {
        editUserSaveBtn.addEventListener('click', () => AdminUsers.save());
    }

    const editUserBillingBtn = document.getElementById('editUserBillingBtn');
    if (editUserBillingBtn) {
        editUserBillingBtn.addEventListener('click', () => AdminUsers.generateUpgrade());
    }

    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => AdminPayments.add());
    }

    const billingCopyLinkBtn = document.getElementById('billingCopyLinkBtn');
    if (billingCopyLinkBtn) {
        billingCopyLinkBtn.addEventListener('click', () => AdminBilling.copyLink());
    }

    const newUserWhatsapp = document.getElementById('newUserWhatsapp');
    if (newUserWhatsapp) {
        newUserWhatsapp.addEventListener('input', (event) => maskPhone(event.target));
    }

    const newUserCpf = document.getElementById('newUserCpf');
    if (newUserCpf) {
        newUserCpf.addEventListener('input', (event) => maskCpf(event.target));
    }

    const editUserPhone = document.getElementById('editUserPhone');
    if (editUserPhone) {
        editUserPhone.addEventListener('input', (event) => maskPhone(event.target));
    }

    const editUserCpf = document.getElementById('editUserCpf');
    if (editUserCpf) {
        editUserCpf.addEventListener('input', (event) => maskCpf(event.target));
    }

    const newUserInstances = document.getElementById('newUserInstances');
    const newUserTotal = document.getElementById('newUserTotal');
    const updateNewUserTotal = () => {
        if (!newUserInstances || !newUserTotal) return;
        const total = parseFloat(newUserInstances.value || 0) * 99;
        newUserTotal.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    };
    if (newUserInstances) {
        newUserInstances.addEventListener('input', updateNewUserTotal);
        updateNewUserTotal();
    }

    const editUserInstances = document.getElementById('editUserInstances');
    const editUserTotal = document.getElementById('editUserTotal');
    const updateEditUserTotal = () => {
        if (!editUserInstances || !editUserTotal) return;
        const total = parseFloat(editUserInstances.value || 0) * 99;
        editUserTotal.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    };
    if (editUserInstances) {
        editUserInstances.addEventListener('input', () => {
            editUserInstances.dataset.edited = '1';
            updateEditUserTotal();
        });
        updateEditUserTotal();
    }

    document.getElementById('filterPaymentStatus').addEventListener('change', () => AdminPayments.load());
    document.getElementById('filterPaymentPlan').addEventListener('change', () => AdminPayments.load());

    // Ao fechar o modal de cobrança, recarrega usuários e financeiro
    document.getElementById('billingModal').addEventListener('hidden.bs.modal', () => {
        AdminUsers.load().catch(() => {});
        // Só recarrega financeiro se a seção estiver visível
        const paySection = document.getElementById('section-payments');
        if (paySection && !paySection.classList.contains('d-none')) {
            AdminPayments.load().catch(() => {});
        }
    });

    // Ao fechar o modal de delete, recarrega lista de usuários
    document.getElementById('deleteUserModal').addEventListener('hidden.bs.modal', () => {
        AdminUsers.load().catch(() => {});
    });

    // Ao fechar o modal de edição, limpa flag e recarrega lista
    document.getElementById('editUserModal').addEventListener('hidden.bs.modal', () => {
        const el = document.getElementById('editUserInstances');
        if (el) delete el.dataset.edited;
        AdminUsers.load().catch(() => {});
    });

    AdminNav.init();
    await AdminAuth.init();
});
