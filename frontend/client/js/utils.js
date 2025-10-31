(function(){
    const env = window.SF_ENV || {};
    const API_ORIGIN = env.API_ORIGIN || (window.location && window.location.origin) || '';
    const FALLBACK_PATH = '/frontend/images/products/no-image.svg';
    const FALLBACK_IMAGE = API_ORIGIN ? (API_ORIGIN + FALLBACK_PATH) : FALLBACK_PATH;

    function normalizeImageUrl(u) {
        if (u === undefined || u === null) return FALLBACK_IMAGE;
        try {
            let s = String(u).trim();
            if (!s) return FALLBACK_IMAGE;
            s = s.replace(/["']/g, '').replace(/\\/g, '/');

            if (/^data:/i.test(s)) return s;
            if (/^https?:\/\//i.test(s)) {
                const lowered = s.toLowerCase();
                if (lowered.includes('placeholder.com') || lowered.includes('dummyimage.com')) return FALLBACK_IMAGE;
                // 若是本機的絕對網址（例如 http://127.0.0.1:5501/... 或 http://localhost:5501/...），
                // 將其改寫為 API_ORIGIN + 路徑，避免跑去 Live Server 取檔導致 404。
                try {
                    const url = new URL(s);
                    const host = (url.hostname || '').toLowerCase();
                    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
                    if (isLocal && API_ORIGIN) {
                        return API_ORIGIN.replace(/\/$/, '') + url.pathname + url.search + url.hash;
                    }
                } catch (_) {
                    // ignore parse errors and fall through to return original s
                }
                return s;
            }
            if (s.startsWith('//')) {
                const absolute = (window.location && window.location.protocol ? window.location.protocol : 'https:') + s;
                return absolute.toLowerCase().includes('placeholder.com') || absolute.toLowerCase().includes('dummyimage.com') ? FALLBACK_IMAGE : absolute;
            }

            if (s.startsWith('/')) {
                return API_ORIGIN ? (API_ORIGIN + s) : s;
            }

            if (s.toLowerCase().startsWith('frontend/')) {
                const normalized = '/' + s.replace(/^\/+/, '');
                return API_ORIGIN ? (API_ORIGIN + normalized) : normalized;
            }

            return API_ORIGIN ? (API_ORIGIN + '/frontend/images/products/' + s) : ('/frontend/images/products/' + s);
        } catch (e) {
            return FALLBACK_IMAGE;
        }
    }

    function formatPrice(value) {
        try {
            const num = Number(value || 0);
            return 'NT$' + num.toLocaleString('zh-TW');
        } catch (e) {
            return value;
        }
    }

    function safeStr(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && v.trim().toLowerCase() === 'null') return '';
        return String(v);
    }

    window.SF_UTILS = {
        normalizeImageUrl,
        formatPrice,
        safeStr,
        fallbackProductImage: FALLBACK_IMAGE
    };

    if (typeof window.normalizeImageUrl !== 'function') window.normalizeImageUrl = normalizeImageUrl;
    if (typeof window.formatPrice !== 'function') window.formatPrice = formatPrice;
    if (typeof window.safeStr !== 'function') window.safeStr = safeStr;
    if (typeof window.SF_FALLBACK_PRODUCT_IMAGE === 'undefined') window.SF_FALLBACK_PRODUCT_IMAGE = FALLBACK_IMAGE;
})();
