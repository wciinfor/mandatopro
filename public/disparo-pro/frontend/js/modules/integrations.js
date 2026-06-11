// ========================================
// DISPARO PRO - CORE MODULES
// ========================================

// ========================================
// 1. CONFIGURACOES E CONSTANTES
// ========================================
const APP_CONFIG = {
    webhookUrl: WEBHOOK_URL,
    version: '3.0',
    updateCheckInterval: 5 * 60 * 1000,
    scheduledCheckInterval: 30000,
    maxHistoryEntries: 50,
    qrRefreshTime: 30000,
    webhookConexao: WEBHOOK_URL,
    webhookExportContacts: WEBHOOK_URL
};

const isFileProtocol = window.location.protocol === 'file:';
const supportsBlob = !isFileProtocol && 'URL' in window && 'createObjectURL' in URL;

console.log('🔍 Protocolo atual:', window.location.protocol);
console.log('📁 É protocolo file:', isFileProtocol);
console.log('🔗 Suporte a blob:', supportsBlob);

const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

if (isLocalhost && window.location.protocol.startsWith('http')) {
    console.log('🌐 Servidor local detectado - blob URLs habilitadas');
    window.supportsBlob = true;
} else {
    window.supportsBlob = supportsBlob;
}

// ========================================
// 2. SISTEMA DE VARIACOES ALEATORIAS
// ========================================
const RandomTagsSystem = {
    variations: {
        oi: [
            'Oi', 'Olá', 'E aí', 'Opa', 'Salve', 'Fala aí', 'Eae', 'Hey', 'Alo'
        ],
        obrigado: [
            'Obrigado', 'Valeu', 'Muito obrigado', 'Obrigadão', 'Vlw', 'Brigadão',
            'Agradeço', 'Thanks', 'Grato', 'Tmj'
        ],
        tchau: [
            'Tchau', 'Até logo', 'Falou', 'Até mais', 'Abraços', 'Um abraço',
            'Até breve', 'Flw', 'Até a próxima', 'Grande abraço'
        ],
        emoticon: [
            '😊', '😁', '👍', '😉', '🙂', '😄', '✨', '🎉', '💪', '🚀',
            '❤️', '🔥', '⭐', '💯', '👏', '🤝', '😍', '🥰', '🎯', '💖'
        ],
        nome: ['{nome}'],
        saudacao: ['{saudacao}']
    },

    getRandomVariation(tagType) {
        const variations = this.variations[tagType];
        if (!variations || variations.length === 0) {
            console.warn(`⚠️ Tag "${tagType}" não encontrada`);
            return `{${tagType}}`;
        }

        if (tagType === 'nome' || tagType === 'saudacao') {
            return variations[0];
        }

        const randomIndex = Math.floor(Math.random() * variations.length);
        const selected = variations[randomIndex];

        console.log(`🎲 Tag {${tagType}} → "${selected}" (${randomIndex + 1}/${variations.length})`);
        return selected;
    },

    processAllTags(message) {
        if (!message) return '';

        console.log('🔄 Processando tags na mensagem:', message);

        let processedMessage = message;

        Object.keys(this.variations).forEach(tagType => {
            const tagPattern = new RegExp(`\\{${tagType}\\}`, 'g');

            processedMessage = processedMessage.replace(tagPattern, () => {
                return this.getRandomVariation(tagType);
            });
        });

        console.log('✅ Mensagem processada:', processedMessage);
        return processedMessage;
    },

    processTagsForPreview(message) {
        return this.processAllTags(message);
    },

    getAvailableTags() {
        return Object.keys(this.variations).map(tag => ({
            tag: `{${tag}}`,
            variations: this.variations[tag],
            count: this.variations[tag].length
        }));
    }
};

window.RandomTagsSystem = RandomTagsSystem;

// ========================================
// 3. ESTADO DA APLICACAO
// ========================================
const AppState = {
    contacts: [],
    sendingInProgress: false,
    stopSending: false,
    isPaused: false,
    results: { success: 0, error: 0 },
    chart: null,
    sendingDetails: [],
    sendingHistory: [],
    scheduledDispatches: [],
    estimatedTime: 0,
    startTime: null,
    instances: [],
    activeInstances: [],

    batchPauseEnabled: false,
    batchSize: 10,
    batchPauseDuration: 10,
    currentBatchCount: 0,
    batchPauseActive: false,
    batchTimer: null,
    totalBatches: 0,
    currentBatchNumber: 1,

    registration: null,
    deferredPrompt: null,

    businessHoursEnabled: false,
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
    isWaitingForBusinessHours: false,

    multipleMessagesEnabled: false,
    messagesConfig: {
        msg1: { enabled: true, text: '', media: null },
        msg2: { enabled: false, text: '', media: null },
        msg3: { enabled: false, text: '', media: null }
    }
};

const ActiveDispatchState = {
    isActive: false,
    startedAt: null,
    currentIndex: 0,
    totalContacts: 0,
    successCount: 0,
    errorCount: 0,
    contactsProcessed: [],
    config: null,
    lastUpdateTimestamp: null
};

