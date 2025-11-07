//
//  管理後台導覽模組：負責側邊欄切換、響應式布局、頁籤切換與登出流程。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state } = Admin;
    const navigation = Admin.navigation || {};
    let currentMode = null;

    /**
     * 快取側邊欄與遮罩的關鍵節點，減少重複查詢 DOM。
     * @returns {{sidebar: HTMLElement|null, backdrop: HTMLElement|null, trigger: HTMLElement|null}}
     */
    function getSidebarElements() {
        return {
            sidebar: document.getElementById('admin-sidebar'),
            backdrop: document.getElementById('admin-sidebar-backdrop'),
            trigger: document.getElementById('admin-menu-button')
        };
    }

    /**
     * 同步選單按鈕的 aria 標記，維持無障礙語意正確性。
     * @param {boolean} expanded 側邊欄是否展開。
     */
    function syncTrigger(expanded) {
        const { trigger } = getSidebarElements();
        if (trigger) trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    //
    //  根據螢幕寬度決定側邊欄呈現模式：
    //    - overlay：窄螢幕，以遮罩覆蓋的方式顯示。
    //    - rail：寬螢幕，常駐於畫面側邊。
    //  同時調整 body class 與遮罩狀態。
    //
    /**
     * 依照螢幕寬度決定側邊欄呈現模式，並更新相關 class。
     * @param {boolean} [force=false] 是否強制重新套用。
     */
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

    /**
     * 將焦點移到目前的 active 導航項目，提升鍵盤操作體驗。
     */
    function focusSidebarDefault() {
        const { sidebar } = getSidebarElements();
        if (!sidebar) return;
        const focusTarget = sidebar.querySelector('.admin-sidebar-link.active')
            || sidebar.querySelector('.admin-sidebar-link');
        if (focusTarget) focusTarget.focus();
    }

    /**
     * 控制側邊欄展開或收合，必要時顯示遮罩與調整焦點。
     * @param {boolean} expanded 是否展開。
     * @param {{focusSidebar?: boolean, focusTrigger?: boolean}} [options]
     */
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

    /**
     * 判斷目前是否為遮罩模式（通常是行動寬度）。
     * @returns {boolean}
     */
    navigation.isSidebarOverlayMode = function () {
        if (currentMode === null) {
            return window.innerWidth < config.SIDEBAR_BREAKPOINT;
        }
        return currentMode === 'overlay';
    };

    /**
     * 展開側邊欄並視情況將焦點移到第一個選項。
     */
    navigation.openSidebar = function (options) {
        const shouldFocus = options?.focusFirst ?? navigation.isSidebarOverlayMode();
        setExpanded(true, { focusSidebar: shouldFocus });
    };

    /**
     * 收合側邊欄。
     */
    navigation.closeSidebar = function (options) {
        setExpanded(false, options);
    };

    /**
     * 切換側邊欄展開狀態。
     */
    navigation.toggleSidebar = function () {
        const expanded = document.body.classList.contains('admin-sidebar-expanded');
        setExpanded(!expanded, {
            focusSidebar: !expanded && navigation.isSidebarOverlayMode(),
            focusTrigger: expanded
        });
    };

    /**
     * 綁定側邊欄按鈕、遮罩與快捷鍵事件，初始化 responsive 行為。
     */
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

    /**
     * 綁定導覽列 Logo 連結，快速切換回預設儀表板。
     */
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

    /**
     * 顯示指定 section，並更新側邊欄與導覽列的 active 樣式。
     * @param {string} sectionId 要顯示的區塊 ID。
     */
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

    /**
     * 取得上次瀏覽的頁籤，若不存在則回傳預設值。
     * @returns {string}
     */
    navigation.getSavedSection = function () {
        try {
            const saved = sessionStorage.getItem('sf_admin_active_section');
            return config.SECTION_NAV_MAP[saved] ? saved : config.DEFAULT_SECTION;
        } catch (_) {
            return config.DEFAULT_SECTION;
        }
    };

    //
    //  切換 section 時還會觸發對應模組的資料載入：
    //    - carousel-section：載入輪播並渲染編輯器。
    //    - site-section：確保網站設定表單就緒。
    //    - dashboard / products / categories / orders：預先取得列表資料。
    //
    /**
     * 切換頁籤，同步載入對應模組的資料。
     * @param {string} sectionId 目標 section。
     * @param {{force?: boolean}} [options] 是否強制刷新。
     */
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

    /**
     * 登出管理端：清除相關 storage 後導回登入頁。
     */
    navigation.logout = function () {
        try {
            localStorage.removeItem('sf-admin-role');
            localStorage.removeItem('sf-admin-name');
            localStorage.removeItem('sf-admin-username');
            localStorage.removeItem('sf-admin-session');
            localStorage.removeItem('username');
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
        window.location.href = '/snackforest-shop/frontend/login.html';
    };

    Admin.navigation = navigation;
})(window);
