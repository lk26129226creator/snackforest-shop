(function () {
    const BREAKPOINT = 992;
    const utils = window.SF_UTILS || {};
    const env = window.SF_ENV || {};
    const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

    function getOriginSafe(value) {
        if (!value) return '';
        try {
            const base = window.location && window.location.origin ? window.location.origin : undefined;
            const origin = new URL(value, base).origin;
            return origin && origin !== 'null' ? origin : '';
        } catch (_) {
            return '';
        }
    }

    const apiOrigin = (() => {
        const envOrigin = getOriginSafe(env.API_ORIGIN);
        const locationOrigin = getOriginSafe(window.location && window.location.origin);

        if (envOrigin && locationOrigin) {
            try {
                const envHost = new URL(envOrigin).hostname.toLowerCase();
                const locHost = new URL(locationOrigin).hostname.toLowerCase();
                if (LOCAL_HOSTS.has(envHost) && !LOCAL_HOSTS.has(locHost)) {
                    return locationOrigin;
                }
            } catch (_) {
                // ignore parsing errors and fall back to envOrigin
            }
            return envOrigin;
        }

        return envOrigin || locationOrigin || '';
    })();

    function adjustToCurrentOrigin(url) {
        if (!url) return url;
        try {
            const currentOrigin = getOriginSafe(window.location && window.location.origin);
            if (!currentOrigin) return url;
            const parsed = new URL(url, currentOrigin);
            const parsedHost = parsed.hostname.toLowerCase();
            const currentHost = new URL(currentOrigin).hostname.toLowerCase();
            if (LOCAL_HOSTS.has(parsedHost) && !LOCAL_HOSTS.has(currentHost)) {
                return currentOrigin.replace(/\/$/, '') + parsed.pathname + parsed.search + parsed.hash;
            }
            return parsed.href;
        } catch (_) {
            return url;
        }
    }

    function normalizeOriginalSource(value) {
        if (!value) return value;
        const trimmed = String(value).trim();
        if (!trimmed) return trimmed;
        if (!/^https?:\/\//i.test(trimmed)) return trimmed;
        try {
            const parsed = new URL(trimmed);
            if (LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
                return parsed.pathname + parsed.search + parsed.hash;
            }
        } catch (_) {
            return trimmed;
        }
        return trimmed;
    }

    const normalizeImageUrl = typeof utils.normalizeImageUrl === 'function'
        ? (value) => adjustToCurrentOrigin(utils.normalizeImageUrl(value))
        : (value) => {
            if (!value) return '';
            const raw = String(value).trim();
            if (!raw) return '';
            if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
                return adjustToCurrentOrigin(raw);
            }

            let path;
            if (raw.startsWith('/')) {
                path = raw;
            } else if (raw.startsWith('./')) {
                path = raw.replace(/^\.\/+/,'/');
            } else if (raw.startsWith('frontend/')) {
                path = `/${raw}`;
            } else if (raw.startsWith('images/')) {
                path = `/frontend/${raw}`;
            } else {
                path = `/frontend/images/products/${raw}`;
            }

            if (apiOrigin) {
                return adjustToCurrentOrigin(apiOrigin.replace(/\/$/, '') + path);
            }
            return path;
        };

    const fetchSiteCfg = typeof window.fetchSiteConfig === 'function'
        ? window.fetchSiteConfig
        : async () => ({});
    const BRANDING_STORAGE_KEY = 'sf-client-branding';
    const SIDEBAR_STATE_KEY = 'sf-client-sidebar-state';

    function readStoredBranding() {
        try {
            if (!('localStorage' in window)) return null;
        } catch (_) {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(BRANDING_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function writeStoredBranding(payload) {
        try {
            if (!('localStorage' in window)) return;
        } catch (_) {
            return;
        }

        try {
            if (!payload) {
                window.localStorage.removeItem(BRANDING_STORAGE_KEY);
            } else {
                window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(payload));
            }
        } catch (_) {
            // 忽略儲存錯誤（隱私模式等情境）
        }
    }

    function readSidebarPreference() {
        try {
            if (!('localStorage' in window)) return null;
        } catch (_) {
            return null;
        }

        try {
            const value = window.localStorage.getItem(SIDEBAR_STATE_KEY);
            return value === 'expanded' || value === 'collapsed' ? value : null;
        } catch (_) {
            return null;
        }
    }

    function writeSidebarPreference(state) {
        try {
            if (!('localStorage' in window)) return;
        } catch (_) {
            return;
        }

        try {
            if (state === 'expanded' || state === 'collapsed') {
                window.localStorage.setItem(SIDEBAR_STATE_KEY, state);
            } else {
                window.localStorage.removeItem(SIDEBAR_STATE_KEY);
            }
        } catch (_) {
            // ignore storage errors
        }
    }

    function extractInitials(name) {
        if (!name) return 'SF';
        const trimmed = String(name).trim();
        if (!trimmed) return 'SF';
        if (/^[\p{L}\p{N}\s]+$/u.test(trimmed)) {
            const parts = trimmed.split(/\s+/).filter(Boolean);
            const letters = parts.map((part) => part.charAt(0)).join('').toUpperCase();
            return letters.slice(0, 2) || trimmed.slice(0, 2).toUpperCase();
        }
        return trimmed.slice(0, 2).toUpperCase();
    }

    function onReady(fn) {0
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(() => {
        const button = document.getElementById('client-menu-button');
        const sidebar = document.getElementById('client-sidebar');
        const backdrop = document.getElementById('client-sidebar-backdrop');

        if (!button || !sidebar) {
            return;
        }

        if (button.dataset.bound === '1') {
            return;
        }
        button.dataset.bound = '1';

    const body = document.body;
        const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        let lastFocused = null;
        let currentMode = null;
    let outsideClickBound = false;
    const storedSidebarPreference = readSidebarPreference();
    const shouldStartExpanded = storedSidebarPreference === 'expanded' && window.innerWidth >= BREAKPOINT;

        async function applyBranding() {
            const brandNameEl = sidebar.querySelector('.client-sidebar-title');
            const taglineEl = sidebar.querySelector('.client-sidebar-subtitle');
            const logoWrapper = sidebar.querySelector('.client-sidebar-logo');
            const logoImg = sidebar.querySelector('.client-sidebar-logo-img');
            const initialsEl = sidebar.querySelector('.client-sidebar-logo-initials');
            const navBrand = document.querySelector('.navbar .navbar-brand');
            const fallbackName = brandNameEl ? brandNameEl.textContent.trim() : 'SnackForest';
            const fallbackTagline = taglineEl ? taglineEl.textContent.trim() : '';

            const stored = readStoredBranding();
            const storedLogoOriginal = stored && typeof stored.logoSrc === 'string' && stored.logoSrc.trim() ? stored.logoSrc.trim() : '';
            const storedLogoResolved = stored && typeof stored.logoResolved === 'string' && stored.logoResolved.trim() ? stored.logoResolved.trim() : '';
            const storedLogoCandidate = storedLogoOriginal || storedLogoResolved;

            let currentName = fallbackName;
            let currentTagline = fallbackTagline;

            const setInitials = (name) => {
                if (!initialsEl) return;
                initialsEl.textContent = extractInitials(name || fallbackName);
            };

            const setTexts = (name, tagline) => {
                const safeName = name || fallbackName;
                const safeTagline = tagline || fallbackTagline;

                currentName = safeName;
                currentTagline = safeTagline;

                if (brandNameEl) brandNameEl.textContent = safeName;
                if (taglineEl) taglineEl.textContent = safeTagline;

                if (navBrand) {
                    navBrand.textContent = safeName;
                    navBrand.setAttribute('title', `回到 ${safeName} 首頁`);
                    navBrand.setAttribute('aria-label', `回到${safeName}首頁`);
                }

                setInitials(safeName);
            };

            const showImage = (name) => {
                if (!logoWrapper || !logoImg) return;
                logoWrapper.classList.add('has-image');
                logoImg.alt = name || '品牌識別';
                logoWrapper.setAttribute('title', name || fallbackName);
            };

            const hideImage = (name, options = {}) => {
                if (!logoWrapper || !logoImg) return;
                logoWrapper.classList.remove('has-image');
                if (options.clearSrc !== false) {
                    logoImg.removeAttribute('src');
                    delete logoImg.dataset.brandSrc;
                }
                logoImg.alt = '';
                if (name) {
                    logoWrapper.setAttribute('title', name);
                } else {
                    logoWrapper.removeAttribute('title');
                }
                setInitials(name);
            };

            const applyLogoSrc = (src, name, options = {}) => {
                const { persist = false, original = null } = options;

                if (!logoWrapper || !logoImg) return;

                const resolvedName = name || fallbackName;

                if (!src) {
                    hideImage(resolvedName);
                    if (persist) {
                        writeStoredBranding({
                            brandName: resolvedName,
                            tagline: currentTagline,
                            logoSrc: null,
                            logoResolved: null
                        });
                    }
                    return;
                }

                let resolvedSrc = '';
                try {
                    resolvedSrc = normalizeImageUrl(src);
                } catch (_) {
                    resolvedSrc = src;
                }

                if (!resolvedSrc) {
                    hideImage(resolvedName);
                    if (persist) {
                        writeStoredBranding({
                            brandName: resolvedName,
                            tagline: currentTagline,
                            logoSrc: null,
                            logoResolved: null
                        });
                    }
                    return;
                }

                if (logoImg.dataset.brandSrc !== resolvedSrc) {
                    logoImg.dataset.brandSrc = resolvedSrc;
                    logoWrapper.classList.remove('has-image');
                    logoImg.src = resolvedSrc;
                }

                logoImg.decoding = 'async';
                logoImg.setAttribute('loading', 'lazy');
                logoImg.onload = () => showImage(resolvedName);
                logoImg.onerror = () => hideImage(resolvedName);

                if (logoImg.complete && logoImg.naturalWidth > 0) {
                    showImage(resolvedName);
                }

                if (persist) {
                    writeStoredBranding({
                        brandName: resolvedName,
                        tagline: currentTagline,
                        logoSrc: resolvedSrc,
                        logoResolved: resolvedSrc
                    });
                }
            };

            if (stored) {
                const storedName = typeof stored.brandName === 'string' && stored.brandName.trim()
                    ? stored.brandName.trim()
                    : fallbackName;
                const storedTagline = typeof stored.tagline === 'string' && stored.tagline.trim()
                    ? stored.tagline.trim()
                    : fallbackTagline;

                currentName = storedName;
                currentTagline = storedTagline;
                setTexts(storedName, storedTagline);

                if (storedLogoCandidate) {
                    applyLogoSrc(storedLogoCandidate, storedName, {
                        persist: false,
                        original: storedLogoOriginal || storedLogoResolved || storedLogoCandidate
                    });
                } else {
                    hideImage(storedName, { clearSrc: false });
                }
            } else {
                setTexts(currentName, currentTagline);
                hideImage(currentName, { clearSrc: false });
            }

            try {
                const cfg = await fetchSiteCfg({ force: true });
                const branding = cfg && typeof cfg === 'object' && cfg.branding ? cfg.branding : {};
                const brandNameRaw = branding.brandName != null ? String(branding.brandName).trim() : '';
                const taglineRaw = branding.tagline != null ? String(branding.tagline).trim() : '';
                const logoUrlRaw = branding.logoUrl != null ? String(branding.logoUrl).trim() : '';
                const logoResolvedRaw = branding.logoResolved != null ? String(branding.logoResolved).trim() : '';

                currentName = brandNameRaw || fallbackName;
                currentTagline = taglineRaw || fallbackTagline;

                setTexts(currentName, currentTagline);

                const finalFetchedLogo = logoResolvedRaw || logoUrlRaw;

                if (finalFetchedLogo) {
                    applyLogoSrc(finalFetchedLogo, currentName, {
                        persist: true,
                        original: logoUrlRaw || finalFetchedLogo
                    });
                } else if (storedLogoCandidate) {
                    let resolvedStored = '';
                    try {
                        resolvedStored = normalizeImageUrl(storedLogoCandidate);
                    } catch (_) {
                        resolvedStored = String(storedLogoCandidate || '').trim();
                    }

                    if (resolvedStored) {
                        applyLogoSrc(resolvedStored, currentName, { persist: false });
                        writeStoredBranding({
                            brandName: currentName,
                            tagline: currentTagline,
                            logoSrc: resolvedStored,
                            logoResolved: resolvedStored
                        });
                    } else {
                        hideImage(currentName);
                        writeStoredBranding({
                            brandName: currentName,
                            tagline: currentTagline,
                            logoSrc: null,
                            logoResolved: null
                        });
                    }
                } else {
                    hideImage(currentName);
                    writeStoredBranding({
                        brandName: currentName,
                        tagline: currentTagline,
                        logoSrc: null,
                        logoResolved: null
                    });
                }
            } catch (err) {
                console.warn('載入品牌設定失敗', err);
                if (storedLogoCandidate) {
                    applyLogoSrc(storedLogoCandidate, currentName, {
                        persist: false,
                        original: storedLogoOriginal || storedLogoResolved || storedLogoCandidate
                    });
                }
            }
        }

        function highlightActiveLink() {
            const links = sidebar.querySelectorAll('.client-sidebar-link[href]');
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            links.forEach((link) => {
                const href = link.getAttribute('href') || '';
                const linkPath = href.split('/').pop();
                const isActive = linkPath === currentPath || (linkPath === 'index.html' && currentPath === '');
                link.classList.toggle('is-active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        }

        highlightActiveLink();

        if (shouldStartExpanded) {
            body.classList.add('client-sidebar-expanded');
            body.classList.remove('client-sidebar-collapsed');
            setTriggerExpanded(true);
        } else if (!body.classList.contains('client-sidebar-expanded') && !body.classList.contains('client-sidebar-collapsed')) {
            body.classList.add('client-sidebar-collapsed');
        }

        applyBranding();

        function setTriggerExpanded(expanded) {
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }

        function getFocusableElements() {
            return Array.from(sidebar.querySelectorAll(focusableSelector))
                .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
        }

        function focusFirstElement() {
            const focusables = getFocusableElements();
            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                sidebar.focus();
            }
        }

        function isOverlay() {
            return currentMode === 'overlay';
        }

        function trapKeydown(event) {
            if (!isOverlay()) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closeSidebar();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusables = getFocusableElements();
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement;

            if (event.shiftKey) {
                if (current === first || !focusables.includes(current)) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (current === last) {
                event.preventDefault();
                first.focus();
            }
        }

        function updateMode(force) {
            const nextMode = window.innerWidth < BREAKPOINT ? 'overlay' : 'rail';
            if (!force && nextMode === currentMode) {
                return;
            }
            currentMode = nextMode;
            body.classList.toggle('client-sidebar-overlay', nextMode === 'overlay');

            if (nextMode === 'overlay') {
                // 進入覆蓋模式：不需要桌面外點關閉，確保移除監聽
                document.removeEventListener('click', handleOutsideClick, true);
                outsideClickBound = false;
                if (!body.classList.contains('client-sidebar-expanded')) {
                    closeSidebar({ force: true, restoreFocus: false });
                } else {
                    sidebar.setAttribute('aria-hidden', 'false');
                    if (backdrop) backdrop.hidden = false;
                    body.classList.add('client-menu-open');
                    document.addEventListener('keydown', trapKeydown, true);
                }
            } else {
                sidebar.removeAttribute('aria-hidden');
                body.classList.remove('client-menu-open');
                if (backdrop) backdrop.hidden = true;
                document.removeEventListener('keydown', trapKeydown, true);
                setTriggerExpanded(body.classList.contains('client-sidebar-expanded'));
                // 在桌面 rail 模式，若目前是展開狀態，啟用外點關閉
                if (body.classList.contains('client-sidebar-expanded') && !outsideClickBound) {
                    document.addEventListener('click', handleOutsideClick, true);
                    outsideClickBound = true;
                }
            }
        }

        function handleOutsideClick(event) {
            // 在桌面「rail」模式，只在點擊『內文以外的空白區域』時才收合
            if (isOverlay()) return; // 行動覆蓋模式已用 backdrop 處理
            if (!body.classList.contains('client-sidebar-expanded')) return;
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            // 內文區域（不要關）
            const main = document.querySelector('.client-main');
            const footer = document.querySelector('.client-footer');
            const navbar = document.querySelector('.navbar');

            // 以下區域一律不視為「外部空白」
            if (sidebar.contains(target)) return;            // 側欄本身
            if (button.contains(target)) return;             // 漢堡鈕
            if (main && main.contains(target)) return;       // 主要內容
            if (footer && footer.contains(target)) return;   // 頁尾內容
            if (navbar && navbar.contains(target)) return;   // 上方導覽列

            // 其餘（例如 client-main 左右留白背景）才視為外部空白，收合
            closeSidebar({ restoreFocus: false });
        }

        function openSidebar(options = {}) {
            const overlay = isOverlay();
            body.classList.add('client-sidebar-expanded');
            body.classList.remove('client-sidebar-collapsed');
            setTriggerExpanded(true);
            if (!overlay) {
                writeSidebarPreference('expanded');
                // 桌面模式：開啟時啟用點擊外部關閉
                if (!outsideClickBound) {
                    document.addEventListener('click', handleOutsideClick, true);
                    outsideClickBound = true;
                }
            }

            if (overlay) {
                lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                sidebar.setAttribute('aria-hidden', 'false');
                if (backdrop) backdrop.hidden = false;
                body.classList.add('client-menu-open');
                document.addEventListener('keydown', trapKeydown, true);
            } else {
                sidebar.removeAttribute('aria-hidden');
            }

            if (options.focusSidebar || overlay) {
                focusFirstElement();
            }
        }

        function closeSidebar(options = {}) {
            const overlay = isOverlay();
            const force = options.force === true;

            if (!force && !body.classList.contains('client-sidebar-expanded') && overlay) {
                return;
            }

            body.classList.remove('client-sidebar-expanded');
            body.classList.add('client-sidebar-collapsed');
            setTriggerExpanded(false);
            if (!overlay) {
                writeSidebarPreference('collapsed');
                // 桌面模式：關閉時移除外點監聽
                if (outsideClickBound) {
                    document.removeEventListener('click', handleOutsideClick, true);
                    outsideClickBound = false;
                }
            }

            if (overlay) {
                body.classList.remove('client-menu-open');
                sidebar.setAttribute('aria-hidden', 'true');
                if (backdrop) backdrop.hidden = true;
                document.removeEventListener('keydown', trapKeydown, true);
                if (options.restoreFocus !== false) {
                    const target = lastFocused || button;
                    if (target && typeof target.focus === 'function') {
                        target.focus();
                    }
                }
            }
        }

        function toggleSidebar() {
            if (body.classList.contains('client-sidebar-expanded')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        }

        button.addEventListener('click', (event) => {
            event.preventDefault();
            toggleSidebar();
        });

        if (backdrop) {
            backdrop.addEventListener('click', () => closeSidebar());
        }

        sidebar.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('[data-client-menu-close]') : null;
            if (target && isOverlay()) {
                closeSidebar({ restoreFocus: false });
            }
        });

        sidebar.querySelectorAll('a[href], button').forEach((el) => {
            el.addEventListener('click', () => {
                if (isOverlay()) {
                    closeSidebar({ restoreFocus: false });
                }
            });
        });

        window.addEventListener('resize', () => {
            const wasOverlay = isOverlay();
            updateMode();
            if (wasOverlay && !isOverlay()) {
                sidebar.removeAttribute('aria-hidden');
            }
        });

        updateMode(true);
        // 初始載入後：若是桌面 rail 且側欄為展開狀態，補上外點關閉監聽
        if (!isOverlay() && body.classList.contains('client-sidebar-expanded') && !outsideClickBound) {
            document.addEventListener('click', handleOutsideClick, true);
            outsideClickBound = true;
        }

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    body.classList.add('client-sidebar-animate');
                });
            });
        } else {
            body.classList.add('client-sidebar-animate');
        }
    });
})();
