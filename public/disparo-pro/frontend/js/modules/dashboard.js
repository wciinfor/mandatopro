// ========================================
// DASHBOARD MODULES
// ========================================

Object.defineProperty(window, 'protectTotalContacts', {
    value: function () {
        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            let currentValue = AppState.contacts.length;

            const observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                        const newValue = parseInt(totalContactsEl.textContent) || 0;
                        const correctValue = AppState.contacts.length;

                        if (newValue !== correctValue && correctValue > 0) {
                            console.warn(`⚠️ totalContacts foi alterado indevidamente: ${newValue} → ${correctValue}`);
                            totalContactsEl.textContent = correctValue;
                        }
                    }
                });
            });

            observer.observe(totalContactsEl, {
                characterData: true,
                childList: true,
                subtree: true
            });

            console.log('🛡️ Proteção de totalContacts ativada');
        }
    },
    writable: false,
    configurable: false
});

// ========================================
// 12. GERENCIAMENTO DE CHARTS
// ========================================
const ChartManager = {
    isInitialized: false,

    initialize() {
        if (this.isInitialized) {
            console.log('⚠️ ChartManager já inicializado, pulando...');
            return;
        }

        const ctx = document.getElementById('resultsChart')?.getContext('2d');
        if (!ctx) {
            console.warn('⚠️ Canvas resultsChart não encontrado');
            return;
        }

        if (AppState.chart) {
            try {
                AppState.chart.destroy();
                console.log('🗑️ Gráfico anterior destruído');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico anterior:', error);
            }
            AppState.chart = null;
        }

        try {
            AppState.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Sucesso', 'Erro'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#28a745', '#dc3545'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'white'
                            }
                        }
                    }
                }
            });

            this.isInitialized = true;
            console.log('✅ ChartManager inicializado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao inicializar ChartManager:', error);
            this.isInitialized = false;
        }
    },

    update() {
        if (AppState.chart && this.isInitialized) {
            try {
                AppState.chart.data.datasets[0].data = [AppState.results.success, AppState.results.error];
                AppState.chart.update('none');
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar gráfico principal:', error);
                this.isInitialized = false;
                this.initialize();
            }
        }

        this.updateResultsChart();
    },

    updateResultsChart() {
        const resultsCtx = document.getElementById('resultsChartResults')?.getContext('2d');
        if (!resultsCtx) {
            console.log('⚠️ Canvas resultsChartResults não encontrado');
            return;
        }

        if (window.resultsChart) {
            try {
                window.resultsChart.destroy();
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico de resultados:', error);
            }
        }

        const totalData = AppState.results.success + AppState.results.error;
        if (totalData === 0) {
            console.log('📊 Sem dados para gráfico de resultados');
            return;
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
    },

    initializeResultsSection() {
        console.log('📊 Inicializando seção de resultados...');

        const resultsCanvas = document.getElementById('resultsChartResults');
        if (!resultsCanvas) {
            console.warn('⚠️ Canvas resultsChartResults não encontrado');
            return;
        }

        if (!AppState.results.success && !AppState.results.error) {
            AppState.results = { success: 0, error: 0 };
        }

        if (typeof SendingManager !== 'undefined' && SendingManager.updateStats) {
            SendingManager.updateStats();
        }

        this.updateResultsChart();

        console.log('✅ Seção de resultados inicializada');
    },

    destroy() {
        if (AppState.chart) {
            try {
                AppState.chart.destroy();
                console.log('🗑️ Gráfico principal destruído no cleanup');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico principal:', error);
            }
            AppState.chart = null;
        }

        if (window.resultsChart) {
            try {
                window.resultsChart.destroy();
                console.log('🗑️ Gráfico de resultados destruído no cleanup');
            } catch (error) {
                console.warn('⚠️ Erro ao destruir gráfico de resultados:', error);
            }
            window.resultsChart = null;
        }

        this.isInitialized = false;
    }
};

