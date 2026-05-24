const UiManager = {
    _initialized: false,
    _badgeInterval: null,
    _storageInterval: null,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        this.applyCustomSystemName();
        this.bindThemeAndProfile();
        this.bindSafeConfig();
        this.bindScheduleValidation();
        this.bindStorageButtons();
        this.bindStartCampaign();
        this.syncFormFields();
        this.startBadgeUpdates();
        this.setupAutoSaveNotification();
        this.startStorageIndicatorUpdates();
    },

    applyCustomSystemName() {
        if (typeof getSystemName !== 'function') {
            console.warn('Funcao getSystemName nao encontrada. Usando nome padrao.');
            return;
        }

        const systemName = getSystemName();
        const elementsToUpdate = [
            { selector: '.installer-title', type: 'text' },
            { selector: '.sidebar-header h3', type: 'text' },
            { selector: 'title', type: 'text' },
            { selector: 'meta[name="apple-mobile-web-app-title"]', type: 'attr', attr: 'content' },
            { selector: '.login-card h1', type: 'text' }
        ];

        elementsToUpdate.forEach(item => {
            const elements = document.querySelectorAll(item.selector);
            elements.forEach(el => {
                if (item.type === 'text') {
                    if (el.textContent.includes('Disparo PRO')) {
                        el.textContent = el.textContent.replace(/Disparo PRO/g, systemName);
                    }
                } else if (item.type === 'attr' && item.attr) {
                    const attrValue = el.getAttribute(item.attr);
                    if (attrValue && attrValue.includes('Disparo PRO')) {
                        el.setAttribute(item.attr, attrValue.replace(/Disparo PRO/g, systemName));
                    }
                }
            });
        });
    },

    bindThemeAndProfile() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                if (typeof UI !== 'undefined' && typeof UI.alternarTema === 'function') {
                    UI.alternarTema();
                }
            });
        }

        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                if (window.ProfileManager && typeof ProfileManager.openModal === 'function') {
                    ProfileManager.openModal();
                }
            });
        }

        const profileSaveBtn = document.getElementById('profileSaveBtn');
        if (profileSaveBtn) {
            profileSaveBtn.addEventListener('click', () => {
                if (window.ProfileManager && typeof ProfileManager.saveName === 'function') {
                    ProfileManager.saveName();
                }
            });
        }
    },

    bindSafeConfig() {
        const safeConfigBtn = document.getElementById('safeConfigBtn');
        if (!safeConfigBtn) return;

        safeConfigBtn.addEventListener('click', () => {
            this.startSafeConfiguration();
        });
    },

    bindScheduleValidation() {
        const scheduleDate = document.getElementById('scheduleDate');
        if (!scheduleDate) return;

        scheduleDate.addEventListener('change', () => {
            this.validateScheduleDate();
        });
    },

    bindStorageButtons() {
        const showStorageInfoBtn = document.getElementById('showStorageInfoBtn');
        if (showStorageInfoBtn) {
            showStorageInfoBtn.addEventListener('click', () => {
                if (typeof window.showStorageInfo === 'function') {
                    window.showStorageInfo();
                }
            });
        }

        const clearSessionDataBtn = document.getElementById('clearSessionDataBtn');
        if (clearSessionDataBtn) {
            clearSessionDataBtn.addEventListener('click', () => {
                if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.clearSessionData === 'function') {
                    SettingsManager.clearSessionData();
                }
            });
        }
    },

    bindStartCampaign() {
        const startCampaignBtn = document.getElementById('startCampaignBtn');
        const originalForm = document.getElementById('bulkForm');

        if (!startCampaignBtn || !originalForm) return;

        startCampaignBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.syncFormFields();

            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            originalForm.dispatchEvent(submitEvent);
        });
    },

    syncFormFields() {
        const configFields = [
            'minInterval', 'maxInterval', 'ia', 'enableBrazilianValidation',
            'enableEmailSending', 'emailSubject', 'enableBatchPause',
            'batchSize', 'batchPauseDuration', 'enableScheduling',
            'scheduleDate', 'scheduleTime'
        ];

        configFields.forEach(fieldId => {
            const originalField = document.getElementById(fieldId);
            const hiddenField = document.getElementById('hidden' + fieldId.charAt(0).toUpperCase() + fieldId.slice(1));

            if (!originalField || !hiddenField) return;

            if (originalField.type === 'checkbox') {
                hiddenField.value = originalField.checked ? '1' : '0';
            } else {
                hiddenField.value = originalField.value;
            }

            if (!originalField.dataset.syncBound) {
                originalField.addEventListener('change', () => {
                    if (originalField.type === 'checkbox') {
                        hiddenField.value = originalField.checked ? '1' : '0';
                    } else {
                        hiddenField.value = originalField.value;
                    }
                });
                originalField.dataset.syncBound = '1';
            }
        });
    },

    updateBadges() {
        const contactCount = document.getElementById('contactCount')?.textContent || '0';
        const contactBadge = document.getElementById('contactCountBadge');
        if (contactBadge && contactCount !== '0 contatos') {
            contactBadge.textContent = contactCount.replace(' contatos', '');
            contactBadge.style.display = 'inline';
        }

        const instanceCount = String(window.AppState?.instances?.length || 0);
        const instanceBadge = document.getElementById('instanceCountBadge');
        if (instanceBadge) {
            instanceBadge.textContent = instanceCount;
        }

        const totalSent = document.getElementById('totalSent')?.textContent || '0';
        const totalContacts = document.getElementById('totalContacts');
        if (totalContacts) {
            totalContacts.textContent = totalSent;
        }

        const successCount = document.getElementById('successCount')?.textContent || '0';
        const successCountDash = document.getElementById('totalSentDash');
        if (successCountDash) {
            successCountDash.textContent = successCount;
        }
    },

    startBadgeUpdates() {
        this.updateBadges();
        if (this._badgeInterval) clearInterval(this._badgeInterval);
        this._badgeInterval = setInterval(() => this.updateBadges(), 2000);
    },

    setupAutoSaveNotification() {
        setTimeout(() => {
            const storageInfo = StorageService.getAutoSaveInfo();
            if (!storageInfo.exists || storageInfo.contacts <= 0) return;

            NotificationService.info(
                `Dados da sessao anterior restaurados: ${storageInfo.contacts} contatos`,
                { timeout: 5000, position: 'right-bottom', fontSize: '14px' }
            );
        }, 2000);
    },

    startSafeConfiguration() {
        const minInterval = document.getElementById('minInterval');
        const maxInterval = document.getElementById('maxInterval');
        const enableBatchPause = document.getElementById('enableBatchPause');
        const batchSize = document.getElementById('batchSize');
        const batchPauseDuration = document.getElementById('batchPauseDuration');

        if (minInterval) minInterval.value = 60;
        if (maxInterval) maxInterval.value = 120;
        if (enableBatchPause) {
            enableBatchPause.checked = true;
            enableBatchPause.dispatchEvent(new Event('change'));
        }
        if (batchSize) batchSize.value = 10;
        if (batchPauseDuration) batchPauseDuration.value = 10;

        NotificationService.success('Configuracoes seguras aplicadas!');
    },

    validateScheduleDate() {
        const scheduleDate = document.getElementById('scheduleDate');
        const scheduleTime = document.getElementById('scheduleTime');

        if (scheduleDate && scheduleDate.value) {
            const selectedDate = new Date(scheduleDate.value + 'T' + (scheduleTime?.value || '00:00'));
            const now = new Date();

            if (selectedDate <= now) {
                alert('A data e hora do agendamento deve ser futura!');
                scheduleDate.value = '';
                if (scheduleTime) scheduleTime.value = '';
            }
        }
    },

    updateStorageIndicator() {
        const storageInfo = StorageService.getAutoSaveInfo();
        if (!storageInfo.exists) return;

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
            return;
        }

        const sizeElement = document.getElementById('storage-size');
        if (sizeElement) {
            sizeElement.textContent = storageInfo.sizeKB + ' KB';
        }
    },

    startStorageIndicatorUpdates() {
        this.updateStorageIndicator();
        if (this._storageInterval) clearInterval(this._storageInterval);
        this._storageInterval = setInterval(() => this.updateStorageIndicator(), 10000);
    }
};

window.UiManager = UiManager;
