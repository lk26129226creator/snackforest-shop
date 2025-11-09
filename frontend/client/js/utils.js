(function(){
    // 客戶端共用工具庫：提供圖片路徑標準化、價格格式化與字串安全處理等。

    /** 由 env.js 注入的環境設定（可能含 API_ORIGIN 與 API_BASE）。 */
    const env = window.SF_ENV || {};
    /** API 伺服器的 Origin，若未設定則退回到瀏覽器目前來源。 */
    const API_ORIGIN = env.API_ORIGIN || window.SF_API_ORIGIN || (window.location && window.location.origin) || '';
    /** 上傳檔案可供瀏覽的 Origin，可獨立於 API 主機。 */
    const STORAGE_ORIGIN = env.STORAGE_ORIGIN || window.SF_STORAGE_BASE || API_ORIGIN;
    /** 預設商品佔位圖路徑（相對於專案根目錄）。 */
    const FALLBACK_PATH = '/frontend/images/products/no-image.svg';
    /** 依照環境自動套上來源的預設商品圖片絕對網址。 */
    const FALLBACK_IMAGE = API_ORIGIN ? (API_ORIGIN + FALLBACK_PATH) : FALLBACK_PATH;

    /**
     * 將傳入的圖片路徑轉為可直接使用的絕對網址，並處理可能出錯的案例。
     * - 支援 data URL / http(s) / protocol-relative / 相對路徑。
     * - 遇到 placeholder/dummyimage 會改為預設圖，以保持品牌一致性。
     * - 若為本機開發的 localhost 圖片，會改用 API_ORIGIN 以避免跨來源問題。
     * @param {string} u 由 API 或使用者輸入的圖片來源字串。
     * @returns {string} 可直接在 <img> 使用的安全絕對網址。
     */
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
                if (/\/api\/uploads\//i.test(s)) {
                    s = s.replace(/\/api\/(?=uploads\/)/i, '/');
                }
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

            if (s.startsWith('/uploads/') || /^uploads\//i.test(s)) {
                const normalized = s.startsWith('/uploads/') ? s : `/${s.replace(/^uploads\//i, 'uploads/')}`;
                return STORAGE_ORIGIN ? (STORAGE_ORIGIN.replace(/\/$/, '') + normalized) : normalized;
            }

            if (s.startsWith('/')) {
                return API_ORIGIN ? (API_ORIGIN.replace(/\/$/, '') + s) : s;
            }

            if (s.toLowerCase().startsWith('frontend/')) {
                const normalized = '/' + s.replace(/^\/+/, '');
                return API_ORIGIN ? (API_ORIGIN.replace(/\/$/, '') + normalized) : normalized;
            }

            return API_ORIGIN
                ? (API_ORIGIN.replace(/\/$/, '') + '/frontend/images/products/' + s)
                : ('/frontend/images/products/' + s);
        } catch (e) {
            return FALLBACK_IMAGE;
        }
    }

    /**
     * 將數值轉為「NT$」加千分位的字串，保留 fallback 行為避免例外。
     * @param {*} value 可被轉為數字的輸入。
     * @returns {string|*}
     */
    function formatPrice(value) {
        try {
            const num = Number(value || 0);
            return 'NT$' + num.toLocaleString('zh-TW');
        } catch (e) {
            return value;
        }
    }

    /**
     * 安全轉字串：避免 null/undefined 或字串 'null' 在畫面上產生雜訊。
     * @param {*} v 任意來源值。
     * @returns {string}
     */
    function safeStr(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && v.trim().toLowerCase() === 'null') return '';
        return String(v);
    }

    // 將工具函式掛到全域，給其他模組（navigation.js 等）呼叫。
    window.SF_UTILS = {
        normalizeImageUrl,
        formatPrice,
        safeStr,
        fallbackProductImage: FALLBACK_IMAGE
    };

    // 兼容舊版頁面：若全域尚未定義對應函式則補上。
    if (typeof window.normalizeImageUrl !== 'function') window.normalizeImageUrl = normalizeImageUrl;
    if (typeof window.formatPrice !== 'function') window.formatPrice = formatPrice;
    if (typeof window.safeStr !== 'function') window.safeStr = safeStr;
    if (typeof window.SF_FALLBACK_PRODUCT_IMAGE === 'undefined') window.SF_FALLBACK_PRODUCT_IMAGE = FALLBACK_IMAGE;
})();
