const AdminUsers = {
    _data: [],

    async load() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span> Carregando...</td></tr>`;

        // Profiles + buscar emails via admin API não disponível no JS SDK público
        // Usaremos profiles como fonte principal
        const { data, error } = await AdminClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-3">${error.message}</td></tr>`;
            return;
        }

        // Buscar pagamentos separadamente e mesclar
        const { data: allPayments } = await AdminClient
            .from('payments')
            .select('user_id, due_date, status, payment_link, boleto_url, amount, instance_count, asaas_payment_id');

        const paymentsByUser = {};
        (allPayments || []).forEach(p => {
            if (!paymentsByUser[p.user_id]) paymentsByUser[p.user_id] = [];
            paymentsByUser[p.user_id].push(p);
        });

        this._data = (data || []).map(u => ({
            ...u,
            payments: paymentsByUser[u.id] || []
        }));

        // Contar instâncias: total e ativas (apikey preenchida)
        const { data: instances } = await AdminClient
            .from('instances')
            .select('user_id, apikey');
        this._instanceCountsTotal = {};
        this._instanceCountsActive = {};
        (instances || []).forEach(i => {
            this._instanceCountsTotal[i.user_id] = (this._instanceCountsTotal[i.user_id] || 0) + 1;
            if (i.apikey && String(i.apikey).trim()) {
                this._instanceCountsActive[i.user_id] = (this._instanceCountsActive[i.user_id] || 0) + 1;
            }
        });
        // Fallback: se usuário não tem linhas em instances, usar instance_count do pagamento mais recente
        Object.entries(paymentsByUser).forEach(([uid, pays]) => {
            if (!this._instanceCountsTotal[uid]) {
                const latest = pays.sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0];
                if (latest?.instance_count) this._instanceCountsTotal[uid] = latest.instance_count;
            }
        });

        this._render(this._data);

        // Filtro de busca
        document.getElementById('userSearchInput').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = this._data.filter(u =>
                (u.full_name || '').toLowerCase().includes(q)
            );
            this._render(filtered);
        };

        // Preencher select de usuários no modal de pagamento
        const sel = document.getElementById('paymentUserId');
        sel.innerHTML = '<option value="">Selecione...</option>' +
            this._data.map(u => `<option value="${u.id}">${u.full_name || u.id.slice(0, 8)}</option>`).join('');
    },

    _render(data) {
        const tbody = document.getElementById('usersTableBody');
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nenhum usuário encontrado</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(u => {
            const payments     = (u.payments || []).sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
            const lastPayment  = payments[0];
            const dueDate      = lastPayment?.due_date ? fmtDate(lastPayment.due_date) : '—';
            const pendingLink  = payments.find(p => (p.status === 'pending' || p.status === 'overdue') && p.payment_link);
            const instTotal    = this._instanceCountsTotal?.[u.id] || 0;
            const instActive   = this._instanceCountsActive?.[u.id] || 0;
            const instBadge    = instTotal > 0
                ? `<span class="badge bg-primary">${instActive}/${instTotal}</span>`
                : `<span class="badge bg-secondary">0/0</span>`;
            const billingOnClick = pendingLink
                ? `AdminBilling.showExisting('${u.id}','${(u.full_name || '').replace(/'/g, '')}')`
                : `AdminBilling.generate('${u.id}','${(u.full_name || '').replace(/'/g, '')}','',${instTotal})`;
            const billingTitle = pendingLink ? 'Ver cobrança em aberto' : 'Gerar Cobrança Asaas';
            const billingClass = pendingLink ? 'btn btn-outline-warning btn-sm me-1' : 'btn btn-outline-success btn-sm me-1';
            return `
            <tr>
                <td>${u.full_name || '<em class="text-muted">Sem nome</em>'}</td>
                <td><small>${u.id.slice(0, 8)}…</small></td>
                <td><span class="badge bg-${u.is_active ? 'success' : 'danger'}">${u.is_active ? 'Ativo' : 'Inativo'}</span></td>
                <td class="text-center">${instBadge}</td>
                <td>${dueDate}</td>
                <td>
                    <button class="${billingClass}" id="billingBtn-${u.id}"
                            onclick="${billingOnClick}"
                            title="${billingTitle}" ${!pendingLink && instTotal === 0 ? 'disabled' : ''}>
                        <i class="bi bi-${pendingLink ? 'link-45deg' : 'receipt'}"></i>
                    </button>
                    <button class="btn btn-outline-primary btn-sm me-1"
                            onclick="AdminUsers.openEdit('${u.id}')" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-warning btn-sm me-1"
                            onclick="AdminUsers.resetPassword('${u.id}')" title="Resetar senha">
                        <i class="bi bi-key"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm"
                            onclick="AdminUsers.deleteUser('${u.id}','${(u.full_name || 'Sem nome').replace(/'/g, '').replace(/"/g, '')}')" title="Deletar usuário">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    _renderInstanceRows(instances) {
        const list = document.getElementById('editUserInstancesList');
        if (!list) return;

        if (!instances?.length) {
            list.innerHTML = '<div class="text-muted small">Nenhuma instância cadastrada.</div>';
            return;
        }

        const rows = instances.map((inst, idx) => {
            const idAttr = inst.id ? ` data-id="${inst.id}"` : '';
            const nameVal = escapeHtml(inst.name || '');
            const keyVal = escapeHtml(inst.apikey || '');
            const placeholderName = `Instância ${idx + 1}`;
            return `
            <div class="row g-2 align-items-end instance-row"${idAttr}>
                <div class="col-md-5">
                    <label class="form-label text-secondary" style="font-size:.72rem;">Nome</label>
                    <input type="text" class="form-control form-control-sm instance-name" placeholder="${placeholderName}" value="${nameVal}">
                </div>
                <div class="col-md-5">
                    <label class="form-label text-secondary" style="font-size:.72rem;">Apikey</label>
                    <input type="text" class="form-control form-control-sm instance-apikey" placeholder="APIKEY" value="${keyVal}">
                </div>
                <div class="col-md-2 d-grid">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="AdminUsers.removeInstanceRow(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>`;
        }).join('');

        list.innerHTML = rows;
    },

    addInstanceRow(data = {}) {
        const list = document.getElementById('editUserInstancesList');
        if (!list) return;

        if (list.querySelector('.text-muted')) list.innerHTML = '';

        const idx = list.querySelectorAll('.instance-row').length + 1;
        const idAttr = data.id ? ` data-id="${data.id}"` : '';
        const nameVal = escapeHtml(data.name || '');
        const keyVal = escapeHtml(data.apikey || '');
        const placeholderName = `Instância ${idx}`;

        list.insertAdjacentHTML('beforeend', `
        <div class="row g-2 align-items-end instance-row"${idAttr}>
            <div class="col-md-5">
                <label class="form-label text-secondary" style="font-size:.72rem;">Nome</label>
                <input type="text" class="form-control form-control-sm instance-name" placeholder="${placeholderName}" value="${nameVal}">
            </div>
            <div class="col-md-5">
                <label class="form-label text-secondary" style="font-size:.72rem;">Apikey</label>
                <input type="text" class="form-control form-control-sm instance-apikey" placeholder="APIKEY" value="${keyVal}">
            </div>
            <div class="col-md-2 d-grid">
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="AdminUsers.removeInstanceRow(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>`);
    },

    removeInstanceRow(btn) {
        const row = btn?.closest('.instance-row');
        if (row) row.remove();

        const list = document.getElementById('editUserInstancesList');
        if (list && !list.querySelector('.instance-row')) {
            list.innerHTML = '<div class="text-muted small">Nenhuma instância cadastrada.</div>';
        }
    },

    async _loadInstancesForEdit(userId) {
        const { data, error } = await AdminClient
            .from('instances')
            .select('id, name, apikey')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('[edit] instances error:', error.message);
            this._renderInstanceRows([]);
            return;
        }

        this._renderInstanceRows(data || []);

        const totalCount = (data || []).length;
        const activeCount = (data || []).filter(i => i.apikey && String(i.apikey).trim()).length;
        this._instanceCountsTotal[userId] = totalCount;
        this._instanceCountsActive[userId] = activeCount;
        document.getElementById('editUserCurrentInstances').textContent = totalCount;
        if (!document.getElementById('editUserInstances').dataset.edited) {
            const chargeCount = totalCount || 1;
            document.getElementById('editUserInstances').value = chargeCount;
            document.getElementById('editUserTotal').textContent = 'R$ ' + (chargeCount * 99).toFixed(2).replace('.', ',');
        }
    },

    _collectInstanceRows() {
        const list = document.getElementById('editUserInstancesList');
        const rows = Array.from(list?.querySelectorAll('.instance-row') || []);
        const items = [];
        const invalid = [];

        rows.forEach((row, idx) => {
            const id = row.dataset.id || null;
            const name = row.querySelector('.instance-name')?.value?.trim() || '';
            const apikey = row.querySelector('.instance-apikey')?.value?.trim() || '';

            if (!name && !apikey) return;

            if (!apikey) {
                invalid.push(name || `Linha ${idx + 1}`);
            }

            items.push({
                id,
                name: name || `Instância ${idx + 1}`,
                apikey: apikey || null
            });
        });

        return { items, invalid };
    },

    async _syncInstances(userId) {
        const { items, invalid } = this._collectInstanceRows();
        if (invalid.length) {
            Notiflix.Notify.info('Algumas instâncias estão sem Apikey e ficarão ocultas para o cliente: ' + invalid.join(', '));
        }

        const { data: existing, error: listErr } = await AdminClient
            .from('instances')
            .select('id')
            .eq('user_id', userId);
        if (listErr) console.warn('[save] list instances error:', listErr.message);

        const keepIds = new Set(items.filter(i => i.id).map(i => i.id));
        const toDelete = (existing || []).filter(e => !keepIds.has(e.id)).map(e => e.id);
        if (toDelete.length) {
            const { error: delErr } = await AdminClient.from('instances').delete().in('id', toDelete);
            if (delErr) console.warn('[save] delete instances error:', delErr.message);
        }

        const inserts = items.filter(i => !i.id).map(i => ({
            user_id:       userId,
            name:          i.name,
            apikey:        i.apikey || null,
            status:        'disconnected',
            total_sent:    0,
            success_count: 0,
            error_count:   0,
            updated_at:    new Date().toISOString()
        }));
        if (inserts.length) {
            const { error: insErr } = await AdminClient.from('instances').insert(inserts);
            if (insErr) console.warn('[save] insert instances error:', insErr.message);
        }

        const updates = items.filter(i => i.id);
        for (const inst of updates) {
            const { error: upErr } = await AdminClient
                .from('instances')
                .update({ name: inst.name, apikey: inst.apikey || null, updated_at: new Date().toISOString() })
                .eq('id', inst.id);
            if (upErr) console.warn('[save] update instance error:', upErr.message);
        }
    },

    async openEdit(userId) {
        const u = this._data.find(u => u.id === userId);
        if (!u) return;
        document.getElementById('editUserId').value        = u.id;
        document.getElementById('editUserName').value      = u.full_name || '';
        document.getElementById('editUserPhone').value     = u.phone || '';
        document.getElementById('editUserCpf').value       = u.cpf || '';
        document.getElementById('editUserActive').value    = String(u.is_active);
        document.getElementById('editUserSubtitle').textContent = u.full_name || u.id.slice(0, 8) + '…';
        document.getElementById('editUserAlert').className = 'd-none';

        // Usar cache local primeiro, depois buscar valor real no banco
        const cached = this._instanceCountsTotal?.[u.id] || 0;
        document.getElementById('editUserCurrentInstances').textContent = cached;
        document.getElementById('editUserInstances').value = cached || 1;
        document.getElementById('editUserTotal').textContent = 'R$ ' + ((cached || 1) * 99).toFixed(2).replace('.', ',');

        new bootstrap.Modal(document.getElementById('editUserModal')).show();

        await this._loadInstancesForEdit(userId);
    },

    async save() {
        const id     = document.getElementById('editUserId').value;
        const name   = document.getElementById('editUserName').value.trim();
        const phone  = document.getElementById('editUserPhone').value.trim();
        const cpf    = document.getElementById('editUserCpf').value.trim();
        const active = document.getElementById('editUserActive').value === 'true';
        const count  = parseInt(document.getElementById('editUserInstances').value) || 0;
        const btn    = document.getElementById('editUserSaveBtn');
        const alert  = document.getElementById('editUserAlert');

        btn.disabled  = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Salvando...';
        alert.className = 'd-none';

        try {
            const { error } = await SupabaseClient
                .from('profiles')
                .update({ full_name: name, is_active: active, phone: phone || null, cpf: cpf || null, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;

            await this._syncInstances(id);

            alert.textContent = 'Salvo com sucesso!';
            alert.className   = 'alert alert-success py-2 mt-2';
            await this.load();
        } catch (err) {
            alert.textContent = 'Erro: ' + err.message;
            alert.className   = 'alert alert-danger py-2 mt-2';
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Salvar';
        }
    },

    async generateUpgrade() {
        const userId = document.getElementById('editUserId').value;
        const u = this._data.find(u => u.id === userId);
        if (!u) {
            Notiflix.Notify.failure('Usuário não encontrado.');
            return;
        }
        const name = u.full_name || '';
        const phone  = document.getElementById('editUserPhone').value.trim();
        const cpf    = document.getElementById('editUserCpf').value.replace(/\D/g, ''); // só dígitos
        const count  = parseInt(document.getElementById('editUserInstances').value) || 0;
        const btn    = document.getElementById('editUserBillingBtn');

        if (count < 1) {
            Notiflix.Notify.warning('Informe ao menos 1 instância para gerar a cobrança.');
            return;
        }

        btn.disabled  = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Gerando...';

        // Fechar modal de edição antes para não conflitar com billingModal
        bootstrap.Modal.getInstance(document.getElementById('editUserModal'))?.hide();

        await AdminBilling.generate(userId, name, '', count, phone, cpf);

        btn.disabled  = false;
        btn.innerHTML = '<i class="bi bi-receipt me-1"></i>Gerar Cobrança';
    },

    deleteUser(userId, userName) {
        document.getElementById('deleteUserName').textContent = userName;
        const btn = document.getElementById('deleteUserConfirmBtn');
        // Remove listener anterior para evitar duplo clique
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async () => {
            newBtn.disabled  = true;
            newBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deletando...';
            try {
                // 1. Cancelar cobranças pendentes no Asaas via N8N (timeout 15s)
                newBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Cancelando Asaas...';
                try {
                    const { status } = await N8nService.postJson(AdminBilling.N8N_WEBHOOK, {
                        action: 'cancelar_por_usuario',
                        userId
                    }, { timeoutMs: 15000 });
                    console.log('[delete] N8N status:', status);
                } catch (asaasErr) {
                    console.warn('[delete] N8N falhou/timeout:', asaasErr.message);
                }

                // 2. Apagar registros do banco (ordem: dependentes antes)
                newBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deletando...</'+'span>';
                const { error: payErr } = await AdminClient.from('payments').delete().eq('user_id', userId);
                if (payErr) console.warn('[delete] payments error:', payErr.message);

                const { error: instErr } = await AdminClient.from('instances').delete().eq('user_id', userId);
                if (instErr) console.warn('[delete] instances error:', instErr.message);

                const { error: profileErr } = await AdminClient.from('profiles').delete().eq('id', userId);
                if (profileErr) throw profileErr;

                // 3. Deletar do auth.users via RPC (requer função delete_user_by_admin no Supabase)
                const { error: authErr } = await SupabaseClient.rpc('delete_user_by_admin', { target_id: userId });
                if (authErr) console.warn('[delete] auth.users não deletado:', authErr.message);

                bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'))?.hide();
                Notiflix.Notify.success('Usuário deletado com sucesso.');
            } catch (err) {
                newBtn.disabled  = false;
                newBtn.innerHTML = '<i class="bi bi-trash me-1"></i>Deletar';
                Notiflix.Notify.failure('Erro: ' + err.message);
            }
        });
        new bootstrap.Modal(document.getElementById('deleteUserModal')).show();
    },

    async create() {
        const name      = document.getElementById('newUserName').value.trim();
        const email     = document.getElementById('newUserEmail').value.trim();
        const password  = document.getElementById('newUserPassword').value.trim();
        const whatsapp  = document.getElementById('newUserWhatsapp').value.trim();
        const cpf       = document.getElementById('newUserCpf').value.replace(/\D/g, ''); // só dígitos
        const instances = parseInt(document.getElementById('newUserInstances').value) || 0;
        const btn       = document.getElementById('createUserBtn');
        const alert     = document.getElementById('createUserAlert');

        if (!email || !password) {
            alert.textContent = 'Preencha e-mail e senha.';
            alert.className   = 'alert alert-danger py-2';
            return;
        }

        btn.disabled  = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Criando...';
        alert.className = 'd-none';

        try {
            // Cria o usuário via signUp (requer confirmação desabilitada no Supabase:
            // Authentication → Providers → Email → desmarcar "Confirm email")
            const { data, error } = await TempClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });
            if (error) {
                if (error.message?.toLowerCase().includes('rate limit') || error.status === 429) {
                    throw new Error('Limite de e-mails atingido. Desabilite "Confirm email" em Authentication → Providers → Email no Supabase, ou aguarde alguns minutos.');
                }
                throw error;
            }

            // Upsert garante criação da linha mesmo se trigger ainda não rodou
            if (data.user) {
                await new Promise(r => setTimeout(r, 1200));
                const { error: upsertErr } = await SupabaseClient
                    .from('profiles')
                    .upsert({
                        id:         data.user.id,
                        full_name:  name,
                        phone:      whatsapp || null,
                        cpf:        cpf      || null,
                        is_active:  true
                    }, { onConflict: 'id' });
                if (upsertErr) {
                    Notiflix.Notify.warning('Aviso: perfil não salvo — ' + upsertErr.message);
                    console.error('[Create] upsert error:', upsertErr);
                }

                // Gerar cobrança automaticamente se houver instâncias
                if (instances > 0) {
                    bootstrap.Modal.getInstance(document.getElementById('createUserModal'))?.hide();
                    await AdminBilling.generate(data.user.id, name, email, instances, whatsapp, cpf);
                }
            }

            alert.textContent = `Usuário "${email}" criado com sucesso!`;
            alert.className   = 'alert alert-success py-2';
            document.getElementById('newUserName').value      = '';
            document.getElementById('newUserEmail').value     = '';
            document.getElementById('newUserPassword').value  = '';
            document.getElementById('newUserWhatsapp').value  = '';
            document.getElementById('newUserCpf').value       = '';
            document.getElementById('newUserInstances').value = '1';
            document.getElementById('newUserTotal').textContent = 'Total: R$ 99,00';
            await this.load();
        } catch (err) {
            alert.textContent = 'Erro: ' + err.message;
            alert.className   = 'alert alert-danger py-2';
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Criar';
        }
    },

    async resetPassword(userId) {
        const u = this._data.find(u => u.id === userId);
        const email = prompt('Informe o e-mail do usuário para enviar o link de redefinição:');
        if (!email) return;
        const { error } = await SupabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + '/index.html'
        });
        if (error) {
            alert('Erro: ' + error.message);
        } else {
            alert(`Link de redefinição enviado para ${email}`);
        }
    }
};

window.AdminUsers = AdminUsers;
