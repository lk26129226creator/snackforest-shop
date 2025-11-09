(function(){
    //
    //  前端環境設定模組：統一定義 API 端點與站台設定快取策略，並掛載至全域。
    //  主要職責有：
    //    - 解析 API_ORIGIN / API_BASE，讓其他模組共享。
    //    - 提供 fetchSiteConfig() 與快取失效控制。
    //
    const FALLBACK_BACKEND = 'http://localhost:8000';

    function toOrigin(input, fallback) {
        if (!input) return fallback;
        try {
            return new URL(String(input), fallback || FALLBACK_BACKEND).origin;
        } catch (_) {
            return fallback || FALLBACK_BACKEND;
        }
    }

    function normalizeBase(input, originFallback) {
        if (!input) return '';
        try {
            const url = new URL(String(input), originFallback || FALLBACK_BACKEND);
            const trimmed = url.origin.replace(/\/?$/, '') + (url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname);
            return trimmed.replace(/\/$/, '');
        } catch (_) {
            return '';
        }
    }

    const runtimeApiBase = typeof window !== 'undefined' ? window.SF_API_BASE : '';
    const runtimeStorageBase = typeof window !== 'undefined' ? window.SF_STORAGE_BASE : '';
    const candidateOrigin = runtimeApiBase ? toOrigin(runtimeApiBase) : null;
    const FALLBACK_ORIGIN = toOrigin(null, FALLBACK_BACKEND);
    const API_ORIGIN = candidateOrigin || (() => {
        try {
            if (typeof window !== 'undefined' && window.location && window.location.origin) {
                const origin = window.location.origin;
                if (origin && origin !== 'null' && origin !== 'file://') {
                    return origin;
                }
            }
        } catch (_) {}
        return FALLBACK_ORIGIN;
    })();
    const API_BASE = (() => {
        if (runtimeApiBase) {
            const normalized = normalizeBase(runtimeApiBase, API_ORIGIN);
            if (normalized) return normalized;
        }
        return API_ORIGIN.replace(/\/$/, '') + '/api';
    })();
    const STORAGE_ORIGIN = runtimeStorageBase ? toOrigin(runtimeStorageBase, API_ORIGIN) : API_ORIGIN;
    const SITE_CONFIG_ENDPOINT = API_BASE.replace(/\/$/, '') + '/site-config';

    // SITE_CONFIG_CACHE_TTL 以毫秒為單位，預設 0 代表每次都重新向後端抓資料。
    const SITE_CONFIG_CACHE_TTL = 0; // milliseconds; 0 disables reuse after each fetch
    let siteConfigCache = null;
    let siteConfigPromise = null;
    let siteConfigCacheTimestamp = 0;

    /**
     * 判斷站台設定是否仍在有效快取期間。
     * @returns {boolean}
     */
    function shouldReuseCache() {
        if (SITE_CONFIG_CACHE_TTL <= 0) return false;
        if (!siteConfigCache) return false;
        return (Date.now() - siteConfigCacheTimestamp) < SITE_CONFIG_CACHE_TTL;
    }

    /**
     * 取得站台設定，預設會尊重快取；傳入 force 時強制刷新。
     * @param {boolean|{force?:boolean}} [options]
     * @returns {Promise<Object>}
     */
    async function fetchSiteConfig(options) {
        const shouldForce = options === true || (options && typeof options === 'object' && options.force === true);
        if (!shouldForce && shouldReuseCache()) {
            return siteConfigCache;
        }

        // 透過共享的 siteConfigPromise 避免並發多次 fetch，並在成功後更新快取時間戳。
        if (!siteConfigPromise || shouldForce) {
            siteConfigPromise = (async () => {
                let result = siteConfigCache || {};
                try {
                    const res = await fetch(SITE_CONFIG_ENDPOINT, { cache: 'no-store' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    result = await res.json();
                    siteConfigCache = result;
                    siteConfigCacheTimestamp = Date.now();
                } catch (e) {
                    console.warn('取得網站設定失敗', e);
                    if (!siteConfigCache) siteConfigCache = result;
                }
                return siteConfigCache || result;
            })();
        }

        const data = await siteConfigPromise;

        // 若無快取策略或為強制刷新，請求完成後立即清空 promise／cache。
        if (SITE_CONFIG_CACHE_TTL <= 0 || shouldForce) {
            siteConfigPromise = null;
            if (SITE_CONFIG_CACHE_TTL <= 0) {
                siteConfigCache = null;
                siteConfigCacheTimestamp = 0;
            }
        }

        return data;
    }

    /**
     * 手動清除站台設定快取，更新後台資料時可呼叫。
     */
    function invalidateSiteConfigCache() {
        siteConfigCache = null;
        siteConfigPromise = null;
        siteConfigCacheTimestamp = 0;
    }

    // 將常用設定整理成單一物件，便於日後擴充或在測試時覆寫。
    const env = {
        API_ORIGIN,
        API_BASE,
        STORAGE_ORIGIN,
        SITE_CONFIG_ENDPOINT,
        fetchSiteConfig,
        invalidateSiteConfigCache,
        SITE_CONFIG_CACHE_TTL,
        get siteConfigCache() {
            return siteConfigCache;
        }
    };

    // 釋出到全域命名空間，讓舊版腳本或純 HTML 頁面也能取得設定值。
    window.SF_ENV = env;
    window.API_ORIGIN = API_ORIGIN;
    window.API_BASE = API_BASE;
    window.SITE_CONFIG_ENDPOINT = SITE_CONFIG_ENDPOINT;
    window.SF_API_ORIGIN = API_ORIGIN;
    window.SF_API_BASE = API_BASE;
    window.SF_STORAGE_BASE = STORAGE_ORIGIN;
    if (window.api && typeof window.api.setBaseURL === 'function') {
        window.api.setBaseURL(API_BASE);
    }
    window.invalidateSiteConfigCache = invalidateSiteConfigCache;

    // 若尚未綁定全域 fetchSiteConfig（避免覆蓋其他模組自訂版本），則掛載預設實作。
    if (typeof window.fetchSiteConfig !== 'function') {
        window.fetchSiteConfig = fetchSiteConfig;
    }
})();
