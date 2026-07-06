// ========================================
// 13. GERENCIAMENTO DE ENVIO
// ========================================
const SendingManager = {
    async start() {
        if (Validators._lastValidation) {
            delete Validators._lastValidation;
        }

        MultipleMessagesManager._isUpdatingCount = false;
        this._isValidating = false;

        if (typeof MultipleMessagesManager !== 'undefined' && MultipleMessagesManager.resetMessageRotation) {
            MultipleMessagesManager.resetMessageRotation();
        }

        const loginScreen = document.getElementById('loginScreen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (isLoginVisible) {
            console.log('🔐 Tentativa de envio na tela de login ignorada');
            return;
        }

        if (!AuthManager.requireAuth()) {
            return;
        }

        const validation = this.validateBeforeSending();
        if (!validation.valid) {
            UI.showError(validation.error);
            return;
        }

        this.initializeSending();

        if (AppState.businessHoursEnabled) {
            const validation = BusinessHoursManager.validateSettings();
            if (!validation.valid) {
                UI.showError(validation.error);
                return;
            }

            if (!BusinessHoursManager.isWithinBusinessHours()) {
                UI.showInfo('Fora do horário comercial. Aguardando...');
                await BusinessHoursManager.waitForBusinessHours();

                if (AppState.stopSending) return;
            }
        }

        this.switchToProgressSection();

        if (AppState.activeInstances.length > 0) {
            UI.showInfo(`Iniciando envio com ${AppState.activeInstances.length} instância(s) conectada(s)...`);
        } else {
            const instanceName = document.getElementById('instanceName')?.value || 'Manual';
            UI.showInfo(`Iniciando envio no modo manual com instância: ${instanceName}...`);
        }

        const { instanceName, instanceAPIKEY } = Validators.instanceData();
        const ia = document.getElementById('ia')?.value || '';
        const { min: minInterval, max: maxInterval } = Validators.intervals();

        UI.showInfo('Iniciando envio para contatos selecionados...');

        for (let i = 0; i < AppState.contacts.length; i++) {
            if (AppState.stopSending) break;

            const contact = AppState.contacts[i];
            TimerManager.showSending(contact.name, i, AppState.contacts.length);
            const messageData = await this.prepareMessageData(contact);
            console.log(`🎯 Mensagem preparada para ${contact.name}: "${messageData.messageId}"`);

            await this.waitWhilePaused();
            if (AppState.stopSending) break;

            await this.sendMessage(instanceName, instanceAPIKEY, ia, contact, messageData, {
                contactName: contact.name,
                currentIndex: i,
                total: AppState.contacts.length
            });
            this.updateProgress(i);

            ActiveDispatchManager.saveDispatchState(i + 1, contact);

            if (AppState.businessHoursEnabled && !BusinessHoursManager.isWithinBusinessHours()) {
                UI.showWarning('Horário comercial encerrado. Pausando até próximo período.');
                await BusinessHoursManager.waitForBusinessHours();

                if (AppState.stopSending) break;
            }

            if (BatchManager.shouldPauseBatch(i)) {
                console.log('📦 Fim do lote - pausando...');
                await BatchManager.startBatchPause();

                if (AppState.stopSending) break;
            }

            const isLastMessage = i >= AppState.contacts.length - 1;
            const willPauseBatch = BatchManager.shouldPauseBatch(i);

            if (!isLastMessage && !willPauseBatch && !AppState.stopSending) {
                const delay = Math.random() * (maxInterval * 1000 - minInterval * 1000) + minInterval * 1000;

                console.log(`⏱️ Iniciando temporizador para próximo envio: ${delay}ms`);

                TimerManager.startCountdown(delay, i + 1, AppState.contacts.length);

                await this.waitInterruptible(delay);

                TimerManager.hide();
            }
        }

        this.finishSending();

        ActiveDispatchManager.clearDispatchState();

        BatchManager.reset();
        if (AppState.batchPauseEnabled) {
            BatchManager.updateBatchInfo();
        }
    },

    switchToProgressSection() {
        console.log('📊 Redirecionando para seção de progresso...');

        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(nav => nav.classList.remove('active'));

        const contentSections = document.querySelectorAll('.content-section');
        contentSections.forEach(section => section.classList.remove('active'));

        const progressNavLink = document.querySelector('.nav-link[data-section="progresso"]');
        if (progressNavLink) {
            progressNavLink.classList.add('active');
        }

        const progressSection = document.getElementById('progresso-section');
        if (progressSection) {
            progressSection.classList.add('active');
        }

        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = 'Progresso';
        }

        setTimeout(() => {
            const nextSendTimer = document.getElementById('nextSendTimer');
            if (nextSendTimer) {
                nextSendTimer.style.display = 'block';
            }
        }, 100);

        console.log('✅ Redirecionamento para progresso concluído');
    },

    validateBeforeSending() {
        if (this._isValidating) {
            console.log('⚠️ Validação já em andamento...');
            return { valid: false, error: 'Validação em andamento' };
        }

        this._isValidating = true;

        console.log('🔍 Iniciando validação única...');

        try {
            if (AppState.sendingInProgress) {
                return { valid: false, error: 'Envio já está em andamento' };
            }

            const contactsValidation = Validators.contacts();
            if (!contactsValidation.valid) {
                const validationMode = PhoneUtils.getValidationMode();
                return {
                    valid: false,
                    error: `Importe uma lista de contatos primeiro. Modo atual: ${validationMode.modeName}`
                };
            }

            const hasActiveInstances = AppState.activeInstances.length > 0;
            const hasLegacyConfig = document.getElementById('instanceName')?.value?.trim() &&
                document.getElementById('instanceAPIKEY')?.value?.trim();

            if (!hasActiveInstances && !hasLegacyConfig) {
                return {
                    valid: false,
                    error: 'Configure pelo menos uma instância WhatsApp conectada ou preencha os campos de instância manual.'
                };
            }

            const intervalsValidation = Validators.intervals();
            if (!intervalsValidation.valid) {
                return { valid: false, error: 'Intervalo mínimo deve ser menor que o máximo' };
            }

            const mediaFile = document.getElementById('mediaFile')?.files[0];
            if (mediaFile) {
                const maxSize = 16 * 1024 * 1024;
                if (mediaFile.size > maxSize) {
                    return {
                        valid: false,
                        error: `Arquivo muito grande: ${(mediaFile.size / 1024 / 1024).toFixed(1)}MB. Máximo: 16MB`
                    };
                }
            }

            console.log('📝 Validando mensagens (única chamada)...');
            if (typeof Validators !== 'undefined') Validators._lastValidation = null;
            const messagesValidation = Validators.messages();
            if (!messagesValidation.valid) {
                return {
                    valid: false,
                    error: messagesValidation.type === 'multiple'
                        ? 'Configure pelo menos uma mensagem ativa no modo múltiplas mensagens'
                        : 'Digite uma mensagem para enviar'
                };
            }

            const emailEnabled = document.getElementById('enableEmailSending')?.checked;
            if (emailEnabled) {
                const contactsWithEmail = AppState.contacts.filter(contact => contact.email && contact.email.trim());
                if (contactsWithEmail.length === 0) {
                    return {
                        valid: false,
                        error: 'Envio por e-mail ativado, mas nenhum contato possui e-mail válido.'
                    };
                }

                const emailSubject = EmailSubjectManager.getEmailSubject();
                if (!emailSubject) {
                    return {
                        valid: false,
                        error: 'Digite um assunto para o e-mail.'
                    };
                }

                console.log('📧 E-mail habilitado:', {
                    contactsWithEmail: contactsWithEmail.length,
                    subject: emailSubject
                });
            }

            console.log('✅ Validação concluída com sucesso');
            return { valid: true };

        } finally {
            setTimeout(() => {
                this._isValidating = false;
            }, 100);
        }
    },

    initializeSending() {
        AppState.sendingInProgress = true;
        AppState.startTime = Date.now();
        AppState.stopSending = false;
        AppState.results = { success: 0, error: 0 };
        AppState.sendingDetails = [];
        AppState.isPaused = false;

        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('reportButton').style.display = 'none';
        this.updateStats();
        ChartManager.update();
        this.updatePauseButton();
        document.getElementById('pauseButton').style.display = 'block';
        TimeEstimator.update();

        this.updateStats();
        ChartManager.update();
        this.updatePauseButton();

        BatchManager.reset();
        if (AppState.batchPauseEnabled) {
            BatchManager.updateBatchInfo();
        }

        this.showCurrentSettings();
        TimeEstimator.update();

        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
        }, 300);
    },

    applyNewSettings() {
        if (!AppState.sendingInProgress || !AppState.isPaused) {
            UI.showWarning('Esta função só funciona durante uma pausa no envio');
            return;
        }

        const intervalsValidation = Validators.intervals();
        if (!intervalsValidation.valid) {
            UI.showError('Configure intervalos válidos primeiro');
            return;
        }

        console.log('🔄 Aplicando novas configurações:', {
            oldMin: AppState.minInterval,
            oldMax: AppState.maxInterval,
            newMin: intervalsValidation.min,
            newMax: intervalsValidation.max
        });

        AppState.minInterval = intervalsValidation.min;
        AppState.maxInterval = intervalsValidation.max;

        const batchEnabled = document.getElementById('enableBatchPause')?.checked;
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);

        AppState.batchPauseEnabled = batchEnabled;
        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        setTimeout(() => {
            this.showCurrentSettings();
            this.updateActiveConfigDisplay(intervalsValidation);
            TimeEstimator.update();
        }, 100);

        UI.showSuccess('✅ Novas configurações aplicadas! Retome o envio para usar.');

        console.log('✅ Configurações aplicadas com sucesso:', {
            intervals: `${intervalsValidation.min}s - ${intervalsValidation.max}s`,
            batch: batchEnabled ? `${batchSize} msgs, ${batchPause}min` : 'Desabilitado'
        });
    },

    async prepareMessageData(contact) {
        let messageData = '';
        let mediaData = null;
        let mediaInfo = null;
        let selectedMessageId = null;

        const randomMessage = MultipleMessagesManager.getRandomActiveMessage();
        selectedMessageId = randomMessage.id;
        messageData = randomMessage.text;

        if (randomMessage.media) {
            if (randomMessage.media.type === 'url') {
                console.log('📎 Processando mídia via URL (enviando diretamente):', randomMessage.media.url);

                mediaInfo = {
                    filename: randomMessage.media.filename,
                    mimetype: randomMessage.media.mimetype,
                    url: randomMessage.media.url,
                    type: 'url'
                };

                mediaData = null;

                console.log('✅ Mídia via URL preparada para envio:', {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    type: mediaInfo.mimetype
                });

            } else {
                mediaInfo = {
                    filename: randomMessage.media.filename,
                    mimetype: randomMessage.media.mimetype,
                    size: randomMessage.media.size,
                    type: 'file'
                };
                mediaData = randomMessage.media.data;
            }
        }

        if (!messageData.trim() && !mediaData && !mediaInfo?.url) {
            throw new Error('Configure pelo menos uma mensagem com texto ou mídia');
        }

        if (messageData.trim()) {
            messageData = messageData
                .replace(/{nome}/g, contact.name)
                .replace(/{saudacao}/g, Utils.getSaudacao());

            messageData = RandomTagsSystem.processAllTags(messageData);
        }

        return {
            messageData,
            mediaData,
            mediaInfo,
            messageId: selectedMessageId
        };
    },

    async sendMessage(instanceName, instanceAPIKEY, ia, contact, messageDataObj, sendContext = null) {
        const { messageData, mediaData, mediaInfo, messageId } = messageDataObj;
        let selectedInstance;
        let currentMedia = null;

        if (AppState.activeInstances.length > 0) {
            selectedInstance = await InstanceManager.getRandomActiveInstanceForSend(sendContext);
            if (!selectedInstance) {
                if (typeof SendingManager !== 'undefined' && SendingManager.pause) {
                    SendingManager.pause();
                } else {
                    AppState.isPaused = true;
                }

                UI.showWarning('Envio pausado: nenhuma instância conectada. Conecte e clique em Retomar.');
                return;
            }
            instanceName = selectedInstance.name;
            instanceAPIKEY = selectedInstance.apikey;
        } else {
            selectedInstance = {
                id: 'legacy',
                name: instanceName || 'Instância Manual',
                apikey: instanceAPIKEY || ''
            };
        }

        const currentMessageId = messageId || 'msg1';
        console.log(`📤 Enviando mensagem "${currentMessageId}" para ${contact.name}`);

        const currentMessage = messageData || '';

        if (!currentMessage.trim() && !mediaData && !mediaInfo?.url) {
            throw new Error('Nenhuma mensagem ou mídia para enviar');
        }

        if (mediaInfo) {
            if (mediaInfo.type === 'url') {
                console.log(`📎 Preparando mídia via URL (${currentMessageId}):`, {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    mimetype: mediaInfo.mimetype
                });

                currentMedia = {
                    filename: mediaInfo.filename,
                    url: mediaInfo.url,
                    mimetype: mediaInfo.mimetype,
                    type: 'url',
                    size: null
                };

            } else if (mediaInfo.type === 'file' && mediaData) {
                console.log(`📎 Preparando mídia via arquivo (${currentMessageId}):`, {
                    filename: mediaInfo.filename,
                    mimetype: mediaInfo.mimetype,
                    size: mediaInfo.size,
                    dataLength: mediaData.length
                });

                currentMedia = {
                    filename: mediaInfo.filename,
                    data: mediaData,
                    mimetype: mediaInfo.mimetype,
                    type: 'file',
                    size: mediaInfo.size
                };
            }
        }

        let personalizedMessage = currentMessage.trim() ?
            currentMessage
                .replace(/{nome}/g, contact.name)
                .replace(/{saudacao}/g, Utils.getSaudacao())
            : '';

        personalizedMessage = cleanMessageForWhatsApp(personalizedMessage);

        console.log(`📤 Enviando "${currentMessageId}" para ${contact.name}:`, {
            temTexto: !!personalizedMessage,
            temMidia: !!currentMedia,
            tipoMidia: currentMedia?.type || 'nenhuma',
            urlMidia: currentMedia?.url || 'N/A'
        });

        const payload = {
            action: 'enviar_mensagem',
            instanceName,
            instanceAPIKEY,
            ia,
            contact: {
                name: contact.name,
                phone: contact.phone,
                email: contact.email || null
            },
            message: personalizedMessage,
            media: currentMedia,
            sendEmail: !!contact.email && document.getElementById('enableEmailSending')?.checked,
            emailSubject: EmailSubjectManager.processEmailSubject(EmailSubjectManager.getEmailSubject(), contact.name),
            messageId: currentMessageId
        };

        console.log(`📤 Payload "${currentMessageId}" completo:`, {
            action: payload.action,
            instanceName: payload.instanceName,
            contactName: payload.contact.name,
            messageId: payload.messageId,
            hasMessage: !!payload.message,
            hasMedia: !!payload.media
        });

        const sendTime = new Date();

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`📡 Resposta para "${currentMessageId}":`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const responseText = await response.text();
            console.log(`📄 Resposta completa "${currentMessageId}":`, responseText);

            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`❌ Erro ao parsear resposta "${currentMessageId}":`, parseError);
                console.log('📄 Resposta bruta:', responseText);
            }

            if (response.ok) {
                AppState.results.success++;

                if (selectedInstance.id !== 'legacy') {
                    InstanceManager.updateInstanceStats(selectedInstance.id, true);
                }

                AppState.sendingDetails.push({
                    datetime: sendTime,
                    phone: contact.phone,
                    name: contact.name,
                    email: contact.email || '',
                    message: personalizedMessage,
                    instance: selectedInstance.name,
                    instanceId: selectedInstance.id,
                    messageId: currentMessageId,
                    status: 'Sucesso',
                    mediaType: currentMedia?.mimetype || null,
                    mediaUrl: currentMedia?.url || null,
                    sentEmail: !!contact.email && payload.sendEmail
                });

                const instanceInfo = AppState.activeInstances.length > 0 ? ` via ${selectedInstance.name}` : '';
                const emailInfo = contact.email && payload.sendEmail ? ' + E-mail' : '';
                const mediaInfo = currentMedia ?
                    ` + ${currentMedia.type === 'url' ? 'URL' : currentMedia.mimetype.split('/')[0]}` : '';
                const messageInfo = ` (${currentMessageId})`;

                UI.showSuccess(`Enviado para ${contact.name}${instanceInfo}${emailInfo}${mediaInfo}${messageInfo}`);
            } else {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }
        } catch (error) {
            AppState.results.error++;

            if (selectedInstance.id !== 'legacy') {
                InstanceManager.updateInstanceStats(selectedInstance.id, false);
            }

            AppState.sendingDetails.push({
                datetime: sendTime,
                phone: contact.phone,
                name: contact.name,
                email: contact.email || '',
                message: personalizedMessage,
                instance: selectedInstance.name,
                instanceId: selectedInstance.id,
                messageId: currentMessageId,
                status: 'Erro',
                error: error.message,
                mediaType: currentMedia?.mimetype || null,
                mediaUrl: currentMedia?.url || null,
                sentEmail: false
            });

            console.error(`❌ Erro detalhado no envio "${currentMessageId}":`, {
                contact: contact.name,
                messageId: currentMessageId,
                error: error.message,
                hasMedia: !!currentMedia,
                mediaType: currentMedia?.type,
                mediaUrl: currentMedia?.url,
                stack: error.stack
            });

            UI.showError(`Erro ao enviar "${currentMessageId}" para ${contact.name} via ${selectedInstance.name}: ${error.message}`);
        }
    },

    updateProgress(currentIndex) {
        const progress = ((currentIndex + 1) / AppState.contacts.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${currentIndex + 1}/${AppState.contacts.length}`;

        this.updateStats();
        ChartManager.update();
        TimeEstimator.update();
    },

    updateStats() {
        console.log('📊 updateStats chamado:', {
            timestamp: new Date().toLocaleTimeString(),
            totalSent: AppState.results.success + AppState.results.error
        });

        const totalSentEl = document.getElementById('totalSent');
        const successCountEl = document.getElementById('successCount');
        const errorCountEl = document.getElementById('errorCount');

        const totalSentProgressEl = document.getElementById('totalSentProgress');
        const successCountProgressEl = document.getElementById('successCountProgress');
        const errorCountProgressEl = document.getElementById('errorCountProgress');

        const totalSentResultsEl = document.getElementById('totalSentResults');
        const successRateEl = document.getElementById('successRate');
        const avgTimeEl = document.getElementById('avgTime');
        const todayDispatchesEl = document.getElementById('todayDispatches');

        const messagesPerHourEl = document.getElementById('messagesPerHour');
        const efficiencyEl = document.getElementById('efficiency');
        const listQualityEl = document.getElementById('listQuality');
        const hourlyProgressEl = document.getElementById('hourlyProgress');
        const efficiencyProgressEl = document.getElementById('efficiencyProgress');
        const qualityProgressEl = document.getElementById('qualityProgress');

        const totalSent = AppState.results.success + AppState.results.error;
        const successRate = totalSent > 0 ? Math.round((AppState.results.success / totalSent) * 100) : 0;

        let avgTime = 0;
        if (AppState.startTime && totalSent > 0) {
            const elapsed = Date.now() - AppState.startTime;
            avgTime = Math.round(elapsed / totalSent / 1000);
        }

        let messagesPerHour = 0;
        if (AppState.startTime && totalSent > 0) {
            const elapsedHours = (Date.now() - AppState.startTime) / (1000 * 60 * 60);
            messagesPerHour = Math.round(totalSent / Math.max(elapsedHours, 0.01));
        }

        let todayDispatches = 0;
        if (AppState.sendingHistory.length > 0) {
            todayDispatches = AppState.sendingHistory.length;
        } else if (AppState.sendingInProgress || totalSent > 0) {
            todayDispatches = 1;
        }

        const efficiency = Math.min(100, successRate * 0.7 + (messagesPerHour > 0 ? 30 : 0));
        const listQuality = successRate;

        if (totalSentEl) totalSentEl.textContent = totalSent;
        if (successCountEl) successCountEl.textContent = AppState.results.success;
        if (errorCountEl) errorCountEl.textContent = AppState.results.error;

        if (totalSentProgressEl) totalSentProgressEl.textContent = totalSent;
        if (successCountProgressEl) successCountProgressEl.textContent = AppState.results.success;
        if (errorCountProgressEl) errorCountProgressEl.textContent = AppState.results.error;

        if (totalSentResultsEl) totalSentResultsEl.textContent = totalSent;
        if (successRateEl) successRateEl.textContent = successRate + '%';
        if (avgTimeEl) avgTimeEl.textContent = avgTime > 0 ? avgTime + 's' : '0s';
        if (todayDispatchesEl) todayDispatchesEl.textContent = todayDispatches;

        if (messagesPerHourEl) messagesPerHourEl.textContent = messagesPerHour;
        if (efficiencyEl) efficiencyEl.textContent = Math.round(efficiency) + '%';
        if (listQualityEl) listQualityEl.textContent = listQuality + '%';

        if (hourlyProgressEl) {
            const maxHourly = 120;
            const hourlyPercentage = Math.min(100, (messagesPerHour / maxHourly) * 100);
            hourlyProgressEl.style.width = hourlyPercentage + '%';
        }

        if (efficiencyProgressEl) {
            efficiencyProgressEl.style.width = Math.round(efficiency) + '%';
        }

        if (qualityProgressEl) {
            qualityProgressEl.style.width = listQuality + '%';
        }

        console.log('✅ Stats de envio atualizadas (totalContacts NÃO foi tocado)');
    },

    updateResultsChart() {
        if (AppState.chart && this.isInitialized) {
            try {
                AppState.chart.data.datasets[0].data = [AppState.results.success, AppState.results.error];
                AppState.chart.update();
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar gráfico principal:', error);
            }
        }

        const resultsCtx = document.getElementById('resultsChartResults')?.getContext('2d');
        if (resultsCtx) {
            if (window.resultsChart) {
                window.resultsChart.destroy();
            }

            try {
                window.resultsChart = new Chart(resultsCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Sucessos', 'Erros'],
                        datasets: [{
                            data: [AppState.results.success, AppState.results.error],
                            backgroundColor: ['#28a745', '#dc3545'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 20,
                                    usePointStyle: true,
                                    font: {
                                        size: 12
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const total = AppState.results.success + AppState.results.error;
                                        const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });

                console.log('📊 Gráfico de resultados atualizado');
            } catch (error) {
                console.error('❌ Erro ao criar gráfico de resultados:', error);
            }
        }
    },

    async waitWhilePaused() {
        while (AppState.isPaused && !AppState.stopSending) {
            await Utils.sleep(500);
        }
    },

    async waitInterruptible(durationMs, stepMs = 250) {
        const startedAt = Date.now();
        while (!AppState.stopSending && Date.now() - startedAt < durationMs) {
            await this.waitWhilePaused();
            if (AppState.stopSending) break;
            const remaining = durationMs - (Date.now() - startedAt);
            await Utils.sleep(Math.min(stepMs, Math.max(0, remaining)));
        }
    },

    stop() {
        if (!AppState.sendingInProgress && !AppState.isPaused && !AppState.batchPauseActive) {
            UI.showInfo('Nenhum envio em andamento para interromper');
            return;
        }

        AppState.stopSending = true;
        AppState.isPaused = false;
        AppState.batchPauseActive = false;
        BatchManager.hideBatchStatus();
        TimerManager.showStopped();
        ActiveDispatchManager.clearDispatchState();
        this.updatePauseButton();

        const stopButton = document.getElementById('stopButton');
        if (stopButton) {
            stopButton.disabled = true;
            stopButton.innerHTML = '<i class="bi bi-stop-circle me-2"></i>Parando...';
        }

        UI.showWarning('Parando envio...');
    },

    pause() {
        AppState.isPaused = true;
        TimerManager.pause();
        this.updatePauseButton();

        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
        }, 100);

        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.style.display = 'inline-block';
        }

        UI.showWarning('Envio pausado - Você pode alterar intervalos e retomar com novas configurações');
    },

    resume() {
        const validation = Validators.intervals();
        if (!validation.valid) {
            UI.showError('Intervalos inválidos. Configure novamente antes de retomar.');
            return;
        }

        console.log('▶️ Retomando envio com novas configurações:', {
            minInterval: validation.min,
            maxInterval: validation.max,
            batchEnabled: AppState.batchPauseEnabled
        });

        AppState.minInterval = validation.min;
        AppState.maxInterval = validation.max;

        const batchEnabled = document.getElementById('enableBatchPause')?.checked;
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);

        AppState.batchPauseEnabled = batchEnabled;
        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        AppState.isPaused = false;
        TimerManager.resume();
        this.updatePauseButton();

        setTimeout(() => {
            this.updateActiveConfigurationsDisplay();
            TimeEstimator.update();
        }, 200);

        const applyBtn = document.getElementById('applySettingsBtn');
        if (applyBtn) {
            applyBtn.style.display = 'none';
        }

        UI.showInfo(`Envio retomado com intervalos: ${validation.min}s - ${validation.max}s`);
    },

    updateActiveConfigurationsDisplay() {
        const validation = Validators.intervals();
        if (!validation.valid) return;

        console.log('🔄 Atualizando display de configurações...');

        const alertElements = document.querySelectorAll('.alert-info');
        let configCard = null;

        alertElements.forEach(element => {
            if (element.textContent.includes('Configurações Ativas') ||
                element.textContent.includes('Intervalo:')) {
                configCard = element;
            }
        });

        if (configCard) {
            const newContent = `
            <strong>⚙️ Configurações Ativas:</strong><br>
            Intervalo: ${validation.min}s - ${validation.max}s<br>
            ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
        `;

            configCard.innerHTML = newContent;
            console.log('✅ Card de configurações atualizado:', {
                min: validation.min,
                max: validation.max,
                batch: AppState.batchPauseEnabled
            });
        } else {
            console.warn('⚠️ Card de configurações não encontrado');

            this.createConfigurationsCard(validation);
        }
    },

    createConfigurationsCard(validation) {
        const progressCard = document.querySelector('.progress-container .card-body');

        if (progressCard) {
            const configDiv = document.createElement('div');
            configDiv.className = 'alert alert-info mt-3';
            configDiv.innerHTML = `
            <strong>⚙️ Configurações Ativas:</strong><br>
            Intervalo: ${validation.min}s - ${validation.max}s<br>
            ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
        `;

            const buttons = progressCard.querySelector('.d-grid');
            if (buttons) {
                progressCard.insertBefore(configDiv, buttons);
            } else {
                progressCard.appendChild(configDiv);
            }

            console.log('✅ Card de configurações criado');
        }
    },

    showCurrentSettings() {
        const validation = Validators.intervals();
        if (!validation.valid) return;

        let settingsInfo = document.getElementById('currentSettingsInfo');
        if (!settingsInfo) {
            const progressCard = document.querySelector('.progress-container .card-body');
            if (progressCard) {
                settingsInfo = document.createElement('div');
                settingsInfo.id = 'currentSettingsInfo';
                settingsInfo.className = 'mt-3';
                progressCard.appendChild(settingsInfo);
            }
        }

        if (settingsInfo) {
            settingsInfo.innerHTML = `
            <div class="alert alert-info">
                <strong>⚙️ Configurações Ativas:</strong><br>
                Intervalo: ${validation.min}s - ${validation.max}s<br>
                ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
            </div>
        `;
        }

        this.updateActiveConfigDisplay(validation);
    },

    updateActiveConfigDisplay(validation) {
        const configElements = document.querySelectorAll('.alert-info');

        configElements.forEach(element => {
            if (element.textContent.includes('Configurações Ativas:')) {
                element.innerHTML = `
                <strong>⚙️ Configurações Ativas:</strong><br>
                Intervalo: ${validation.min}s - ${validation.max}s<br>
                ${AppState.batchPauseEnabled ? `Lotes: ${AppState.batchSize} msgs, Pausa: ${AppState.batchPauseDuration}min` : 'Sem pausas em lotes'}
            `;
            }
        });

        console.log('✅ Display de configurações ativas atualizado:', {
            minInterval: validation.min,
            maxInterval: validation.max,
            batchEnabled: AppState.batchPauseEnabled,
            batchSize: AppState.batchSize,
            batchPause: AppState.batchPauseDuration
        });
    },

    updatePauseButton() {
        const pauseButton = document.getElementById('pauseButton');
        if (!pauseButton) return;

        if (AppState.isPaused) {
            pauseButton.className = 'btn btn-success';
            pauseButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Retomar Envio';
        } else {
            pauseButton.className = 'btn btn-warning';
            pauseButton.innerHTML = '<i class="bi bi-pause-circle me-2"></i>Pausar Envio';
        }
    },

    async sendCompletionNotification(sessionData, totalDuration) {
        if (AppState.stopSending || !sessionData?.totalContacts) return;

        const profile = ProfileManager?._profile || AuthManager.userProfile || {};
        const rawPhone = profile.phone;

        if (!rawPhone) {
            console.warn('⚠️ Telefone do tenant nao encontrado para notificacao de conclusao');
            return;
        }

        const phoneValidation = PhoneUtils.isValidPhone(rawPhone);
        if (!phoneValidation.valid) {
            console.warn('⚠️ Telefone do tenant invalido para notificacao:', phoneValidation.error);
            return;
        }

        const formattedPhone = phoneValidation.formatted || PhoneUtils.formatPhone(rawPhone);
        const details = Array.isArray(sessionData.details) ? sessionData.details : [];
        const lastDetail = details.length > 0 ? details[details.length - 1] : null;

        let instance = null;
        if (lastDetail?.instanceId) {
            instance = AppState.instances.find(inst => String(inst.id) === String(lastDetail.instanceId));
        }
        if (!instance && lastDetail?.instance) {
            instance = AppState.instances.find(inst => inst.name === lastDetail.instance);
        }
        if (!instance) {
            instance = AppState.instances.find(inst => inst.status === 'connected');
        }
        if (!instance || !instance.apikey) {
            console.warn('⚠️ Nenhuma instancia valida para notificar conclusao');
            return;
        }

        const displayName = profile.full_name || profile.email || 'Usuario';
        const messageLines = [
            'Envio concluido!',
            `Total: ${sessionData.totalContacts || 0}`,
            `Sucesso: ${sessionData.successCount || 0}`,
            `Erros: ${sessionData.errorCount || 0}`,
            `Duracao: ${Utils.formatTime(totalDuration || 0)}`
        ];

        const payload = {
            action: 'enviar_mensagem',
            instanceName: instance.name,
            instanceAPIKEY: instance.apikey,
            ia: '',
            contact: {
                name: displayName,
                phone: formattedPhone,
                email: null
            },
            message: cleanMessageForWhatsApp(messageLines.join('\n')),
            media: null,
            sendEmail: false,
            emailSubject: null,
            messageId: 'dispatch-completed'
        };

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || response.statusText);
            }

            console.log('✅ Notificacao de conclusao enviada para o tenant');
        } catch (err) {
            console.warn('⚠️ Falha ao enviar notificacao de conclusao:', err.message || err);
        }
    },

    finishSending() {
        AppState.isPaused = false;
        document.getElementById('pauseButton').style.display = 'none';
        const stopButton = document.getElementById('stopButton');
        if (stopButton) {
            stopButton.disabled = false;
            stopButton.innerHTML = '<i class="bi bi-stop-circle me-2"></i>Parar Envio';
        }

        const totalDuration = AppState.startTime ? Date.now() - AppState.startTime : 0;

        console.log('⏱️ Envio finalizado:', {
            startTime: AppState.startTime ? new Date(AppState.startTime).toLocaleTimeString() : 'N/A',
            endTime: new Date().toLocaleTimeString(),
            duracaoReal: Utils.formatTime(totalDuration),
            totalEnvios: AppState.sendingDetails.length
        });

        TimerManager.showCompleted(AppState.results.success, AppState.results.error, totalDuration);
        AppState.sendingInProgress = false;

        this.updateStats();
        ChartManager.update();

        const sessionData = {
            instanceName: document.getElementById('instanceName')?.value || '',
            totalContacts: AppState.contacts.length,
            successCount: AppState.results.success,
            errorCount: AppState.results.error,
            duration: totalDuration,
            details: AppState.sendingDetails
        };

        HistoryManager.saveToHistory(sessionData);
        this.sendCompletionNotification(sessionData, totalDuration);

        if (AppState.sendingDetails.length > 0) {
            document.getElementById('reportButton').style.display = 'block';
        }

        AppState.startTime = null;

        if (AppState.stopSending) {
            UI.showWarning('Envio interrompido pelo usuário');
        } else {
            UI.showSuccess('Envio concluído!');
        }
    }
};

// ========================================
// 15. GERENCIAMENTO DE AGENDAMENTO
// ========================================
const ScheduleManager = {
    initialize() {
        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
        const minDate = localDate.toISOString().split('T')[0];

        const scheduleDateInput = document.getElementById('scheduleDate');
        const scheduleTimeInput = document.getElementById('scheduleTime');

        if (scheduleDateInput) {
            scheduleDateInput.min = minDate;
            scheduleDateInput.value = minDate;
        }

        if (scheduleTimeInput) {
            const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
            const timeString = nextHour.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            scheduleTimeInput.value = timeString;
        }

        this.loadScheduledDispatches();
        AppIntervals.scheduledCheck = setInterval(() => this.checkScheduledDispatches(), APP_CONFIG.scheduledCheckInterval);
    },

    scheduleDispatch(dispatchData) {
        const validation = Validators.schedule();
        if (!validation.valid) {
            UI.showError(validation.error);
            return false;
        }

        const scheduledDispatch = {
            id: Date.now(),
            scheduledDateTime: validation.scheduledDateTime,
            dispatchData: dispatchData,
            status: 'agendado',
            createdAt: new Date()
        };

        AppState.scheduledDispatches.push(scheduledDispatch);
        this.saveScheduledDispatches();
        this.updateScheduledTable();

        UI.showSuccess(`Envio agendado para ${validation.scheduledDateTime.toLocaleString('pt-BR')}`);

        const enableSchedulingCheckbox = document.getElementById('enableScheduling');
        if (enableSchedulingCheckbox) {
            enableSchedulingCheckbox.checked = false;
            this.toggleSchedulingOptions();
        }

        return true;
    },

    checkScheduledDispatches() {
        const now = new Date();

        AppState.scheduledDispatches.forEach(dispatch => {
            if (dispatch.status === 'agendado') {
                const timeUntil = dispatch.scheduledDateTime - now;

                if (timeUntil <= 5 * 60 * 1000 && timeUntil > 4 * 60 * 1000 && !dispatch.warned) {
                    UI.showInfo('Envio será executado em 5 minutos');
                    dispatch.warned = true;
                    this.saveScheduledDispatches();
                }

                if (timeUntil <= 0) {
                    this.executeScheduledDispatch(dispatch);
                }
            }
        });

        this.updateScheduledTable();
    },

    async executeScheduledDispatch(scheduledDispatch) {
        if (AppState.sendingInProgress) {
            UI.showWarning('Outro envio está em andamento. Reagendando...');
            scheduledDispatch.scheduledDateTime = new Date(Date.now() + 5 * 60 * 1000);
            this.saveScheduledDispatches();
            return;
        }

        scheduledDispatch.status = 'executando';
        this.updateScheduledTable();

        const data = scheduledDispatch.dispatchData;

        const instanceNameInput = document.getElementById('instanceName');
        const instanceAPIKEYInput = document.getElementById('instanceAPIKEY');
        const messageInput = document.getElementById('message');
        const iaInput = document.getElementById('ia');
        const minIntervalInput = document.getElementById('minInterval');
        const maxIntervalInput = document.getElementById('maxInterval');

        if (instanceNameInput) instanceNameInput.value = data.instanceName;
        if (instanceAPIKEYInput) instanceAPIKEYInput.value = data.instanceAPIKEY;
        if (messageInput && !data.multipleMessages) messageInput.value = data.message;
        if (iaInput) iaInput.value = data.ia;
        if (minIntervalInput) minIntervalInput.value = data.minInterval;
        if (maxIntervalInput) maxIntervalInput.value = data.maxInterval;

        if (data.contacts) {
            AppState.contacts = data.contacts;
            ContactManager.updateContactsList();
        }

        UI.showInfo('Executando envio agendado...');

        try {
            await SendingManager.start();
            scheduledDispatch.status = 'concluído';
        } catch (error) {
            scheduledDispatch.status = 'erro';
            UI.showError('Erro ao executar envio agendado: ' + error.message);
        }

        this.saveScheduledDispatches();
        this.updateScheduledTable();
    },

    cancelScheduledDispatch(id) {
        UI.confirm(
            'Cancelar Agendamento',
            'Tem certeza que deseja cancelar este agendamento?',
            () => {
                AppState.scheduledDispatches = AppState.scheduledDispatches.filter(d => d.id !== id);
                this.saveScheduledDispatches();
                this.updateScheduledTable();
                UI.showSuccess('Agendamento cancelado');
            }
        );
    },

    updateScheduledTable() {
        const tbody = document.getElementById('scheduledTableBody');
        const section = document.getElementById('scheduledSection');
        const count = document.getElementById('scheduledCount');

        if (!tbody) return;

        const activeSchedules = AppState.scheduledDispatches.filter(d => d.status !== 'concluído');

        if (activeSchedules.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }

        if (section) section.style.display = 'block';
        if (count) count.textContent = activeSchedules.length;

        tbody.innerHTML = activeSchedules.map(dispatch => {
            const now = new Date();
            const timeUntil = dispatch.scheduledDateTime - now;
            const timeRemaining = timeUntil > 0 ? Utils.formatTimeRemaining(timeUntil) : 'Executando...';

            let statusBadge = '';
            switch (dispatch.status) {
                case 'agendado':
                    statusBadge = '<span class="badge bg-primary">Agendado</span>';
                    break;
                case 'executando':
                    statusBadge = '<span class="badge bg-warning">Executando</span>';
                    break;
                case 'erro':
                    statusBadge = '<span class="badge bg-danger">Erro</span>';
                    break;
            }

            return `
                <tr>
                    <td>${dispatch.scheduledDateTime.toLocaleString('pt-BR')}</td>
                    <td><span class="badge bg-info">${dispatch.dispatchData.instanceName}</span></td>
                    <td>${dispatch.dispatchData.contacts ? dispatch.dispatchData.contacts.length : 'N/A'}</td>
                    <td>${timeRemaining}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${dispatch.status === 'agendado' ?
                    `<button class="btn btn-outline-danger btn-sm" onclick="ScheduleManager.cancelScheduledDispatch(${dispatch.id})" title="Cancelar">
                                <i class="bi bi-trash"></i>
                            </button>` :
                    '<span class="text-muted">-</span>'
                }
                    </td>
                </tr>
            `;
        }).join('');
    },

    toggleSchedulingOptions() {
        const checkbox = document.getElementById('enableScheduling');
        const options = document.getElementById('schedulingOptions');

        if (checkbox && options) {
            options.style.display = checkbox.checked ? 'block' : 'none';
        }
    },

    saveScheduledDispatches() {
        const dataToSave = AppState.scheduledDispatches.map(dispatch => ({
            ...dispatch,
            scheduledDateTime: dispatch.scheduledDateTime.toISOString(),
            createdAt: dispatch.createdAt.toISOString()
        }));

        StorageService.setLocalJson('scheduledDispatches', dataToSave);
    },

    loadScheduledDispatches() {
        const saved = StorageService.getLocalJson('scheduledDispatches');
        if (saved) {
            AppState.scheduledDispatches = saved.map(dispatch => ({
                ...dispatch,
                scheduledDateTime: new Date(dispatch.scheduledDateTime),
                createdAt: new Date(dispatch.createdAt)
            }));

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            AppState.scheduledDispatches = AppState.scheduledDispatches.filter(d => d.createdAt > weekAgo);

            this.updateScheduledTable();
        }
    }
};

// ========================================
// GERENCIAMENTO DE LOTE
// ========================================
const BatchManager = {
    initialize() {
        console.log('🔧 Inicializando BatchManager...');
        this.setupEventListeners();
    },

    setupEventListeners() {
        const enableBatchPause = document.getElementById('enableBatchPause');
        if (enableBatchPause) {
            enableBatchPause.addEventListener('change', () => {
                console.log('🔄 Checkbox de pausa em lotes alterado:', enableBatchPause.checked);
                this.toggleBatchOptions();
            });
            console.log('✅ Event listener do BatchManager configurado');
        } else {
            console.error('❌ Elemento enableBatchPause não encontrado');
        }

        const batchSize = document.getElementById('batchSize');
        const batchPauseDuration = document.getElementById('batchPauseDuration');

        if (batchSize) {
            batchSize.addEventListener('input', () => {
                AppState.batchSize = parseInt(batchSize.value || 10);
                this.updateBatchInfo();
                TimeEstimator.update();
            });
        }

        if (batchPauseDuration) {
            batchPauseDuration.addEventListener('input', () => {
                AppState.batchPauseDuration = parseInt(batchPauseDuration.value || 10);
                this.updateBatchInfo();
                TimeEstimator.update();
            });
        }
    },

    toggleBatchOptions() {
        const checkbox = document.getElementById('enableBatchPause');
        const options = document.getElementById('batchPauseOptions');

        console.log('🔄 Alternando opções de lote...', {
            checkbox: !!checkbox,
            options: !!options,
            checked: checkbox?.checked
        });

        if (checkbox && options) {
            AppState.batchPauseEnabled = checkbox.checked;
            options.style.display = checkbox.checked ? 'block' : 'none';

            if (checkbox.checked) {
                console.log('✅ Pausa em lotes ativada');
                this.updateBatchInfo();
                UI.showSuccess('Pausa em lotes ativada!');
            } else {
                console.log('❌ Pausa em lotes desativada');
                UI.showInfo('Pausa em lotes desativada');
            }

            TimeEstimator.update();
        } else {
            console.error('❌ Elementos não encontrados:', {
                checkbox: !!checkbox,
                options: !!options
            });
        }
    },

    updateBatchInfo() {
        const batchSize = parseInt(document.getElementById('batchSize')?.value || 10);
        const batchPause = parseInt(document.getElementById('batchPauseDuration')?.value || 10);
        const totalContacts = AppState.contacts.length;

        AppState.batchSize = batchSize;
        AppState.batchPauseDuration = batchPause;

        if (totalContacts > 0) {
            AppState.totalBatches = Math.ceil(totalContacts / batchSize);
            console.log(`📦 Configuração atualizada: ${AppState.totalBatches} lotes de ${batchSize} mensagens, pausa de ${batchPause}min`);
        }
    },

    shouldPauseBatch(currentIndex) {
        if (!AppState.batchPauseEnabled) return false;

        const batchSize = AppState.batchSize;
        const isEndOfBatch = (currentIndex + 1) % batchSize === 0;
        const notLastMessage = currentIndex < AppState.contacts.length - 1;

        console.log(`🔍 Verificando pausa: índice ${currentIndex}, lote ${batchSize}, fim do lote: ${isEndOfBatch}, não é última: ${notLastMessage}`);

        return isEndOfBatch && notLastMessage;
    },

    async startBatchPause() {
        const pauseDuration = AppState.batchPauseDuration;
        const pauseMs = pauseDuration * 60 * 1000;

        AppState.batchPauseActive = true;
        AppState.currentBatchNumber++;

        console.log(`⏸️ Iniciando pausa entre lotes: ${pauseDuration} minutos`);

        this.showBatchStatus(pauseMs);
        UI.showWarning(`Pausa entre lotes ativa: ${pauseDuration} minutos`);

        return new Promise((resolve) => {
            const startedAt = Date.now();

            AppState.batchTimer = setInterval(() => {
                const elapsed = Date.now() - startedAt;
                if (AppState.stopSending || elapsed >= pauseMs) {
                    clearInterval(AppState.batchTimer);
                    AppState.batchTimer = null;
                    AppState.batchPauseActive = false;
                    this.hideBatchStatus();

                    if (!AppState.stopSending) {
                        UI.showInfo('Pausa entre lotes finalizada - continuando envio...');
                        console.log('â–¶ï¸ Pausa entre lotes finalizada');
                    }

                    resolve();
                }
            }, 250);
        });
    },

    _legacyStartBatchPauseDisabled() {
        return Promise.resolve();
        return new Promise((resolve) => {
            AppState.batchTimer = setTimeout(() => {
                AppState.batchPauseActive = false;
                this.hideBatchStatus();
                UI.showInfo('Pausa entre lotes finalizada - continuando envio...');
                console.log('▶️ Pausa entre lotes finalizada');
                resolve();
            }, pauseMs);
        });
    },

    showBatchStatus(pauseMs) {
        const statusDiv = document.getElementById('batchStatus');
        const currentBatch = document.getElementById('currentBatch');
        const countdown = document.getElementById('batchCountdown');
        const progressBar = document.getElementById('batchProgressBar');
        const timeRemaining = document.getElementById('batchTimeRemaining');

        if (statusDiv) statusDiv.style.display = 'block';
        if (currentBatch) currentBatch.textContent = AppState.currentBatchNumber - 1;

        let remainingTime = pauseMs;
        const updateInterval = setInterval(() => {
            if (!AppState.batchPauseActive) {
                clearInterval(updateInterval);
                return;
            }

            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (countdown) countdown.textContent = timeString;
            if (timeRemaining) timeRemaining.textContent = timeString;

            const progress = ((pauseMs - remainingTime) / pauseMs) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;

            remainingTime -= 1000;

            if (remainingTime < 0) {
                clearInterval(updateInterval);
            }
        }, 1000);
    },

    hideBatchStatus() {
        const statusDiv = document.getElementById('batchStatus');
        if (statusDiv) statusDiv.style.display = 'none';

        if (AppState.batchTimer) {
            clearTimeout(AppState.batchTimer);
            AppState.batchTimer = null;
        }
    },

    reset() {
        AppState.currentBatchCount = 0;
        AppState.currentBatchNumber = 1;
        AppState.batchPauseActive = false;
        this.hideBatchStatus();
        console.log('🔄 BatchManager resetado');
    }
};

// ========================================
// GERENCIAMENTO DE HORARIO COMERCIAL
// ========================================
const BusinessHoursManager = {
    initialize() {
        console.log('🕐 Inicializando BusinessHoursManager...');
        this.setupEventListeners();
        this.loadSettings();
    },

    setupEventListeners() {
        const enableCheckbox = document.getElementById('enableBusinessHours');
        const options = document.getElementById('businessHoursOptions');

        if (enableCheckbox) {
            enableCheckbox.addEventListener('change', (e) => {
                AppState.businessHoursEnabled = e.target.checked;
                if (options) {
                    options.style.display = e.target.checked ? 'block' : 'none';
                }
                this.saveSettings();
                TimeEstimator.update();
            });
        }

        const startInput = document.getElementById('businessHoursStart');
        const endInput = document.getElementById('businessHoursEnd');

        if (startInput) {
            startInput.addEventListener('change', () => {
                AppState.businessHoursStart = startInput.value;
                this.saveSettings();
                TimeEstimator.update();
            });
        }

        if (endInput) {
            endInput.addEventListener('change', () => {
                AppState.businessHoursEnd = endInput.value;
                this.saveSettings();
                TimeEstimator.update();
            });
        }
    },

    isWithinBusinessHours() {
        if (!AppState.businessHoursEnabled) {
            return true;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return currentTime >= startTime && currentTime < endTime;
    },

    getTimeUntilBusinessHours() {
        if (!AppState.businessHoursEnabled) {
            return 0;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (currentTime < startTime) {
            const minutesUntilStart = startTime - currentTime;
            return minutesUntilStart * 60 * 1000;
        }

        if (currentTime >= endTime) {
            const minutesInDay = 24 * 60;
            const minutesUntilTomorrow = minutesInDay - currentTime + startTime;
            return minutesUntilTomorrow * 60 * 1000;
        }

        return 0;
    },

    async waitForBusinessHours() {
        if (!AppState.businessHoursEnabled || this.isWithinBusinessHours()) {
            return;
        }

        AppState.isWaitingForBusinessHours = true;
        const waitTime = this.getTimeUntilBusinessHours();

        console.log(`🕐 Aguardando horário comercial: ${Utils.formatTime(waitTime)}`);

        this.showBusinessHoursWait(waitTime);

        const startWait = Date.now();
        while (!this.isWithinBusinessHours() && !AppState.stopSending) {
            const elapsed = Date.now() - startWait;
            const remaining = Math.max(0, waitTime - elapsed);

            this.updateBusinessHoursDisplay(remaining);

            await Utils.sleep(1000);

            await SendingManager.waitWhilePaused();
        }

        AppState.isWaitingForBusinessHours = false;

        if (!AppState.stopSending) {
            UI.showSuccess('✅ Horário comercial iniciado - retomando envios');
        }
    },

    showBusinessHoursWait(waitTime) {
        const timerElement = document.getElementById('nextSendTimer');
        if (!timerElement) return;

        const nextStart = new Date(Date.now() + waitTime);
        const formattedTime = nextStart.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        TimerManager.currentState = 'business-hours-wait';
        TimerManager.updateDisplay('Aguardando...', 'warning', 'warning');
        TimerManager.updateLabel('Fora do horário comercial:');
        TimerManager.updateDetails(`Aguardando até ${formattedTime} para continuar`);
        TimerManager.updateProgress(0, 'warning');
    },

    updateBusinessHoursDisplay(remaining) {
        const countdownElement = document.getElementById('timerCountdown');
        if (!countdownElement) return;

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        let display;
        if (hours > 0) {
            display = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            display = `${minutes}m ${seconds}s`;
        } else {
            display = `${seconds}s`;
        }

        countdownElement.textContent = display;
        countdownElement.className = 'badge bg-warning fs-6';

        const nextStart = new Date(Date.now() + remaining);
        const formattedTime = nextStart.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        TimerManager.updateDetails(`Aguardando até ${formattedTime} para continuar`);
    },

    saveSettings() {
        const settings = {
            enabled: AppState.businessHoursEnabled,
            start: AppState.businessHoursStart,
            end: AppState.businessHoursEnd
        };
        StorageService.setLocalJson('business_hours_settings', settings);
    },

    loadSettings() {
        const saved = StorageService.getLocalJson('business_hours_settings');
        if (saved) {
            AppState.businessHoursEnabled = saved.enabled;
            AppState.businessHoursStart = saved.start;
            AppState.businessHoursEnd = saved.end;

            const enableCheckbox = document.getElementById('enableBusinessHours');
            const startInput = document.getElementById('businessHoursStart');
            const endInput = document.getElementById('businessHoursEnd');
            const options = document.getElementById('businessHoursOptions');

            if (enableCheckbox) enableCheckbox.checked = saved.enabled;
            if (startInput) startInput.value = saved.start;
            if (endInput) endInput.value = saved.end;
            if (options) options.style.display = saved.enabled ? 'block' : 'none';
        }
    },

    validateSettings() {
        const [startHour, startMin] = AppState.businessHoursStart.split(':').map(Number);
        const [endHour, endMin] = AppState.businessHoursEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (endTime <= startTime) {
            return {
                valid: false,
                error: 'Horário de término deve ser maior que horário de início'
            };
        }

        return { valid: true };
    },

    reset() {
        AppState.isWaitingForBusinessHours = false;
    }
};

window.BusinessHoursManager = BusinessHoursManager;

// ========================================
// 19B. GERENCIAMENTO DE MULTIPLAS MENSAGENS
// ========================================
const MultipleMessagesManager = {
    initialize() {
        console.log('🔧 Inicializando MultipleMessagesManager...');

        //Flag para evitar verificações múltiplas
        _isUpdatingCount: false,

            // Sempre ativar modo múltiplas mensagens
            AppState.multipleMessagesEnabled = true;

        AppState.messagesConfig.msg1.enabled = true;

        const multipleMode = document.getElementById('multipleMessagesMode');
        const previewContainer = document.getElementById('previewContainer');
        const previewContent = document.getElementById('previewContent');

        console.log('🔍 Elementos encontrados:', {
            multipleMode: !!multipleMode,
            previewContainer: !!previewContainer,
            previewContent: !!previewContent
        });

        this.setupTabListeners();
        this.setupMessageListeners();
        this.toggleMessageModes();
        this.updateActiveMessagesInfo();
    },

    toggleMessageModes() {
        const multipleMode = document.getElementById('multipleMessagesMode');
        const previewContainer = document.getElementById('previewContainer');

        if (multipleMode) {
            multipleMode.style.display = 'block';
            console.log('✅ Modo múltiplas mensagens ativado');
        }

        if (previewContainer) {
            previewContainer.style.display = 'block';
            console.log('✅ Preview container ativado');
        }

        setTimeout(() => {
            console.log('🔄 Atualizando preview inicial...');
            this.updateMainPreview('msg1');
        }, 100);

        this.updateActiveMessagesInfo();
    },

    setupTabListeners() {
        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            const tab = document.getElementById(`${msgId}-tab`);
            if (tab) {
                tab.addEventListener('click', () => {
                    setTimeout(() => this.updateMainPreview(msgId), 100);
                });
            }
        });
    },

    setupMediaEvents(msgId) {
        const fileRadio = document.getElementById(`${msgId}-media-file`);
        const urlRadio = document.getElementById(`${msgId}-media-url`);
        const fileContainer = document.getElementById(`${msgId}-file-container`);
        const urlContainer = document.getElementById(`${msgId}-url-container`);

        const fileInput = document.getElementById(`${msgId}-media`);

        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const testUrlBtn = document.getElementById(`${msgId}-test-url`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (fileRadio && urlRadio) {
            fileRadio.addEventListener('change', () => {
                if (fileRadio.checked) {
                    fileContainer.style.display = 'block';
                    urlContainer.style.display = 'none';
                    this.clearMediaUrl(msgId);
                }
            });

            urlRadio.addEventListener('change', () => {
                if (urlRadio.checked) {
                    fileContainer.style.display = 'none';
                    urlContainer.style.display = 'block';
                    this.clearMediaFile(msgId);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleMediaChange(msgId, e.target.files[0]);
            });
        }

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                this.validateMediaUrl(msgId, urlInput.value);
            });

            urlInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.validateMediaUrl(msgId, e.target.value);
                }, 100);
            });
        }

        if (testUrlBtn) {
            testUrlBtn.addEventListener('click', () => {
                this.testMediaUrl(msgId);
            });
        }
    },

    validateMediaUrl(msgId, url) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (!url || !url.trim()) {
            urlPreview.style.display = 'none';
            AppState.messagesConfig[msgId].media = null;
            this.updateActiveMessagesInfo();
            return;
        }

        try {
            new URL(url);
        } catch (error) {
            this.showUrlValidation(msgId, false, 'URL inválida');
            return;
        }

        const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf'];
        const urlLower = url.toLowerCase();
        const isSupported = supportedExtensions.some(ext => urlLower.includes(ext));

        if (!isSupported) {
            this.showUrlValidation(msgId, false, 'Tipo de arquivo não detectado');
        } else {
            this.showUrlValidation(msgId, true, 'URL válida');
            this.previewMediaUrl(msgId, url);
        }
    },

    showUrlValidation(msgId, isValid, message) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);

        urlInput.classList.remove('is-valid', 'is-invalid');
        urlInput.classList.add(isValid ? 'is-valid' : 'is-invalid');

        let feedback = urlInput.parentNode.querySelector('.url-validation-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'url-validation-feedback mt-1';
            urlInput.parentNode.appendChild(feedback);
        }

        feedback.className = `url-validation-feedback mt-1 ${isValid ? 'url-validation-success' : 'url-validation-error'}`;
        feedback.textContent = message;
    },

    previewMediaUrl(msgId, url) {
        const urlPreview = document.getElementById(`${msgId}-url-preview`);
        const urlPreviewContent = document.getElementById(`${msgId}-url-preview-content`);

        if (!urlPreview || !urlPreviewContent) return;

        const urlLower = url.toLowerCase();
        let previewHTML = '';

        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif')) {
            previewHTML = `
            <img src="${url}" class="url-preview-image me-2" alt="Preview" 
                 onload="this.style.display='block'" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div style="display: none;">
                <i class="bi bi-image url-preview-icon text-primary"></i>
                <span>Imagem: ${this.getFileName(url)}</span>
            </div>
        `;
        } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
            previewHTML = `
            <i class="bi bi-play-circle url-preview-icon text-primary"></i>
            <div>
                <strong>Vídeo:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else if (urlLower.includes('.mp3') || urlLower.includes('.wav') || urlLower.includes('.ogg')) {
            previewHTML = `
            <i class="bi bi-music-note url-preview-icon text-success"></i>
            <div>
                <strong>Áudio:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else if (urlLower.includes('.pdf')) {
            previewHTML = `
            <i class="bi bi-file-pdf url-preview-icon text-danger"></i>
            <div>
                <strong>PDF:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        } else {
            previewHTML = `
            <i class="bi bi-link-45deg url-preview-icon text-secondary"></i>
            <div>
                <strong>Arquivo:</strong><br>
                <small class="text-muted">${this.getFileName(url)}</small>
            </div>
        `;
        }

        urlPreviewContent.innerHTML = previewHTML;
        urlPreview.style.display = 'block';

        AppState.messagesConfig[msgId].media = {
            type: 'url',
            url: url,
            filename: this.getFileName(url),
            mimetype: this.getMimeTypeFromUrl(url)
        };

        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    async testMediaUrl(msgId) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const url = urlInput.value.trim();

        if (!url) {
            UI.showWarning('Digite uma URL primeiro');
            return;
        }

        UI.showLoading('Testando URL...');

        try {
            const response = await HttpService.head(url);
            UI.hideLoading();

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');

                let sizeText = '';
                if (contentLength) {
                    const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(1);
                    sizeText = ` (${sizeMB}MB)`;
                }

                UI.showSuccess(`✅ URL acessível! Tipo: ${contentType || 'Desconhecido'}${sizeText}`);
                this.previewMediaUrl(msgId, url);
            } else {
                UI.showError(`❌ URL não acessível (${response.status})`);
            }
        } catch (error) {
            UI.hideLoading();
            UI.showError('❌ Erro ao acessar URL: ' + error.message);
        }
    },

    clearMediaUrl(msgId) {
        const urlInput = document.getElementById(`${msgId}-media-url-input`);
        const urlPreview = document.getElementById(`${msgId}-url-preview`);

        if (urlInput) urlInput.value = '';
        if (urlPreview) urlPreview.style.display = 'none';

        AppState.messagesConfig[msgId].media = null;
        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    clearMediaFile(msgId) {
        const fileInput = document.getElementById(`${msgId}-media`);
        const filePreview = document.getElementById(`${msgId}-media-preview`);

        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';

        AppState.messagesConfig[msgId].media = null;
        this.updateActiveMessagesInfo();
        this.updateMainPreview(msgId);
    },

    getFileName(url) {
        try {
            return url.split('/').pop().split('?')[0] || 'arquivo';
        } catch (error) {
            return 'arquivo';
        }
    },

    getMimeTypeFromUrl(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
        if (urlLower.includes('.png')) return 'image/png';
        if (urlLower.includes('.gif')) return 'image/gif';
        if (urlLower.includes('.mp4')) return 'video/mp4';
        if (urlLower.includes('.mp3')) return 'audio/mpeg';
        if (urlLower.includes('.wav')) return 'audio/wav';
        if (urlLower.includes('.pdf')) return 'application/pdf';
        return 'application/octet-stream';
    },

    setupMessageListeners() {
        const debouncedUpdate = this.debounce(() => {
            this.updateActiveMessagesInfo();
        }, 300);

        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', (e) => {
                    AppState.messagesConfig[msgId].enabled = e.target.checked;
                    if (typeof Validators !== 'undefined') Validators._lastValidation = null;
                    debouncedUpdate();
                    this.updateMessageStatus(msgId);
                    this.updateMainPreview(msgId);
                });
            }

            const textInput = document.getElementById(`${msgId}-text`);
            if (textInput) {
                textInput.addEventListener('input', (e) => {
                    AppState.messagesConfig[msgId].text = e.target.value;
                    if (typeof Validators !== 'undefined') Validators._lastValidation = null;
                    debouncedUpdate();
                    this.updateMainPreview(msgId);
                    this.updateMessageStatus(msgId);
                    this.updateCharCounter(msgId);
                });
            }

            this.setupMediaEvents(msgId);

            this.initializeRichTextEditor(msgId);
        });
    },

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

    async handleMediaChange(msgId, file) {
        if (file) {
            console.log('📎 Processando arquivo para:', msgId, file.name, file.type);

            if (file.type.startsWith('video/')) {
                const maxVideoSize = 10 * 1024 * 1024;
                if (file.size > maxVideoSize) {
                    UI.showError(`Vídeo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo para vídeos: 10MB`);
                    const mediaInput = document.getElementById(`${msgId}-media`);
                    if (mediaInput) mediaInput.value = '';
                    return;
                }

                const videoDuration = await this.getVideoDuration(file);
                if (videoDuration > 300) {
                    UI.showError(`Vídeo muito longo: ${Math.round(videoDuration)}s. Máximo: 5 minutos`);
                    const mediaInput = document.getElementById(`${msgId}-media`);
                    if (mediaInput) mediaInput.value = '';
                    return;
                }
            }

            const maxSize = 16 * 1024 * 1024;
            if (file.size > maxSize && !file.type.startsWith('video/')) {
                UI.showError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: 16MB`);
                const mediaInput = document.getElementById(`${msgId}-media`);
                if (mediaInput) mediaInput.value = '';
                return;
            }

            try {
                const mediaData = await Utils.fileToBase64(file);

                AppState.messagesConfig[msgId].media = {
                    filename: file.name,
                    data: mediaData,
                    mimetype: file.type,
                    size: file.size
                };

                this.showMediaPreview(msgId, file);
                setTimeout(() => this.updateMainPreview(msgId), 200);

            } catch (error) {
                console.error('❌ Erro ao processar arquivo:', error);
                UI.showError('Erro ao processar arquivo: ' + error.message);
            }
        } else {
            console.log('🗑️ Removendo mídia de:', msgId);
            AppState.messagesConfig[msgId].media = null;
            this.hideMediaPreview(msgId);
            this.updateMainPreview(msgId);
        }

        this.updateActiveMessagesInfo();
        this.updateMessageStatus(msgId);
    },

    getVideoDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };

            video.onerror = () => {
                resolve(0);
            };

            video.src = URL.createObjectURL(file);
        });
    },

    showMediaPreview(msgId, file) {
        const preview = document.getElementById(`${msgId}-media-preview`);
        if (!preview) return;

        console.log('📎 Criando preview lateral para:', file.name, file.type);

        let previewHTML = '';

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${e.target.result}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;" alt="Preview">
                    <div class="ms-2">
                        <div class="fw-bold">${file.name}</div>
                        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
                preview.style.display = 'block';

                setTimeout(() => this.updateMainPreview(msgId), 100);
            };
            reader.readAsDataURL(file);
            return;

        } else if (file.type.startsWith('video/')) {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-play-circle fs-2 text-primary"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else if (file.type === 'application/pdf') {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-file-pdf fs-2 text-danger"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else if (file.type.startsWith('audio/')) {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-music-note fs-2 text-success"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        } else {
            previewHTML = `
            <div class="d-flex align-items-center">
                <div class="media-preview-icon"><i class="bi bi-file-earmark fs-2 text-secondary"></i></div>
                <div class="ms-2">
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm ms-auto" onclick="MultipleMessagesManager.clearMedia('${msgId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        }

        if (previewHTML) {
            preview.innerHTML = previewHTML;
            preview.style.display = 'block';
        }
    },

    hideMediaPreview(msgId) {
        const preview = document.getElementById(`${msgId}-media-preview`);
        if (preview) {
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    },

    clearMedia(msgId) {
        AppState.messagesConfig[msgId].media = null;

        const mediaInput = document.getElementById(`${msgId}-media`);
        if (mediaInput) {
            mediaInput.value = '';
        }

        this.hideMediaPreview(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        UI.showInfo('Mídia removida');
    },

    updateMainPreview(currentMsgId) {
        const config = AppState.messagesConfig[currentMsgId];
        const previewBody = document.getElementById('previewContent');
        const currentPreviewMessage = document.getElementById('currentPreviewMessage');
        const previewAvatar = document.getElementById('previewAvatar');
        const previewContactName = document.getElementById('previewContactName');

        if (!previewBody || !currentPreviewMessage) return;

        let exampleName = 'João Silva';
        if (AppState.contacts.length > 0) {
            exampleName = AppState.contacts[0].name;
        }

        if (previewAvatar) previewAvatar.textContent = exampleName.charAt(0).toUpperCase();
        if (previewContactName) previewContactName.textContent = exampleName;

        const msgNumber = currentMsgId.replace('msg', '');
        const isEnabled = config.enabled;
        const hasContent = config.text.trim() || config.media;

        currentPreviewMessage.textContent = `Mensagem ${msgNumber}`;
        currentPreviewMessage.className = `badge ${isEnabled && hasContent ? 'bg-success' : isEnabled ? 'bg-warning' : 'bg-secondary'}`;

        if (!isEnabled) {
            previewBody.innerHTML = `
                <div class="preview-placeholder">
                    <i class="bi bi-x-circle fs-3 mb-2 d-block"></i>
                    Mensagem ${msgNumber} está desativada
                </div>
            `;
            return;
        }

        if (!hasContent) {
            previewBody.innerHTML = `
                <div class="preview-placeholder">
                    <i class="bi bi-chat-text fs-3 mb-2 d-block"></i>
                    Configure a mensagem ${msgNumber} para visualizar
                </div>
            `;
            return;
        }

        let previewHTML = '<div class="whatsapp-message text-white">';

        if (config.media) {
            if (config.media.type === 'url') {
                const url = config.media.url;
                const urlLower = url.toLowerCase();

                if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif')) {
                    previewHTML += `<img src="${url}" class="whatsapp-media" alt="Preview da imagem">`;
                } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
                    previewHTML += `<video controls class="whatsapp-media"><source src="${url}" type="${config.media.mimetype}"></video>`;
                } else if (urlLower.includes('.mp3') || urlLower.includes('.wav') || urlLower.includes('.ogg')) {
                    previewHTML += `<audio controls class="whatsapp-media" style="width: 100%;"><source src="${url}" type="${config.media.mimetype}"></audio>`;
                } else if (urlLower.includes('.pdf')) {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-file-pdf fs-1 text-danger"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                } else {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-link-45deg fs-1 text-primary"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                }
            } else {
                if (config.media.mimetype.startsWith('image/')) {
                    const imageData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<img src="${imageData}" class="whatsapp-media" alt="Preview da imagem">`;
                } else if (config.media.mimetype.startsWith('video/')) {
                    const videoData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<video controls class="whatsapp-media"><source src="${videoData}" type="${config.media.mimetype}"></video>`;
                } else if (config.media.mimetype.startsWith('audio/')) {
                    const audioData = `data:${config.media.mimetype};base64,${config.media.data}`;
                    previewHTML += `<audio controls class="whatsapp-media" style="width: 100%;"><source src="${audioData}" type="${config.media.mimetype}"></audio>`;
                } else if (config.media.mimetype === 'application/pdf') {
                    previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <div class="text-center">
                        <i class="bi bi-file-pdf fs-1 text-danger"></i>
                        <div class="mt-2 small text-muted">${config.media.filename}</div>
                    </div>
                </div>`;
                }
            }
        }

        if (config.text.trim()) {
            let personalizedMessage = config.text
                .replace(/{nome}/g, exampleName)
                .replace(/{saudacao}/g, Utils.getSaudacao());

            personalizedMessage = RandomTagsSystem.processTagsForPreview(personalizedMessage);

            personalizedMessage = personalizedMessage
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            previewHTML += `<div>${personalizedMessage}</div>`;
        }

        previewHTML += `
            <div class="whatsapp-time text-white">
                ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <i class="bi bi-check2-all"></i>
            </div>
        </div>`;

        previewBody.innerHTML = previewHTML;
    },

    updateMessageStatus(msgId) {
        const config = AppState.messagesConfig[msgId];
        const statusBadge = document.getElementById(`${msgId}-status`);

        if (!statusBadge) return;

        const hasContent = config.text.trim() || config.media;
        const isComplete = config.enabled && hasContent;

        if (config.enabled && !hasContent) {
            statusBadge.style.display = 'inline';
            statusBadge.className = 'badge bg-warning ms-2';
            statusBadge.textContent = '!';
            statusBadge.title = 'Mensagem ativa mas sem conteúdo';
        } else {
            statusBadge.style.display = 'none';
        }
    },

    syncMessagesConfigFromUI() {
        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            if (!AppState.messagesConfig[msgId]) {
                AppState.messagesConfig[msgId] = { enabled: false, text: '', media: null };
            }

            const enabledCheckbox = document.getElementById(`${msgId}-enabled`);
            const textInput = document.getElementById(`${msgId}-text`);

            if (enabledCheckbox) {
                AppState.messagesConfig[msgId].enabled = enabledCheckbox.checked;
            }

            if (textInput) {
                AppState.messagesConfig[msgId].text = textInput.value || '';
            }
        });
    },

    updateActiveMessagesInfo() {
        this.syncMessagesConfigFromUI();

        if (this._isUpdatingCount) {
            console.log('🔄 Verificação já em andamento, pulando...');
            return;
        }

        this._isUpdatingCount = true;

        console.log('🔢 Atualizando contador de mensagens ativas...');

        const messages = AppState.messagesConfig;
        console.log('📊 Estado atual das mensagens:', {
            msg1: { enabled: messages.msg1.enabled, hasText: !!messages.msg1.text.trim(), hasMedia: !!messages.msg1.media },
            msg2: { enabled: messages.msg2.enabled, hasText: !!messages.msg2.text.trim(), hasMedia: !!messages.msg2.media },
            msg3: { enabled: messages.msg3.enabled, hasText: !!messages.msg3.text.trim(), hasMedia: !!messages.msg3.media }
        });

        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => {
                const isEnabled = config.enabled;
                const hasContent = config.text.trim() || config.media;
                return isEnabled && hasContent;
            });

        const activeCount = activeMessages.length;
        console.log('📈 Total de mensagens ativas com conteúdo:', activeCount);

        const infoElement = document.getElementById('activeMessagesCount');
        if (infoElement) {
            const text = `${activeCount} mensagem${activeCount !== 1 ? 's' : ''} ativa${activeCount !== 1 ? 's' : ''}`;
            infoElement.textContent = text;
            console.log('✅ Contador atualizado:', text);
        }

        const badgeElement = document.getElementById('activeMessagesInfo');
        if (badgeElement) {
            if (activeCount === 0) {
                badgeElement.className = 'alert alert-warning mt-3';
            } else {
                badgeElement.className = 'alert alert-success mt-3';
            }
        }

        ['msg1', 'msg2', 'msg3'].forEach(msgId => {
            this.updateMessageStatus(msgId);
        });

        setTimeout(() => {
            this._isUpdatingCount = false;
        }, 100);

        console.log('🎯 Contador de mensagens ativas atualizado:', activeCount);
    },

    getRandomActiveMessage() {
        this.syncMessagesConfigFromUI();

        const activeMessages = Object.entries(AppState.messagesConfig)
            .filter(([id, config]) => config.enabled && (config.text.trim() || config.media));

        console.log('🔍 Mensagens ativas disponíveis:', activeMessages.map(([id]) => id));

        if (activeMessages.length === 0) {
            throw new Error('Nenhuma mensagem ativa configurada');
        }

        if (activeMessages.length === 1) {
            console.log(`📝 Apenas 1 mensagem ativa: ${activeMessages[0][0]}`);
            const [messageId, messageConfig] = activeMessages[0];
            return {
                id: messageId,
                text: messageConfig.text || '',
                media: messageConfig.media
            };
        }

        if (!window.messageUsageHistory) {
            window.messageUsageHistory = {};
        }

        const usageCounts = {};
        activeMessages.forEach(([id]) => {
            usageCounts[id] = window.messageUsageHistory[id] || 0;
        });

        console.log('📊 Histórico de uso atual:', usageCounts);

        const minUsage = Math.min(...Object.values(usageCounts));
        const leastUsedMessages = activeMessages.filter(([id]) => usageCounts[id] === minUsage);

        console.log(`📈 Mensagens menos usadas (${minUsage} usos):`, leastUsedMessages.map(([id]) => id));

        const randomIndex = Math.floor(Math.random() * leastUsedMessages.length);
        const [selectedId, selectedConfig] = leastUsedMessages[randomIndex];

        window.messageUsageHistory[selectedId] = (window.messageUsageHistory[selectedId] || 0) + 1;

        activeMessages.forEach(([id]) => {
            if (!(id in window.messageUsageHistory)) {
                window.messageUsageHistory[id] = 0;
            }
        });

        console.log(`🎯 Mensagem "${selectedId}" selecionada (${randomIndex + 1}/${leastUsedMessages.length} candidatas)`);
        console.log('📊 Novo histórico completo:', window.messageUsageHistory);

        return {
            id: selectedId,
            text: selectedConfig.text || '',
            media: selectedConfig.media
        };
    },

    validateMessages() {
        this.syncMessagesConfigFromUI();

        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => config.enabled);

        if (activeMessages.length === 0) {
            return { valid: false, error: 'Ative pelo menos uma mensagem' };
        }

        const validMessages = activeMessages.filter(config =>
            config.text.trim() || config.media
        );

        if (validMessages.length === 0) {
            return { valid: false, error: 'Configure conteúdo para pelo menos uma mensagem ativa' };
        }

        return { valid: true };
    },

    initializeRichTextEditor(msgId) {
        const boldBtn = document.getElementById(`${msgId}BoldBtn`);
        const italicBtn = document.getElementById(`${msgId}ItalicBtn`);
        const clearBtn = document.getElementById(`${msgId}ClearFormatBtn`);

        const nameBtn = document.getElementById(`${msgId}NameBtn`);
        const greetingBtn = document.getElementById(`${msgId}GreetingBtn`);

        const helloBtn = document.getElementById(`${msgId}HelloBtn`);
        const thanksBtn = document.getElementById(`${msgId}ThanksBtn`);
        const byeBtn = document.getElementById(`${msgId}ByeBtn`);
        const emoticonBtn = document.getElementById(`${msgId}EmoticonBtn`);

        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        if (boldBtn) boldBtn.addEventListener('click', () => this.toggleFormat(msgId, 'bold'));
        if (italicBtn) italicBtn.addEventListener('click', () => this.toggleFormat(msgId, 'italic'));
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearFormatting(msgId));

        if (nameBtn) nameBtn.addEventListener('click', () => this.insertTag(msgId, 'nome'));
        if (greetingBtn) greetingBtn.addEventListener('click', () => this.insertTag(msgId, 'saudacao'));

        if (helloBtn) helloBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'oi'));
        if (thanksBtn) thanksBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'obrigado'));
        if (byeBtn) byeBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'tchau'));
        if (emoticonBtn) emoticonBtn.addEventListener('click', () => this.insertRandomTag(msgId, 'emoticon'));

        textarea.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(msgId, e));
        textarea.addEventListener('select', () => this.updateToolbarState(msgId));
        textarea.addEventListener('click', () => this.updateToolbarState(msgId));

        this.updateCharCounter(msgId);
    },

    insertRandomTag(msgId, tagType) {
        const tag = `{${tagType}}`;
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        const newValue = value.slice(0, start) + tag + value.slice(end);
        textarea.value = newValue;
        AppState.messagesConfig[msgId].text = newValue;

        const newPosition = start + tag.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        this.animateTagButton(msgId, tagType);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        const previewVariation = RandomTagsSystem.getRandomVariation(tagType);
        UI.showInfo(`Tag {${tagType}} inserida → Preview: "${previewVariation}"`);

        console.log(`✅ Tag {${tagType}} inserida em ${msgId} na posição ${start}`);
    },

    insertTag(msgId, tagType) {
        const tags = {
            'nome': '{nome}',
            'saudacao': '{saudacao}'
        };

        const tag = tags[tagType];
        if (!tag) return;

        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        const newValue = value.slice(0, start) + tag + value.slice(end);
        textarea.value = newValue;
        AppState.messagesConfig[msgId].text = newValue;

        const newPosition = start + tag.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        this.animateTagButton(msgId, tagType);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.updateMessageStatus(msgId);

        console.log(`✅ Tag {${tagType}} inserida em ${msgId} na posição ${start}`);
    },

    animateTagButton(msgId, tagType) {
        let button;
        switch (tagType) {
            case 'nome':
                button = document.getElementById(`${msgId}NameBtn`);
                break;
            case 'saudacao':
                button = document.getElementById(`${msgId}GreetingBtn`);
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    },

    toggleFormat(msgId, type) {
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (selectedText.length === 0) {
            this.insertFormatMarkers(msgId, type);
        } else {
            this.wrapSelectedText(msgId, type, selectedText, start, end);
        }

        this.animateButton(msgId, type);
        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
    },

    insertFormatMarkers(msgId, type) {
        const markers = { 'bold': '*', 'italic': '_' };
        const marker = markers[type];
        const textarea = document.getElementById(`${msgId}-text`);

        const start = textarea.selectionStart;
        const value = textarea.value;

        const newValue = value.slice(0, start) + marker + marker + value.slice(start);
        textarea.value = newValue;

        const newPosition = start + marker.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();

        AppState.messagesConfig[msgId].text = newValue;
    },

    wrapSelectedText(msgId, type, selectedText, start, end) {
        const markers = { 'bold': '*', 'italic': '_' };
        const marker = markers[type];
        const textarea = document.getElementById(`${msgId}-text`);

        const beforeText = textarea.value.substring(Math.max(0, start - marker.length), start);
        const afterText = textarea.value.substring(end, Math.min(textarea.value.length, end + marker.length));

        let newValue;
        if (beforeText === marker && afterText === marker) {
            newValue = textarea.value.slice(0, start - marker.length) +
                selectedText +
                textarea.value.slice(end + marker.length);
            textarea.setSelectionRange(start - marker.length, end - marker.length);
        } else {
            newValue = textarea.value.slice(0, start) +
                marker + selectedText + marker +
                textarea.value.slice(end);
            textarea.setSelectionRange(start, end + (marker.length * 2));
        }

        textarea.value = newValue;
        textarea.focus();

        AppState.messagesConfig[msgId].text = newValue;
    },

    clearFormatting(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        if (!textarea) return;

        let text = textarea.value;
        text = text.replace(/\*([^*]+)\*/g, '$1');
        text = text.replace(/_([^_]+)_/g, '$1');

        textarea.value = text;
        AppState.messagesConfig[msgId].text = text;

        this.updateCharCounter(msgId);
        this.updateMainPreview(msgId);
        this.animateButton(msgId, 'clear');
    },

    updateCharCounter(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        const counter = document.getElementById(`${msgId}CharCounter`);

        if (!textarea || !counter) return;

        const currentLength = textarea.value.length;
        const maxLength = textarea.maxLength || 4096;

        counter.textContent = `${currentLength}/${maxLength}`;

        if (currentLength > maxLength * 0.9) {
            counter.style.color = '#dc3545';
        } else if (currentLength > maxLength * 0.8) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#6c757d';
        }
    },

    updateToolbarState(msgId) {
        const textarea = document.getElementById(`${msgId}-text`);
        const boldBtn = document.getElementById(`${msgId}BoldBtn`);
        const italicBtn = document.getElementById(`${msgId}ItalicBtn`);

        if (!textarea || !boldBtn || !italicBtn) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end) {
            const text = textarea.value;
            const beforeCursor = text.substring(0, start);

            const boldMatches = beforeCursor.split('*').length - 1;
            const inBold = boldMatches % 2 === 1;

            const italicMatches = beforeCursor.split('_').length - 1;
            const inItalic = italicMatches % 2 === 1;

            boldBtn.classList.toggle('active', inBold);
            italicBtn.classList.toggle('active', inItalic);
        } else {
            const beforeText = textarea.value.substring(Math.max(0, start - 1), start);
            const afterText = textarea.value.substring(end, Math.min(textarea.value.length, end + 1));

            boldBtn.classList.toggle('active', beforeText === '*' && afterText === '*');
            italicBtn.classList.toggle('active', beforeText === '_' && afterText === '_');
        }
    },

    handleKeyboardShortcuts(msgId, e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.toggleFormat(msgId, 'bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.toggleFormat(msgId, 'italic');
                    break;
                case 'n':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.insertTag(msgId, 'nome');
                    }
                    break;
                case 'g':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.insertTag(msgId, 'saudacao');
                    }
                    break;
            }
        }
    },

    animateButton(msgId, type) {
        let button;
        switch (type) {
            case 'bold':
                button = document.getElementById(`${msgId}BoldBtn`);
                break;
            case 'italic':
                button = document.getElementById(`${msgId}ItalicBtn`);
                break;
            case 'clear':
                button = document.getElementById(`${msgId}ClearFormatBtn`);
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    },

    getRandomActiveMessage() {
        this.syncMessagesConfigFromUI();

        const activeMessages = Object.entries(AppState.messagesConfig)
            .filter(([id, config]) => config.enabled && (config.text.trim() || config.media));

        console.log('🔍 Mensagens ativas disponíveis:', activeMessages.map(([id]) => id));

        if (activeMessages.length === 0) {
            throw new Error('Nenhuma mensagem ativa configurada');
        }

        if (activeMessages.length === 1) {
            console.log(`📝 Apenas 1 mensagem ativa: ${activeMessages[0][0]}`);
            const [messageId, messageConfig] = activeMessages[0];
            return {
                id: messageId,
                text: messageConfig.text || '',
                media: messageConfig.media
            };
        }

        if (!window.messageUsageHistory) {
            window.messageUsageHistory = {};
        }

        const usageCounts = {};
        activeMessages.forEach(([id]) => {
            usageCounts[id] = window.messageUsageHistory[id] || 0;
        });

        console.log('📊 Histórico de uso atual:', usageCounts);

        const minUsage = Math.min(...Object.values(usageCounts));
        const leastUsedMessages = activeMessages.filter(([id]) => usageCounts[id] === minUsage);

        console.log(`📈 Mensagens menos usadas (${minUsage} usos):`, leastUsedMessages.map(([id]) => id));

        const randomIndex = Math.floor(Math.random() * leastUsedMessages.length);
        const [selectedId, selectedConfig] = leastUsedMessages[randomIndex];

        window.messageUsageHistory[selectedId] = (window.messageUsageHistory[selectedId] || 0) + 1;

        console.log(`🎯 Mensagem "${selectedId}" selecionada (${randomIndex + 1}/${leastUsedMessages.length} candidatas)`);
        console.log('📊 Novo histórico de uso:', window.messageUsageHistory);

        return {
            id: selectedId,
            text: selectedConfig.text || '',
            media: selectedConfig.media
        };
    },

    resetMessageRotation() {
        window.messageUsageHistory = {};
        console.log('🔄 Histórico de rotação de mensagens resetado');
    }
};

window.MultipleMessagesManager = MultipleMessagesManager;

// ========================================
// 20. GERENCIAMENTO DE EVENTOS
// ========================================
const EventManager = {
    setupFileUpload() {
        console.log('🔧 Configurando upload de arquivos...');

        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('excelFile');

        if (!fileUploadArea || !fileInput) {
            console.error('❌ Elementos não encontrados:', {
                fileUploadArea: !!fileUploadArea,
                fileInput: !!fileInput
            });
            return;
        }

        console.log('✅ Elementos encontrados, configurando eventos...');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, this.preventDefaults, false);
            fileUploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, this.highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, this.unhighlight, false);
        });

        fileUploadArea.addEventListener('drop', this.handleDrop, false);
        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', this.handleFileSelect);

        fileInput.addEventListener('change', this.handleFileSelect);
        console.log('✅ Event listener change configurado');
    },

    setupFormEvents() {
        console.log('🔧 Configurando eventos do formulário...');

        const bulkForm = document.getElementById('bulkForm');

        if (bulkForm) {
            bulkForm.addEventListener('submit', (e) => {
                console.log('🚀 Evento submit capturado!', e);
                this.handleFormSubmit(e);
            });
        }

        const submitButton = document.querySelector('#mainApp button[type="submit"]');
        console.log('🔘 Botão submit do painel principal encontrado:', !!submitButton);

        if (submitButton) {
            submitButton.addEventListener('click', (e) => {
                console.log('🔘 Clique direto no botão do painel principal capturado!');

                e.preventDefault();

                if (!AuthManager.requireAuth()) {
                    console.log('❌ Usuário não autenticado');
                    return;
                }

                console.log('🔍 Verificando se envio está em andamento...');
                if (AppState.sendingInProgress) {
                    console.log('⚠️ Envio já em andamento');
                    UI.showWarning('Envio já está em andamento');
                    return;
                }

                console.log('🔍 Validando antes do envio...');
                const validation = SendingManager.validateBeforeSending();
                console.log('📊 Resultado da validação:', validation);

                if (!validation.valid) {
                    console.log('❌ Validação falhou:', validation.error);
                    UI.showError(validation.error);
                    return;
                }

                const isScheduled = document.getElementById('enableScheduling')?.checked;
                console.log('📅 Agendado?', isScheduled);

                if (isScheduled) {
                    console.log('📅 Executando agendamento...');
                    const dispatchData = FormManager.collectDispatchData();
                    ScheduleManager.scheduleDispatch(dispatchData);
                } else {
                    console.log('🚀 Mostrando diálogo de confirmação...');
                    FormManager.showConfirmationDialog();
                }
            });
        }

        const stopButton = document.getElementById('stopButton');
        const pauseButton = document.getElementById('pauseButton');
        const reportButton = document.getElementById('reportButton');

        if (stopButton) stopButton.addEventListener('click', () => SendingManager.stop());
        if (pauseButton) pauseButton.addEventListener('click', this.handlePauseToggle);
        if (reportButton) reportButton.addEventListener('click', () => ReportManager.generatePDFReport());

        const checkConnectionBtn = document.getElementById('checkConnectionBtn');
        const recheckConnection = document.getElementById('recheckConnection');

        if (checkConnectionBtn) {
            checkConnectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ConnectionManager.checkConnection();
            });
        }

        if (recheckConnection) {
            recheckConnection.addEventListener('click', (e) => {
                e.preventDefault();
                ConnectionManager.checkConnection();
            });
        }

        const enableScheduling = document.getElementById('enableScheduling');
        if (enableScheduling) {
            enableScheduling.addEventListener('change', () => ScheduleManager.toggleSchedulingOptions());
        }

        const clearHistoryButton = document.getElementById('clearHistoryButton');
        const clearContactsBtn = document.getElementById('clearContactsBtn');

        if (clearHistoryButton) clearHistoryButton.addEventListener('click', () => HistoryManager.clear());
        if (clearContactsBtn) clearContactsBtn.addEventListener('click', () => ContactManager.clear());

        this.setupExportImportEvents();

        const enableBrazilianValidation = document.getElementById('enableBrazilianValidation');
        if (enableBrazilianValidation) {
            enableBrazilianValidation.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                const mode = isEnabled ? 'Validação Brasileira' : 'Validação Internacional';

                console.log('🔧 Modo de validação alterado:', mode);

                if (isEnabled) {
                    UI.showInfo('✅ Validação brasileira ativada - Números serão validados com DDD brasileiro');
                } else {
                    UI.showSuccess('🌍 Validação internacional ativada - Aceita números de qualquer país');
                }

                if (AppState.contacts.length > 0) {
                    setTimeout(() => {
                        UI.confirm(
                            'Revalidar Contatos',
                            `Modo de validação alterado para: ${mode}<br><br>Deseja revalidar os ${AppState.contacts.length} contatos existentes com o novo modo?`,
                            () => {
                                ContactManager.revalidateContacts();
                            }
                        );
                    }, 1000);
                }
            });
        }
    },

    setupExportImportEvents() {
        const events = [
            { id: 'exportHistoryBtn', handler: () => DataManager.exportHistoryToExcel() },
            { id: 'exportContactsBtn', handler: () => DataManager.exportContactsToExcel() },
            { id: 'downloadModelBtn', handler: () => ModeloManager.downloadModel() }
        ];

        events.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        });
    },

    setupAutoSave() {
        AutoSaveManager.initialize();
        console.log('✅ Sistema de auto-save avançado ativado');
    },

    setupPreviewEvents() {
        const messageField = document.getElementById('message');
        const mediaFileField = document.getElementById('mediaFile');

        if (messageField) {
            messageField.addEventListener('input', () => {
                PreviewManager.update();
            });
        }

        if (mediaFileField) {
            mediaFileField.addEventListener('change', (e) => {
                console.log('📎 Evento change no campo de mídia');

                const file = e.target.files[0];

                if (file && file.size > 0) {
                    console.log('📎 Arquivo selecionado:', file.name, file.type);

                    showMediaPreview(file);

                    setTimeout(() => {
                        PreviewManager.update();
                    }, 200);

                } else {
                    console.log('📎 Nenhum arquivo válido');

                    const preview = document.getElementById('mediaPreview');
                    if (preview) preview.style.display = 'none';

                    PreviewManager.update();
                }
            });
        }

        const clearMediaBtn = document.getElementById('clearMediaBtn');
        if (clearMediaBtn) {
            clearMediaBtn.addEventListener('click', clearMedia);
        }

        const minInterval = document.getElementById('minInterval');
        const maxInterval = document.getElementById('maxInterval');

        if (minInterval) minInterval.addEventListener('input', TimeEstimator.update);
        if (maxInterval) maxInterval.addEventListener('input', TimeEstimator.update);
    },

    forceCleanAndUpdate() {
        console.log('🧹 Limpeza forçada do preview...');

        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            const allMedia = previewContent.querySelectorAll('img, video, source');
            allMedia.forEach(element => {
                const src = element.src || element.getAttribute('src');
                if (src && src.startsWith('blob:')) {
                    URL.revokeObjectURL(src);
                }
            });

            this.update();
        }
    },

    setupDelegatedEvents() {
        const historyTable = document.getElementById('historyTable');

        if (historyTable) {
            historyTable.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.view-details-btn');
                const reportBtn = e.target.closest('.generate-report-btn');
                const deleteBtn = e.target.closest('.delete-entry-btn');
                const resultsBtn = e.target.closest('.history-results-btn');
                const exportBtn = e.target.closest('.history-export-btn');

                if (resultsBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    HistoryManager.openCampaignResults(resultsBtn.dataset.campaignId);
                } else if (exportBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    HistoryManager.exportCampaignCsv(exportBtn.dataset.campaignId);
                } else if (viewBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(viewBtn.dataset.entryId);
                    HistoryManager.viewDetails(entryId);
                } else if (reportBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(reportBtn.dataset.entryId);
                    HistoryManager.generateReport(entryId);
                } else if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryId = parseInt(deleteBtn.dataset.entryId);
                    HistoryManager.deleteEntry(entryId);
                }
            });
        }
    },

    setupModalCleanup() {
        const connectionModal = document.getElementById('connectionModal');
        if (connectionModal) {
            connectionModal.addEventListener('hidden.bs.modal', () => {
                AppIntervals.clear('qrRefresh');
            });
        }
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    highlight(e) {
        e.currentTarget.classList.add('dragover');
    },

    unhighlight(e) {
        e.currentTarget.classList.remove('dragover');
    },

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];

            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel' ||
                file.name.toLowerCase().endsWith('.xlsx') ||
                file.name.toLowerCase().endsWith('.xls')) {
                ContactManager.processExcelFile(file);
            } else {
                UI.showError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
            }
        }
    },

    handleFileSelect(e) {
        console.log('📁 Evento change capturado');

        const file = e.target.files[0];

        if (!file) {
            console.log('❌ Nenhum arquivo selecionado');
            return;
        }

        console.log('📊 Processando arquivo selecionado:', {
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024).toFixed(2)} KB`
        });

        const isExcelFile =
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel' ||
            file.name.toLowerCase().endsWith('.xlsx') ||
            file.name.toLowerCase().endsWith('.xls');

        if (isExcelFile) {
            console.log('✅ Arquivo Excel válido - processando...');
            ContactManager.processExcelFile(file);
        } else {
            console.log('❌ Arquivo inválido:', file.type);
            UI.showError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
            e.target.value = '';
        }
    },

    handleFormSubmit(e) {
        console.log('📋 handleFormSubmit chamado', e);

        if (e.target && e.target.closest('.instance-card')) {
            console.log('❌ Clique veio de card de instância, ignorando');
            return;
        }

        e.preventDefault();
        console.log('✅ preventDefault executado no handleFormSubmit');

        const loginScreen = document.getElementById('loginScreen');
        const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

        if (!isLoginVisible && !AuthManager.requireAuth()) {
            console.log('❌ Usuário não autenticado no form submit');
            return;
        }

        if (isLoginVisible) {
            console.log('🔐 Tela de login ativa, ignorando form submit');
            return;
        }

        if (AppState.sendingInProgress) {
            console.log('⚠️ Envio já em andamento');
            UI.showWarning('Envio já está em andamento');
            return;
        }

        console.log('🔍 Validando antes do envio...');
        const validation = SendingManager.validateBeforeSending();
        console.log('📊 Resultado da validação:', validation);

        if (!validation.valid) {
            console.log('❌ Validação falhou:', validation.error);
            UI.showError(validation.error);
            return;
        }

        const isScheduled = document.getElementById('enableScheduling')?.checked;
        console.log('📅 Agendado?', isScheduled);

        if (isScheduled) {
            console.log('📅 Executando agendamento...');
            const dispatchData = FormManager.collectDispatchData();
            ScheduleManager.scheduleDispatch(dispatchData);
        } else {
            console.log('🚀 Mostrando diálogo de confirmação...');
            FormManager.showConfirmationDialog();
        }
    },

    handlePauseToggle() {
        if (AppState.isPaused) {
            SendingManager.resume();
        } else {
            SendingManager.pause();
        }
    },

    clearMediaCache() {
        console.log('🧹 Limpeza completa de cache de mídia...');

        if (window.currentMediaURL) {
            URL.revokeObjectURL(window.currentMediaURL);
            window.currentMediaURL = null;
        }

        if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
            for (let i = 0; i < 100; i++) {
                try {
                    URL.revokeObjectURL(`blob:${window.location.origin}/${i}`);
                } catch (e) {
                }
            }
        }

        const mediaFile = document.getElementById('mediaFile');
        if (mediaFile) {
            mediaFile.value = '';
            mediaFile.type = '';
            mediaFile.type = 'file';
        }

        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) {
            mediaPreview.style.display = 'none';
        }

        const mediaContent = document.getElementById('mediaPreviewContent');
        if (mediaContent) {
            mediaContent.innerHTML = '';
        }

        console.log('🗑️ Cache de mídia completamente limpo na inicialização');
    }
};

function clearMediaUrl(msgId) {
    if (typeof MultipleMessagesManager !== 'undefined') {
        MultipleMessagesManager.clearMediaUrl(msgId);
    }
}

// ========================================
// 22. GERENCIAMENTO DE FORMULARIO
// ========================================
const FormManager = {
    collectDispatchData() {
        const validation = Validators.instanceData();

        return {
            instanceName: validation.instanceName || 'Múltiplas Instâncias',
            instanceAPIKEY: validation.instanceAPIKEY || '',
            activeInstancesCount: AppState.activeInstances.length,
            instancesUsed: AppState.activeInstances.map(inst => ({
                id: inst.id,
                name: inst.name
            })),
            multipleMessages: {
                enabled: true,
                config: AppState.messagesConfig
            },
            ia: document.getElementById('ia')?.value || '',
            minInterval: parseInt(document.getElementById('minInterval')?.value || 0),
            maxInterval: parseInt(document.getElementById('maxInterval')?.value || 0),
            contacts: [...AppState.contacts]
        };
    },

    showConfirmationDialog() {
        console.log('🔍 Coletando dados do envio...');

        const instanceName = document.getElementById('instanceName')?.value || 'Instâncias Múltiplas';

        const activeMessages = Object.values(AppState.messagesConfig)
            .filter(config => config.enabled && (config.text.trim() || config.media));

        const messageCount = activeMessages.length;
        const messagePreview = activeMessages.length > 0 ?
            activeMessages[0].text.substring(0, 50) + (activeMessages[0].text.length > 50 ? '...' : '') :
            'Sem mensagem configurada';

        const confirmText = `
        <div class="text-start">
            <h6>Confirme os dados do envio</h6>
            <p><strong>Instância:</strong> ${instanceName}</p>
            <p><strong>Contatos:</strong> ${AppState.contacts.length}</p>
            <p><strong>Mensagens ativas:</strong> ${messageCount}</p>
            <p><strong>Preview:</strong> ${messagePreview}</p>
        </div>
    `;

        console.log('🔍 Mostrando diálogo de confirmação...');
        UI.confirm(
            'Confirmar Envio',
            confirmText,
            () => {
                console.log('✅ Usuário confirmou o envio');
                SendingManager.start();
            }
        );
    }
};

// ========================================
// EDITOR DE TEXTO RICO + HELPERS
// ========================================
class RichTextEditor {
    constructor(editorId) {
        this.editor = document.getElementById(editorId);
        this.textarea = this.editor.querySelector('.rich-text-area');
        this.charCounter = this.editor.querySelector('.char-counter');
        this.boldBtn = document.getElementById('boldBtn');
        this.italicBtn = document.getElementById('italicBtn');
        this.clearFormatBtn = document.getElementById('clearFormatBtn');

        this.nameBtn = document.getElementById('nameBtn');
        this.greetingBtn = document.getElementById('greetingBtn');

        this.init();
    }

    init() {
        if (this.boldBtn) {
            this.boldBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFormat('bold');
            });
        }

        if (this.italicBtn) {
            this.italicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFormat('italic');
            });
        }

        if (this.clearFormatBtn) {
            this.clearFormatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearFormatting();
            });
        }

        if (this.nameBtn) {
            this.nameBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.insertTag('nome');
            });
        }

        if (this.greetingBtn) {
            this.greetingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.insertTag('saudacao');
            });
        }

        if (this.textarea) {
            this.textarea.addEventListener('input', () => {
                this.updateCharCounter();
                PreviewManager.update();
            });
            this.textarea.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
            this.textarea.addEventListener('select', () => this.updateToolbarState());
            this.textarea.addEventListener('click', () => this.updateToolbarState());
        }

        this.updateCharCounter();
    }

    toggleFormat(type) {
        console.log('🔍 ANTES da formatação:', this.textarea.value);

        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.textarea.value.substring(start, end);

        if (selectedText.length === 0) {
            this.insertFormatMarkers(type);
        } else {
            this.wrapSelectedText(type, selectedText, start, end);
        }

        console.log('🔍 DEPOIS da formatação:', this.textarea.value);

        this.animateButton(type);
        this.updateCharCounter();
        PreviewManager.update();
    }

    insertTag(tagType) {
        const tags = {
            'nome': '{nome}',
            'saudacao': '{saudacao}'
        };

        const tag = tags[tagType];
        if (!tag) return;

        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        const newValue = value.slice(0, start) + tag + value.slice(end);
        this.textarea.value = newValue;

        const newPosition = start + tag.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();

        this.animateTagButton(tagType);
        this.updateCharCounter();
        PreviewManager.update();

        console.log(`✅ Tag {${tagType}} inserida na posição ${start}`);
    }

    insertFormatMarkers(type) {
        const markers = {
            'bold': '*',
            'italic': '_'
        };

        const marker = markers[type];
        const start = this.textarea.selectionStart;
        const value = this.textarea.value;

        const newValue = value.slice(0, start) + marker + marker + value.slice(start);
        this.textarea.value = newValue;

        const newPosition = start + marker.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();
    }

    wrapSelectedText(type, selectedText, start, end) {
        const markers = {
            'bold': '*',
            'italic': '_'
        };

        const marker = markers[type];

        const beforeText = this.textarea.value.substring(Math.max(0, start - marker.length), start);
        const afterText = this.textarea.value.substring(end, Math.min(this.textarea.value.length, end + marker.length));

        if (beforeText === marker && afterText === marker) {
            const newValue =
                this.textarea.value.slice(0, start - marker.length) +
                selectedText +
                this.textarea.value.slice(end + marker.length);

            this.textarea.value = newValue;
            this.textarea.setSelectionRange(start - marker.length, end - marker.length);
        } else {
            const newValue =
                this.textarea.value.slice(0, start) +
                marker + selectedText + marker +
                this.textarea.value.slice(end);

            this.textarea.value = newValue;
            this.textarea.setSelectionRange(start, end + (marker.length * 2));
        }

        this.textarea.focus();
    }

    clearFormatting() {
        let text = this.textarea.value;

        text = text.replace(/\*([^*]+)\*/g, '$1');
        text = text.replace(/_([^_]+)_/g, '$1');

        this.textarea.value = text;
        this.updateCharCounter();
        PreviewManager.update();
        this.animateButton('clear');
    }

    updateCharCounter() {
        const currentLength = this.textarea.value.length;
        const maxLength = this.textarea.maxLength || 4096;

        this.charCounter.textContent = `${currentLength}/${maxLength}`;

        if (currentLength > maxLength * 0.9) {
            this.charCounter.style.color = '#dc3545';
        } else if (currentLength > maxLength * 0.8) {
            this.charCounter.style.color = '#ffc107';
        } else {
            this.charCounter.style.color = '#6c757d';
        }
    }

    updateToolbarState() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        if (start === end) {
            const text = this.textarea.value;
            const beforeCursor = text.substring(0, start);

            const boldMatches = beforeCursor.split('*').length - 1;
            const inBold = boldMatches % 2 === 1;

            const italicMatches = beforeCursor.split('_').length - 1;
            const inItalic = italicMatches % 2 === 1;

            if (this.boldBtn) this.boldBtn.classList.toggle('active', inBold);
            if (this.italicBtn) this.italicBtn.classList.toggle('active', inItalic);
        } else {
            const beforeText = this.textarea.value.substring(Math.max(0, start - 1), start);
            const afterText = this.textarea.value.substring(end, Math.min(this.textarea.value.length, end + 1));

            if (this.boldBtn) this.boldBtn.classList.toggle('active', beforeText === '*' && afterText === '*');
            if (this.italicBtn) this.italicBtn.classList.toggle('active', beforeText === '_' && afterText === '_');
        }
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.toggleFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.toggleFormat('italic');
                    break;
                case 'n':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.insertTag('nome');
                    }
                    break;
                case 'g':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.insertTag('saudacao');
                    }
                    break;
            }
        }
    }

    animateButton(type) {
        let button;
        switch (type) {
            case 'bold':
                button = this.boldBtn;
                break;
            case 'italic':
                button = this.italicBtn;
                break;
            case 'clear':
                button = this.clearFormatBtn;
                break;
        }

        if (button) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 300);
        }
    }

    animateTagButton(tagType) {
        let button;
        switch (tagType) {
            case 'nome':
                button = this.nameBtn;
                break;
            case 'saudacao':
                button = this.greetingBtn;
                break;
        }

        if (button) {
            button.classList.add('tag-inserted');
            setTimeout(() => button.classList.remove('tag-inserted'), 600);
        }
    }

    getValue() {
        return this.textarea.value;
    }

    setValue(value) {
        this.textarea.value = value;
        this.updateCharCounter();
        PreviewManager.update();
    }

    focus() {
        this.textarea.focus();
    }

    insertText(text) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        const newValue = value.slice(0, start) + text + value.slice(end);
        this.textarea.value = newValue;

        const newPosition = start + text.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();

        this.updateCharCounter();
        PreviewManager.update();
    }

    validateWhatsAppFormatting(text) {
        text = text.replace(/\*\s+/g, '*');
        text = text.replace(/\s+\*/g, '*');
        text = text.replace(/_\s+/g, '_');
        text = text.replace(/\s+_/g, '_');

        const asteriskCount = (text.match(/\*/g) || []).length;
        const underscoreCount = (text.match(/_/g) || []).length;

        if (asteriskCount % 2 !== 0) {
            console.warn('⚠️ Marcadores de negrito ímpares detectados');
        }
        if (underscoreCount % 2 !== 0) {
            console.warn('⚠️ Marcadores de itálico ímpares detectados');
        }

        return text;
    }
}

