// ========================================
// 14. GERENCIAMENTO DE HISTORICO
// ========================================
const HistoryManager = {
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
