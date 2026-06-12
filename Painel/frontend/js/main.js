// ========================================
// DISPARO PRO - BOOTSTRAP
// ========================================
(function () {
    function exposeLegacyGlobals() {
        if (typeof ScheduleManager !== 'undefined') {
            window.ScheduleManager = ScheduleManager;
        }
    }

    function init() {
        exposeLegacyGlobals();
        if (typeof App !== 'undefined' && typeof App.initialize === 'function') {
            App.initialize();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', () => {
        if (window.currentMediaURL) {
            URL.revokeObjectURL(window.currentMediaURL);
            window.currentMediaURL = null;
            console.log('🗑️ URLs limpas ao fechar página');
        }

        if (typeof AppIntervals !== 'undefined' && typeof AppIntervals.clearAll === 'function') {
            AppIntervals.clearAll();
        }
    });
})();
