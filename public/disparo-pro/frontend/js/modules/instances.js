// ========================================
// 16. GERENCIAMENTO DE CONEXAO WHATSAPP
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
            // ── API Layer (se configurada e instância tem ID salvo) ──────────
            if (typeof ApiService !== 'undefined' && ApiService.isConfigured()) {
                const inst = (AppState?.instances || []).find(i => i.name === instanceName);
                if (inst?.id) {
                    const apiData = await this._checkConnectionViaApi(inst.id);
                    if (apiData !== null) {
                        this.displayConnectionStatus(apiData, instanceName, instanceAPIKEY);
                        return;
                    }
                }
            }

            // ── Fallback: N8N ──────────────────────────────────────────────
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verificar_conexao',
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

    /**
     * Verifica conexão via API Layer.
     * Retorna objeto no formato { result } compatível com normalizeConnectionData,
     * ou null se a API falhar (sinaliza para usar fallback N8N).
     */
    async _checkConnectionViaApi(instanceId) {
        try {
            const instance = await ApiService.getInstance(instanceId);

            // Mapear status Evolution para o formato legacy { result }
            const rt     = instance?.realtimeStatus;
            const state  = rt?.instance?.state || rt?.instance?.status
                         || rt?.state || instance?.status || '';
            const norm   = String(state).toLowerCase();

            if (norm === 'open' || norm === 'connected') {
                return { result: 'open' };
            }

            // Não conectado: buscar QR Code
            const qrData = await ApiService.getInstanceQrCode(instanceId);
            // Evolution API retorna { base64, code, pairingCode }
            const base64 = qrData?.base64 || qrData?.qrcode?.base64
                         || qrData?.qrCode || qrData?.code || null;

            if (!base64) return { result: null }; // sem QR — exibir desconectado
            return { result: base64 };

        } catch (err) {
            // Erros de autenticação/autorização NÃO devem fazer fallback silencioso para N8N;
            // o usuário precisa saber que a sessão expirou ou que não tem permissão.
            const code = err.code;
            const msg  = err.message || '';
            if (
                code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ||
                msg.includes('HTTP 401') || msg.includes('HTTP 403') ||
                msg.includes('não autenticado') || msg.includes('Sessão expirada')
            ) {
                throw err; // propaga — não silencia erros de auth
            }
            console.warn('[ApiService] Falha ao verificar conexão via API Layer, usando N8N:', err.message);
            return null; // sinaliza fallback apenas para erros de rede/timeout
        }
    },

    normalizeConnectionData(raw) {
        let data = raw;
        if (Array.isArray(data)) data = data[0] || {};
        if (!data || typeof data !== 'object') data = {};

        if (data.base64 && !data.result) data.result = data.base64;
        if (data.qrCode && !data.result) data.result = data.qrCode;
        if (data.qrcode && !data.result) data.result = data.qrcode;

        const state = data.state || data.status || data.connectionState || data?.instance?.state || data?.instance?.status;
        if (state) {
            const normalized = String(state).toLowerCase();
            if (normalized === 'open' || normalized === 'connected') data.result = 'open';
        }
        if (data.connected === true) data.result = 'open';

        return data;
    },

    displayConnectionStatus(data, instanceName, instanceAPIKEY) {
        data = this.normalizeConnectionData(data);
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

            const inst = AppState.instances.find(i => i.name === instanceName);
            if (inst) {
                inst.status = 'connected';
                inst.qrCode = null;
                inst.lastCheck = new Date();
                InstanceManager.saveInstances();
                InstanceManager.updateInstancesList();
                InstanceManager.updateActiveInstances();
            }
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
                    let data = null;

                    // ── API Layer (se configurada e instância tem ID) ──────────
                    if (typeof ApiService !== 'undefined' && ApiService.isConfigured()) {
                        const inst = (AppState?.instances || []).find(i => i.name === instanceName);
                        if (inst?.id) {
                            data = await this._checkConnectionViaApi(inst.id);
                        }
                    }

                    // ── Fallback: N8N ──────────────────────────────────────────
                    if (data === null) {
                        const response = await fetch(WEBHOOK_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'verificar_conexao',
                                instanceName,
                                instanceAPIKEY
                            })
                        });
                        data = await response.json();
                    }

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
// 26. GERENCIAMENTO DE MULTIPLAS INSTANCIAS
// ========================================
const InstanceManager = {
    isInitialized: false,
    connectionRecheckMs: 0,
    connectionRecheckMinMs: 3000,

    initialize() {
        if (this.isInitialized) {
            console.log('⚠️ InstanceManager já foi inicializado, ignorando...');
            return;
        }

        console.log('🔧 Inicializando InstanceManager corrigido...');

        this.loadInstances();
        this.updateInstancesList();

        setInterval(() => {
            if (AppState.instances.length > 0 && !AppState.sendingInProgress) {
                this.autoCheckConnections();
            }
        }, 10 * 60 * 1000);

        setTimeout(() => {
            const addInstanceBtn = document.getElementById('addInstanceBtn');
            if (addInstanceBtn) {
                if (this.addInstanceHandler) {
                    addInstanceBtn.removeEventListener('click', this.addInstanceHandler);
                }
                this.addInstanceHandler = () => this.addInstance();
                addInstanceBtn.addEventListener('click', this.addInstanceHandler);
            }

            if (this.instanceButtonsHandler) {
                document.removeEventListener('click', this.instanceButtonsHandler);
            }

            this.instanceButtonsHandler = (e) => {
                const instanceButton = e.target.closest('.check-connection-btn, .show-qr-btn, .disconnect-instance-btn, .edit-instance-btn, .remove-instance-btn, .export-contacts-btn');

                if (instanceButton) {
                    e.preventDefault();
                    e.stopPropagation();

                    const instanceId = instanceButton.dataset.instanceId;
                    if (!instanceId) return;

                    if (instanceButton.classList.contains('check-connection-btn')) {
                        this.checkConnection(instanceId);
                    } else if (instanceButton.classList.contains('show-qr-btn')) {
                        this.showConnectionModal(instanceId);
                    } else if (instanceButton.classList.contains('disconnect-instance-btn')) {
                        this.disconnectInstance(instanceId);
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
            };

            document.addEventListener('click', this.instanceButtonsHandler);

            this.isInitialized = true;
        }, 100);
    },

    loadInstances() {
        const saved = StorageService.getLocal('disparador_instances');

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
                StorageService.removeLocal('disparador_instances');
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

        instancesList.innerHTML = AppState.instances.map(instance => {
            const rawStatus = instance.status || 'disconnected';
            const normalizedStatus = ['connected', 'disconnected', 'connecting', 'error'].includes(rawStatus)
                ? rawStatus
                : 'disconnected';
            return `
            <div class="col-md-6 col-lg-3 mb-3">
                <div class="card instance-card ${normalizedStatus}" style="position: relative;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">${instance.name}</h6>
                            <span class="badge status-badge ${this.getStatusBadgeClass(normalizedStatus)}">
                                ${this.getStatusText(normalizedStatus)}
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
                            <button type="button" class="btn btn-outline-primary btn-sm check-connection-btn" onclick="InstanceManager.checkConnection(this.dataset.instanceId); return false;" 
                                    data-instance-id="${instance.id}"
                                    title="Verificar conexão">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            
                            ${normalizedStatus === 'connected' ? `
                                <button type="button" class="btn btn-outline-secondary btn-sm disconnect-instance-btn" onclick="InstanceManager.disconnectInstance(this.dataset.instanceId); return false;" 
                                        data-instance-id="${instance.id}"
                                        title="Desconectar">
                                    <i class="bi bi-power"></i>
                                </button>
                                <button type="button" class="btn btn-outline-success btn-sm export-contacts-btn" onclick="if (typeof InstanceContactsExporter !== 'undefined') InstanceContactsExporter.exportInstanceContacts(this.dataset.instanceId); return false;" 
                                        data-instance-id="${instance.id}"
                                        title="Importar/Exportar contatos WhatsApp">
                                    <i class="bi bi-people"></i>
                                </button>
                            ` : ''}
                            
                            ${normalizedStatus === 'disconnected' ? `
                                <button type="button" class="btn btn-outline-warning btn-sm show-qr-btn" onclick="InstanceManager.showConnectionModal(this.dataset.instanceId); return false;" 
                                        data-instance-id="${instance.id}"
                                        title="Conectar">
                                    <i class="bi bi-qr-code"></i>
                                </button>
                            ` : ''}
                            
                            <button type="button" class="btn btn-outline-danger btn-sm remove-instance-btn" onclick="InstanceManager.removeInstance(this.dataset.instanceId); return false;" 
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
        `;
        }).join('');

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

    async ensureInstanceConnectionForSend(instance, uiContext = null) {
        if (!instance || instance.id === 'legacy') return true;

        const lastCheckTime = instance.lastCheck ? new Date(instance.lastCheck).getTime() : 0;
        const minMs = Math.max(0, this.connectionRecheckMinMs || 0);

        if (lastCheckTime && minMs > 0 && (Date.now() - lastCheckTime) < minMs) {
            return instance.status === 'connected';
        }

        const needsCheck = this.connectionRecheckMs === 0 || instance.status !== 'connected' || !lastCheckTime || (Date.now() - lastCheckTime) > this.connectionRecheckMs;

        if (!needsCheck) return instance.status === 'connected';

        if (uiContext?.contactName && typeof TimerManager !== 'undefined') {
            TimerManager.updateDisplay('Verificando...', 'info', 'info');
            TimerManager.updateLabel('Verificando conexão antes de enviar:');
            TimerManager.updateDetails(`${uiContext.contactName} (${uiContext.currentIndex + 1}/${uiContext.total})`);
            TimerManager.updateProgress(0, 'info');
        }

        const connectionStatus = await this.checkInstanceConnectionWithLicense(instance.name, instance.apikey);
        instance.status = connectionStatus.status;
        instance.qrCode = connectionStatus.qrCode || null;
        instance.lastCheck = new Date();

        this.saveInstances();
        this.updateInstancesList();
        this.updateActiveInstances();

        if (uiContext?.contactName && typeof TimerManager !== 'undefined') {
            TimerManager.showSending(uiContext.contactName, uiContext.currentIndex, uiContext.total);
        }

        return connectionStatus.status === 'connected';
    },

    async getRandomActiveInstanceForSend(uiContext = null) {
        this.updateActiveInstances();

        if (AppState.activeInstances.length === 0) {
            console.warn('⚠️ Nenhuma instância ativa disponível');
            return null;
        }

        const candidates = [...AppState.activeInstances];
        while (candidates.length > 0) {
            const randomIndex = Math.floor(Math.random() * candidates.length);
            const selectedInstance = candidates.splice(randomIndex, 1)[0];

            const isConnected = await this.ensureInstanceConnectionForSend(selectedInstance, uiContext);
            if (isConnected) {
                console.log(`🔄 Instância selecionada: ${selectedInstance.name} (envio validado)`);
                return selectedInstance;
            }
        }

        return null;
    },

    updateInstanceStats(instanceId, success = true) {
        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
        if (!instance) return;

        instance.totalSent = (instance.totalSent || 0) + 1;

        if (success) {
            instance.successCount = (instance.successCount || 0) + 1;
        } else {
            instance.errorCount = (instance.errorCount || 0) + 1;
        }

        this.saveInstances();
        if (typeof SupabaseDataManager !== 'undefined' && instance._supabaseId) {
            SupabaseDataManager.saveInstance(instance);
        }
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

            StorageService.setLocalJson('disparador_instances', dataToSave);

            const saved = StorageService.getLocal('disparador_instances');
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
            if (typeof SupabaseDataManager !== 'undefined') {
                SupabaseDataManager.saveInstance(newInstance).then(id => {
                    if (id) newInstance._supabaseId = id;
                });
            }
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

            const normalizedName = String(instanceName || '').trim();
            const normalizedKey = String(instanceAPIKEY || '').trim();
            const payload = {
                action: 'verificar_conexao',
                instanceName: normalizedName,
                instanceAPIKEY: normalizedKey,
                apikey: normalizedKey,
                instanceKey: normalizedKey,
                instance: normalizedName
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

            data = (typeof ConnectionManager !== 'undefined' && ConnectionManager.normalizeConnectionData)
                ? ConnectionManager.normalizeConnectionData(data)
                : data;

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
        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
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

    async disconnectInstance(instanceId) {
        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
        if (!instance) return;

        UI.confirm(
            'Desconectar instância',
            `Deseja desconectar a instância "${instance.name}"?`,
            async () => {
                UI.showLoading('Desconectando instância...');

                try {
                    const normalizedName = String(instance.name || '').trim();
                    const normalizedKey = String(instance.apikey || '').trim();

                    const response = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'desconectar_instancia',
                            instanceName: normalizedName,
                            instanceAPIKEY: normalizedKey,
                            apikey: normalizedKey,
                            instanceKey: normalizedKey,
                            instance: normalizedName
                        })
                    });

                    const responseText = await response.text();
                    let data = null;

                    if (responseText && responseText.trim()) {
                        try {
                            data = JSON.parse(responseText);
                        } catch (parseError) {
                            console.warn('⚠️ Resposta não JSON ao desconectar:', responseText);
                        }
                    }

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${responseText || 'Erro ao desconectar'}`);
                    }

                    if (data && (data.result === 'error' || data.error)) {
                        throw new Error(data.message || data.error || 'Erro ao desconectar instância');
                    }

                    instance.status = 'disconnected';
                    instance.qrCode = null;
                    instance.lastCheck = new Date();

                    this.saveInstances();
                    this.updateInstancesList();
                    this.updateActiveInstances();

                    UI.showSuccess(`Instância "${instance.name}" desconectada`);
                } catch (error) {
                    console.error('❌ Erro ao desconectar instância:', error);
                    UI.showError('Erro ao desconectar instância: ' + error.message);
                } finally {
                    UI.hideLoading();
                }
            }
        );
    },

    showConnectionModal(instanceData) {
        const instance = (typeof instanceData === 'number' || typeof instanceData === 'string')
            ? AppState.instances.find(inst => String(inst.id) === String(instanceData))
            : instanceData;

        if (!instance) return;

        const modal = bootstrap.Modal.getInstance(document.getElementById('connectionModal')) ||
            new bootstrap.Modal(document.getElementById('connectionModal'));

        const modalTitle = document.querySelector('#connectionModal .modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="bi bi-whatsapp me-2"></i>Conectar - ${instance.name}`;
        }

        modal.show();

        this.performConnectionCheckForInstance(instance);
    },

    async performConnectionCheckForInstance(instance) {
        try {
            console.log('🔒 Verificando conexão da instância (sem licença):', {
                instanceName: instance.name
            });

            const normalizedName = String(instance.name || '').trim();
            const normalizedKey = String(instance.apikey || '').trim();

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    action: 'verificar_conexao',
                    instanceName: normalizedName,
                    instanceAPIKEY: normalizedKey,
                    apikey: normalizedKey,
                    instanceKey: normalizedKey,
                    instance: normalizedName
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

            data = (typeof ConnectionManager !== 'undefined' && ConnectionManager.normalizeConnectionData)
                ? ConnectionManager.normalizeConnectionData(data)
                : data;

            ConnectionManager.displayConnectionStatus(data, instance.name, instance.apikey);

            if (data?.result === 'open') {
                instance.status = 'connected';
                instance.qrCode = null;
            } else if (data?.result && String(data.result).startsWith('data:image')) {
                instance.status = 'disconnected';
                instance.qrCode = data.result;
            } else if (data?.result === 'error') {
                instance.status = 'error';
            } else {
                instance.status = instance.status || 'disconnected';
            }

            instance.lastCheck = new Date();
            this.saveInstances();
            this.updateInstancesList();
            this.updateActiveInstances();

        } catch (error) {
            console.error('❌ Erro ao verificar conexão:', error);
            ConnectionManager.displayConnectionError(error.message);
        }
    },

    removeInstance(instanceId) {
        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
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

                AppState.instances = AppState.instances.filter(inst => String(inst.id) !== String(instanceId));
                if (typeof SupabaseDataManager !== 'undefined' && instance._supabaseId) {
                    SupabaseDataManager.deleteInstance(instance._supabaseId);
                }

                console.log('📊 Após remoção:', {
                    afterCount: AppState.instances.length,
                    remainingInstances: AppState.instances.map(i => ({ id: i.id, name: i.name }))
                });

                this.saveInstances();

                const savedData = StorageService.getLocal('disparador_instances');
                console.log('💾 Dados salvos no localStorage:', savedData);

                this.updateInstancesList();
                this.updateActiveInstances();

                const activeInstance = AppState.activeInstances.find(inst => String(inst.id) === String(instanceId));
                if (activeInstance) {
                    console.warn('⚠️ Instância ainda estava nas ativas, removendo...');
                    AppState.activeInstances = AppState.activeInstances.filter(inst => String(inst.id) !== String(instanceId));
                }

                UI.showSuccess(`Instância "${instance.name}" removida`);

                console.log('✅ Remoção concluída:', {
                    totalInstances: AppState.instances.length,
                    activeInstances: AppState.activeInstances.length
                });
            }
        );
    },

    editInstance(instanceId) {
        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
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

            await Utils.sleep(2000);
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
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verificar_conexao',
                    instanceName,
                    instanceAPIKEY
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
                    const response = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'verificar_conexao',
                            instanceName,
                            instanceAPIKEY
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

Object.assign(ConnectionManager, ConnectionManagerWithLicense);

console.log('✅ InstanceManager carregado!');

// ========================================
// 1. GERENCIADOR DE EXPORTACAO DE CONTATOS
// ========================================
const InstanceContactsExporter = {
    isExporting: false,

    async exportInstanceContacts(instanceId) {
        if (this.isExporting) {
            console.log('⚠️ Exportação já em andamento, ignorando chamada duplicada');
            return;
        }

        this.isExporting = true;

        const instance = AppState.instances.find(inst => String(inst.id) === String(instanceId));
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

        const existingModal = document.getElementById('exportOptionsModal');
        if (existingModal) {
            const existingInstance = bootstrap.Modal.getInstance(existingModal);
            if (existingInstance) {
                existingInstance.dispose();
            }
            existingModal.remove();
            console.log('🗑️ Modal anterior removido');
        }

        this.clearTempData();

        document.body.insertAdjacentHTML('beforeend', modalContent);

        window.tempContactsData = contactsData;
        window.tempInstanceName = instanceName;
        window.tempDataTimestamp = Date.now();

        const modalElement = document.getElementById('exportOptionsModal');
        const modal = new bootstrap.Modal(modalElement);

        modalElement.addEventListener('hidden.bs.modal', () => {
            console.log('🧹 Modal fechado, limpando dados temporários...');
            this.clearTempData();
            this.isExporting = false;
            setTimeout(() => {
                if (modalElement && modalElement.parentNode) {
                    modalElement.remove();
                }
            }, 300);
        });

        modal.show();
    },

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
        const maxAge = 5 * 60 * 1000;
        if (!window.tempContactsData || !window.tempDataTimestamp ||
            (Date.now() - window.tempDataTimestamp) > maxAge) {
            UI.showError('Dados expiraram. Tente exportar novamente.');
            this.clearTempData();
            return;
        }

        const contactsData = window.tempContactsData;
        console.log('📋 Importando contatos para a lista do disparador...');

        const modal = bootstrap.Modal.getInstance(document.getElementById('exportOptionsModal'));
        if (modal) {
            modal.hide();
        }
        this.clearTempData();

        UI.showLoading('Processando e validando contatos...');

        try {
            const processedContacts = this.processContactsForImport(contactsData);

            const { validContacts, invalidContacts } = this.validateContactsForImport(processedContacts);

            if (validContacts.length === 0) {
                UI.hideLoading();
                UI.showError('Nenhum contato válido encontrado após as validações');
                return;
            }

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

    processContactsForImport(contactsData) {
        return contactsData
            .filter(contact => contact.telefone && contact.telefone.trim())
            .map((contact, index) => {
                const name = contact.nome && contact.nome.trim() ? contact.nome.trim() : `Contato ${index + 1}`;
                const rawPhone = contact.telefone.trim();

                return {
                    name: name,
                    rawPhone: rawPhone,
                    email: '',
                    source: 'WhatsApp'
                };
            });
    },

    validateContactsForImport(contacts) {
        const validContacts = [];
        const invalidContacts = [];

        contacts.forEach((contact, index) => {
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

    replaceContactsList(validContacts, invalidContacts, instanceName) {
        console.log(`📋 Substituindo lista por ${validContacts.length} contatos da instância ${instanceName}`);

        const { uniqueContacts, duplicates } = ContactManager.removeDuplicates(validContacts);

        AppState.contacts = uniqueContacts;

        ContactManager.updateContactsList();
        TimeEstimator.update();

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

        this.showImportSummary(
            validContacts.length,
            uniqueContacts.length,
            duplicates.length,
            invalidContacts.length,
            instanceName
        );

        UI.showSuccess(`✅ ${uniqueContacts.length} contatos importados da instância "${instanceName}"!`);
    },

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

        NotificationService.reportSuccess(
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

    downloadExcel(instanceName) {
        if (!window.tempContactsData || !window.tempDataTimestamp ||
            (Date.now() - window.tempDataTimestamp) > (5 * 60 * 1000)) {
            UI.showError('Dados expiraram. Tente exportar novamente.');
            this.clearTempData();
            return;
        }

        const contactsData = window.tempContactsData;

        const modal = bootstrap.Modal.getInstance(document.getElementById('exportOptionsModal'));
        if (modal) {
            modal.hide();
        }
        this.clearTempData();

        this.processAndExportContacts(contactsData, instanceName);
    },

    processAndExportContacts(contactsData, instanceName) {
        console.log('📊 Processando contatos para Excel...');

        try {
            const processedContacts = contactsData
                .filter(contact => contact.telefone && contact.telefone.trim())
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

            const excelData = [
                ['Nome', 'Telefone', 'Telefone Formatado', 'Status'],
                ...processedContacts.map(contact => [
                    contact.nome,
                    contact.telefone,
                    contact.telefoneFormatado,
                    'WhatsApp'
                ])
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(excelData);

            ws['!cols'] = [
                { wch: 25 },
                { wch: 18 },
                { wch: 20 },
                { wch: 12 }
            ];

            const headerRange = XLSX.utils.decode_range('A1:D1');
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;

                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: 'E3F2FD' } },
                    border: {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    }
                };
            }

            XLSX.utils.book_append_sheet(wb, ws, 'Contatos WhatsApp');

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const sanitizedInstanceName = instanceName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `contatos_${sanitizedInstanceName}_${dateStr}_${timeStr}.xlsx`;

            XLSX.writeFile(wb, fileName);

            console.log(`✅ Excel gerado: ${fileName}`);

            UI.showSuccess(`✅ ${processedContacts.length} contatos exportados para: ${fileName}`);

            this.showExportSummary(contactsData.length, processedContacts.length, instanceName);

        } catch (error) {
            console.error('❌ Erro ao gerar Excel:', error);
            UI.showError('Erro ao gerar arquivo Excel: ' + error.message);
        }
    },

    formatPhone(phone) {
        if (!phone) return '';

        const cleaned = phone.replace(/\D/g, '');

        if (cleaned.startsWith('55') && cleaned.length > 11) {
            return cleaned;
        }

        return '55' + cleaned;
    },

    formatPhoneForDisplay(phone) {
        if (!phone) return '';

        const cleaned = phone.replace(/\D/g, '');

        let displayNumber = cleaned;
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            displayNumber = cleaned.substring(2);
        }

        if (displayNumber.length === 11) {
            return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 7)}-${displayNumber.substring(7)}`;
        } else if (displayNumber.length === 10) {
            return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 6)}-${displayNumber.substring(6)}`;
        }

        return phone;
    },

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

        NotificationService.reportSuccess(
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

    showInstanceSelector() {
        const connectedInstances = AppState.instances.filter(inst => inst.status === 'connected');

        if (connectedInstances.length === 0) {
            UI.showWarning('Nenhuma instância conectada encontrada');
            return;
        }

        if (connectedInstances.length === 1) {
            this.exportInstanceContacts(connectedInstances[0].id);
            return;
        }

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

        const existingModal = document.getElementById('instanceSelectorModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalContent);

        const modal = new bootstrap.Modal(document.getElementById('instanceSelectorModal'));
        modal.show();
    },

    selectInstanceForImport(instanceId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('instanceSelectorModal'));
        if (modal) modal.hide();

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

    instancesList.innerHTML = AppState.instances.map(instance => {
        const rawStatus = instance.status || 'disconnected';
        const normalizedStatus = ['connected', 'disconnected', 'connecting', 'error'].includes(rawStatus)
            ? rawStatus
            : 'disconnected';
        return `
        <div class="col-md-6 col-lg-3 mb-3">
            <div class="card instance-card ${normalizedStatus}" style="position: relative;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${instance.name}</h6>
                        <span class="badge status-badge ${InstanceManager.getStatusBadgeClass(normalizedStatus)}">
                            ${InstanceManager.getStatusText(normalizedStatus)}
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
                        <button type="button" class="btn btn-outline-primary btn-sm check-connection-btn" onclick="InstanceManager.checkConnection(this.dataset.instanceId); return false;" 
                                data-instance-id="${instance.id}"
                                title="Verificar conexão">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        
                        ${normalizedStatus === 'connected' ? `
                            <button type="button" class="btn btn-outline-secondary btn-sm disconnect-instance-btn" onclick="InstanceManager.disconnectInstance(this.dataset.instanceId); return false;" 
                                    data-instance-id="${instance.id}"
                                    title="Desconectar">
                                <i class="bi bi-power"></i>
                            </button>
                            <button type="button" class="btn btn-outline-success btn-sm export-contacts-btn" onclick="if (typeof InstanceContactsExporter !== 'undefined') InstanceContactsExporter.exportInstanceContacts(this.dataset.instanceId); return false;" 
                                    data-instance-id="${instance.id}"
                                    title="Importar/Exportar contatos WhatsApp">
                                <i class="bi bi-people"></i>
                            </button>
                        ` : ''}
                        
                        ${normalizedStatus === 'disconnected' ? `
                            <button type="button" class="btn btn-outline-warning btn-sm show-qr-btn" onclick="InstanceManager.showConnectionModal(this.dataset.instanceId); return false;" 
                                    data-instance-id="${instance.id}"
                                    title="Conectar">
                                <i class="bi bi-qr-code"></i>
                            </button>
                        ` : ''}
                        
                        <button type="button" class="btn btn-outline-danger btn-sm remove-instance-btn" onclick="InstanceManager.removeInstance(this.dataset.instanceId); return false;" 
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
    `;
    }).join('');

    instancesList.innerHTML = `<div class="row">${instancesList.innerHTML}</div>`;

    this.updateActiveInstances();
};

const addExportInstanceContactsButton = function () {
    const exportContactsBtn = document.getElementById('exportContactsBtn');

    if (exportContactsBtn && exportContactsBtn.parentNode) {
        const importAllBtn = document.createElement('button');
        importAllBtn.type = 'button';
        importAllBtn.className = 'btn btn-outline-success btn-sm me-1';
        importAllBtn.id = 'importAllInstanceContactsBtn';
        importAllBtn.title = 'Importar contatos de uma instância WhatsApp';
        importAllBtn.innerHTML = '<i class="bi bi-whatsapp me-1"></i>WhatsApp';
        importAllBtn.style.display = 'none';

        exportContactsBtn.parentNode.insertBefore(importAllBtn, exportContactsBtn);

        importAllBtn.addEventListener('click', () => {
            InstanceContactsExporter.showInstanceSelector();
        });

        console.log('✅ Botão de importação de instâncias adicionado');
    }
};

const initializeInstanceContactsExporter = function () {
    console.log('🔧 Inicializando InstanceContactsExporter...');

    if (typeof InstanceManager !== 'undefined') {
        InstanceManager.updateInstancesList = updateInstancesListWithExportButton;
        console.log('✅ Função updateInstancesList atualizada com botão de exportação');
    }

    setTimeout(() => {
        addExportInstanceContactsButton();

        const updateButtonVisibility = () => {
            const importAllBtn = document.getElementById('importAllInstanceContactsBtn');
            const connectedInstances = AppState.instances.filter(inst => inst.status === 'connected');

            if (importAllBtn) {
                importAllBtn.style.display = connectedInstances.length > 0 ? 'inline-block' : 'none';
            }
        };

        setInterval(updateButtonVisibility, 2000);
        updateButtonVisibility();

    }, 1000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInstanceContactsExporter);
} else {
    initializeInstanceContactsExporter();
}

window.InstanceContactsExporter = InstanceContactsExporter;


window.ConnectionManager = ConnectionManager;
window.InstanceManager = InstanceManager;
if (typeof ConnectionManagerWithLicense !== 'undefined') {
  window.ConnectionManagerWithLicense = ConnectionManagerWithLicense;
}