// ========================================
// GERENCIAMENTO DE DISPARO ATIVO
// ========================================
const ActiveDispatchManager = {
    saveKey: 'active_dispatch_state',

    saveDispatchState(currentIndex, contact) {
        try {
            const state = {
                isActive: true,
                startedAt: AppState.startTime,
                currentIndex: currentIndex,
                totalContacts: AppState.contacts.length,
                successCount: AppState.results.success,
                errorCount: AppState.results.error,
                contactsProcessed: AppState.sendingDetails.map(d => d.phone),
                lastUpdateTimestamp: Date.now(),
                config: {
                    instanceName: document.getElementById('instanceName')?.value || '',
                    instanceAPIKEY: document.getElementById('instanceAPIKEY')?.value || '',
                    minInterval: document.getElementById('minInterval')?.value || '',
                    maxInterval: document.getElementById('maxInterval')?.value || '',
                    ia: document.getElementById('ia')?.value || ''
                },
                currentContact: {
                    name: contact.name,
                    phone: contact.phone
                }
            };

            StorageService.setLocalJson(this.saveKey, state);
            console.log(`💾 Estado do envio salvo: índice ${currentIndex}/${AppState.contacts.length}`);
        } catch (error) {
            console.error('❌ Erro ao salvar estado do envio:', error);
        }
    },

    loadDispatchState() {
        try {
            const state = StorageService.getLocalJson(this.saveKey);
            if (!state) return null;

            const hoursSinceLastUpdate = (Date.now() - state.lastUpdateTimestamp) / (1000 * 60 * 60);

            if (hoursSinceLastUpdate > 24) {
                console.log('⏰ Disparo muito antigo (>24h), descartando');
                this.clearDispatchState();
                return null;
            }

            console.log('📖 Estado de envio anterior encontrado:', {
                currentIndex: state.currentIndex,
                totalContacts: state.totalContacts,
                successCount: state.successCount,
                errorCount: state.errorCount,
                hoursAgo: hoursSinceLastUpdate.toFixed(1)
            });

            return state;
        } catch (error) {
            console.error('❌ Erro ao carregar estado do envio:', error);
            return null;
        }
    },

    clearDispatchState() {
        StorageService.removeLocal(this.saveKey);
        console.log('🗑️ Estado do envio limpo');
    },

    checkForResumableDispatch() {
        const state = this.loadDispatchState();

        if (!state || !state.isActive) {
            return null;
        }

        const remainingContacts = state.totalContacts - state.currentIndex;

        if (remainingContacts <= 0) {
            console.log('✅ Envio anterior já foi concluído');
            this.clearDispatchState();
            return null;
        }

        return state;
    },

    showResumeModal(state) {
        const remainingContacts = state.totalContacts - state.currentIndex;
        const progressPercent = ((state.currentIndex / state.totalContacts) * 100).toFixed(1);
        const hoursSinceLastUpdate = ((Date.now() - state.lastUpdateTimestamp) / (1000 * 60 * 60)).toFixed(1);

        const modalContent = `
            <div class="modal fade" id="resumeDispatchModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="bi bi-exclamation-triangle me-2"></i>Envio Interrompido Detectado
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                Foi detectado um envio que foi interrompido há <strong>${hoursSinceLastUpdate}h</strong>.
                            </div>

                            <div class="card mb-3">
                                <div class="card-body">
                                    <h6 class="card-title">📊 Progresso Anterior:</h6>
                                    
                                    <div class="row text-center mb-3">
                                        <div class="col-4">
                                            <div class="fw-bold text-primary">${state.currentIndex}</div>
                                            <small class="text-muted">Processados</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-success">${state.successCount}</div>
                                            <small class="text-muted">Sucessos</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-danger">${state.errorCount}</div>
                                            <small class="text-muted">Erros</small>
                                        </div>
                                    </div>

                                    <div class="progress mb-2" style="height: 20px;">
                                        <div class="progress-bar bg-warning" style="width: ${progressPercent}%">
                                            ${progressPercent}%
                                        </div>
                                    </div>

                                    <div class="text-center">
                                        <strong>${remainingContacts} contatos restantes</strong> para processar
                                        <br>
                                        <small class="text-muted">Último contato: ${state.currentContact.name}</small>
                                    </div>
                                </div>
                            </div>

                            <div class="alert alert-warning">
                                <strong><i class="bi bi-question-circle me-2"></i>O que deseja fazer?</strong>
                                <ul class="mb-0 mt-2">
                                    <li><strong>Retomar:</strong> Continua de onde parou (recomendado)</li>
                                    <li><strong>Novo Envio:</strong> Descarta o progresso e inicia do zero</li>
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="ActiveDispatchManager.startFreshDispatch()">
                                <i class="bi bi-arrow-clockwise me-2"></i>Novo Envio
                            </button>
                            <button type="button" class="btn btn-success" onclick="ActiveDispatchManager.resumeDispatch()">
                                <i class="bi bi-play-circle me-2"></i>Retomar Envio
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('resumeDispatchModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalContent);

        const modal = new bootstrap.Modal(document.getElementById('resumeDispatchModal'));
        modal.show();
    },

    async resumeDispatch() {
        const state = this.loadDispatchState();
        if (!state) {
            UI.showError('Estado do envio não encontrado');
            return;
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('resumeDispatchModal'));
        if (modal) modal.hide();

        UI.showLoading('Restaurando estado do envio...');

        try {
            if (state.config) {
                const fields = ['instanceName', 'instanceAPIKEY', 'minInterval', 'maxInterval', 'ia'];
                fields.forEach(fieldId => {
                    const element = document.getElementById(fieldId);
                    if (element && state.config[fieldId]) {
                        element.value = state.config[fieldId];
                    }
                });
            }

            AppState.startTime = state.startedAt;
            AppState.results = {
                success: state.successCount,
                error: state.errorCount
            };

            const processedPhones = new Set(state.contactsProcessed);
            const remainingContacts = AppState.contacts.filter(
                contact => !processedPhones.has(contact.phone)
            );

            console.log(`📋 Retomando envio: ${remainingContacts.length} contatos restantes`);

            UI.hideLoading();
            UI.showSuccess(`Retomando envio com ${remainingContacts.length} contatos restantes`);

            await Utils.sleep(1000);

            this.continueDispatch(remainingContacts, state);

        } catch (error) {
            UI.hideLoading();
            console.error('❌ Erro ao retomar envio:', error);
            UI.showError('Erro ao retomar envio: ' + error.message);
        }
    },

    async continueDispatch(remainingContacts, previousState) {
        const originalContacts = [...AppState.contacts];
        AppState.contacts = remainingContacts;

        SendingManager.initializeSending();
        SendingManager.switchToProgressSection();

        const { instanceName, instanceAPIKEY } = Validators.instanceData();
        const ia = document.getElementById('ia')?.value || '';
        const { min: minInterval, max: maxInterval } = Validators.intervals();

        for (let i = 0; i < remainingContacts.length; i++) {
            if (AppState.stopSending) break;

            const contact = remainingContacts[i];
            const globalIndex = previousState.currentIndex + i;

            this.saveDispatchState(globalIndex + 1, contact);

            TimerManager.showSending(contact.name, globalIndex, previousState.totalContacts);
            const messageData = await SendingManager.prepareMessageData(contact);

            await SendingManager.waitWhilePaused();
            if (AppState.stopSending) break;

            await SendingManager.sendMessage(instanceName, instanceAPIKEY, ia, contact, messageData, {
                contactName: contact.name,
                currentIndex: globalIndex,
                total: previousState.totalContacts
            });
            SendingManager.updateProgress(globalIndex);

            if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
                UI.showWarning('Horário comercial encerrado. Pausando até próximo período.');
                await BusinessHoursManager.waitForBusinessHours();
                if (AppState.stopSending) break;
            }

            if (BatchManager.shouldPauseBatch(globalIndex)) {
                await BatchManager.startBatchPause();
                if (AppState.stopSending) break;
            }

            const isLastMessage = i >= remainingContacts.length - 1;
            if (!isLastMessage && !AppState.stopSending) {
                const delay = Math.random() * (maxInterval * 1000 - minInterval * 1000) + minInterval * 1000;
                TimerManager.startCountdown(delay, globalIndex + 1, previousState.totalContacts);
                await Utils.sleep(delay);
                TimerManager.hide();
            }
        }

        AppState.contacts = originalContacts;

        this.clearDispatchState();

        SendingManager.finishSending();
    },

    startFreshDispatch() {
        this.clearDispatchState();

        const modal = bootstrap.Modal.getInstance(document.getElementById('resumeDispatchModal'));
        if (modal) modal.hide();

        UI.showSuccess('Envio anterior descartado. Inicie um novo disparo normalmente.');
    }
};

window.ActiveDispatchManager = ActiveDispatchManager;

// ========================================
// 4. GERENCIAMENTO DE INTERVALOS
// ========================================
const AppIntervals = {
    qrRefresh: null,
    scheduledCheck: null,
    updateCheck: null,

    clear(intervalName) {
        if (this[intervalName]) {
            clearInterval(this[intervalName]);
            this[intervalName] = null;
        }
    },

    clearAll() {
        Object.keys(this).forEach(key => {
            if (key !== 'clear' && key !== 'clearAll' && this[key]) {
                clearInterval(this[key]);
                this[key] = null;
            }
        });
    }
};

// ========================================
// 5. UTILITARIOS E HELPERS
// ========================================
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    },

    async safeAsyncCall(fn, errorMessage = 'Erro inesperado') {
        try {
            return await fn();
        } catch (error) {
            console.error(errorMessage, error);
            NotificationService.error(errorMessage);
            return null;
        }
    },

    getSaudacao() {
        const hora = new Date().getHours();
        if (hora >= 5 && hora < 12) return 'Bom dia';
        if (hora >= 12 && hora < 18) return 'Boa tarde';
        return 'Boa noite';
    },

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    },

    formatTimeRemaining(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            console.log('🔄 Iniciando conversão para base64:', file.name, file.type);

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    const result = reader.result;
                    if (!result) {
                        throw new Error('Resultado da leitura está vazio');
                    }

                    const base64Data = result.split(',')[1];
                    if (!base64Data) {
                        throw new Error('Dados base64 não encontrados');
                    }

                    console.log('✅ Conversão base64 concluída:', {
                        fileType: file.type,
                        originalSize: file.size,
                        base64Size: base64Data.length
                    });

                    resolve(base64Data);
                } catch (error) {
                    console.error('❌ Erro no processamento do resultado:', error);
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                console.error('❌ Erro na leitura do arquivo:', error);
                reject(new Error('Erro ao ler arquivo: ' + error.message));
            };

            reader.onabort = () => {
                console.error('❌ Leitura do arquivo foi abortada');
                reject(new Error('Leitura do arquivo foi abortada'));
            };

            if (file.type.startsWith('audio/')) {
                console.log('🔊 Iniciando leitura de arquivo de áudio...');
            }

            try {
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('❌ Erro ao iniciar leitura:', error);
                reject(error);
            }
        });
    },

    safeFormatDate(dateValue) {
        try {
            if (!dateValue) return 'Data inválida';
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            return date.toLocaleString('pt-BR');
        } catch (error) {
            return 'Data inválida';
        }
    },

    safeFormatTime(dateValue) {
        try {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            return date.toLocaleTimeString('pt-BR');
        } catch (error) {
            return 'Hora inválida';
        }
    }
};

// ========================================
// 6. VALIDADORES
// ========================================
const Validators = {
    instanceData() {
        const instanceName = document.getElementById('instanceName')?.value?.trim() || '';
        const instanceAPIKEY = document.getElementById('instanceAPIKEY')?.value?.trim() || '';
        return {
            valid: !!(instanceName && instanceAPIKEY),
            instanceName,
            instanceAPIKEY
        };
    },

    intervals() {
        const min = parseInt(document.getElementById('minInterval')?.value || 0);
        const max = parseInt(document.getElementById('maxInterval')?.value || 0);
        return { valid: min <= max && min > 0 && max > 0, min, max };
    },

    contacts() {
        return { valid: AppState.contacts.length > 0, count: AppState.contacts.length };
    },

    messages() {
        if (this._lastValidation && Date.now() - this._lastValidation.timestamp < 500) {
            console.log('📝 Usando validação cached de mensagens');
            return this._lastValidation.result;
        }

        console.log('📝 Executando validação completa de mensagens...');

        const validation = MultipleMessagesManager.validateMessages();

        this._lastValidation = {
            timestamp: Date.now(),
            result: { valid: validation.valid, error: validation.error, type: 'multiple' }
        };

        console.log('📝 Resultado da validação:', validation);
        return this._lastValidation.result;
    },

    schedule() {
        const scheduleDate = document.getElementById('scheduleDate')?.value;
        const scheduleTime = document.getElementById('scheduleTime')?.value;

        if (!scheduleDate || !scheduleTime) {
            return { valid: false, error: 'Data e horário obrigatórios' };
        }

        const [year, month, day] = scheduleDate.split('-');
        const [hour, minute] = scheduleTime.split(':');
        const scheduledDateTime = new Date(year, month - 1, day, hour, minute);
        const minScheduleTime = new Date(Date.now() + 60 * 1000);

        return {
            valid: scheduledDateTime > minScheduleTime,
            scheduledDateTime,
            error: scheduledDateTime <= minScheduleTime ? 'Horário deve ser no futuro' : null
        };
    },

    mail(email) {
        if (!email || !email.trim()) {
            return { valid: true, email: '' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const cleanEmail = email.trim().toLowerCase();

        return {
            valid: emailRegex.test(cleanEmail),
            email: cleanEmail,
            error: emailRegex.test(cleanEmail) ? null : 'E-mail inválido'
        };
    }
};

// ========================================
// 7. GERENCIAMENTO DE TELEFONES
// ========================================
const PhoneUtils = {
    isBrazilianValidationEnabled() {
        const checkbox = document.getElementById('enableBrazilianValidation');
        return checkbox ? checkbox.checked : true;
    },

    formatBrazilianPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        let number = cleaned;

        if (number.startsWith('55') && number.length > 11) {
            number = cleaned;
        } else {
            if (number.startsWith('55') && number.length > 11) {
                number = number.substring(2);
            }

            const validDDDs = [
                '11', '12', '13', '14', '15', '16', '17', '18', '19',
                '21', '22', '24', '27', '28', '31', '32', '33', '34',
                '35', '37', '38', '41', '42', '43', '44', '45', '46',
                '47', '48', '49', '51', '53', '54', '55', '61', '62',
                '64', '63', '65', '66', '67', '68', '69', '71', '73',
                '74', '75', '77', '79', '81', '87', '82', '83', '84',
                '85', '88', '86', '89', '91', '93', '94', '92', '97',
                '95', '96', '98', '99'
            ];

            if (number.length === 10 && validDDDs.includes(number.substring(0, 2))) {
                number = number.substring(0, 2) + '9' + number.substring(2);
            }

            number = '55' + number;
        }

        return number;
    },

    formatInternationalPhone(phone) {
        return phone.replace(/[^\d+]/g, '');
    },

    formatPhone(phone) {
        if (!phone) return '';

        if (this.isBrazilianValidationEnabled()) {
            return this.formatBrazilianPhone(phone);
        }
        return this.formatInternationalPhone(phone);
    },

    isValidBrazilianPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');

        let numberToValidate = cleaned;
        if (cleaned.startsWith('55') && cleaned.length > 11) {
            numberToValidate = cleaned.substring(2);
        }

        const validDDDs = [
            '11', '12', '13', '14', '15', '16', '17', '18', '19',
            '21', '22', '24', '27', '28', '31', '32', '33', '34',
            '35', '37', '38', '41', '42', '43', '44', '45', '46',
            '47', '48', '49', '51', '53', '54', '55', '61', '62',
            '64', '63', '65', '66', '67', '68', '69', '71', '73',
            '74', '75', '77', '79', '81', '87', '82', '83', '84',
            '85', '88', '86', '89', '91', '93', '94', '92', '97',
            '95', '96', '98', '99'
        ];

        if (numberToValidate.length !== 10 && numberToValidate.length !== 11) {
            return { valid: false, error: 'Telefone brasileiro deve ter 10 ou 11 dígitos' };
        }

        const ddd = numberToValidate.substring(0, 2);
        if (!validDDDs.includes(ddd)) {
            return { valid: false, error: 'DDD inválido' };
        }

        if (numberToValidate.length === 11 && numberToValidate[2] !== '9') {
            return { valid: false, error: 'Celular deve começar com 9 após o DDD' };
        }

        if (numberToValidate.length === 10 && numberToValidate[2] === '9') {
            return { valid: false, error: 'Telefone fixo não deve começar com 9' };
        }

        const uniqueDigits = new Set(numberToValidate).size;
        if (uniqueDigits <= 2) {
            return { valid: false, error: 'Número inválido (muitos dígitos repetidos)' };
        }

        let finalNumber = numberToValidate;

        if (finalNumber.length === 10 && validDDDs.includes(finalNumber.substring(0, 2))) {
            finalNumber = finalNumber.substring(0, 2) + '9' + finalNumber.substring(2);
        }

        finalNumber = '55' + finalNumber;

        return { valid: true, formatted: finalNumber };
    },

    isValidInternationalPhone(phone) {
        const cleaned = this.formatInternationalPhone(phone);
        const numbersOnly = cleaned.replace(/[^\d]/g, '');

        if (numbersOnly.length < 7) {
            return { valid: false, error: 'Número muito curto (mínimo 7 dígitos)' };
        }

        if (numbersOnly.length > 15) {
            return { valid: false, error: 'Número muito longo (máximo 15 dígitos)' };
        }

        const uniqueDigits = new Set(numbersOnly).size;
        if (uniqueDigits <= 2 && numbersOnly.length > 4) {
            return { valid: false, error: 'Número inválido (muitos dígitos repetidos)' };
        }

        const invalidPatterns = [
            /^0+$/,
            /^1+$/,
            /^12345/,
            /^11111/,
            /^00000/
        ];

        for (const pattern of invalidPatterns) {
            if (pattern.test(numbersOnly)) {
                return { valid: false, error: 'Padrão de número inválido' };
            }
        }

        return { valid: true, formatted: cleaned };
    },

    isValidPhone(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Número não fornecido' };
        }

        if (this.isBrazilianValidationEnabled()) {
            return this.isValidBrazilianPhone(phone);
        }
        return this.isValidInternationalPhone(phone);
    },

    displayFormattedPhone(phone) {
        if (!phone) return '';

        if (this.isBrazilianValidationEnabled()) {
            return this.displayBrazilianFormattedPhone(phone);
        }
        return this.displayInternationalFormattedPhone(phone);
    },

    displayBrazilianFormattedPhone(phone) {
        let cleaned = phone.replace(/\D/g, '');

        if (cleaned.startsWith('55') && cleaned.length > 11) {
            cleaned = cleaned.substring(2);
        }

        if (cleaned.length === 11) {
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        } else if (cleaned.length === 10) {
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
        }

        return phone;
    },

    displayInternationalFormattedPhone(phone) {
        return phone.replace(/[^\d+]/g, '');
    },

    getValidationMode() {
        return {
            isBrazilian: this.isBrazilianValidationEnabled(),
            modeName: this.isBrazilianValidationEnabled() ? 'Validação Brasileira' : 'Validação Internacional',
            description: this.isBrazilianValidationEnabled()
                ? 'Valida DDD e formato brasileiro (10-11 dígitos)'
                : 'Aceita números internacionais (7-15 dígitos)'
        };
    }
};

// ========================================
// 8. GERENCIAMENTO DE UI
// ========================================
const UI = {
    showLoading(message = 'Carregando...') {
        NotificationService.loading(message);
    },

    hideLoading() {
        NotificationService.hideLoading();
    },

    showSuccess(message, options = {}) {
        NotificationService.success(message, options);
    },

    showError(message, options = {}) {
        NotificationService.error(message, options);
    },

    showWarning(message, options = {}) {
        NotificationService.warning(message, options);
    },

    showInfo(message, options = {}) {
        NotificationService.info(message, options);
    },

    confirm(title, message, onConfirm, onCancel = () => {}) {
        NotificationService.confirm(title, message, onConfirm, 'Sim', 'Cancelar', onCancel);
    },

    alternarTema() {
        const html = document.documentElement;
        const temaAtual = html.getAttribute('data-theme');
        const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', novoTema);

        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = novoTema === 'dark' ? 'bi bi-moon-fill me-2' : 'bi bi-sun-fill me-2';
        }
    }
};

// ========================================
// 9. GERENCIAMENTO DE ESTIMATIVAS DE TEMPO
// ========================================
const TimeEstimator = {
    calculate() {
        if (AppState.contacts.length === 0) return 0;

        const minInterval = parseInt(document.getElementById('minInterval')?.value || 0) * 1000;
        const maxInterval = parseInt(document.getElementById('maxInterval')?.value || 0) * 1000;
        const avgInterval = (minInterval + maxInterval) / 2;

        let totalTime = ((AppState.contacts.length - 1) * avgInterval) + (AppState.contacts.length * 2000);

        if (AppState.batchPauseEnabled && AppState.batchSize) {
            const batchSize = AppState.batchSize;
            const batchPause = AppState.batchPauseDuration * 60 * 1000;
            const totalBatches = Math.ceil(AppState.contacts.length / batchSize);
            const batchPauses = Math.max(0, totalBatches - 1);

            totalTime += batchPauses * batchPause;

            console.log(`⏱️ Estimativa com lotes: ${totalBatches} lotes, ${batchPauses} pausas de ${AppState.batchPauseDuration}min`);
        }

        if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
            const waitTime = BusinessHoursManager.getTimeUntilBusinessHours();
            totalTime += waitTime;
            console.log(`⏱️ Adicionando espera pelo horário comercial: ${Utils.formatTime(waitTime)}`);
        }

        return totalTime;
    },

    update: Utils.throttle(function () {
        const estimateElement = document.getElementById('timeEstimate');
        if (!estimateElement) return;

        if (AppState.sendingInProgress && AppState.startTime) {
            const elapsed = Date.now() - AppState.startTime;
            const progress = (AppState.results.success + AppState.results.error) / AppState.contacts.length;

            if (progress > 0) {
                const totalEstimated = elapsed / progress;
                const remaining = totalEstimated - elapsed;

                estimateElement.innerHTML = `
                    <div class="row text-center">
                        <div class="col-4">
                            <small class="text-muted">Decorrido</small>
                            <div class="fw-bold">${Utils.formatTime(elapsed)}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Restante</small>
                            <div class="fw-bold text-warning">${Utils.formatTime(Math.max(0, remaining))}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Total Est.</small>
                            <div class="fw-bold">${Utils.formatTime(totalEstimated)}</div>
                        </div>
                    </div>
                `;
            }
        } else if (AppState.contacts.length > 0) {
            AppState.estimatedTime = TimeEstimator.calculate();

            let extraInfo = '';
            if (AppState.batchPauseEnabled) {
                const batches = Math.ceil(AppState.contacts.length / AppState.batchSize);
                extraInfo = `<small class="text-muted">Com ${batches} lotes e pausas</small>`;
            }

            estimateElement.innerHTML = `
                <div class="text-center">
                    <small class="text-muted">Tempo Estimado</small>
                    <div class="fw-bold text-info">${Utils.formatTime(AppState.estimatedTime)}</div>
                    <small class="text-muted">Para ${AppState.contacts.length} contatos</small>
                    ${extraInfo}
                </div>
            `;
        } else {
            estimateElement.innerHTML = `
                <div class="text-center text-muted">
                    <small>Importe contatos para ver estimativa</small>
                </div>
            `;
        }
    }, 500)
};

// ========================================
// 10. GERENCIAMENTO PWA
// ========================================
const PWAManager = {
    initialize() {
        if (this.canRegisterServiceWorker()) {
            this.registerServiceWorker();
        } else {
            console.log('⚠️ Service Worker não disponível (requer HTTPS ou localhost)');
        }

        this.setupInstallPrompt();
    },

    canRegisterServiceWorker() {
        const isHTTPS = location.protocol === 'https:';
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isFile = location.protocol === 'file:';

        return 'serviceWorker' in navigator && (isHTTPS || isLocalhost) && !isFile;
    },

    async registerServiceWorker() {
        try {
            if (location.protocol === 'file:') {
                console.log('📁 Protocolo file:// detectado - Service Worker desabilitado');
                return;
            }

            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker registrado com sucesso');

            AppState.registration = registration;

            this.setupBasicCaching(registration);

        } catch (error) {
            console.log('⚠️ SW registration failed:', error.message);
        }
    },

    setupBasicCaching(registration) {
        registration.addEventListener('updatefound', () => {
            console.log('🔄 Nova versão encontrada (silencioso)');
            const newWorker = registration.installing;

            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('🆕 Nova versão instalada (background)');
                        } else {
                            console.log('✅ App instalado e pronto para usar offline');
                            this.showOfflineReady();
                        }
                    }
                });
            }
        });
    },

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            AppState.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA foi instalado');
            AppState.deferredPrompt = null;
            UI.showSuccess('App instalado com sucesso!');
        });
    },

    showInstallButton() {
        if (document.getElementById('pwa-install-btn')) return;

        const installButton = document.createElement('button');
        installButton.id = 'pwa-install-btn';
        installButton.className = 'btn btn-success btn-sm position-fixed';
        installButton.style.cssText = 'bottom: 20px; left: 20px; z-index: 1050; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        installButton.innerHTML = '<i class="bi bi-download me-2"></i>Instalar App';

        installButton.addEventListener('click', async () => {
            if (AppState.deferredPrompt) {
                try {
                    AppState.deferredPrompt.prompt();
                    const { outcome } = await AppState.deferredPrompt.userChoice;

                    if (outcome === 'accepted') {
                        console.log('✅ Usuário aceitou instalação');
                    } else {
                        console.log('❌ Usuário rejeitou instalação');
                    }

                    AppState.deferredPrompt = null;
                    installButton.remove();
                } catch (error) {
                    console.error('Erro na instalação:', error);
                    installButton.remove();
                }
            }
        });

        document.body.appendChild(installButton);

        setTimeout(() => {
            if (installButton.parentNode) {
                installButton.remove();
            }
        }, 15000);
    },

    showOfflineReady() {
        UI.showSuccess('App pronto para usar offline!');
    },

    cleanup() {
        try {
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.remove();
            }

            console.log('🧹 PWA cleanup concluído');
        } catch (error) {
            console.warn('⚠️ Erro durante PWA cleanup:', error);
        }
    },

    checkForUpdates() {
        if (AppState.registration) {
            UI.showLoading('Verificando atualizações...');

            AppState.registration.update().then(() => {
                setTimeout(() => {
                    UI.hideLoading();
                    UI.showInfo('Verificação concluída. Se houver atualizações, serão aplicadas automaticamente.');
                }, 2000);
            }).catch((error) => {
                UI.hideLoading();
                console.warn('Erro ao verificar atualizações:', error);
                UI.showWarning('Não foi possível verificar atualizações');
            });
        } else {
            UI.showInfo('Service Worker não disponível');
        }
    }
};

// ========================================
// 11. SUPABASE DATA MANAGER
// ========================================
const SupabaseDataManager = {
    async loadUserInstances() {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return;

            const { data, error } = await SupabaseClient
                .from('instances')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const visible = (data || []).filter(inst => inst.apikey && String(inst.apikey).trim());

            AppState.instances = visible.map(inst => ({
                id: inst.id,
                name: inst.name,
                apikey: inst.apikey,
                status: inst.status,
                totalSent: inst.total_sent,
                successCount: inst.success_count,
                errorCount: inst.error_count,
                lastCheck: inst.last_check ? new Date(inst.last_check) : null,
                _supabaseId: inst.id
            }));

            console.log(`✅ ${AppState.instances.length} instâncias carregadas do Supabase`);

            if (typeof InstanceManager !== 'undefined') {
                InstanceManager.updateInstancesList();
            }
        } catch (err) {
            console.error('❌ Erro ao carregar instâncias:', err);
        }
    },

    async saveInstance(instance) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return null;

            const payload = {
                user_id: userId,
                name: instance.name,
                apikey: instance.apikey,
                status: instance.status || 'disconnected',
                total_sent: instance.totalSent || 0,
                success_count: instance.successCount || 0,
                error_count: instance.errorCount || 0,
                last_check: instance.lastCheck || null,
                updated_at: new Date().toISOString()
            };

            if (instance._supabaseId) {
                const { error } = await SupabaseClient
                    .from('instances')
                    .update(payload)
                    .eq('id', instance._supabaseId)
                    .eq('user_id', userId);
                if (error) throw error;
                return instance._supabaseId;
            }

            const { data, error } = await SupabaseClient
                .from('instances')
                .upsert({ ...payload }, { onConflict: 'user_id,name' })
                .select('id')
                .single();
            if (error) throw error;
            return data?.id;

        } catch (err) {
            console.error('❌ Erro ao salvar instância:', err);
            return null;
        }
    },

    async deleteInstance(supabaseId) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId || !supabaseId) return;
            const { error } = await SupabaseClient
                .from('instances')
                .delete()
                .eq('id', supabaseId)
                .eq('user_id', userId);
            if (error) throw error;
        } catch (err) {
            console.error('❌ Erro ao deletar instância:', err);
        }
    },

    async saveCampaign(campaignData) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return null;

            const { data, error } = await SupabaseClient
                .from('campaigns')
                .insert({
                    user_id: userId,
                    instance_name: campaignData.instanceName,
                    name: campaignData.name || `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
                    total_contacts: campaignData.totalContacts || 0,
                    sent_count: campaignData.sentCount || 0,
                    success_count: campaignData.successCount || 0,
                    error_count: campaignData.errorCount || 0,
                    status: campaignData.status || 'completed',
                    started_at: campaignData.startedAt || new Date().toISOString(),
                    finished_at: campaignData.finishedAt || new Date().toISOString(),
                    message_preview: campaignData.messagePreview || '',
                    has_media: campaignData.hasMedia || false
                })
                .select('id')
                .single();

            if (error) throw error;
            console.log('✅ Campanha salva no Supabase:', data?.id);
            return data?.id;
        } catch (err) {
            console.error('❌ Erro ao salvar campanha:', err);
            return null;
        }
    },

    async loadCampaignHistory(limit = 50) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return [];

            const { data, error } = await SupabaseClient
                .from('campaigns')
                .select('*')
                .eq('user_id', userId)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('❌ Erro ao carregar histórico:', err);
            return [];
        }
    },

    async saveCampaignResults(campaignId, results) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId || !campaignId || !results?.length) return;

            const rows = results.map(r => ({
                campaign_id: campaignId,
                user_id: userId,
                contact_name: r.name || '',
                phone: r.phone,
                status: r.status,
                error_msg: r.error || null,
                sent_at: r.sentAt || new Date().toISOString()
            }));

            const { error } = await SupabaseClient.from('campaign_results').insert(rows);
            if (error) throw error;
        } catch (err) {
            console.error('❌ Erro ao salvar resultados:', err);
        }
    },

    async saveContacts(contacts) {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId || !contacts?.length) return;

            const rows = contacts.map(c => ({
                user_id: userId,
                name: c.name || '',
                phone: String(c.phone),
                email: c.email || null,
                tags: c.tags || null
            }));

            const { error } = await SupabaseClient
                .from('contacts')
                .upsert(rows, { onConflict: 'user_id,phone', ignoreDuplicates: false });

            if (error) throw error;
            console.log(`✅ ${rows.length} contatos sincronizados no Supabase`);
        } catch (err) {
            console.error('❌ Erro ao salvar contatos:', err);
        }
    },

    async loadContacts() {
        try {
            const userId = AuthManager.currentUser?.id;
            if (!userId) return [];

            const { data, error } = await SupabaseClient
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .order('name', { ascending: true });

            if (error) throw error;
            return (data || []).map(c => ({
                name: c.name,
                phone: c.phone,
                email: c.email,
                tags: c.tags
            }));
        } catch (err) {
            console.error('❌ Erro ao carregar contatos:', err);
            return [];
        }
    }
};

