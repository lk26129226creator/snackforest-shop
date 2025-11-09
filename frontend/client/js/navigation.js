(function () {
    // 導覽列與側欄的入口腳本：負責客戶端頁面共用的搜尋、購物車、支援資訊與側欄互動。
    /** @constant BREAKPOINT 行動與桌面切換視窗寬度，單位為 px。 */
    const BREAKPOINT = 992;
    /** @constant utils 客戶端共用工具函式集合（由 core.js 暴露）。 */
    const utils = window.SF_UTILS || {};
    /** @constant env 透過 env.js 注入的環境設定（API_BASE 等）。 */
    const env = window.SF_ENV || {};
    /** @constant LOCAL_HOSTS 開發時需要特殊處理的本機主機名清單。 */
    const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

    /**
     * 解析輸入字串並安全地回傳其 origin，確保任何例外都會被吞掉以避免中斷流程。
     * @param {string} value 可能是完整 URL 或部分路徑。
     * @returns {string} 合法的 origin，或空字串。
     */
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

    function originFrom(value) {
        if (!value) return '';
        try {
            const base = window.location && window.location.origin ? window.location.origin : undefined;
            return new URL(String(value), base).origin;
        } catch (_) {
            return '';
        }
    }

    /**
     * 依序判斷環境變數與瀏覽器當前來源，推導出前端要呼叫的 API 來源位址。
     * 優先使用 env.API_ORIGIN，若偵測到本機與部署主機混搭則會自動修正。
     */
    const apiOrigin = (() => {
        const runtimeBase = typeof window !== 'undefined' && window.SF_API_BASE ? window.SF_API_BASE : '';
        const runtimeOrigin = typeof window !== 'undefined' && window.SF_API_ORIGIN ? window.SF_API_ORIGIN : '';
        const preferred = env.API_ORIGIN || runtimeOrigin || runtimeBase;
        const envOrigin = getOriginSafe(preferred);
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

    const storageOrigin = (() => {
        const envStorage = getOriginSafe(env.STORAGE_ORIGIN);
        const runtimeStorage = typeof window !== 'undefined' ? getOriginSafe(window.SF_STORAGE_BASE) : '';
        if (envStorage) return envStorage;
        if (runtimeStorage) return runtimeStorage;
        const fallback = originFrom(env.API_BASE) || apiOrigin;
        return fallback;
    })();

    /**
     * 將開發時硬編成 localhost 的網址調整為目前網站的來源，避免跨來源問題。
     * @param {string} url 需要修正的網址。
     * @returns {string} 經過同源調整後的絕對網址。
     */
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

    /**
     * 清理圖片來源字串：若是 data scheme 或 HTTP(S) 以外的自訂格式，盡量保留原始內容。
     * 若來源指向本機伺服器，會改為相對路徑以便部署。
     */
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

    /**
     * 供商品圖片與大頭貼共用的圖片 URL 標準化邏輯：支援 data URL、本機產品圖與上傳圖。
     * 會優先呼叫 utils.normalizeImageUrl，否則自行推導路徑。
     */
    const normalizeImageUrl = typeof utils.normalizeImageUrl === 'function'
        ? (value) => adjustToCurrentOrigin(utils.normalizeImageUrl(value))
        : (value) => {
            if (!value) return '';
            const raw = String(value).trim();
            if (!raw) return '';
            if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
                if (/\/api\/uploads\//i.test(raw)) {
                    const adjusted = raw.replace(/\/api(?=\/uploads\/)/gi, '');
                    return adjustToCurrentOrigin(adjusted);
                }
                return adjustToCurrentOrigin(raw);
            }

            let path;
            if (raw.startsWith('/')) {
                path = raw;
            } else if (raw.startsWith('./')) {
                path = raw.replace(/^\.\/+/,'/');
            } else if (/^uploads\//i.test(raw)) {
                path = `/${raw}`;
            } else if (raw.startsWith('frontend/')) {
                path = `/${raw}`;
            } else if (raw.startsWith('images/')) {
                path = `/frontend/${raw}`;
            } else {
                path = `/frontend/images/products/${raw}`;
            }

            if (path.startsWith('/uploads/')) {
                const base = storageOrigin || apiOrigin || getOriginSafe(window.location && window.location.origin);
                if (base) {
                    return adjustToCurrentOrigin(base.replace(/\/$/, '') + path);
                }
            }

            if (path.startsWith('/frontend/')) {
                const siteOrigin = getOriginSafe(window.location && window.location.origin) || apiOrigin;
                if (siteOrigin) {
                    return adjustToCurrentOrigin(siteOrigin.replace(/\/$/, '') + path);
                }
            }

            if (apiOrigin) {
                return adjustToCurrentOrigin(apiOrigin.replace(/\/$/, '') + path);
            }
            return path;
        };

    /**
     * 共用的價格格式化函式，確保畫面上的金額皆以 NT$ 與千分位顯示。
     */
    const formatPrice = typeof utils.formatPrice === 'function'
        ? (value) => utils.formatPrice(value)
        : (value) => {
            const num = Number(value || 0);
            return Number.isFinite(num) ? 'NT$' + num.toLocaleString('zh-TW') : String(value || '');
        };

    /**
     * 換算 API Base URL：若 env 內已設置則沿用，否則使用目前來源加上 /api。
     */
    const API_BASE = (() => {
        if (env && typeof env.API_BASE === 'string' && env.API_BASE.trim()) {
            return env.API_BASE.trim();
        }
        if (apiOrigin) {
            return apiOrigin.replace(/\/$/, '') + '/api';
        }
        return '/api';
    })();

    /** 輪播優惠輪替時間（毫秒）。 */
    const PROMO_ROTATION_MS = 8000;
    /** 輪播淡入淡出動畫時間（毫秒）。 */
    const PROMO_FADE_MS = 320;
    /** 快取站台設定內容，避免每次開啟都重抓。 */
    let navSiteConfigCache = null;
    /** 紀錄正在進行中的設定抓取 Promise，避免重複發送。 */
    let navSiteConfigPromise = null;

    /** 取得 site-config 的通用函式：若窗口引入了 fetchSiteConfig 則沿用。 */
    const fetchSiteCfg = typeof window.fetchSiteConfig === 'function'
        ? window.fetchSiteConfig
        : async () => ({});

    /**
     * 載入站台設定，支援強制重新載入（force = true）。
     * @param {boolean} [force=false] 是否強制忽略快取。
     * @returns {Promise<Object>}
     */
    async function loadNavSiteConfig(force) {
        if (force === true) {
            try {
                const fresh = await fetchSiteCfg({ force: true });
                navSiteConfigCache = fresh && typeof fresh === 'object' ? fresh : {};
            } catch (e) {
                if (!navSiteConfigCache) navSiteConfigCache = {};
            }
            return navSiteConfigCache;
        }

        if (navSiteConfigCache) {
            return navSiteConfigCache;
        }

        if (!navSiteConfigPromise) {
            navSiteConfigPromise = (async () => {
                try {
                    const data = await fetchSiteCfg();
                    navSiteConfigCache = data && typeof data === 'object' ? data : {};
                } catch (e) {
                    if (!navSiteConfigCache) navSiteConfigCache = {};
                } finally {
                    navSiteConfigPromise = null;
                }
                return navSiteConfigCache;
            })();
        }

        return navSiteConfigPromise;
    }

    /** localStorage key：儲存品牌標誌顏色與字樣。 */
    const BRANDING_STORAGE_KEY = 'sf-client-branding';
    /** localStorage key：記錄側欄展開/收合偏好。 */
    const SIDEBAR_STATE_KEY = 'sf-client-sidebar-state';
    /** localStorage key：候選的會員名稱欄位。 */
    const MEMBER_NAME_KEYS = ['sf-client-name', 'customerName', 'userName'];
    /** localStorage key：候選的會員編號欄位。 */
    const MEMBER_ID_KEYS = ['sf-client-id', 'customerId'];
    /** localStorage key：會員大頭貼圖片位置。 */
    const MEMBER_AVATAR_KEY = 'sf-client-avatar';
    const MEMBER_AVATAR_RESOLVED_KEY = 'sf-client-avatar-resolved';
    /** Profile 更新事件名稱：用於跨頁同步會員資訊。 */
    const PROFILE_UPDATE_EVENT = 'sf:profile-updated';
    const PROFILE_SYNC_TIMESTAMP_KEY = 'sf-client-profile-sync';
    const PROFILE_VERSION_KEY = 'sf-client-profile-version';
    const PROFILE_SYNC_TTL_MS = 30 * 1000;
    let updateSidebarProfileProxy = null;

    /** 行動版搜尋覆蓋層觸發函式（於 initNavSearch 內初始化）。 */
    let openSearchOverlayFn = null;
    /** 行動版搜尋覆蓋層關閉函式，供其他模組必要時呼叫。 */
    let closeSearchOverlayFn = null;

    /**
     * 嘗試從 localStorage 讀取品牌設定，若解析失敗則回傳 null。
     * @returns {?Object}
     */
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

    /**
     * 將品牌設定寫回 localStorage；若 payload 為 falsy 則清除資料。
     * @param {?Object} payload 品牌設定物件。
     */
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

    /**
     * 讀取使用者針對側欄展開/收合的偏好。
     * @returns {?string}
     */
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

    /**
     * 儲存側欄偏好：接受 'expanded' 或 'collapsed'，其他值會清除設定。
     * @param {string} state 側欄狀態字串。
     */
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

    /**
     * 將顯示名稱轉換為首字母組合（支援多語），供大頭貼預設文字使用。
     * @param {string} name 顯示名稱。
     * @returns {string}
     */
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

    /**
     * 安全去除兩側空白，對 null/undefined 回傳空字串。
     * @param {*} value 輸入值。
     * @returns {string}
     */
    function safeTrim(value) {
        if (value == null) return '';
        return String(value).trim();
    }

    function sanitizeUploadUrl(value) {
        const trimmed = safeTrim(value);
        if (!trimmed) return '';
        let sanitized = trimmed.replace(/\/api(?=\/uploads\/)/gi, '');
        sanitized = sanitized.replace(/^api(?=\/uploads\/)/i, '');
        sanitized = sanitized.replace(/^\.\/(?=uploads\/)/i, '/');
        sanitized = sanitized.replace(/^\/{2,}(?=uploads\/)/i, '/');
        return sanitized;
    }

    /**
     * 從 localStorage 蒐集目前登入會員的名稱、編號與頭像。
     * @returns {{name:string,id:string,avatar:string}}
     */
    function readStoredMemberMeta() {
        const meta = { name: '', id: '', avatar: '' };
        try {
            if (!('localStorage' in window)) return meta;
        } catch (_) {
            return meta;
        }

        try {
            const store = window.localStorage;
            for (const key of MEMBER_NAME_KEYS) {
                if (meta.name) break;
                const candidate = safeTrim(store.getItem(key));
                if (candidate) meta.name = candidate;
            }

            for (const key of MEMBER_ID_KEYS) {
                if (meta.id) break;
                const candidate = safeTrim(store.getItem(key));
                if (candidate) meta.id = candidate;
            }

            const resolvedCandidate = safeTrim(store.getItem(MEMBER_AVATAR_RESOLVED_KEY));
            const avatarCandidate = safeTrim(store.getItem(MEMBER_AVATAR_KEY));
            const preferred = resolvedCandidate || avatarCandidate;
            if (preferred) {
                const sanitized = sanitizeUploadUrl(preferred);
                if (sanitized && sanitized !== avatarCandidate) {
                    try {
                        store.setItem(MEMBER_AVATAR_KEY, sanitized);
                    } catch (_) {
                        // ignore storage rewrite errors
                    }
                }
                meta.avatar = resolvedCandidate || sanitized || avatarCandidate;
            }
        } catch (_) {
            // 忽略存取錯誤（例如隱私模式）
        }

        return meta;
    }

    function readProfileSyncTimestamp() {
        try {
            const raw = window.localStorage.getItem(PROFILE_SYNC_TIMESTAMP_KEY);
            if (!raw) return 0;
            const value = Number(raw);
            return Number.isFinite(value) ? value : 0;
        } catch (_) {
            return 0;
        }
    }

    function writeProfileSyncTimestamp(value) {
        try {
            if (!value) {
                window.localStorage.removeItem(PROFILE_SYNC_TIMESTAMP_KEY);
            } else {
                window.localStorage.setItem(PROFILE_SYNC_TIMESTAMP_KEY, String(value));
            }
        } catch (_) {
            // ignore storage errors
        }
    }

    function readStoredProfileVersion() {
        try {
            return safeTrim(window.localStorage.getItem(PROFILE_VERSION_KEY));
        } catch (_) {
            return '';
        }
    }

    function writeStoredProfileVersion(value) {
        try {
            const trimmed = safeTrim(value);
            if (trimmed) {
                window.localStorage.setItem(PROFILE_VERSION_KEY, trimmed);
            } else {
                window.localStorage.removeItem(PROFILE_VERSION_KEY);
            }
        } catch (_) {
            // ignore storage errors
        }
    }

    function resolveProfileAvatarCandidate(list) {
        if (!Array.isArray(list)) return '';
        for (const candidate of list) {
            const trimmed = sanitizeUploadUrl(candidate);
            if (!trimmed) continue;
            const lowered = trimmed.toLowerCase();
            if (lowered === 'null' || lowered === 'undefined') continue;
            let resolved = trimmed;
            try {
                resolved = normalizeImageUrl(trimmed);
            } catch (_) {
                resolved = adjustToCurrentOrigin(trimmed);
            }
            if (resolved) return resolved;
        }
        return '';
    }

    async function fetchProfileById(customerId) {
        if (!customerId) return null;
        const endpointBase = API_BASE.replace(/\/$/, '');
        const endpoint = `${endpointBase}/customer-profile/${encodeURIComponent(customerId)}`;
        try {
            const res = await fetch(endpoint, { cache: 'no-store', credentials: 'include' });
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.warn('Nav profile fetch failed', err);
            return null;
        }
    }

    async function refreshMemberProfile(options = {}) {
        const force = options && options.force === true;
        const stored = readStoredMemberMeta();
        const memberId = stored.id;
        if (!memberId) return;

        const lastSync = readProfileSyncTimestamp();
        if (!force && lastSync && (Date.now() - lastSync) < PROFILE_SYNC_TTL_MS) {
            return;
        }

        let profile = await fetchProfileById(memberId);
        if (!profile && window.api && typeof window.api.getCustomerProfile === 'function') {
            try {
                const fallbackRes = await window.api.getCustomerProfile(memberId);
                if (fallbackRes && fallbackRes.success) {
                    profile = fallbackRes.data || null;
                }
            } catch (_) {
                // ignore fallback errors
            }
        }
        if (profile && typeof profile === 'object' && !profile.customerId) {
            profile.customerId = memberId;
        }

        if (!profile || typeof profile !== 'object') {
            if (force) writeProfileSyncTimestamp(0);
            return;
        }

        const displayName = safeTrim(profile.displayName || profile.name || stored.name);
        const avatarUrl = resolveProfileAvatarCandidate([
            profile.avatarUrlResolved,
            profile.avatarUrl,
            profile.avatarUrlOriginal,
            profile.avatar,
            profile.avatarPath,
            stored.avatar
        ]);
        const customerId = safeTrim(profile.customerId || memberId);
        const updatedAt = safeTrim(profile.updatedAt || readStoredProfileVersion());

        let sanitizedAvatar = '';
        try {
            if (displayName) {
                window.localStorage.setItem('sf-client-name', displayName);
            } else {
                window.localStorage.removeItem('sf-client-name');
            }
            if (customerId) {
                window.localStorage.setItem('sf-client-id', customerId);
            } else {
                window.localStorage.removeItem('sf-client-id');
            }
            sanitizedAvatar = sanitizeUploadUrl(avatarUrl);
            if (sanitizedAvatar) {
                window.localStorage.setItem(MEMBER_AVATAR_KEY, sanitizedAvatar);
                window.localStorage.setItem(
                    MEMBER_AVATAR_RESOLVED_KEY,
                    avatarUrl || sanitizedAvatar
                );
            } else {
                window.localStorage.removeItem(MEMBER_AVATAR_KEY);
                window.localStorage.removeItem(MEMBER_AVATAR_RESOLVED_KEY);
            }
            writeProfileSyncTimestamp(Date.now());
            writeStoredProfileVersion(updatedAt);
        } catch (_) {
            // ignore storage failures
        }

        if (typeof updateSidebarProfileProxy === 'function') {
            updateSidebarProfileProxy({
                name: displayName,
                avatarUrlResolved: avatarUrl,
                avatarUrl: sanitizedAvatar,
                customerId
            });
        }

        try {
            window.dispatchEvent(new CustomEvent(PROFILE_UPDATE_EVENT, {
                detail: {
                    name: displayName,
                    avatarUrl: sanitizedAvatar,
                    avatarUrlResolved: avatarUrl,
                    customerId
                }
            }));
            window.dispatchEvent(new CustomEvent('avatar-updated', {
                detail: {
                    name: displayName,
                    avatarUrl: sanitizedAvatar,
                    avatarUrlResolved: avatarUrl,
                    customerId
                }
            }));
        } catch (_) {
            // ignore event dispatch failures
        }
    }

    /**
     * DOMContentLoaded 封裝：確保所傳函式於文件準備完成後才執行。
     */
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    /**
     * 將 site-config 內的 promotions 轉為陣列，並過濾掉重複或空白資訊。
     * @param {Object} cfg 站台設定物件。
     * @returns {Array<{text:string,href:?string}>}
     */
    function collectPromoItems(cfg) {
        const items = [];
        const promoSource = cfg && Array.isArray(cfg.promotions) ? cfg.promotions : [];

        promoSource.forEach((entry) => {
            if (!entry) return;
            if (typeof entry === 'string') {
                const text = entry.trim();
                if (text) items.push({ text, href: null });
                return;
            }
            if (typeof entry === 'object') {
                const text = String(entry.text || entry.title || '').trim();
                if (!text) return;
                const hrefRaw = typeof entry.href === 'string' ? entry.href : (typeof entry.link === 'string' ? entry.link : entry.url);
                const href = hrefRaw && typeof hrefRaw === 'string' && hrefRaw.trim() ? hrefRaw.trim() : null;
                items.push({ text, href });
            }
        });

        const unique = [];
        const seen = new Set();
        items.forEach((item) => {
            if (!item.text || seen.has(item.text)) return;
            seen.add(item.text);
            unique.push(item);
        });

        if (unique.length) return unique;

        return [
            { text: '全館滿 NT$999 免運', href: 'product.html' },
            { text: '加入會員立即享 95 折優惠', href: 'member.html' },
            { text: '最新上架零食！把握限量好味道', href: 'product.html?category=all' }
        ];
    }

    /**
     * 根據優惠文字計算 promo 按鈕所需寬度，確保輪播時不會跳動。
     * @param {Array<{text:string}>} promos 優惠項目。
     * @param {HTMLElement} promoEl 跑馬燈元素。
     * @returns {?number}
     */
    function resolvePromoWidth(promos, promoEl) {
        if (!promoEl || !Array.isArray(promos) || promos.length === 0) {
            return null;
        }
        if (typeof document === 'undefined' || !document.body) {
            return null;
        }

        const probe = promoEl.cloneNode(true);
        probe.removeAttribute('id');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.left = '-9999px';
        probe.style.top = '-9999px';
        probe.style.width = 'auto';
        probe.style.minWidth = '0';
        probe.style.maxWidth = 'none';
        probe.dataset.state = '';

        const textEl = probe.querySelector('[data-promo-text]');
        if (!textEl) {
            return null;
        }

        document.body.appendChild(probe);

        let maxWidth = 0;
        promos.forEach((item) => {
            textEl.textContent = item.text;
            const width = probe.offsetWidth;
            if (width > maxWidth) maxWidth = width;
        });

        probe.remove();

        if (!maxWidth) {
            return null;
        }

        const padded = Math.ceil(maxWidth + 12);
        const MIN_WIDTH = 260;
        const MAX_WIDTH = 420;
        return Math.max(MIN_WIDTH, Math.min(padded, MAX_WIDTH));
    }

    /**
     * 初始化頂部優惠跑馬燈：沒有資料時隱藏按鈕，並套用最佳寬度。
     * @param {Object} cfg 站台設定。
     */
    function hydratePromoTicker(cfg) {
        const promoEl = document.getElementById('client-topbar-promo');
        if (!promoEl) return;
        const textEl = promoEl.querySelector('[data-promo-text]');
        if (!textEl) return;

        const promos = collectPromoItems(cfg);
        if (!promos || promos.length === 0) {
            if (typeof document !== 'undefined' && document.documentElement) {
                document.documentElement.style.removeProperty('--client-topbar-promo-width');
            }
            promoEl.hidden = true;
            return;
        }

        const resolvedWidth = resolvePromoWidth(promos, promoEl);
        if (typeof document !== 'undefined' && document.documentElement) {
            if (resolvedWidth) {
                document.documentElement.style.setProperty('--client-topbar-promo-width', resolvedWidth + 'px');
                promoEl.style.minWidth = resolvedWidth + 'px';
                promoEl.style.maxWidth = resolvedWidth + 'px';
                promoEl.style.width = resolvedWidth + 'px';
            } else {
                document.documentElement.style.removeProperty('--client-topbar-promo-width');
                promoEl.style.removeProperty('min-width');
                promoEl.style.removeProperty('max-width');
                promoEl.style.removeProperty('width');
            }
        }

        let index = 0;
        let rotating = false;

        function applyItem(item) {
            if (!item) return;
            textEl.textContent = item.text;
            if (item.href) {
                promoEl.dataset.href = item.href;
                promoEl.setAttribute('aria-label', `查看優惠：${item.text}`);
            } else {
                delete promoEl.dataset.href;
                promoEl.setAttribute('aria-label', item.text);
            }
        }

        function tick() {
            if (promos.length <= 1 || rotating) return;
            rotating = true;
            promoEl.dataset.state = 'leave';
            window.setTimeout(() => {
                index = (index + 1) % promos.length;
                applyItem(promos[index]);
                promoEl.dataset.state = 'enter';
                window.setTimeout(() => {
                    delete promoEl.dataset.state;
                    rotating = false;
                }, PROMO_FADE_MS);
            }, PROMO_FADE_MS);
        }

        applyItem(promos[0]);
        promoEl.hidden = false;
        promoEl.dataset.state = 'enter';
        window.setTimeout(() => delete promoEl.dataset.state, PROMO_FADE_MS);

        if (promos.length > 1) {
            window.setInterval(tick, PROMO_ROTATION_MS);
        }

        promoEl.addEventListener('click', () => {
            const current = promos[index];
            if (current && current.href) {
                window.location.href = current.href;
            }
        });

        promoEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const current = promos[index];
                if (current && current.href) {
                    window.location.href = current.href;
                }
            }
        });
    }

    /**
     * 初始化頂部搜尋列：負責即時搜尋商品、顯示結果面板與鍵盤操作。
     */
    function initNavSearch() {
        const form = document.getElementById('client-nav-search');
        const input = document.getElementById('client-nav-search-input');
        const resultsPanel = document.getElementById('client-nav-search-results');
        if (!form || !input || !resultsPanel) return;
        const resultsWrap = resultsPanel.querySelector('[data-results]');
        const emptyEl = resultsPanel.querySelector('[data-empty]');
        if (!resultsWrap) return;

        if (form.dataset.bound === '1') {
            return;
        }
        form.dataset.bound = '1';

        const bodyEl = document.body;
        const overlay = ensureSearchOverlay();
        const overlayForm = overlay ? overlay.querySelector('[data-mobile-search-form]') : null;
        const overlayInput = overlay ? overlay.querySelector('[data-mobile-search-input]') : null;
        const overlayResultsWrap = overlay ? overlay.querySelector('[data-mobile-search-results]') : null;
        const overlayEmpty = overlay ? overlay.querySelector('[data-mobile-search-empty]') : null;
        const overlayDismissNodes = overlay ? overlay.querySelectorAll('[data-mobile-search-dismiss]') : [];
        let overlayOpen = false;

        const MIN_QUERY = 2;
        let productsPromise = null;
        let queryToken = 0;
        let lastResults = [];

        function ensureSearchOverlay() {
            let existing = document.getElementById('client-search-overlay');
            if (existing) return existing;

            const overlayEl = document.createElement('div');
            overlayEl.id = 'client-search-overlay';
            overlayEl.className = 'client-search-overlay';
            overlayEl.setAttribute('hidden', 'hidden');
            overlayEl.innerHTML = `
                <div class="client-search-overlay-backdrop" data-mobile-search-dismiss aria-hidden="true"></div>
                <div class="client-search-overlay-panel" role="dialog" aria-modal="true" aria-label="搜尋商品">
                    <div class="client-search-overlay-header">
                        <button type="button" class="client-search-overlay-close" data-mobile-search-dismiss aria-label="關閉搜尋">
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                        <form class="client-search-overlay-form" data-mobile-search-form role="search">
                            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                            <label class="visually-hidden" for="client-search-overlay-input">搜尋商品</label>
                            <input type="search" id="client-search-overlay-input" data-mobile-search-input placeholder="搜尋商品或輸入熱門關鍵字" autocomplete="off" inputmode="search" enterkeyhint="search">
                            <button type="submit" aria-label="開始搜尋">
                                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                            </button>
                        </form>
                    </div>
                    <div class="client-search-overlay-body">
                        <div class="client-search-overlay-empty" data-mobile-search-empty>輸入關鍵字即可尋找商品</div>
                        <div class="client-search-overlay-results" data-mobile-search-results role="listbox"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlayEl);
            return overlayEl;
        }

        function syncQueryValue(source, value) {
            if (input && source !== input && input.value !== value) {
                input.value = value;
            }
            if (overlayInput && source !== overlayInput && overlayInput.value !== value) {
                overlayInput.value = value;
            }
        }

        function handleOverlayKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeOverlay({ restoreFocus: true });
            }
        }

        function openOverlay(options = {}) {
            if (!overlay) return;
            hideResults();
            if (!overlayOpen) {
                overlay.hidden = false;
                overlay.setAttribute('aria-hidden', 'false');
                bodyEl.classList.add('client-search-open');
                overlayOpen = true;
                document.addEventListener('keydown', handleOverlayKeydown, true);
            }
            const query = typeof options.query === 'string' ? options.query : (input ? input.value : '');
            syncQueryValue(null, query);
            renderOverlayResults(lastResults);
            if (overlayEmpty) {
                if (!lastResults.length) {
                    overlayEmpty.hidden = false;
                    overlayEmpty.textContent = query && query.length >= MIN_QUERY
                        ? '找不到符合的商品'
                        : '輸入關鍵字即可尋找商品';
                } else {
                    overlayEmpty.hidden = true;
                }
            }
            if (options.focus !== false && overlayInput) {
                setTimeout(() => {
                    try {
                        overlayInput.focus({ preventScroll: true });
                    } catch (_) {
                        overlayInput.focus();
                    }
                }, 20);
            }
        }

        function closeOverlay({ restoreFocus } = {}) {
            if (!overlay || !overlayOpen) return;
            overlay.hidden = true;
            overlay.setAttribute('aria-hidden', 'true');
            bodyEl.classList.remove('client-search-open');
            overlayOpen = false;
            document.removeEventListener('keydown', handleOverlayKeydown, true);
            if (restoreFocus && input) {
                setTimeout(() => {
                    try {
                        input.focus({ preventScroll: true });
                    } catch (_) {
                        input.focus();
                    }
                }, 20);
            }
        }

        function normalizeProduct(product) {
            const rawId = product.id ?? product.idProducts ?? product.idProduct ?? product.id_products ?? product.idproducts;
            const id = rawId != null ? String(rawId) : '';
            const name = String(product.name || product.ProductName || product.productName || '').trim();
            const priceValue = product.price !== undefined ? product.price : (product.Price !== undefined ? product.Price : 0);
            const categoryName = String(product.categoryName || product.category || product.CategoryName || product.categoryname || '').trim();
            let image = '';
            if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
                image = product.imageUrls[0];
            } else if (Array.isArray(product.ImageUrls) && product.ImageUrls.length > 0) {
                image = product.ImageUrls[0];
            } else if (product.imageUrl) {
                image = product.imageUrl;
            }
            return {
                id,
                name,
                price: Number(priceValue) || 0,
                categoryName,
                imageUrl: image ? normalizeImageUrl(image) : ''
            };
        }

        function fetchProducts() {
            if (!productsPromise) {
                productsPromise = fetch(API_BASE + '/products', { cache: 'no-store' })
                    .then((res) => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.json();
                    })
                    .then((data) => Array.isArray(data) ? data.map(normalizeProduct) : [])
                    .catch((err) => {
                        console.warn('Nav search: failed to load products', err);
                        return [];
                    });
            }
            return productsPromise;
        }

        function hideResults() {
            resultsPanel.hidden = true;
            document.removeEventListener('click', handleOutsideClick, true);
        }

        function showResults() {
            if (overlayOpen) return;
            resultsPanel.hidden = false;
            document.addEventListener('click', handleOutsideClick, true);
        }

        function handleOutsideClick(event) {
            const target = event.target instanceof Node ? event.target : null;
            if (!target) return;
            if (form.contains(target)) return;
            if (overlay && overlay.contains(target)) return;
            hideResults();
        }

        function renderResults(items) {
            resultsWrap.innerHTML = '';
            if (!items.length) {
                if (emptyEl) {
                    emptyEl.hidden = false;
                    emptyEl.textContent = '找不到符合的商品';
                }
                showResults();
                return;
            }

            if (emptyEl) emptyEl.hidden = true;

            items.forEach((item) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'client-nav-search-item';
                button.setAttribute('data-product-id', item.id);
                button.setAttribute('role', 'option');

                if (item.imageUrl) {
                    const thumb = document.createElement('img');
                    thumb.src = item.imageUrl;
                    thumb.alt = '';
                    thumb.loading = 'lazy';
                    thumb.className = 'client-nav-search-thumb';
                    button.appendChild(thumb);
                }

                const content = document.createElement('div');
                content.className = 'flex-grow-1';

                const title = document.createElement('span');
                title.className = 'client-nav-search-item-title';
                title.textContent = item.name;

                const meta = document.createElement('span');
                meta.className = 'client-nav-search-item-meta';
                const categoryMeta = item.categoryName ? `${item.categoryName} · ` : '';
                meta.textContent = categoryMeta + formatPrice(item.price);

                content.appendChild(title);
                content.appendChild(meta);

                button.appendChild(content);

                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-arrow-right';
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);

                button.addEventListener('click', () => {
                    closeOverlay();
                    if (item.id) {
                        window.location.href = 'product.html?id=' + encodeURIComponent(item.id);
                    } else {
                        window.location.href = 'product.html';
                    }
                });

                resultsWrap.appendChild(button);
            });

            showResults();
        }

        function renderOverlayResults(items) {
            if (!overlayResultsWrap) return;
            overlayResultsWrap.innerHTML = '';
            if (!items.length) {
                if (overlayEmpty) {
                    const query = overlayInput ? overlayInput.value.trim() : (input ? input.value.trim() : '');
                    overlayEmpty.hidden = false;
                    overlayEmpty.textContent = query.length >= MIN_QUERY
                        ? '找不到符合的商品'
                        : '輸入關鍵字即可尋找商品';
                }
                return;
            }

            if (overlayEmpty) overlayEmpty.hidden = true;

            items.forEach((item) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'client-search-overlay-item';
                button.setAttribute('data-product-id', item.id);
                button.setAttribute('role', 'option');

                const thumb = document.createElement('div');
                thumb.className = 'client-search-overlay-thumb';
                if (item.imageUrl) {
                    const img = document.createElement('img');
                    img.src = item.imageUrl;
                    img.alt = item.name || '商品';
                    img.loading = 'lazy';
                    thumb.appendChild(img);
                } else {
                    thumb.classList.add('is-placeholder');
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-box-open';
                    icon.setAttribute('aria-hidden', 'true');
                    thumb.appendChild(icon);
                }
                button.appendChild(thumb);

                const info = document.createElement('div');
                info.className = 'client-search-overlay-info';

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = item.name;

                const meta = document.createElement('div');
                meta.className = 'meta';
                const categoryMeta = item.categoryName ? `${item.categoryName} · ` : '';
                meta.textContent = categoryMeta + formatPrice(item.price);

                info.appendChild(title);
                info.appendChild(meta);
                button.appendChild(info);

                const chevron = document.createElement('i');
                chevron.className = 'fa-solid fa-chevron-right';
                chevron.setAttribute('aria-hidden', 'true');
                button.appendChild(chevron);

                button.addEventListener('click', () => {
                    closeOverlay();
                    if (item.id) {
                        window.location.href = 'product.html?id=' + encodeURIComponent(item.id);
                    } else {
                        window.location.href = 'product.html';
                    }
                });

                overlayResultsWrap.appendChild(button);
            });
        }

        async function handleQueryChange(sourceInput) {
            const source = sourceInput && typeof sourceInput.value === 'string' ? sourceInput : input;
            const query = source ? source.value.trim() : '';
            syncQueryValue(source, query);
            const token = ++queryToken;

            if (query.length < MIN_QUERY) {
                lastResults = [];
                hideResults();
                if (emptyEl) emptyEl.hidden = true;
                renderOverlayResults([]);
                if (overlayEmpty) {
                    overlayEmpty.hidden = false;
                    overlayEmpty.textContent = query ? '請再輸入至少 2 個字' : '輸入關鍵字即可尋找商品';
                }
                return;
            }

            const products = await fetchProducts();
            if (token !== queryToken) return;

            const lowered = query.toLowerCase();
            const matches = products
                .filter((item) => {
                    if (!item.name) return false;
                    if (item.name.toLowerCase().includes(lowered)) return true;
                    if (item.categoryName && item.categoryName.toLowerCase().includes(lowered)) return true;
                    return false;
                })
                .slice(0, 8);

            lastResults = matches;
            renderResults(matches);
            renderOverlayResults(matches);
        }

        input.addEventListener('input', () => {
            handleQueryChange(input);
        });

        input.addEventListener('focus', () => {
            if (window.innerWidth < BREAKPOINT) {
                openOverlay({ query: input.value, focus: true });
                return;
            }
            if (input.value.trim().length >= MIN_QUERY && resultsWrap.children.length > 0) {
                showResults();
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                hideResults();
            }
        });

        if (overlayInput) {
            overlayInput.addEventListener('input', () => {
                handleQueryChange(overlayInput);
            });
            overlayInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeOverlay({ restoreFocus: true });
                }
            });
        }

        resultsPanel.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                hideResults();
                if (input) {
                    input.focus();
                }
            }
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const query = input.value.trim();
            if (!query) {
                hideResults();
                return;
            }
            window.location.href = 'product.html?search=' + encodeURIComponent(query);
            hideResults();
            closeOverlay();
        });

        if (overlayForm && !overlayForm.dataset.bound) {
            overlayForm.dataset.bound = '1';
            overlayForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const query = overlayInput ? overlayInput.value.trim() : '';
                if (!query) {
                    if (overlayEmpty) {
                        overlayEmpty.hidden = false;
                        overlayEmpty.textContent = '輸入關鍵字即可尋找商品';
                    }
                    return;
                }
                window.location.href = 'product.html?search=' + encodeURIComponent(query);
                closeOverlay();
            });
        }

        if (overlay && !overlay.dataset.dismissBound) {
            overlay.dataset.dismissBound = '1';
            overlayDismissNodes.forEach((node) => {
                node.addEventListener('click', (event) => {
                    event.preventDefault();
                    closeOverlay({ restoreFocus: true });
                });
            });
        }

        window.addEventListener('resize', () => {
            if (overlayOpen && window.innerWidth >= BREAKPOINT) {
                closeOverlay();
            }
        });

        openSearchOverlayFn = (options) => openOverlay(options || {});
        closeSearchOverlayFn = (options) => closeOverlay(options || {});
    }

    /**
     * 初始化導覽列購物車快覽：讀取 cart.js 共用狀態並顯示商品摘要。
     */
    function initCartPreview() {
        const toggle = document.getElementById('client-cart-button');
        const panel = document.getElementById('client-cart-panel');
        const wrapper = document.getElementById('client-nav-cart');
        if (!toggle || !panel || !wrapper) return;

        const itemsContainer = panel.querySelector('[data-cart-items]');
        const emptyState = panel.querySelector('[data-cart-empty]');
        const totalRow = panel.querySelector('[data-cart-total]');
        const totalAmount = panel.querySelector('[data-cart-total-amount]');
        const viewAllBtn = panel.querySelector('[data-nav-cart-action="view-cart"]');

        let open = false;

        if (toggle.dataset.previewBound === '1') {
            return;
        }
        toggle.dataset.previewBound = '1';

    /**
     * 重新渲染購物車快覽：最多顯示前五項，並呈現總金額與空狀態。
     */
    function renderCartPreview() {
            if (!itemsContainer) return;
            const getCartFn = typeof window.getCart === 'function' ? window.getCart : null;
            const cart = getCartFn ? getCartFn() : [];
            const entries = Array.isArray(cart) ? cart : [];

            itemsContainer.innerHTML = '';

            if (!entries.length) {
                if (emptyState) emptyState.hidden = false;
                if (totalRow) totalRow.hidden = true;
                return;
            }

            if (emptyState) emptyState.hidden = true;

            let total = 0;
            entries.slice(0, 5).forEach((item) => {
                const qty = Number(item.quantity || 0);
                const unitPrice = Number(item.price || 0);
                total += qty * unitPrice;
                const name = item.name || '商品';
                const productId = item.id != null ? item.id : item.productId;

                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'client-nav-cart-item';

                const thumbUrl = item.imageUrl ? normalizeImageUrl(item.imageUrl) : '';
                if (thumbUrl) {
                    const img = document.createElement('img');
                    img.src = thumbUrl;
                    img.alt = name;
                    img.className = 'client-nav-cart-thumb';
                    img.loading = 'lazy';
                    row.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'client-nav-cart-thumb';
                    row.appendChild(placeholder);
                }

                const info = document.createElement('div');
                info.className = 'client-nav-cart-info';

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = name;

                const meta = document.createElement('div');
                meta.className = 'meta';
                meta.textContent = `${qty} 件 · ${formatPrice(unitPrice)}`;

                info.appendChild(title);
                info.appendChild(meta);

                row.appendChild(info);

                if (productId != null) {
                    row.addEventListener('click', () => {
                        window.location.href = 'product.html?id=' + encodeURIComponent(productId);
                    });
                } else {
                    row.addEventListener('click', () => {
                        window.location.href = 'cart.html';
                    });
                }

                itemsContainer.appendChild(row);
            });

            if (entries.length > 5) {
                const more = document.createElement('div');
                more.className = 'client-nav-cart-more text-muted';
                more.textContent = `還有 ${entries.length - 5} 件商品…`;
                itemsContainer.appendChild(more);
            }

            if (totalRow && totalAmount) {
                totalRow.hidden = false;
                totalAmount.textContent = formatPrice(total);
            }
        }

    /** 關閉快覽並移除相關監聽，維持焦點回饋。 */
    function closePanel() {
            if (!open) return;
            panel.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', handleOutsideClick, true);
            panel.removeEventListener('keydown', handleKeydown, true);
            open = false;
        }

    /** 開啟快覽：先渲染再加上點擊/鍵盤監聽。 */
    function openPanel() {
            if (open) return;
            renderCartPreview();
            panel.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            document.addEventListener('click', handleOutsideClick, true);
            panel.addEventListener('keydown', handleKeydown, true);
            open = true;
        }

    /** 監聽外部點擊以在使用者點擊其他區域時收起面板。 */
    function handleOutsideClick(event) {
            const target = event.target instanceof Node ? event.target : null;
            if (!target) return;
            if (wrapper.contains(target)) return;
            closePanel();
        }

    /** 支援 Esc 關閉購物車面板。 */
    function handleKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePanel();
                toggle.focus();
            }
        }

        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            if (open) {
                closePanel();
            } else {
                openPanel();
            }
        });

        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = 'cart.html';
            });
        }

        window.addEventListener('cart:updated', () => {
            if (open) {
                renderCartPreview();
            }
        });
    }

    /**
     * 從站台設定整理客服資訊，若缺欄位則從 footer 或預設值填補。
     */
    function extractSupportInfo(cfg) {
        const info = {
            email: '',
            phone: '',
            hours: '',
            liveChatUrl: '',
            liveChatLabel: ''
        };

        if (cfg && typeof cfg.support === 'object' && cfg.support !== null) {
            info.email = String(cfg.support.email || cfg.support.mail || '').trim();
            info.phone = String(cfg.support.phone || cfg.support.tel || '').trim();
            info.hours = String(cfg.support.hours || cfg.support.businessHours || '').trim();
            info.liveChatUrl = String(cfg.support.liveChatUrl || cfg.support.chatUrl || '').trim();
            info.liveChatLabel = String(cfg.support.liveChatLabel || cfg.support.liveChatText || cfg.support.chatLabel || '').trim();
        }

        const footerText = cfg && cfg.footer && typeof cfg.footer.text === 'string' ? cfg.footer.text : '';
        if (footerText) {
            if (!info.email) {
                const emailMatch = footerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
                if (emailMatch) info.email = emailMatch[0];
            }
            if (!info.phone) {
                const phoneMatch = footerText.match(/(0\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}|09\d{2}[\s-]?\d{3}[\s-]?\d{3})/);
                if (phoneMatch) info.phone = phoneMatch[0];
            }
        }

        if (!info.email) info.email = 'snackforest1688@gmail.com';
        if (!info.phone) info.phone = '0909-585-898';
        if (!info.hours) info.hours = '週一至週五 09:00 - 18:00';

        return info;
    }

    /**
     * 初始化導覽列客服下拉：動態填入電話/信箱/營業時間並處理面板開關。
     */
    function initSupportMenu(cfg) {
        const wrapper = document.getElementById('client-support');
        const button = document.getElementById('client-support-button');
        const panel = document.getElementById('client-support-panel');
        if (!wrapper || !button || !panel) return;

    const emailLink = panel.querySelector('[data-support-email]');
    const phoneLink = panel.querySelector('[data-support-phone]');
    const chatLink = panel.querySelector('[data-support-chat]');
    const hoursEl = panel.querySelector('[data-support-hours]');

        const info = extractSupportInfo(cfg);
        const alreadyBound = button.dataset.supportBound === '1';

        if (emailLink) {
            if (info.email) {
                const span = emailLink.querySelector('span');
                if (span) span.textContent = info.email;
                emailLink.href = 'mailto:' + info.email;
                emailLink.hidden = false;
            } else {
                emailLink.hidden = true;
            }
        }

        if (phoneLink) {
            if (info.phone) {
                const span = phoneLink.querySelector('span');
                if (span) span.textContent = info.phone;
                const tel = info.phone.replace(/[^+\d]/g, '');
                phoneLink.href = tel ? 'tel:' + tel : '#';
                phoneLink.hidden = false;
            } else {
                phoneLink.hidden = true;
            }
        }

        if (hoursEl) {
            if (info.hours) {
                hoursEl.textContent = info.hours;
                hoursEl.hidden = false;
            } else {
                hoursEl.hidden = true;
            }
        }

        if (chatLink) {
            if (info.liveChatUrl) {
                const span = chatLink.querySelector('span');
                if (span) span.textContent = info.liveChatLabel || '線上客服';
                chatLink.href = info.liveChatUrl;
                if (/^https?:/i.test(info.liveChatUrl)) {
                    chatLink.target = '_blank';
                    chatLink.rel = 'noopener noreferrer';
                } else {
                    chatLink.removeAttribute('target');
                    chatLink.removeAttribute('rel');
                }
                chatLink.hidden = false;
            } else {
                chatLink.hidden = true;
            }
        }

        window.requestAnimationFrame(() => {
            if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 991.98px)').matches) {
                panel.style.removeProperty('min-width');
                panel.style.removeProperty('width');
                panel.style.removeProperty('max-width');
                return;
            }
            const measured = panel.scrollWidth;
            if (Number.isFinite(measured) && measured > 0) {
                const targetWidth = Math.min(Math.max(Math.ceil(measured + 24), 320), 420);
                panel.style.minWidth = targetWidth + 'px';
                panel.style.maxWidth = targetWidth + 'px';
                panel.style.width = targetWidth + 'px';
            }
        });

        let open = false;

    /** 關閉客服面板並解除監聽，避免多重綁定。 */
    function closePanel() {
            if (!open) return;
            panel.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', handleOutsideClick, true);
            panel.removeEventListener('keydown', handleKeydown, true);
            open = false;
        }

    /** 顯示客服面板並啟用外部點擊與鍵盤監聽。 */
    function openPanel() {
            if (open) return;
            panel.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            document.addEventListener('click', handleOutsideClick, true);
            panel.addEventListener('keydown', handleKeydown, true);
            open = true;
        }

    /** 監聽表單外點擊以自動收合客服面板。 */
    function handleOutsideClick(event) {
            const target = event.target instanceof Node ? event.target : null;
            if (!target) return;
            if (wrapper.contains(target)) return;
            closePanel();
        }

    /** 支援 Esc 關閉客服面板並將焦點回到觸發鈕。 */
    function handleKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePanel();
                button.focus();
            }
        }

        if (!alreadyBound) {
            button.dataset.supportBound = '1';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                if (open) {
                    closePanel();
                } else {
                    openPanel();
                }
            });

            panel.addEventListener('click', (event) => {
                const target = event.target instanceof HTMLElement ? event.target : null;
                if (!target) return;
                if (target.closest('a')) {
                    // Let navigation proceed but close the panel for consistency.
                    closePanel();
                }
            });
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

        initNavSearch();
        initCartPreview();

        const body = document.body;
        const topbarContainer = document.querySelector('.client-topbar-container');
        const topbarCenter = topbarContainer ? topbarContainer.querySelector('.client-topbar-center') : null;
        const topbarRight = topbarContainer ? topbarContainer.querySelector('.client-topbar-right') : null;
        const profileContainer = sidebar.querySelector('[data-client-sidebar-profile]');
        const profileLink = profileContainer ? profileContainer.querySelector('[data-client-profile-link]') : null;
        const avatarWrapper = profileContainer ? profileContainer.querySelector('[data-client-profile-avatar]') : null;
        const avatarImg = profileContainer ? profileContainer.querySelector('[data-client-profile-avatar-img]') : null;
        const avatarInitial = profileContainer ? profileContainer.querySelector('[data-client-profile-avatar-initial]') : null;
        const profilePrimary = profileContainer ? profileContainer.querySelector('[data-client-profile-primary]') : null;
    const profileSecondary = profileContainer ? profileContainer.querySelector('[data-client-profile-secondary]') : null;
    const primaryDefaultText = profilePrimary ? profilePrimary.textContent.trim() : '歡迎登入會員';
    const secondaryDefaultText = profileSecondary ? profileSecondary.textContent.trim() : '會員中心';
    let lastSidebarProfile = null;

        const topbarCenterPlacement = topbarCenter ? {
            parent: topbarCenter.parentNode,
            nextSibling: topbarCenter.nextSibling
        } : null;
        const topbarRightPlacement = topbarRight ? {
            parent: topbarRight.parentNode,
            nextSibling: topbarRight.nextSibling
        } : null;

        let actionsContainer = null;
        let navRelocatedForMobile = false;
        let mobileLogoutWrapper = null;
        let mobileLogoutButton = null;

        function ensureMobileLogoutControl() {
            if (!topbarContainer) return null;
            if (mobileLogoutButton && mobileLogoutButton.isConnected) {
                return mobileLogoutButton;
            }

            const existingButton = topbarContainer.querySelector('[data-mobile-logout]');
            if (existingButton) {
                mobileLogoutButton = existingButton;
                mobileLogoutWrapper = existingButton.closest('.client-topbar-mobile-logout');
                return mobileLogoutButton;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'client-topbar-mobile-logout';
            wrapper.hidden = true;
            wrapper.setAttribute('aria-hidden', 'true');

            const buttonEl = document.createElement('button');
            buttonEl.type = 'button';
            buttonEl.className = 'btn btn-outline-light btn-sm client-mobile-logout-btn';
            buttonEl.setAttribute('data-mobile-logout', '1');
            buttonEl.innerHTML = '<i class="fa-solid fa-right-from-bracket me-1" aria-hidden="true"></i><span>登出</span>';

            buttonEl.addEventListener('click', (event) => {
                event.preventDefault();
                if (typeof window.logout === 'function') {
                    window.logout();
                } else {
                    window.location.href = 'login.html';
                }
            });

            wrapper.appendChild(buttonEl);
            topbarContainer.appendChild(wrapper);
            mobileLogoutWrapper = wrapper;
            mobileLogoutButton = buttonEl;
            return mobileLogoutButton;
        }

        mobileLogoutButton = ensureMobileLogoutControl();

    /**
     * 建立或取用行動版底部導覽列，確保只生成一次。
     * @returns {HTMLElement|null}
     */
    function ensureMobileTabbar() {
            let tabbar = document.querySelector('[data-client-mobile-tabbar]');
            if (tabbar && tabbar.isConnected) {
                return tabbar;
            }

            tabbar = document.createElement('nav');
            tabbar.className = 'client-mobile-tabbar';
            tabbar.setAttribute('data-client-mobile-tabbar', '1');
            tabbar.innerHTML = `
                <a href="index.html" class="client-tabbar-item" data-tab-key="home" aria-label="回到首頁">
                    <i class="fa-solid fa-house" aria-hidden="true"></i>
                    <span>首頁</span>
                </a>
                <a href="product.html" class="client-tabbar-item" data-tab-key="products" aria-label="瀏覽全部商品">
                    <i class="fa-solid fa-store" aria-hidden="true"></i>
                    <span>商品</span>
                </a>
                <button type="button" class="client-tabbar-item client-tabbar-item-featured" data-tab-action="search" data-tab-key="search" aria-label="快速搜尋商品">
                    <span class="client-tabbar-fab" aria-hidden="true">
                        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    </span>
                    <span>搜尋</span>
                </button>
                <a href="cart.html" class="client-tabbar-item" data-tab-key="cart" aria-label="查看購物車">
                    <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
                    <span>購物車</span>
                    <span class="client-tabbar-badge" data-cart-badge aria-hidden="true">0</span>
                </a>
                <a href="member.html" class="client-tabbar-item" data-tab-key="profile" aria-label="前往會員中心">
                    <i class="fa-solid fa-user" aria-hidden="true"></i>
                    <span>會員</span>
                </a>
            `;
            document.body.appendChild(tabbar);
            return tabbar;
        }

    /**
     * 依據當前頁面路徑標示底部導覽列的啟用狀態。
     * @param {HTMLElement} tabbar 底部導覽列元素
     */
    function syncTabbarActiveState(tabbar) {
            if (!tabbar) return;
            const tabs = tabbar.querySelectorAll('[data-tab-key]');
            if (!tabs.length) return;
            tabs.forEach((tab) => {
                tab.classList.remove('is-active');
                tab.removeAttribute('aria-current');
            });

            const path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
            let key = 'home';
            if (path.includes('cart')) {
                key = 'cart';
            } else if (path.includes('member')) {
                key = 'profile';
            } else if (path.includes('product')) {
                key = 'products';
            }

            const active = tabbar.querySelector(`[data-tab-key="${key}"]`);
            if (active) {
                active.classList.add('is-active');
                active.setAttribute('aria-current', 'page');
            }
        }

    /**
     * 綁定底部導覽列的互動行為（例如搜尋按鈕聚焦輸入框）。
     * @param {HTMLElement} tabbar 底部導覽列元素
     */
    function bindTabbarInteractions(tabbar) {
            if (!tabbar || tabbar.dataset.tabbarBound === '1') {
                return;
            }

            const searchBtn = tabbar.querySelector('[data-tab-action="search"]');
            if (searchBtn) {
                searchBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    const isMobile = window.innerWidth < BREAKPOINT;
                    if (isMobile && typeof openSearchOverlayFn === 'function') {
                        openSearchOverlayFn({ focus: true });
                        return;
                    }

                    const searchInput = document.getElementById('client-nav-search-input');
                    const shouldOpenSidebar = isMobile && !body.classList.contains('client-sidebar-expanded');

                    if (shouldOpenSidebar) {
                        openSidebar({ focusSidebar: true });
                    } else {
                        if (typeof closeSearchOverlayFn === 'function') {
                            closeSearchOverlayFn();
                        }
                        const searchForm = document.getElementById('client-nav-search');
                        if (searchForm && typeof searchForm.scrollIntoView === 'function') {
                            searchForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }

                    if (searchInput) {
                        const delay = shouldOpenSidebar ? 140 : 40;
                        setTimeout(() => {
                            try {
                                searchInput.focus({ preventScroll: true });
                            } catch (_) {
                                searchInput.focus();
                            }
                        }, delay);
                    }
                });
            }

            tabbar.dataset.tabbarBound = '1';
        }

    /**
     * 確保側欄內存在承載搜尋與快捷操作的容器，若尚未建立則即時產生。
     */
    function ensureMobileActionsContainer() {
            if (actionsContainer && actionsContainer.isConnected) {
                return actionsContainer;
            }
            const existing = sidebar.querySelector('[data-client-sidebar-mobile-actions]');
            if (existing) {
                actionsContainer = existing;
                return actionsContainer;
            }
            const container = document.createElement('div');
            container.className = 'client-sidebar-mobile-actions';
            container.setAttribute('data-client-sidebar-mobile-actions', '1');
            container.hidden = true;
            const navEl = sidebar.querySelector('.client-sidebar-nav');
            if (navEl && navEl.parentNode === sidebar) {
                sidebar.insertBefore(container, navEl);
            } else {
                sidebar.appendChild(container);
            }
            actionsContainer = container;
            return actionsContainer;
        }

    /**
     * 將 DOM 節點依原始位置插回（桌面模式時使用）。
     */
    function restoreNode(node, placement) {
            if (!node || !placement || !placement.parent) return;
            if (node.parentNode === placement.parent) return;
            if (placement.nextSibling && placement.nextSibling.parentNode === placement.parent) {
                placement.parent.insertBefore(node, placement.nextSibling);
            } else {
                placement.parent.appendChild(node);
            }
        }

    /**
     * 行動版：把搜尋列與右側快捷鈕移到側欄容器內，並標記目前版型。
     */
    function moveNavBitsToSidebar() {
            if (navRelocatedForMobile) return;
            const container = ensureMobileActionsContainer();
            if (!container) return;
            if (topbarCenter && topbarCenter.parentNode !== container) {
                container.appendChild(topbarCenter);
            }
            if (topbarRight && topbarRight.parentNode !== container) {
                container.appendChild(topbarRight);
            }
            container.hidden = false;
            navRelocatedForMobile = true;
            body.setAttribute('data-client-mobile-nav', 'tabbar');
        }

    /**
     * 回復桌面版：將搜尋和快捷鈕移回頂部導覽列，並隱藏側欄容器。
     */
    function restoreNavBitsToTopbar() {
            if (!navRelocatedForMobile) return;
            restoreNode(topbarCenter, topbarCenterPlacement);
            restoreNode(topbarRight, topbarRightPlacement);
            if (actionsContainer) {
                actionsContainer.hidden = true;
            }
            navRelocatedForMobile = false;
            body.removeAttribute('data-client-mobile-nav');
        }

    /** 根據視窗寬度切換導覽列元件所屬位置。 */
    function syncNavLayoutForViewport() {
            const shouldUseMobileLayout = window.innerWidth < BREAKPOINT;
            if (shouldUseMobileLayout) {
                moveNavBitsToSidebar();
            } else {
                restoreNavBitsToTopbar();
            }
        }

        syncNavLayoutForViewport();

        const mobileTabbar = ensureMobileTabbar();
        syncTabbarActiveState(mobileTabbar);
    bindTabbarInteractions(mobileTabbar);
        window.addEventListener('hashchange', () => syncTabbarActiveState(mobileTabbar));
        window.addEventListener('sf:navigation', () => syncTabbarActiveState(mobileTabbar));
        window.addEventListener('popstate', () => syncTabbarActiveState(mobileTabbar));

        if (typeof window.matchMedia === 'function') {
            const mq = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
            const handler = () => {
                syncNavLayoutForViewport();
                syncTabbarActiveState(mobileTabbar);
            };
            if (typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', handler);
            } else if (typeof mq.addListener === 'function') {
                mq.addListener(handler);
            }
        } else {
            window.addEventListener('resize', () => {
                syncNavLayoutForViewport();
                syncTabbarActiveState(mobileTabbar);
            });
        }

        const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        let lastFocused = null;
        let currentMode = null;
        let outsideClickBound = false;
        const storedSidebarPreference = readSidebarPreference();
        const shouldStartExpanded = storedSidebarPreference === 'expanded' && window.innerWidth >= BREAKPOINT;

    /**
     * 將會員資訊同步到側欄頭像區，包含名稱、編號與預設字母。
     */
    function applySidebarProfileState(state) {
            if (!profileContainer) return;
            const nextName = safeTrim(state && state.name);
            const nextId = safeTrim(state && state.id);
            const nextAvatarRaw = safeTrim(state && state.avatar);

            if (
                lastSidebarProfile
                && lastSidebarProfile.name === nextName
                && lastSidebarProfile.id === nextId
                && lastSidebarProfile.avatar === nextAvatarRaw
            ) {
                return;
            }

            lastSidebarProfile = { name: nextName, id: nextId, avatar: nextAvatarRaw };

            const hasName = Boolean(nextName);

            if (mobileLogoutWrapper) {
                mobileLogoutWrapper.hidden = !hasName;
                mobileLogoutWrapper.setAttribute('aria-hidden', String(!hasName));
            }
            if (mobileLogoutButton) {
                mobileLogoutButton.disabled = !hasName;
            }
            const hasAvatar = Boolean(nextAvatarRaw);

            if (profileContainer) {
                profileContainer.dataset.memberState = hasName ? 'authenticated' : 'guest';
            }

            if (profilePrimary) {
                profilePrimary.textContent = hasName ? `歡迎 ${nextName} 會員` : primaryDefaultText;
            }

            if (profileSecondary) {
                profileSecondary.textContent = secondaryDefaultText || '會員中心';
                if (nextId) {
                    profileSecondary.setAttribute('data-member-id', nextId);
                    profileSecondary.setAttribute('title', `會員編號 #${nextId}`);
                } else {
                    profileSecondary.removeAttribute('data-member-id');
                    profileSecondary.removeAttribute('title');
                }
            }

            const initialsSource = hasName ? nextName : '會員';
            const initials = extractInitials(initialsSource);
            if (avatarInitial) {
                avatarInitial.textContent = initials;
            }

            if (avatarWrapper) {
                avatarWrapper.classList.toggle('has-image', hasAvatar);
                if (hasName) {
                    avatarWrapper.setAttribute('title', `${nextName} 會員`);
                } else {
                    avatarWrapper.removeAttribute('title');
                }
            }

            if (avatarImg) {
                if (hasAvatar) {
                    let resolvedAvatar = nextAvatarRaw;
                    try {
                        resolvedAvatar = normalizeImageUrl(nextAvatarRaw);
                    } catch (_) {
                        resolvedAvatar = nextAvatarRaw;
                    }
                    if (avatarImg.src !== resolvedAvatar) {
                        avatarImg.src = resolvedAvatar;
                    }
                    avatarImg.alt = `${nextName || '會員'}頭像`;
                } else {
                    avatarImg.removeAttribute('src');
                    avatarImg.alt = '';
                }
            }

            if (profileLink) {
                const labelName = hasName ? nextName : '會員';
                const label = hasName ? `前往 ${labelName} 的會員中心` : '前往會員中心';
                profileLink.setAttribute('title', label);
                profileLink.setAttribute('aria-label', label);
                if (nextId) {
                    profileLink.setAttribute('data-member-id', nextId);
                } else {
                    profileLink.removeAttribute('data-member-id');
                }
            }
        }

    /**
     * 從 localStorage 或事件覆寫的資料更新側欄會員資料顯示。
     */
    function updateSidebarProfile(override) {
            if (!profileContainer) return;
            const stored = readStoredMemberMeta();
            const next = { ...stored };

            if (override && typeof override === 'object') {
                if (Object.prototype.hasOwnProperty.call(override, 'name')) {
                    next.name = safeTrim(override.name);
                }
                let overrideAvatar = '';
                if (Object.prototype.hasOwnProperty.call(override, 'avatarUrlResolved')) {
                    overrideAvatar = safeTrim(override.avatarUrlResolved);
                }
                if (!overrideAvatar && Object.prototype.hasOwnProperty.call(override, 'avatarUrl')) {
                    overrideAvatar = sanitizeUploadUrl(override.avatarUrl);
                }
                if (!overrideAvatar && Object.prototype.hasOwnProperty.call(override, 'avatar')) {
                    overrideAvatar = sanitizeUploadUrl(override.avatar);
                }
                if (overrideAvatar) {
                    next.avatar = overrideAvatar;
                }
                if (Object.prototype.hasOwnProperty.call(override, 'customerId')) {
                    next.id = safeTrim(override.customerId);
                } else if (Object.prototype.hasOwnProperty.call(override, 'id')) {
                    next.id = safeTrim(override.id);
                }
            }

            applySidebarProfileState(next);
        }

        updateSidebarProfileProxy = updateSidebarProfile;

    /**
     * 監聽 localStorage 與自訂事件變更，保持側欄會員資訊最新。
     */
    const handleProfileStorage = (event) => {
            if (!event) {
                updateSidebarProfile();
                return;
            }
            const key = event.key;
            if (
                key == null
                || MEMBER_NAME_KEYS.includes(key)
                || MEMBER_ID_KEYS.includes(key)
                || key === MEMBER_AVATAR_KEY
                || key === MEMBER_AVATAR_RESOLVED_KEY
            ) {
                updateSidebarProfile();
            }
        };

        const handleProfileEvent = (event) => {
            if (!event) {
                updateSidebarProfile();
                return;
            }
            const detail = event.detail && typeof event.detail === 'object' ? event.detail : null;
            updateSidebarProfile(detail);
        };

        if (profileContainer) {
            updateSidebarProfile();
            window.addEventListener('storage', handleProfileStorage);
            window.addEventListener(PROFILE_UPDATE_EVENT, handleProfileEvent);
        }

        refreshMemberProfile({ force: true });

        const handleWindowFocus = () => {
            refreshMemberProfile({ force: true });
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                refreshMemberProfile({ force: true });
            }
        });

    /**
     * 依據 site-config 或快取資料套用品牌名稱、標語與 Logo。
     * 若使用者已透過管理端更新，會寫入 localStorage 以便其他頁面共用。
     */
    async function applyBranding(preloadedCfg) {
            const brandNameEls = sidebar.querySelectorAll('[data-client-brand-name]');
            const taglineEls = sidebar.querySelectorAll('[data-client-brand-tagline]');
            const logoWrappers = sidebar.querySelectorAll('[data-client-brand-logo]');
            const logoImgs = sidebar.querySelectorAll('[data-client-brand-logo-img]');
            const initialsEls = sidebar.querySelectorAll('[data-client-brand-initials]');
            const navBrand = document.querySelector('.navbar .navbar-brand');
            const fallbackName = brandNameEls.length ? brandNameEls[0].textContent.trim() : 'SnackForest';
            const fallbackTagline = taglineEls.length ? taglineEls[0].textContent.trim() : '';

            const fallbackLogoSrc = '/frontend/images/branding/%E9%9B%B6%E9%A3%9F%E6%A3%AE%E6%9E%97LOGO.png';

            const stored = readStoredBranding();
            const storedLogoOriginal = stored && typeof stored.logoSrc === 'string' && stored.logoSrc.trim() ? stored.logoSrc.trim() : '';
            const storedLogoResolved = stored && typeof stored.logoResolved === 'string' && stored.logoResolved.trim() ? stored.logoResolved.trim() : '';
            const storedLogoCandidate = storedLogoOriginal || storedLogoResolved;

            let currentName = fallbackName;
            let currentTagline = fallbackTagline;

            const setInitials = (name) => {
                if (!initialsEls.length) return;
                const initials = extractInitials(name || fallbackName);
                initialsEls.forEach((el) => {
                    el.textContent = initials;
                });
            };

            const setTexts = (name, tagline) => {
                const safeName = name || fallbackName;
                const safeTagline = tagline || fallbackTagline;

                currentName = safeName;
                currentTagline = safeTagline;

                brandNameEls.forEach((el) => {
                    el.textContent = safeName;
                });

                taglineEls.forEach((el) => {
                    el.textContent = safeTagline;
                });

                if (navBrand) {
                    navBrand.textContent = safeName;
                    navBrand.setAttribute('title', `回到 ${safeName} 首頁`);
                    navBrand.setAttribute('aria-label', `回到${safeName}首頁`);
                }

                setInitials(safeName);
            };

            const showImage = (name) => {
                if (!logoWrappers.length || !logoImgs.length) return;
                const label = name || fallbackName;
                logoWrappers.forEach((wrapper) => {
                    wrapper.classList.add('has-image');
                    if (label) {
                        wrapper.setAttribute('title', label);
                    } else {
                        wrapper.removeAttribute('title');
                    }
                });
                logoImgs.forEach((img) => {
                    img.alt = label || '品牌識別';
                });
            };

            const hideImage = (name, options = {}) => {
                if (!logoWrappers.length || !logoImgs.length) return;
                const label = name || fallbackName;
                logoWrappers.forEach((wrapper) => {
                    wrapper.classList.remove('has-image');
                    if (label) {
                        wrapper.setAttribute('title', label);
                    } else {
                        wrapper.removeAttribute('title');
                    }
                });
                if (options.clearSrc !== false) {
                    logoImgs.forEach((img) => {
                        img.removeAttribute('src');
                        delete img.dataset.brandSrc;
                    });
                }
                logoImgs.forEach((img) => {
                    img.alt = '';
                });
                setInitials(label);
            };

            const applyLogoSrc = (src, name, options = {}) => {
                const { persist = false, original = null } = options;

                if (!logoWrappers.length || !logoImgs.length) return;

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

                logoImgs.forEach((img, index) => {
                    if (img.dataset.brandSrc !== resolvedSrc) {
                        img.dataset.brandSrc = resolvedSrc;
                        if (logoWrappers[index]) {
                            logoWrappers[index].classList.remove('has-image');
                        }
                        img.src = resolvedSrc;
                    }

                    img.decoding = 'async';
                    img.setAttribute('loading', 'lazy');
                    img.onload = () => showImage(resolvedName);
                    img.onerror = () => hideImage(resolvedName, { clearSrc: false });

                    if (img.complete && img.naturalWidth > 0) {
                        showImage(resolvedName);
                    }
                });

                if (persist) {
                    writeStoredBranding({
                        brandName: resolvedName,
                        tagline: currentTagline,
                        logoSrc: resolvedSrc,
                        logoResolved: resolvedSrc
                    });
                }
            };

            const useFallbackLogo = (name, options = {}) => {
                if (!fallbackLogoSrc) return false;
                const { persist = false } = options;
                applyLogoSrc(fallbackLogoSrc, name, { persist, original: fallbackLogoSrc });
                return true;
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
                    if (!useFallbackLogo(storedName)) {
                        hideImage(storedName, { clearSrc: false });
                    }
                }
            } else {
                setTexts(currentName, currentTagline);
                if (!useFallbackLogo(currentName)) {
                    hideImage(currentName, { clearSrc: false });
                }
            }

            try {
                const cfg = preloadedCfg || await loadNavSiteConfig();
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
                        if (!useFallbackLogo(currentName, { persist: true })) {
                            hideImage(currentName);
                            writeStoredBranding({
                                brandName: currentName,
                                tagline: currentTagline,
                                logoSrc: null,
                                logoResolved: null
                            });
                        }
                    }
                } else {
                    if (!useFallbackLogo(currentName, { persist: true })) {
                        hideImage(currentName);
                        writeStoredBranding({
                            brandName: currentName,
                            tagline: currentTagline,
                            logoSrc: null,
                            logoResolved: null
                        });
                    }
                }
            } catch (err) {
                console.warn('載入品牌設定失敗', err);
                if (storedLogoCandidate) {
                    applyLogoSrc(storedLogoCandidate, currentName, {
                        persist: false,
                        original: storedLogoOriginal || storedLogoResolved || storedLogoCandidate
                    });
                } else {
                    if (!useFallbackLogo(currentName)) {
                        hideImage(currentName);
                    }
                }
            }
        }

    /**
     * 根據目前網址標記側欄的啟用連結，協助使用者辨識所在頁面。
     */
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

        loadNavSiteConfig()
            .then((cfg) => {
                applyBranding(cfg);
                hydratePromoTicker(cfg);
                initSupportMenu(cfg);
            })
            .catch((err) => {
                console.warn('Nav enhancements: failed to load site config', err);
                applyBranding();
                hydratePromoTicker();
                initSupportMenu();
            });

        /** 更新漢堡按鈕的 aria-expanded 屬性，反映側欄狀態。 */
        function setTriggerExpanded(expanded) {
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }

        /** 收集側欄內可聚焦元素，供焦點陷阱與鍵盤導覽使用。 */
        function getFocusableElements() {
            return Array.from(sidebar.querySelectorAll(focusableSelector))
                .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
        }

        /** 將焦點移到側欄第一個可互動元件，若無則聚焦於容器本身。 */
        function focusFirstElement() {
            const focusables = getFocusableElements();
            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                sidebar.focus();
            }
        }

        /** 判斷目前側欄模式是否為覆蓋模式（行動裝置使用）。 */
        function isOverlay() {
            return currentMode === 'overlay';
        }

        /**
         * 行動覆蓋模式下的鍵盤陷阱：攔截 Tab 與 Esc，避免焦點離開側欄。
         */
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

    /**
     * 依視窗寬度切換覆蓋或 rail 模式，並同步相關監聽與外觀狀態。
     */
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

    /**
     * 桌面模式下的外點關閉邏輯：僅當點擊在內容區以外時才收合側欄。
     */
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

    /**
     * 開啟側欄：處理 body 樣式、焦點、偏好儲存與覆蓋模式的監聽。
     */
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

    /**
     * 關閉側欄：根據模式調整外觀、釋放監聽並視需求回復焦點。
     */
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

    /** 切換側欄展開/收合，供漢堡按鈕與側欄連結使用。 */
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
