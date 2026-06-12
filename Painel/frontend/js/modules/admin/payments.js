const AdminPayments = {
    async load() {
        const tbody      = document.getElementById('paymentsTableBody');
        const filterSt   = document.getElementById('filterPaymentStatus').value;
        const filterPlan = document.getElementById('filterPaymentPlan').value;

        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span> Carregando...</td></tr>`;

        // Buscar payments e profiles separadamente (sem FK no banco)
        let query = AdminClient
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (filterSt)   query = query.eq('status', filterSt);
        if (filterPlan) query = query.eq('plan', filterPlan);

        const [{ data, error }, { data: profiles }] = await Promise.all([
            query,
            AdminClient.from('profiles').select('id, full_name')
        ]);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-3">${error.message}</td></tr>`;
            return;
        }

        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });

        if (!data?.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Nenhum registro</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${profileMap[p.user_id] || p.user_id.slice(0, 8) + '…'}</td>
                <td>${planBadge(p.plan)}</td>
                <td>${fmtCurrency(p.amount)}</td>
                <td>${statusBadge(p.status)}</td>
                <td>${fmtDate(p.due_date)}</td>
                <td>${p.paid_at ? fmtDate(p.paid_at) : '—'}</td>
                <td>
                    <button class="btn btn-outline-success btn-sm me-1"
                            onclick="AdminPayments.markPaid('${p.id}')" title="Marcar como pago">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm"
                            onclick="AdminPayments.remove('${p.id}')" title="Remover">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async add() {
        const userId  = document.getElementById('paymentUserId').value;
        const plan    = document.getElementById('paymentPlan').value;
        const amount  = document.getElementById('paymentAmount').value;
        const status  = document.getElementById('paymentStatus').value;
        const dueDate = document.getElementById('paymentDueDate').value;
        const notes   = document.getElementById('paymentNotes').value;
        const alert   = document.getElementById('addPaymentAlert');

        if (!userId) {
            alert.textContent = 'Selecione um usuário.';
            alert.className   = 'alert alert-danger py-2';
            return;
        }

        alert.className = 'd-none';

        const { error } = await SupabaseClient.from('payments').insert({
            user_id:  userId,
            plan,
            amount:   Number(amount) || 0,
            status,
            due_date: dueDate || null,
            paid_at:  status === 'paid' ? new Date().toISOString() : null,
            notes:    notes || null
        });

        if (error) {
            alert.textContent = 'Erro: ' + error.message;
            alert.className   = 'alert alert-danger py-2';
            return;
        }

        alert.textContent = 'Pagamento registrado com sucesso!';
        alert.className   = 'alert alert-success py-2';
        await this.load();

        // Atualizar plano do usuário
        await SupabaseClient.from('profiles').update({ plan }).eq('id', userId);
    },

    async markPaid(paymentId) {
        const { error } = await SupabaseClient
            .from('payments')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', paymentId);
        if (!error) await this.load();
    },

    async remove(paymentId) {
        if (!confirm('Remover este registro?')) return;
        const { error } = await SupabaseClient.from('payments').delete().eq('id', paymentId);
        if (!error) await this.load();
    }
};

window.AdminPayments = AdminPayments;
