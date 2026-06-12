// ========================================
// 14. GERENCIAMENTO DE HISTORICO
// ========================================
const HistoryManager = {
    campaigns: [],
    filteredCampaigns: [],
    isShowingCampaignHistory: false,
    initialized: false,

    initialize() {
        if (this.initialized) {
            this.loadCampaignHistory();
            return;
        }

        this.initialized = true;
        document.getElementById('refreshHistoryBtn')?.addEventListener('click', () => this.loadCampaignHistory());
        document.getElementById('historySearchInput')?.addEventListener('input', () => this.renderCampaignHistory());
        document.getElementById('historyStatusFilter')?.addEventListener('change', () => this.renderCampaignHistory());
        document.getElementById('historyPeriodFilter')?.addEventListener('change', () => this.renderCampaignHistory());

        this.loadCampaignHistory();
    },

    async loadCampaignHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                        Carregando historico de campanhas...
                    </td>
                </tr>
            `;
        }

        try {
            const response = await fetch('/api/disparos/campanhas');
            const payload = await response.json();
            if (!response.ok || payload.success === false) {
                throw new Error(payload.message || 'Erro ao carregar campanhas');
            }

            this.campaigns = Array.isArray(payload.data) ? payload.data : [];
            this.isShowingCampaignHistory = this.campaigns.length > 0;

            if (this.isShowingCampaignHistory) {
                this.setSourceInfo('Historico consolidado carregado do banco.');
                this.renderCampaignHistory();
            } else {
                this.setSourceInfo('Nenhuma campanha encontrada no banco. Exibindo historico local.');
                this.updateLocalTable();
            }
        } catch (error) {
            console.warn('Falha ao carregar historico consolidado:', error);
            this.isShowingCampaignHistory = false;
            this.setSourceInfo('Nao foi possivel carregar o banco. Exibindo historico local.');
            this.updateLocalTable();
        }
    },

    getFilteredCampaigns() {
        const search = String(document.getElementById('historySearchInput')?.value || '').trim().toLowerCase();
        const status = String(document.getElementById('historyStatusFilter')?.value || '').trim();
        const period = String(document.getElementById('historyPeriodFilter')?.value || '').trim();
        const now = new Date();

        return this.campaigns.filter((campaign) => {
            if (search && !String(campaign.titulo || '').toLowerCase().includes(search)) return false;
            if (status && campaign.status !== status) return false;
            if (!period || !campaign.createdAt) return true;

            const createdAt = new Date(campaign.createdAt);
            if (Number.isNaN(createdAt.getTime())) return true;
            if (period === 'today') {
                return createdAt.toDateString() === now.toDateString();
            }

            const days = Number(period);
            if (!Number.isFinite(days)) return true;
            return createdAt >= new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        });
    },

    renderCampaignHistory() {
        const tbody = document.getElementById('historyTableBody');
        const exportBtn = document.getElementById('exportHistoryBtn');
        if (!tbody) return;

        this.filteredCampaigns = this.getFilteredCampaigns();
        this.isShowingCampaignHistory = true;

        if (exportBtn) {
            exportBtn.style.display = this.filteredCampaigns.length > 0 ? 'inline-block' : 'none';
        }

        if (this.filteredCampaigns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-3 d-block mb-2"></i>
                        Nenhuma campanha encontrada para os filtros atuais
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredCampaigns.map((campaign) => {
            const total = Number(campaign.totalContatos || 0);
            const sent = Number(campaign.totalEnviados || 0);
            const failed = Number(campaign.totalFalhas || 0);
            const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
            const rateClass = rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-danger';
            const statusClass = this.getStatusClass(campaign.status);
            const date = campaign.createdAt ? Utils.safeFormatDate(campaign.createdAt) : '-';

            return `
                <tr>
                    <td>${date}</td>
                    <td>
                        <div class="fw-semibold">${this.escapeHtml(campaign.titulo || 'Campanha sem titulo')}</div>
                        <small class="text-muted">${this.escapeHtml(campaign.instancia?.nome || 'Sem instancia')}</small>
                    </td>
                    <td>${total}</td>
                    <td><span class="text-success fw-bold">${sent}</span></td>
                    <td><span class="text-danger fw-bold">${failed}</span></td>
                    <td><span class="badge ${rateClass}">${rate}%</span></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-primary btn-sm history-results-btn" data-campaign-id="${campaign.id}" title="Ver resultados">
                                <i class="bi bi-graph-up"></i>
                            </button>
                            <button class="btn btn-outline-success btn-sm history-export-btn" data-campaign-id="${campaign.id}" title="Exportar CSV">
                                <i class="bi bi-download"></i>
                            </button>
                            <span class="btn btn-sm ${statusClass}" title="Status">${this.escapeHtml(campaign.status || '-')}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    updateLocalTable() {
        this.isShowingCampaignHistory = false;
        this.updateTable();
    },

    openCampaignResults(campaignId) {
        const nav = document.querySelector('.nav-link[data-section="resultados"]');
        nav?.click();

        setTimeout(async () => {
            await window.ResultsManager?.initialize?.();
            const select = document.getElementById('resultsCampaignSelect');
            if (select) select.value = String(campaignId);
            await window.ResultsManager?.loadSelectedCampaignResults?.();
        }, 250);
    },

    async exportCampaignCsv(campaignId) {
        await window.ResultsManager?.initialize?.();
        const previousResult = window.ResultsManager?.currentResult || null;
        try {
            const response = await fetch(`/api/disparos/campanhas/${campaignId}/resultados`);
            const payload = await response.json();
            if (!response.ok || payload.success === false) {
                throw new Error(payload.message || 'Erro ao carregar resultados');
            }
            window.ResultsManager.currentResult = payload;
            window.ResultsManager.exportCsv();
        } catch (error) {
            UI.showError(error.message || 'Erro ao exportar campanha');
        } finally {
            if (window.ResultsManager) window.ResultsManager.currentResult = previousResult;
        }
    },

    exportCampaignHistoryCsv() {
        const rows = [
            ['Data/Hora', 'Campanha', 'Status', 'Instancia', 'Total', 'Enviados', 'Falhas', 'Taxa Sucesso (%)'],
            ...this.filteredCampaigns.map((campaign) => {
                const total = Number(campaign.totalContatos || 0);
                const sent = Number(campaign.totalEnviados || 0);
                const failed = Number(campaign.totalFalhas || 0);
                const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
                return [
                    campaign.createdAt ? new Date(campaign.createdAt).toLocaleString('pt-BR') : '',
                    campaign.titulo || '',
                    campaign.status || '',
                    campaign.instancia?.nome || '',
                    total,
                    sent,
                    failed,
                    rate
                ];
            })
        ];

        const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'historico-campanhas.csv';
        link.click();
        URL.revokeObjectURL(url);
    },

    getStatusClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (['concluida', 'completed', 'finalizada'].includes(normalized)) return 'btn-success';
        if (['em_andamento', 'processando'].includes(normalized)) return 'btn-warning';
        if (['cancelada', 'falhou'].includes(normalized)) return 'btn-danger';
        if (['pausada'].includes(normalized)) return 'btn-secondary';
        return 'btn-outline-secondary';
    },

    setSourceInfo(message) {
        const info = document.getElementById('historySourceInfo');
        if (info) info.textContent = message;
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    },

    saveToHistory(sessionData) {
        const safeDetails = Array.isArray(sessionData.details) ? sessionData.details : [];

        const instancesUsed = [...new Set(safeDetails.map(detail => detail.instance || 'Desconhecido'))];
        const instanceName = instancesUsed.length > 1 ?
            `Múltiplas (${instancesUsed.length})` :
            (instancesUsed[0] || sessionData.instanceName || 'Desconhecido');

        let calculatedDuration = sessionData.duration || 0;

        if (calculatedDuration === 0 && safeDetails.length > 1) {
            const startTime = safeDetails[0]?.datetime || new Date();
            const endTime = safeDetails[safeDetails.length - 1]?.datetime || new Date();
            calculatedDuration = new Date(endTime) - new Date(startTime);

            calculatedDuration += safeDetails.length * 500;
        }

        if (calculatedDuration < 1000 && safeDetails.length > 0) {
            calculatedDuration = safeDetails.length * 2000;
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
            duration: calculatedDuration,
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

        if (typeof SupabaseDataManager !== 'undefined') {
            SupabaseDataManager.saveCampaign({
                instanceName: historyEntry.instanceName,
                name: `Disparo ${new Date(historyEntry.datetime).toLocaleDateString('pt-BR')}`,
                totalContacts: historyEntry.totalContacts,
                sentCount: (historyEntry.successCount || 0) + (historyEntry.errorCount || 0),
                successCount: historyEntry.successCount,
                errorCount: historyEntry.errorCount,
                status: 'completed',
                startedAt: historyEntry.datetime,
                finishedAt: new Date(),
                messagePreview: '',
                hasMedia: !!(historyEntry.details?.[0]?.mediaType)
            }).then(campaignId => {
                if (campaignId && historyEntry.details?.length > 0) {
                    SupabaseDataManager.saveCampaignResults(campaignId, historyEntry.details.map(d => ({
                        name: d.name || '',
                        phone: d.phone || '',
                        status: d.status === 'Sucesso' ? 'success' : 'error',
                        error: d.error || null,
                        sentAt: d.datetime
                    })));
                }
            });
        }

        this.updateTable();
    },

    updateTable() {
        if (this.isShowingCampaignHistory) {
            this.renderCampaignHistory();
            return;
        }

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

        const instancesUsed = [...new Set(entry.details.map(detail => detail.instance || 'Desconhecido'))];
        const instanceStats = {};

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

        const encodedData = encodeURIComponent(JSON.stringify(reportData));
        const reportUrl = `relatorio.html?data=${encodedData}`;

        if (reportUrl.length > 2000) {
            StorageService.setSessionJson('current_report_data', reportData);
            window.open('relatorio.html', '_blank');
        } else {
            window.open(reportUrl, '_blank');
        }

        UI.showSuccess('Relatório do histórico aberto em nova aba!');
    },

    clear() {
        if (this.isShowingCampaignHistory) {
            UI.showInfo('O historico consolidado vem do banco e nao e apagado por aqui. Use filtros para localizar campanhas.');
            return;
        }

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
// 17. GERENCIAMENTO DE RELATORIOS
// ========================================
const ReportManager = {
    generatePDFReport() {
        if (AppState.sendingDetails.length === 0) {
            UI.showWarning('Não há dados para gerar relatório');
            return;
        }

        let reportDuration = 0;

        if (AppState.sendingHistory.length > 0) {
            const latestHistory = AppState.sendingHistory[0];
            reportDuration = latestHistory.duration || 0;
            console.log('📊 Usando duração do histórico:', Utils.formatTime(reportDuration));
        }

        if (reportDuration === 0 && AppState.sendingDetails.length > 1) {
            const startTime = AppState.sendingDetails[0]?.datetime;
            const endTime = AppState.sendingDetails[AppState.sendingDetails.length - 1]?.datetime;

            if (startTime && endTime) {
                reportDuration = new Date(endTime) - new Date(startTime);
                console.log('📊 Duração calculada pelos timestamps:', Utils.formatTime(reportDuration));
            }
        }

        if (reportDuration === 0) {
            reportDuration = AppState.sendingDetails.length * 2000;
            console.log('📊 Usando duração estimada:', Utils.formatTime(reportDuration));
        }

        console.log('📊 Gerando relatório:', {
            totalEnvios: AppState.sendingDetails.length,
            duracaoFinal: Utils.formatTime(reportDuration),
            sucessos: AppState.results.success,
            erros: AppState.results.error
        });

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
            duration: reportDuration,
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
            StorageService.setSessionJson('current_report_data', reportData);
            window.open('relatorio.html', '_blank');
        } else {
            window.open(reportUrl, '_blank');
        }

        UI.showSuccess('Relatório aberto em nova aba!');
    }
};
