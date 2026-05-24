document.addEventListener('DOMContentLoaded', () => {
    if (window.NavigationManager && typeof NavigationManager.init === 'function') {
        NavigationManager.init();
    }

    if (window.UiManager && typeof UiManager.init === 'function') {
        UiManager.init();
    }
});