window.SupabaseDataManager = SupabaseDataManager;

// ========================================
// 12. INICIALIZACAO DA APLICACAO
// ========================================
const App = {
    async initialize() {
        try {
            console.log('🚀 Iniciando Mandato Connect...');

            if (typeof Chart !== 'undefined') {
                Chart.getChart('resultsChart')?.destroy();
            }

            AuthManager.initialize();
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            NotificationService.error('Erro ao inicializar aplicação: ' + error.message);
        }
    },

    async initializeApp() {
        try {
            console.log('🔧 Inicializando aplicação principal...');

            if (typeof ChartManager !== 'undefined') {
                ChartManager.destroy();
            }

            const originalUpdateStats = SendingManager.updateStats;
            SendingManager.updateStats = function () {
                console.log('⏸️ updateStats bloqueado durante inicialização');
            };

            await this.unregisterServiceWorkers();
            this.clearMediaCache();

            if (typeof AutoSaveManager !== 'undefined') {
                AutoSaveManager.isLoading = true;
            }

            AutoSaveManager.initialize();

            NotificationService.initNotify({
                position: 'right-top',
                distance: '20px',
                timeout: 4000
            });

            ChartManager.initialize();
            EventManager.setupFileUpload();
            EventManager.setupFormEvents();
            EventManager.setupPreviewEvents();
            EventManager.setupDelegatedEvents();
            EventManager.setupModalCleanup();

            ScheduleManager.initialize();
            SettingsManager.loadSaved();
            PWAManager.initialize();
            InstanceManager.initialize();
            BatchManager.initialize();
            BusinessHoursManager.initialize();
            EmailSubjectManager.initialize();

            setTimeout(() => {
                if (document.getElementById('richTextEditor') && !window.richTextEditor) {
                    window.richTextEditor = new RichTextEditor('richTextEditor');
                    console.log('✅ Editor de texto rico inicializado');
                }

                if (!window.multipleMessagesInitialized) {
                    MultipleMessagesManager.initialize();
                    window.multipleMessagesInitialized = true;
                    console.log('✅ MultipleMessagesManager inicializado');
                }
            }, 1000);

            setTimeout(() => {
                if (typeof ChartManager !== 'undefined') {
                    ChartManager.initializeResultsSection();
                }
                if (typeof ResultsManager !== 'undefined') {
                    ResultsManager.initialize();
                }
            }, 1500);

            setTimeout(() => {
                if (typeof AutoSaveManager !== 'undefined') {
                    AutoSaveManager.isLoading = false;
                    console.log('✅ Flag isLoading liberada após inicialização completa');
                }
            }, 3000);

            console.log('✅ Mandato Connect inicializado com sucesso!');

            setTimeout(() => {
                SendingManager.updateStats = originalUpdateStats;
                console.log('✅ updateStats reabilitado');
            }, 3000);

            setTimeout(() => {
                if (typeof window.protectTotalContacts === 'function') {
                    window.protectTotalContacts();
                }
            }, 2000);

        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
        }
    },

    async unregisterServiceWorkers() {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();

                for (const registration of registrations) {
                    console.log('🗑️ Desregistrando Service Worker...');
                    await registration.unregister();
                }

                if (registrations.length > 0) {
                    console.log('✅ Service Workers removidos');
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover Service Workers:', error);
        }
    },

    clearMediaCache() {
        if (window.currentMediaURL) {
            URL.revokeObjectURL(window.currentMediaURL);
            window.currentMediaURL = null;
        }

        const mediaFile = document.getElementById('mediaFile');
        if (mediaFile) {
            mediaFile.value = '';
        }

        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) {
            mediaPreview.style.display = 'none';
        }

        console.log('🗑️ Cache de mídia limpo na inicialização');
    }
};

// Expor estado quando embed do MandatoPro ou ambiente local
if (window.APP_ENV?.MANDATOPRO_EMBED || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.AppState = AppState;
    window.APP_CONFIG = APP_CONFIG;
}

if (typeof PhoneUtils !== 'undefined') window.PhoneUtils = PhoneUtils;
if (typeof TimeEstimator !== 'undefined') window.TimeEstimator = TimeEstimator;