// ========================================
// GERENCIAMENTO DE TEMPORIZADOR
// ========================================
const TimerManager = {
    timerInterval: null,
    startTime: null,
    duration: 0,
    isPaused: false,
    currentState: 'idle',

    initialize() {
        console.log('⏱️ Inicializando TimerManager...');

        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.style.display = 'block';
        }

        this.showIdle();
    },

    showIdle() {
        this.currentState = 'idle';
        this.updateDisplay('Aguardando...', 'info', 'secondary');
        this.updateLabel('Status do envio:');
        this.updateDetails('Configure uma lista de contatos e inicie o disparo');
        this.updateProgress(0, 'secondary');
        this.clear();
    },

    showPreparing() {
        this.currentState = 'preparing';
        this.updateDisplay('Preparando...', 'info', 'primary');
        this.updateLabel('Preparando envio:');
        this.updateDetails('Validando dados e iniciando disparo em massa');
        this.updateProgress(0, 'primary');
    },

    showSending(contactName, currentIndex, total) {
        this.currentState = 'sending';
        this.updateDisplay('Enviando...', 'warning', 'warning');
        this.updateLabel('Enviando para:');
        this.updateDetails(`${contactName} (${currentIndex + 1}/${total})`);
        this.updateProgress(100, 'warning');
    },

    startCountdown(durationMs, currentIndex, total) {
        this.currentState = 'countdown';
        this.duration = durationMs;
        this.startTime = Date.now();
        this.isPaused = false;

        this.updateLabel('Próximo envio em:');
        this.updateDetails(`Aguardando intervalo de segurança (${currentIndex + 1}/${total})`);
        this.updateTimerClass('info');

        this.clear();
        this.timerInterval = setInterval(() => {
            this.updateCountdown();
        }, 100);

        this.updateCountdown();
    },

    startBatchPause(durationMs, batchNumber, totalBatches) {
        this.currentState = 'batch-pause';
        this.duration = durationMs;
        this.startTime = Date.now();
        this.isPaused = false;

        this.updateLabel('Pausa entre lotes:');
        this.updateDetails(`Lote ${batchNumber}/${totalBatches} - Pausa para evitar bloqueios`);
        this.updateTimerClass('warning');

        this.clear();
        this.timerInterval = setInterval(() => {
            this.updateCountdown();
        }, 100);

        this.updateCountdown();
    },

    showPaused() {
        this.currentState = 'paused';
        this.isPaused = true;
        this.updateDisplay('PAUSADO', 'secondary', 'secondary');
        this.updateLabel('Envio pausado:');
        this.updateDetails('Clique em "Retomar Envio" para continuar');
        this.updateProgress(50, 'secondary');
    },

    showCompleted(successCount, errorCount, totalTime) {
        this.currentState = 'completed';
        this.clear();

        const successRate = totalTime ? ((successCount / (successCount + errorCount)) * 100).toFixed(1) : 0;

        this.updateDisplay('Concluído!', 'success', 'success');
        this.updateLabel('Disparo finalizado:');
        this.updateDetails(`${successCount} sucessos, ${errorCount} erros (${successRate}% sucesso) em ${Utils.formatTime(totalTime)}`);
        this.updateProgress(100, 'success');

        setTimeout(() => {
            if (this.currentState === 'completed') {
                this.showIdle();
            }
        }, 10000);
    },

    showStopped() {
        this.currentState = 'stopped';
        this.clear();
        this.updateDisplay('Interrompido', 'danger', 'danger');
        this.updateLabel('Envio interrompido:');
        this.updateDetails('O disparo foi interrompido pelo usuário');
        this.updateProgress(0, 'danger');

        setTimeout(() => {
            if (this.currentState === 'stopped') {
                this.showIdle();
            }
        }, 5000);
    },

    updateCountdown() {
        if (this.isPaused) return;

        const now = Date.now();
        const elapsed = now - this.startTime;
        const remaining = Math.max(0, this.duration - elapsed);

        if (remaining <= 0) {
            this.finish();
            return;
        }

        const seconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

        const countdownElement = document.getElementById('timerCountdown');
        if (countdownElement) {
            countdownElement.textContent = display;

            if (seconds <= 5) {
                countdownElement.className = 'badge bg-danger fs-6';
            } else if (seconds <= 10) {
                countdownElement.className = 'badge bg-warning fs-6';
            } else {
                const bgClass = this.currentState === 'batch-pause' ? 'bg-warning' : 'bg-primary';
                countdownElement.className = `badge ${bgClass} fs-6`;
            }
        }

        const percentage = ((this.duration - remaining) / this.duration) * 100;
        this.updateProgress(percentage, this.currentState === 'batch-pause' ? 'warning' : 'primary');
    },

    updateDisplay(text, alertClass, badgeClass) {
        const countdownElement = document.getElementById('timerCountdown');
        const timerElement = document.getElementById('nextSendTimer');

        if (countdownElement) {
            countdownElement.textContent = text;
            countdownElement.className = `badge bg-${badgeClass} fs-6`;
        }

        if (timerElement) {
            timerElement.className = `alert alert-${alertClass}`;
        }
    },

    updateLabel(text) {
        const labelElement = document.getElementById('timerLabel');
        if (labelElement) {
            labelElement.textContent = text;
        }
    },

    updateDetails(text) {
        const detailsElement = document.getElementById('timerDetails');
        if (detailsElement) {
            detailsElement.textContent = text;
        }
    },

    updateProgress(percentage, colorClass) {
        const progressElement = document.getElementById('timerProgress');
        if (progressElement) {
            progressElement.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            progressElement.className = `progress-bar bg-${colorClass}`;
        }
    },

    updateTimerClass(alertClass) {
        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.className = `alert alert-${alertClass}`;
        }
    },

    pause() {
        if (this.currentState === 'countdown' || this.currentState === 'batch-pause') {
            this.isPaused = true;
            this.showPaused();
        }
    },

    resume() {
        if (this.currentState === 'paused') {
            this.isPaused = false;

            const currentMinInterval = parseInt(document.getElementById('minInterval')?.value || 0) * 1000;
            const currentMaxInterval = parseInt(document.getElementById('maxInterval')?.value || 0) * 1000;

            const newDelay = Math.random() * (currentMaxInterval - currentMinInterval) + currentMinInterval;

            console.log('▶️ Retomando com configurações atuais:', {
                minInterval: `${currentMinInterval / 1000}s`,
                maxInterval: `${currentMaxInterval / 1000}s`,
                newDelay: `${(newDelay / 1000).toFixed(1)}s`
            });

            this.startTime = Date.now();
            this.duration = newDelay;
            this.currentState = 'countdown';
            this.updateLabel('Próximo envio em:');
            this.updateDetails('Envio retomado - usando configurações atuais');
            this.updateTimerClass('info');

            UI.showInfo(`Envio retomado com intervalo de ${(newDelay / 1000).toFixed(1)}s`);
        }
    },

    finish() {
        this.clear();
    },

    clear() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    hide() {
        if (this.currentState !== 'countdown' && this.currentState !== 'batch-pause' && this.currentState !== 'sending') {
            this.showIdle();
        }
    },

    startSendTimer(durationMs) {
        this.startCountdown(durationMs, 0, AppState.contacts.length);
    },

    cleanup() {
        console.log('🧹 Limpando TimerManager...');

        this.clear();
        this.currentState = 'idle';
        this.isPaused = false;
        this.duration = 0;
        this.startTime = null;

        const timerElement = document.getElementById('nextSendTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }

        this.updateDisplay('', 'secondary', 'secondary');
        this.updateProgress(0, 'secondary');

        console.log('✅ TimerManager limpo');
    }
};

// ========================================
// SINCRONIZAR DADOS ENTRE DASHBOARD E RESULTADOS
// ========================================
function updateResultsSection() {
    const totalSent = document.getElementById('totalSent')?.textContent || '0';
    const successCount = document.getElementById('successCount')?.textContent || '0';
    const errorCount = document.getElementById('errorCount')?.textContent || '0';

    const totalSentResults = document.getElementById('totalSentResults');
    if (totalSentResults) totalSentResults.textContent = totalSent;

    const total = parseInt(totalSent) || 0;
    const success = parseInt(successCount) || 0;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;

    const successRateEl = document.getElementById('successRate');
    if (successRateEl) successRateEl.textContent = rate + '%';

    const originalChart = document.getElementById('resultsChart');
    const resultsChart = document.getElementById('resultsChartResults');
    if (originalChart && resultsChart && window.Chart) {
        // Copiar configuração do gráfico original
    }
}

setInterval(updateResultsSection, 2000);
