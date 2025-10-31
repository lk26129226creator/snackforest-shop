(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state } = Admin;
    const navigation = Admin.navigation || {};
    let currentMode = null;

    function getSidebarElements() {
        return {
            sidebar: document.getElementById('admin-sidebar'),
            backdrop: document.getElementById('admin-sidebar-backdrop'),
            trigger: document.getElementById('admin-menu-button')
        };
    }

    function syncTrigger(expanded) {
        const { trigger } = getSidebarElements();
        if (trigger) trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function applyLayout(force) {
        const nextMode = window.innerWidth < config.SIDEBAR_BREAKPOINT ? 'overlay' : 'rail';
        if (!force && nextMode === currentMode) return;
        currentMode = nextMode;

        const body = document.body;
        const { backdrop } = getSidebarElements();

        body.classList.toggle('admin-sidebar-overlay', nextMode === 'overlay');

        if (!body.classList.contains('admin-sidebar-expanded')) {
            body.classList.add('admin-sidebar-collapsed');
        }

        if (nextMode === 'overlay') {
            const expanded = body.classList.contains('admin-sidebar-expanded');
            body.classList.toggle('admin-menu-open', expanded);
            if (backdrop) backdrop.hidden = !expanded;
        } else {
            body.classList.remove('admin-menu-open');
            if (backdrop) backdrop.hidden = true;
        }

        syncTrigger(body.classList.contains('admin-sidebar-expanded'));
    }

    function focusSidebarDefault() {
        const { sidebar } = getSidebarElements();
        if (!sidebar) return;
        const focusTarget = sidebar.querySelector('.admin-sidebar-link.active')
            || sidebar.querySelector('.admin-sidebar-link');
        if (focusTarget) focusTarget.focus();
    }

    function setExpanded(expanded, options = {}) {
        applyLayout(true);

        const body = document.body;
        const { backdrop, trigger } = getSidebarElements();
        const overlayMode = navigation.isSidebarOverlayMode();
        const focusTrigger = options.focusTrigger !== false;

        if (expanded) {
            body.classList.add('admin-sidebar-expanded');
            body.classList.remove('admin-sidebar-collapsed');
            if (overlayMode) {
                body.classList.add('admin-menu-open');
                if (backdrop) backdrop.hidden = false;
            } else if (backdrop) {
                backdrop.hidden = true;
            }
            syncTrigger(true);
            if (options.focusSidebar) focusSidebarDefault();
            return;
        }

        body.classList.remove('admin-sidebar-expanded');
        body.classList.add('admin-sidebar-collapsed');
        body.classList.remove('admin-menu-open');
        if (backdrop) backdrop.hidden = true;
        syncTrigger(false);
        if (focusTrigger && trigger) trigger.focus();
    }

    navigation.isSidebarOverlayMode = function () {
        if (currentMode === null) {
            return window.innerWidth < config.SIDEBAR_BREAKPOINT;
        }
        return currentMode === 'overlay';
    };

    navigation.openSidebar = function (options) {
        const shouldFocus = options?.focusFirst ?? navigation.isSidebarOverlayMode();
        setExpanded(true, { focusSidebar: shouldFocus });
    };

    navigation.closeSidebar = function (options) {
        setExpanded(false, options);
    };

    navigation.toggleSidebar = function () {
        const expanded = document.body.classList.contains('admin-sidebar-expanded');
        setExpanded(!expanded, {
            focusSidebar: !expanded && navigation.isSidebarOverlayMode(),
            focusTrigger: expanded
        });
    };

    navigation.bindAdminMenu = function () {
        const elements = getSidebarElements();
        const { trigger, backdrop, sidebar } = elements;
        if (!trigger || !sidebar) return;

        if (!document.body.classList.contains('admin-sidebar-expanded')
            && !document.body.classList.contains('admin-sidebar-collapsed')) {
            document.body.classList.add('admin-sidebar-collapsed');
        }

        applyLayout(true);
        syncTrigger(document.body.classList.contains('admin-sidebar-expanded'));
        trigger.setAttribute('aria-controls', 'admin-sidebar');

        if (!trigger.dataset.bound) {
            trigger.dataset.bound = '1';
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                navigation.toggleSidebar();
            });
        }

        if (backdrop && !backdrop.dataset.bound) {
            backdrop.dataset.bound = '1';
            backdrop.addEventListener('click', (event) => {
                event.preventDefault();
                navigation.closeSidebar();
            });
        }

        if (!sidebar.dataset.escapeBound) {
            sidebar.dataset.escapeBound = '1';
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape'
                    && navigation.isSidebarOverlayMode()
                    && document.body.classList.contains('admin-sidebar-expanded')) {
                    event.preventDefault();
                    navigation.closeSidebar();
                }
            });
        }

        if (!state.sidebarResizeBound) {
            state.sidebarResizeBound = true;
            window.addEventListener('resize', () => applyLayout());
        }

        applyLayout(true);
        syncTrigger(document.body.classList.contains('admin-sidebar-expanded'));
    };

    navigation.bindAdminHomeLink = function () {
        const link = document.getElementById('admin-home-link');
        if (!link || link.dataset.bound) return;
        link.dataset.bound = '1';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            navigation.switchToSection(config.DEFAULT_SECTION, { force: true }).catch((err) => {
                console.error('切換管理首頁失敗', err);
            });
            if (navigation.isSidebarOverlayMode()) {
                navigation.closeSidebar({ focusTrigger: false });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    navigation.showSection = function (sectionId) {
        const target = config.SECTION_NAV_MAP[sectionId] ? sectionId : config.DEFAULT_SECTION;
        state.activeSection = target;
        try {
            sessionStorage.setItem('sf_admin_active_section', target);
        } catch (_) {
            // ignore storage errors
        }
        document.querySelectorAll('.admin-section').forEach((section) => section.classList.remove('active'));
        document.getElementById(target)?.classList.add('active');

        document.querySelectorAll('.navbar .nav-link').forEach((link) => link.classList.remove('active'));
        const navId = config.SECTION_NAV_MAP[target];
        if (navId) document.getElementById(navId)?.classList.add('active');

        document.querySelectorAll('.admin-sidebar-link').forEach((button) => {
            const matches = button.getAttribute('data-target-section') === target;
            button.classList.toggle('active', matches);
            if (matches) {
                button.setAttribute('aria-current', 'page');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    };

    navigation.getSavedSection = function () {
        try {
            const saved = sessionStorage.getItem('sf_admin_active_section');
            return config.SECTION_NAV_MAP[saved] ? saved : config.DEFAULT_SECTION;
        } catch (_) {
            return config.DEFAULT_SECTION;
        }
    };

    navigation.switchToSection = async function (sectionId, options) {
        const target = config.SECTION_NAV_MAP[sectionId] ? sectionId : config.DEFAULT_SECTION;
        const isSame = state.activeSection === target;
        navigation.showSection(target);
        if (isSame && !options?.force) return;

        if (target === 'carousel-section') {
            if (Admin.carousel && typeof Admin.carousel.loadSlides === 'function') {
                try {
                    const slides = await Admin.carousel.loadSlides({ force: options?.force });
                    if (typeof Admin.carousel.renderEditor === 'function') {
                        Admin.carousel.renderEditor(slides);
                    }
                } catch (err) {
                    console.error('載入輪播失敗', err);
                    if (Admin.carousel && typeof Admin.carousel.renderEditor === 'function') {
                        Admin.carousel.renderEditor([]);
                    }
                }
            } else {
                console.warn('Admin.carousel 模組尚未載入');
            }
        } else if (target === 'site-section') {
            if (Admin.site && typeof Admin.site.ensureSection === 'function') {
                try {
                    await Admin.site.ensureSection({ force: options?.force });
                } catch (err) {
                    console.error('載入網站設定失敗', err);
                }
            } else {
                console.warn('Admin.site 模組尚未載入');
            }
        } else if (target === 'dashboard-section') {
            if (Admin.dashboard && typeof Admin.dashboard.render === 'function') {
                Admin.dashboard.render();
            }
            if (Admin.data && typeof Admin.data.ensureProducts === 'function') {
                Admin.data.ensureProducts().catch(() => {});
            }
            if (Admin.data && typeof Admin.data.ensureCategories === 'function') {
                Admin.data.ensureCategories().catch(() => {});
            }
            if (Admin.data && typeof Admin.data.ensureOrders === 'function') {
                Admin.data.ensureOrders().catch(() => {});
            }
        } else if (target === 'products-section') {
            if (Admin.data && typeof Admin.data.ensureProducts === 'function') {
                Admin.data.ensureProducts().catch(() => {});
            }
            if (Admin.data && typeof Admin.data.ensureCategories === 'function') {
                Admin.data.ensureCategories().catch(() => {});
            }
        } else if (target === 'categories-section') {
            if (Admin.data && typeof Admin.data.ensureCategories === 'function') {
                Admin.data.ensureCategories().catch(() => {});
            }
        } else if (target === 'orders-section') {
            if (Admin.data && typeof Admin.data.ensureOrders === 'function') {
                Admin.data.ensureOrders().catch(() => {});
            }
        }
    };

    navigation.logout = function () {
        try {
            localStorage.removeItem('sf-admin-role');
            localStorage.removeItem('sf-admin-name');
            localStorage.removeItem('sf-admin-session');
            if (!localStorage.getItem('sf-client-role')) {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
            } else {
                localStorage.setItem('userRole', 'customer');
                const clientName = localStorage.getItem('sf-client-name')
                    || localStorage.getItem('customerName')
                    || localStorage.getItem('userName')
                    || '會員';
                localStorage.setItem('userName', clientName);
            }
        } catch (_) {
            // ignore storage errors
        }
        window.location.href = '../login.html';
    };

    Admin.navigation = navigation;
})(window);
