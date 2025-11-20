(function(){
    // 客戶端共用工具庫：提供圖片路徑標準化、價格格式化與字串安全處理等。

    /** 由 env.js 注入的環境設定（可能含 API_ORIGIN 與 API_BASE）。 */
    const env = window.SF_ENV || {};
    /** API 伺服器的 Origin，若未設定則退回到瀏覽器目前來源。 */
    const API_ORIGIN = env.API_ORIGIN || window.SF_API_ORIGIN || (window.location && window.location.origin) || '';
    /** 靜態資源的 Origin，指向 Cloudflare R2 公開網址。 */
    const STORAGE_ORIGIN = 'https://snackforest-assets.pages.dev';
    /** 預設商品佔位圖，使用 picsum 作為通用佔位圖服務。 */
    const FALLBACK_IMAGE = 'https://picsum.photos/320/320?snack';

    /**
     * Gets the first non-null/undefined value from a list of properties on an object.
     */
    function getFirstValue(obj, props) {
        if (!obj) return;
        for (const prop of props) {
            if (obj[prop] != null) return obj[prop];
        }
    }

    /**
     * 將傳入的圖片路徑轉為可直接使用的絕對網址，並處理可能出錯的案例。
     */
    function normalizeImageUrl(u) {
        if (u === undefined || u === null) return FALLBACK_IMAGE;
        try {
            let s = String(u).trim().replace(/["']/g, '').replace(/\\/g, '/');
            if (!s) return FALLBACK_IMAGE;

            if (/^data:/i.test(s)) return s;
            if (/^https?:\/\//i.test(s)) {
                const lowered = s.toLowerCase();
                if (lowered.includes('placeholder.com') || lowered.includes('dummyimage.com')) return FALLBACK_IMAGE;
                try {
                    const url = new URL(s);
                    const host = (url.hostname || '').toLowerCase();
                    if ((host === 'localhost' || host === '127.0.0.1') && API_ORIGIN) {
                        return API_ORIGIN.replace(/\/$/, '') + url.pathname + url.search + url.hash;
                    }
                } catch (_) { /* ignore parse errors */ }
                return s;
            }
            if (s.startsWith('//')) {
                const absolute = (window.location?.protocol || 'https:') + s;
                return absolute.toLowerCase().includes('placeholder.com') ? FALLBACK_IMAGE : absolute;
            }

            const uploadPath = s.split('uploads/').pop();
            if (s.includes('uploads/')) {
                 return `${STORAGE_ORIGIN.replace(/\/$/, '')}/uploads/${uploadPath}`;
            }
            if (s.startsWith('/')) {
                return `${API_ORIGIN.replace(/\/$/, '')}${s}`;
            }
            return s; // Fallback for relative paths or other cases
        } catch (e) {
            return FALLBACK_IMAGE;
        }
    }

    /**
     * Normalizes a product object from the API into a consistent shape.
     */
    function normalizeProduct(product) {
        if (!product) return null;
        const id = getFirstValue(product, ['id', 'idProducts', 'idProduct', 'id_products']);
        if (id == null) return null;

        const imageUrls = getFirstValue(product, ['imageUrls', 'ImageUrls']) || [];
        const singleImage = getFirstValue(product, ['imageUrl', 'image', 'ImageUrl']);
        const finalImages = ((Array.isArray(imageUrls) && imageUrls.length) ? imageUrls : (singleImage ? [singleImage] : []))
            .map(normalizeImageUrl).filter(Boolean);

        return {
            id,
            name: getFirstValue(product, ['name', 'ProductName', 'productName']) || '未命名商品',
            price: getFirstValue(product, ['price', 'Price']) ?? 0,
            categoryName: getFirstValue(product, ['categoryName', 'categoryname']) || '未分類',
            introduction: getFirstValue(product, ['introduction', 'remark', 'description']) || '',
            origin: getFirstValue(product, ['origin', 'Origin']),
            productionDate: getFirstValue(product, ['productionDate', 'ProductionDate']),
            expiryDate: getFirstValue(product, ['expiryDate', 'ExpiryDate']),
            imageUrls: finalImages.length ? finalImages : [FALLBACK_IMAGE],
            imageUrl: finalImages.length ? finalImages[0] : FALLBACK_IMAGE,
            __raw: product,
        };
    }

    /**
     * 去除多餘前綴與查詢字串，將 uploads 相對路徑正規化為穩定格式。
     */
    function sanitizeUploadUrl(value) {
        if (value == null) return '';
        let sanitized = String(value).trim();
        if (!sanitized) return '';
        sanitized = sanitized.split('?')[0].split('#')[0];
        const uploadIndex = sanitized.indexOf('uploads/');
        if (uploadIndex > -1) {
            return sanitized.substring(uploadIndex);
        }
        return sanitized;
    }

    /**
     * 為圖片網址附加 cache-buster 參數，確保最新內容被載入。
     */
    function appendCacheBuster(url, version) {
        if (!url) return '';
        const str = String(url);
        const [base, hash] = str.split('#');
        const [path, query] = base.split('?');
        const params = new URLSearchParams(query);
        params.set('v', String(version).trim() || Date.now());
        const finalBase = `${path}?${params.toString()}`;
        return hash ? `${finalBase}#${hash}` : finalBase;
    }

    /**
     * 將數值轉為「NT$」加千分位的字串。
     */
    function formatPrice(value) {
        try {
            return (Number(value || 0)).toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 });
        } catch (e) {
            return value;
        }
    }

    /**
     * 安全轉字串：避免 null/undefined 或字串 'null' 在畫面上產生雜訊。
     */
    function safeStr(v) {
        if (v == null || String(v).trim().toLowerCase() === 'null') return '';
        return String(v);
    }

    // 將工具函式掛到全域
    window.SF_UTILS = {
        getFirstValue,
        normalizeImageUrl,
        normalizeProduct,
        formatPrice,
        safeStr,
        sanitizeUploadUrl,
        appendCacheBuster,
        fallbackProductImage: FALLBACK_IMAGE
    };
})();