function cleanMessageForWhatsApp(message) {
    if (!message) return '';

    console.log('🧹 Limpando mensagem para WhatsApp:', message);

    let cleanMessage = message
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<br>/g, '\n')
        .replace(/<[^>]*>/g, '');

    cleanMessage = cleanMessage
        .replace(/\*\*([^*]+)\*\*/g, '*$1*')
        .replace(/__([^_]+)__/g, '_$1_');

    console.log('✅ Mensagem limpa:', cleanMessage);

    return cleanMessage;
}

// ========================================
// MULTIPLE MESSAGES FIXED (LEGACY)
// ========================================
const MultipleMessagesManagerFixed = {
    initialize() {
        console.log('🔧 Inicializando MultipleMessagesManager...');

        const toggleSwitch = document.getElementById('enableMultipleMessages');
        const singleMode = document.getElementById('singleMessageMode');
        const multipleMode = document.getElementById('multipleMessagesMode');

        if (!toggleSwitch) {
            console.warn('⚠️ Elemento enableMultipleMessages não encontrado. Recurso de múltiplas mensagens não disponível.');
            return;
        }

        if (!singleMode) {
            console.warn('⚠️ Elemento singleMessageMode não encontrado.');
            return;
        }

        if (!multipleMode) {
            console.warn('⚠️ Elemento multipleMessagesMode não encontrado.');
            return;
        }

        console.log('✅ Elementos de múltiplas mensagens encontrados');

        toggleSwitch.addEventListener('change', (e) => {
            AppState.multipleMessagesEnabled = e.target.checked;

            if (AppState.multipleMessagesEnabled) {
                singleMode.style.display = 'none';
                multipleMode.style.display = 'block';
                setTimeout(() => this.updateMainPreview('msg1'), 100);
            } else {
                singleMode.style.display = 'block';
                multipleMode.style.display = 'none';
                if (typeof PreviewManager !== 'undefined') {
                    PreviewManager.update();
                }
            }
        });

        this.setupMessageListeners();
        this.setupTabListeners();
        this.updateActiveMessagesInfo();
    }
};

