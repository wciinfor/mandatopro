const NotificationService = {
    success(message, options = {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.success(message, options);
            return;
        }
        alert(message);
    },
    info(message, options = {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.info(message, options);
            return;
        }
        alert(message);
    },
    warning(message, options = {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.warning(message, options);
            return;
        }
        alert(message);
    },
    error(message, options = {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.failure(message, options);
            return;
        }
        alert(message);
    },
    confirm(title, message, onConfirm, confirmText = 'Sim', cancelText = 'Cancelar', onCancel = () => {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Confirm.show(title, message, confirmText, cancelText, onConfirm, onCancel);
            return;
        }
        if (confirm(title + '\n\n' + message)) {
            onConfirm();
        } else {
            onCancel();
        }
    },
    initNotify(options = {}) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Notify.init(options);
        }
    },
    report(type, title, message, buttonText = 'OK', options = {}) {
        if (typeof Notiflix === 'undefined') {
            alert([title, message].filter(Boolean).join('\n\n'));
            return;
        }

        const method = type && Notiflix.Report[type] ? Notiflix.Report[type] : Notiflix.Report.info;
        method(title, message, buttonText, options);
    },
    reportSuccess(title, message, buttonText = 'OK', options = {}) {
        this.report('success', title, message, buttonText, options);
    },
    reportInfo(title, message, buttonText = 'OK', options = {}) {
        this.report('info', title, message, buttonText, options);
    },
    reportWarning(title, message, buttonText = 'OK', options = {}) {
        this.report('warning', title, message, buttonText, options);
    },
    reportFailure(title, message, buttonText = 'OK', options = {}) {
        this.report('failure', title, message, buttonText, options);
    },
    loading(message) {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Loading.hourglass(message);
            return;
        }
        console.log('Loading:', message);
    },
    hideLoading() {
        if (typeof Notiflix !== 'undefined') {
            Notiflix.Loading.remove();
        }
    }
};

window.NotificationService = NotificationService;
