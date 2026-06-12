// ========================================
// 18. GERENCIAMENTO DE EXPORT/IMPORT
// ========================================
const DataManager = {
    exportHistoryToExcel() {
        if (typeof HistoryManager !== 'undefined' && HistoryManager.isShowingCampaignHistory) {
            HistoryManager.exportCampaignHistoryCsv();
            UI.showSuccess('HistÃ³rico de campanhas exportado com sucesso!');
            return;
        }

        if (AppState.sendingHistory.length === 0) {
            UI.showWarning('Não há histórico para exportar');
            return;
        }

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
                exportData.push(['', 'Hora', 'Nome', 'Telefone', 'Instância', 'Status', 'Mensagem']);

                entry.details.forEach(detail => {
                    exportData.push([
                        '',
                        detail.datetime.toLocaleTimeString('pt-BR'),
                        detail.name,
                        detail.phone,
                        detail.instance || 'N/A',
                        detail.status,
                        detail.message.length > 50 ? detail.message.substring(0, 50) + '...' : detail.message
                    ]);
                });

                exportData.push(['', '', '', '', '', '', '']);
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);

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

        const exportData = [['Nome', 'Telefone', 'E-mail', 'Telefone Formatado', 'Status']];

        AppState.contacts.forEach(contact => {
            exportData.push([
                contact.name,
                contact.phone,
                contact.email || '',
                PhoneUtils.displayFormattedPhone(contact.phone),
                contact.isValid ? 'Válido' : 'Verificar'
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);

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
            instances: (AppState.instances || []).map(instance => ({
                ...instance,
                lastCheck: instance.lastCheck
                    ? new Date(instance.lastCheck).toISOString()
                    : null
            })),
            settings: {
                instanceName: document.getElementById('instanceName')?.value || '',
                instanceAPIKEY: document.getElementById('instanceAPIKEY')?.value || '',
                ia: document.getElementById('ia')?.value || '',
                minInterval: document.getElementById('minInterval')?.value || '',
                maxInterval: document.getElementById('maxInterval')?.value || '',
                emailSubject: document.getElementById('emailSubject')?.value || ''
            },
            multipleMessages: {
                enabled: true,
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
            scheduledDispatches: (AppState.scheduledDispatches || []).map(dispatch => ({
                ...dispatch,
                scheduledDateTime: dispatch.scheduledDateTime
                    ? new Date(dispatch.scheduledDateTime).toISOString()
                    : null,
                createdAt: dispatch.createdAt
                    ? new Date(dispatch.createdAt).toISOString()
                    : null
            }))
        };

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
            input.remove();
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

        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    },

    async restoreBackupData(backupData) {
        try {
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

            if (backupData.contacts && Array.isArray(backupData.contacts)) {
                AppState.contacts = backupData.contacts;
                ContactManager.updateContactsList();
                TimeEstimator.update();
            }

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

            if (backupData.scheduledDispatches && Array.isArray(backupData.scheduledDispatches)) {
                AppState.scheduledDispatches = backupData.scheduledDispatches.map(dispatch => ({
                    ...dispatch,
                    scheduledDateTime: new Date(dispatch.scheduledDateTime),
                    createdAt: new Date(dispatch.createdAt)
                }));
                ScheduleManager.updateScheduledTable();
            }

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

            if (backupData.multipleMessages) {
                AppState.multipleMessagesEnabled = true;
                AppState.messagesConfig = backupData.multipleMessages.config || AppState.messagesConfig;

                if (typeof MultipleMessagesManager !== 'undefined' &&
                    MultipleMessagesManager.toggleMessageModes) {
                    MultipleMessagesManager.toggleMessageModes();
                    MultipleMessagesManager.updateActiveMessagesInfo();
                }

                ['msg1', 'msg2', 'msg3'].forEach(msgId => {
                    const config = AppState.messagesConfig[msgId];
                    if (config) {
                        const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
                        const textInput = document.getElementById(`${msgId}-text`);

                        if (enabledCheckbox) enabledCheckbox.checked = config.enabled;
                        if (textInput) textInput.value = config.text || '';

                        if (config.media && config.media.data) {
                            this.restoreMultipleMessageMedia(msgId, config.media);
                        }
                    }
                });
            } else {
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

            const base64Data = mediaData.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mediaData.mimetype });
            const file = new File([blob], mediaData.filename, { type: mediaData.mimetype });

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

                const changeEvent = new Event('change', { bubbles: true });
                mediaInput.dispatchEvent(changeEvent);

                AppState.messagesConfig[msgId].media = {
                    filename: mediaData.filename,
                    data: mediaData.data,
                    mimetype: mediaData.mimetype,
                    size: mediaData.size
                };

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
        const fields = [
            'instanceName', 'instanceAPIKEY', 'ia', 'minInterval', 'maxInterval'
        ];

        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && settings[fieldId]) {
                element.value = settings[fieldId];
            }
        });

        TimeEstimator.update();
    },

    initializeRichEditorSafely() {
        return new Promise((resolve) => {
            const editorElement = document.getElementById('richTextEditor');
            if (!editorElement) {
                console.warn('⚠️ Elemento richTextEditor não encontrado');
                resolve(false);
                return;
            }

            if (window.richTextEditor && typeof window.richTextEditor.setValue === 'function') {
                console.log('✅ Editor rico já inicializado');
                resolve(true);
                return;
            }

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
    }
};

// ========================================
// 19. GERENCIAMENTO DE CONFIGURACOES
// ========================================
const SettingsManager = {
    loadSaved() {
        console.log('📄 Carregando configurações salvas...');

        const saved = StorageService.getLocal('disparador_settings');
        if (saved) {
            console.log('📄 Configurações antigas encontradas no localStorage');
        }
    },

    clearSavedSettings() {
        UI.confirm(
            'Limpar Dados do Navegador',
            'Deseja limpar todos os dados salvos no navegador?<br><br>' +
            '<strong>Isso irá limpar:</strong><br>' +
            '• Cache do navegador<br>' +
            '• Configurações temporárias<br>' +
            '• Arquivos em cache',
            () => {
                StorageService.clearLocal();
                StorageService.clearSession();

                UI.showSuccess('Dados do navegador limpos com sucesso!');

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

window.SettingsManager = SettingsManager;

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
            StorageService.removeLocal('mandatopro_disparo_settings');
            StorageService.removeLocal('mandatopro_disparo_campaign');
            StorageService.removeLocal('mandatopro_disparo_contacts_meta');

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

            ContactManager.updateContactsList();
            if (typeof SendingManager !== 'undefined') {
                SendingManager.updateStats();
            }
            if (typeof HistoryManager !== 'undefined') {
                HistoryManager.updateTable();
            }

            UI.showSuccess('Dados da sessão limpos com sucesso!');

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

// ========================================
// GERENCIAMENTO DE PLANILHA MODELO
// ========================================
const ModeloManager = {
    generateModelExcel() {
        console.log('📊 Gerando planilha modelo...');

        try {
            const dadosExemplo = [
                ['Nome', 'Telefone', 'E-mail'],
                ['João Silva', '11987654321', 'joao@email.com'],
                ['Maria Santos', '11976543210', 'maria@email.com'],
                ['Pedro Oliveira', '11965432109', 'pedro@email.com'],
                ['Ana Costa', '11954321098', 'ana@email.com'],
                ['Carlos Ferreira', '11943210987', 'carlos@email.com']
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(dadosExemplo);

            ws['!cols'] = [
                { wch: 20 },
                { wch: 15 },
                { wch: 25 }
            ];

            const headerRange = XLSX.utils.decode_range('A1:C1');
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;

                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: 'CCCCCC' } }
                };
            }

            XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

            XLSX.writeFile(wb, 'modelo-planilha.xlsx');

            UI.showSuccess('Planilha modelo baixada com sucesso!');

        } catch (error) {
            console.error('❌ Erro ao gerar planilha modelo:', error);
            UI.showError('Erro ao gerar planilha modelo: ' + error.message);
        }
    },

    downloadStaticModel() {
        console.log('📊 Baixando planilha modelo estática...');

        try {
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
            this.generateModelExcel();
        }
    },

    async downloadModel() {
        try {
            const response = await HttpService.head('./modelo-planilha.xlsx');

            if (response.ok) {
                this.downloadStaticModel();
            } else {
                this.generateModelExcel();
            }
        } catch (error) {
            console.log('📊 Arquivo modelo não encontrado, gerando dinamicamente...');
            this.generateModelExcel();
        }
    }
};

window.DataManager = DataManager;
window.ModeloManager = ModeloManager;

function startSafeConfiguration() {
    const minIntervalInput = document.getElementById('minInterval');
    const maxIntervalInput = document.getElementById('maxInterval');

    if (minIntervalInput && maxIntervalInput) {
        minIntervalInput.value = '60';
        maxIntervalInput.value = '120';

        TimeEstimator.update();

        const batchCheckbox = document.getElementById('enableBatchPause');
        const batchSize = document.getElementById('batchSize');
        const batchPause = document.getElementById('batchPauseDuration');

        if (batchCheckbox && batchSize && batchPause) {
            batchCheckbox.checked = true;
            batchSize.value = '10';
            batchPause.value = '10';

            if (BatchManager && BatchManager.toggleBatchOptions) {
                BatchManager.toggleBatchOptions();
            }
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('safetyTipsModal'));
        if (modal) {
            modal.hide();
        }

        UI.showSuccess('✅ Configurações seguras aplicadas! Intervalos: 60-120s, Lotes: 10 msgs com pausa de 10min');
    } else {
        UI.showError('❌ Não foi possível aplicar as configurações automáticas');
    }
}

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

function addSafetyTooltips() {
    const minInterval = document.getElementById('minInterval');
    const maxInterval = document.getElementById('maxInterval');

    if (minInterval && maxInterval) {
        minInterval.setAttribute('title', 'Recomendado: mínimo 60 segundos para evitar bloqueios');
        maxInterval.setAttribute('title', 'Recomendado: máximo 120 segundos para simular comportamento natural');

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

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        addSafetyTooltips();
    }, 1000);
});