// ========================================
// GERENCIAMENTO DO CAMPO DE ASSUNTO DO E-MAIL
// ========================================
const EmailSubjectManager = {
    initialize() {
        console.log('📧 Inicializando EmailSubjectManager...');

        const enableEmailCheckbox = document.getElementById('enableEmailSending');
        const subjectContainer = document.getElementById('emailSubjectContainer');

        if (enableEmailCheckbox && subjectContainer) {
            enableEmailCheckbox.addEventListener('change', (e) => {
                this.toggleSubjectField(e.target.checked);
            });

            this.toggleSubjectField(enableEmailCheckbox.checked);

            console.log('✅ EmailSubjectManager inicializado');
        } else {
            console.warn('⚠️ Elementos de e-mail não encontrados:', {
                checkbox: !!enableEmailCheckbox,
                container: !!subjectContainer
            });
        }
    },

    toggleSubjectField(show) {
        const subjectContainer = document.getElementById('emailSubjectContainer');
        const subjectInput = document.getElementById('emailSubject');

        if (subjectContainer) {
            subjectContainer.style.display = show ? 'block' : 'none';

            if (show && subjectInput) {
                setTimeout(() => {
                    subjectInput.focus();
                }, 200);
            }

            if (!show && subjectInput) {
                subjectInput.value = '';
            }
        }
    },

    getEmailSubject() {
        const subjectInput = document.getElementById('emailSubject');
        const enableEmail = document.getElementById('enableEmailSending')?.checked;

        if (!enableEmail || !subjectInput) {
            return '';
        }

        return subjectInput.value.trim();
    },

    processEmailSubject(subject, contactName) {
        if (!subject) return 'Mensagem';

        let processedSubject = subject
            .replace(/{nome}/g, contactName)
            .replace(/{saudacao}/g, Utils.getSaudacao());

        if (typeof RandomTagsSystem !== 'undefined') {
            processedSubject = RandomTagsSystem.processAllTags(processedSubject);
        }

        return processedSubject.trim() || 'Mensagem';
    }
};

window.EmailSubjectManager = EmailSubjectManager;

window.clearMediaUrl = function (msgId) {
    if (typeof MultipleMessagesManager !== 'undefined') {
        MultipleMessagesManager.clearMediaUrl(msgId);
    }
};
