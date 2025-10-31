(function(){
    const DEFAULT_BACKEND = 'http://localhost:8000';
    let apiOrigin;
    try {
        apiOrigin = new URL(DEFAULT_BACKEND).origin;
    } catch (_) {
        apiOrigin = (window.location && window.location.origin) ? window.location.origin : DEFAULT_BACKEND;
    }

    const API_ORIGIN = apiOrigin;
    const API_BASE = API_ORIGIN + '/api';
    const SITE_CONFIG_ENDPOINT = API_BASE + '/site-config';

    const SITE_CONFIG_CACHE_TTL = 0; // milliseconds; 0 disables reuse after each fetch
    let siteConfigCache = null;
    let siteConfigPromise = null;
    let siteConfigCacheTimestamp = 0;

    function shouldReuseCache() {
        if (SITE_CONFIG_CACHE_TTL <= 0) return false;
        if (!siteConfigCache) return false;
        return (Date.now() - siteConfigCacheTimestamp) < SITE_CONFIG_CACHE_TTL;
    }

    async function fetchSiteConfig(options) {
        const shouldForce = options === true || (options && typeof options === 'object' && options.force === true);
        if (!shouldForce && shouldReuseCache()) {
            return siteConfigCache;
        }

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

        if (SITE_CONFIG_CACHE_TTL <= 0 || shouldForce) {
            siteConfigPromise = null;
            if (SITE_CONFIG_CACHE_TTL <= 0) {
                siteConfigCache = null;
                siteConfigCacheTimestamp = 0;
            }
        }

        return data;
    }

    function invalidateSiteConfigCache() {
        siteConfigCache = null;
        siteConfigPromise = null;
        siteConfigCacheTimestamp = 0;
    }

    const env = {
        API_ORIGIN,
        API_BASE,
        SITE_CONFIG_ENDPOINT,
        fetchSiteConfig,
        invalidateSiteConfigCache,
        SITE_CONFIG_CACHE_TTL,
        get siteConfigCache() {
            return siteConfigCache;
        }
    };

    window.SF_ENV = env;
    window.API_ORIGIN = API_ORIGIN;
    window.API_BASE = API_BASE;
    window.SITE_CONFIG_ENDPOINT = SITE_CONFIG_ENDPOINT;
    window.SF_API_BASE = API_BASE;
    window.SF_STORAGE_BASE = API_ORIGIN;
    window.invalidateSiteConfigCache = invalidateSiteConfigCache;

    if (typeof window.fetchSiteConfig !== 'function') {
        window.fetchSiteConfig = fetchSiteConfig;
    }
})();