// ========================================
// SISTEMA DE AUTO-SAVE MELHORADO
// ========================================
const AutoSaveManager = {
    saveKey: 'disparador_session_data',
    debounceTimeout: null,
    isLoading: false,

    initialize() {
        console.log('💾 Inicializando sistema de auto-save...');

        this.loadSessionData();
        this.setupAutoSave();

        window.addEventListener('beforeunload', () => {
            this.saveSessionDataSync();
        });

        setTimeout(() => {
            this.updateDashboardStorageCard();
        }, 2000);

        console.log('✅ Sistema de auto-save inicializado');
    },

    loadSessionData() {
        try {
            console.log('📖 Carregando dados da sessão...');

            const savedData = StorageService.getLocal(this.saveKey);
            if (!savedData) {
                console.log('📝 Nenhum dado de sessão encontrado');
                return;
            }

            const sessionData = JSON.parse(savedData);
            this.isLoading = true;

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
            StorageService.removeLocal(this.saveKey);
        }
    },

    restoreMessageMedia(msgId, mediaData) {
        try {
            console.log(`📎 Restaurando mídia para ${msgId}:`, {
                filename: mediaData.filename,
                mimetype: mediaData.mimetype,
                hasData: !!mediaData.data
            });

            const base64Data = mediaData.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mediaData.mimetype });
            const file = new File([blob], mediaData.filename, { type: mediaData.mimetype });

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

    saveSessionData() {
        if (this.isLoading) {
            return;
        }

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.saveSessionDataNow();
        }, 1000);
    },

    saveSessionDataNow() {
        try {
            const sessionData = {
                savedAt: new Date().toISOString(),
                version: APP_CONFIG.version,
                contacts: AppState.contacts || [],
                messagesConfig: AppState.messagesConfig || {
                    msg1: { enabled: true, text: '', media: null },
                    msg2: { enabled: false, text: '', media: null },
                    msg3: { enabled: false, text: '', media: null }
                },
                results: AppState.results || { success: 0, error: 0 },
                sendingHistory: (AppState.sendingHistory || []).slice(0, 10).map(entry => ({
                    ...entry,
                    datetime: entry.datetime?.toISOString() || new Date().toISOString(),
                    details: (entry.details || []).map(detail => ({
                        ...detail,
                        datetime: detail.datetime?.toISOString() || new Date().toISOString()
                    }))
                })),
                settings: {
                    minInterval: document.getElementById('minInterval')?.value || '',
                    maxInterval: document.getElementById('maxInterval')?.value || '',
                    ia: document.getElementById('ia')?.value || '',
                    enableBrazilianValidation: document.getElementById('enableBrazilianValidation')?.checked || true,
                    enableEmailSending: document.getElementById('enableEmailSending')?.checked || false,
                    emailSubject: document.getElementById('emailSubject')?.value || ''
                }
            };

            StorageService.setLocalJson(this.saveKey, sessionData);

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

    saveSessionDataSync() {
        if (this.isLoading) return;

        try {
            this.saveSessionDataNow();
        } catch (error) {
            console.error('❌ Erro no salvamento síncrono:', error);
        }
    },

    setupAutoSave() {
        if (typeof ContactManager !== 'undefined' && ContactManager.updateContactsList) {
            const originalUpdateContactsList = ContactManager.updateContactsList.bind(ContactManager);
            ContactManager.updateContactsList = function () {
                originalUpdateContactsList();
                AutoSaveManager.saveSessionData();
            };
        }

        if (typeof SendingManager !== 'undefined' && SendingManager.updateStats) {
            const originalUpdateStats = SendingManager.updateStats.bind(SendingManager);
            SendingManager.updateStats = function () {
                originalUpdateStats();
                AutoSaveManager.saveSessionData();
            };
        }

        if (typeof HistoryManager !== 'undefined' && HistoryManager.saveToHistory) {
            const originalSaveToHistory = HistoryManager.saveToHistory.bind(HistoryManager);
            HistoryManager.saveToHistory = function (sessionData) {
                originalSaveToHistory(sessionData);
                AutoSaveManager.saveSessionData();
            };
        }

        const originalUpdateContactsList = ContactManager.updateContactsList;
        ContactManager.updateContactsList = function () {
            originalUpdateContactsList.call(this);
            AutoSaveManager.saveSessionData();
        };

        const originalUpdateStats = SendingManager.updateStats;
        SendingManager.updateStats = function () {
            originalUpdateStats.call(this);
            AutoSaveManager.saveSessionData();
        };

        const originalSaveToHistory = HistoryManager.saveToHistory;
        HistoryManager.saveToHistory = function (sessionData) {
            originalSaveToHistory.call(this, sessionData);
            AutoSaveManager.saveSessionData();
        };

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
                    }, 2000));
                }
            });
        }, 1000);

        console.log('✅ Auto-save configurado para todos os campos relevantes');
    },

    clearSessionData() {
        try {
            StorageService.removeLocal(this.saveKey);
            console.log('🗑️ Dados da sessão limpos');
        } catch (error) {
            console.error('❌ Erro ao limpar dados da sessão:', error);
        }
    },

    getStorageInfo() {
        try {
            const data = StorageService.getLocal(this.saveKey);
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
            const existingCard = document.getElementById('storage-indicator-card');
            if (existingCard) {
                existingCard.remove();
            }
            return;
        }

        const dashboardCards = document.querySelector('#dashboard-section .row');
        if (!dashboardCards) return;

        let storageCard = document.getElementById('storage-indicator-card');

        if (!storageCard) {
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
            const sizeElement = document.getElementById('storage-size');
            const detailsElement = storageCard.querySelector('.text-muted');

            if (sizeElement) {
                sizeElement.textContent = storageInfo.sizeKB + ' KB';
            }
            if (detailsElement) {
                detailsElement.innerHTML = `${storageInfo.contacts} contatos<br>${storageInfo.messages} mensagens`;
            }
        }
    }
};

window.AutoSaveManager = AutoSaveManager;

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

    NotificationService.reportInfo('Storage Info', message, 'OK', {
        width: '400px',
        plainText: false
    });
};
