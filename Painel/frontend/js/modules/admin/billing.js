const AdminBilling = {
    PRICE_PER_INSTANCE: 99,
    // N8N_WEBHOOK mantido internamente; acesso externo somente via ApiService.
    // Regra: este módulo NÃO referencia N8nService diretamente.

    async cancelUserPayments(userId) {
        // Delegado ao ApiService (Fase 1: ApiService chama N8N internamente)
        const data = await ApiService.cancelUserBillingCharges(userId);
        if (!data.success) throw new Error(`Asaas: ${data.error || JSON.stringify(data)}`);
        return Number(data.cancelled || 0);
    },

    async generate(userId, userName, userEmail, instanceCount, userPhone = '', userCpf = '') {
        if (instanceCount < 1) { alert('Usuário não tem instâncias cadastradas.'); return; }

        const amount     = this.PRICE_PER_INSTANCE * instanceCount;
        const btn        = document.getElementById(`billingBtn-${userId}`);
        const dueDate    = new Date();
        dueDate.setDate(dueDate.getDate() + 5);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; }

        try {
            // Delegado ao ApiService — Fase 1: usa N8N internamente;
            // Fase 2: endpoint /api/v1/billing/charges substituirá automaticamente.
            const data = await ApiService.createBillingCharge({
                userId,
                userName,
                userEmail,
                userPhone,
                userCpf,
                instanceCount,
                amount,
                dueDate:     dueDateStr,
                description: `Disparo PRO — ${instanceCount} instância${instanceCount > 1 ? 's' : ''} × R$${this.PRICE_PER_INSTANCE}`,
            });

            if (!data.success) throw new Error(`Asaas: ${data.error || JSON.stringify(data)}`);

            // Salvar pagamento no Supabase
            const { error: payErr } = await AdminClient.from('payments').insert({
                user_id:           userId,
                plan:              'pro',
                amount,
                status:            'pending',
                due_date:          dueDateStr,
                asaas_payment_id:  data.paymentId  || null,
                asaas_customer_id: data.customerId || null,
                payment_link:      data.invoiceUrl  || null,
                boleto_url:        data.bankSlipUrl || null,
                instance_count:    instanceCount
            });
            if (payErr) {
                Notiflix.Notify.warning('Aviso: cobrança não salva no banco — ' + payErr.message);
                console.error('[Billing] insert error:', payErr);
            }

            // Atualizar customer_id no perfil
            if (data.customerId) {
                await AdminClient.from('profiles')
                    .update({ asaas_customer_id: data.customerId })
                    .eq('id', userId);
            }

            this._showModal(data, userName, amount, dueDateStr, instanceCount);
        } catch (err) {
            alert('Erro ao gerar cobrança: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-receipt"></i>'; }
        }
    },

    showExisting(userId, userName) {
        const u = AdminUsers._data.find(u => u.id === userId);
        if (!u) return;
        const payments = (u.payments || []).sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
        const p = payments.find(pay => (pay.status === 'pending' || pay.status === 'overdue') && pay.payment_link);
        if (!p) {
            Notiflix.Notify.info('Nenhuma cobrança em aberto com link disponível.');
            return;
        }
        this._showModal(
            { invoiceUrl: p.payment_link, bankSlipUrl: p.boleto_url || null },
            userName,
            p.amount,
            p.due_date,
            p.instance_count || 1
        );
    },

    _showModal(data, userName, amount, dueDate, instanceCount) {
        document.getElementById('billingModalTitle').innerHTML =
            `<i class="bi bi-check-circle me-2"></i>Cobrança — ${userName || 'Usuário'}`;
        document.getElementById('billingAmount').textContent  = fmtCurrency(amount);
        document.getElementById('billingDueDate').textContent = fmtDate(dueDate);
        document.getElementById('billingInstances').textContent =
            `${instanceCount} instância${instanceCount > 1 ? 's' : ''} × R$${this.PRICE_PER_INSTANCE} = ${fmtCurrency(amount)}`;

        const linkInput = document.getElementById('billingPaymentLinkInput');
        const linkOpen  = document.getElementById('billingPaymentLinkOpen');
        if (data.invoiceUrl) {
            linkInput.value = data.invoiceUrl;
            linkOpen.href   = data.invoiceUrl;
        }

        const boletoSection = document.getElementById('billingBoletoSection');
        const boletoUrl     = document.getElementById('billingBoletoUrl');
        const boletoOpen    = document.getElementById('billingBoletoOpen');
        if (data.bankSlipUrl) {
            boletoUrl.value  = data.bankSlipUrl;
            boletoOpen.href  = data.bankSlipUrl;
            boletoSection.classList.remove('d-none');
        } else {
            boletoSection.classList.add('d-none');
        }

        new bootstrap.Modal(document.getElementById('billingModal')).show();
    },

    copyLink() {
        const input = document.getElementById('billingPaymentLinkInput');
        if (!input.value) return;
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = input.nextElementSibling;
            btn.innerHTML = '<i class="bi bi-check"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    }
};

window.AdminBilling = AdminBilling;
