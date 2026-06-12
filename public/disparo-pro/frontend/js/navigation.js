const NavigationManager = {
    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        const contentSections = document.querySelectorAll('.content-section');
        const pageTitle = document.getElementById('pageTitle');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }

        let _activeSection = null;

        // Mapa de seções com lifecycle hooks
        const SECTION_HOOKS = {
            atendimento: {
                onEnter: () => window.InboxModule?.onEnter(),
                onLeave: () => window.InboxModule?.onLeave(),
            },
            resultados: {
                onEnter: () => window.ResultsManager?.initialize(),
            },
            historico: {
                onEnter: () => window.HistoryManager?.initialize(),
            },
        };

        if (navLinks.length && contentSections.length) {
            navLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();

                    const targetSection = link.getAttribute('data-section');

                    // Lifecycle: onLeave da seção anterior
                    if (_activeSection && _activeSection !== targetSection) {
                        SECTION_HOOKS[_activeSection]?.onLeave?.();
                    }

                    navLinks.forEach(nav => nav.classList.remove('active'));
                    link.classList.add('active');

                    contentSections.forEach(section => section.classList.remove('active'));
                    const targetElement = document.getElementById(targetSection + '-section');
                    if (targetElement) {
                        targetElement.classList.add('active');

                        if (pageTitle) {
                            pageTitle.textContent = link.textContent.trim();
                        }

                        if (window.innerWidth <= 768 && sidebar) {
                            sidebar.classList.remove('show');
                        }

                        // Lifecycle: onEnter da nova seção
                        _activeSection = targetSection;
                        SECTION_HOOKS[targetSection]?.onEnter?.();
                    }
                });
            });
        }

        document.addEventListener('click', (event) => {
            if (window.innerWidth > 768 || !sidebar || !sidebarToggle) return;
            if (!sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
                sidebar.classList.remove('show');
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && sidebar) {
                sidebar.classList.remove('show');
            }
            if (window.innerWidth > 768 && mainContent) {
                mainContent.classList.remove('expanded');
            }
        });
    }
};

window.NavigationManager = NavigationManager;
