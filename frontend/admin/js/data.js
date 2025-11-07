//
//  Admin 資料快取模組：統一處理商品、分類、訂單 API 載入與快取時效。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state } = Admin;
    const data = Admin.data || {};

    const CACHE_TTL = 60 * 1000;
    const RESOURCE_LABELS = {
        products: '商品',
        categories: '分類',
        orders: '訂單'
    };

    /**
     * 包裝 fetchJson，若工具模組未載入則改用原生 fetch。
     * @param {string} url API 位置。
     * @param {RequestInit} [options] 其他 fetch 參數。
     * @returns {Promise<any>} 解析後的 JSON。
     */
    data.fetchJson = async function (url, options) {
        if (Admin.utils && typeof Admin.utils.fetchJson === 'function') {
            return Admin.utils.fetchJson(url, options);
        }
        const res = await fetch(url, Object.assign({ cache: 'no-store' }, options));
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Fetch failed: ${res.status}${text ? ` - ${text}` : ''}`);
        }
        return res.json();
    };

    // 判斷快取是否在 TTL 內，除非帶 force=true。
    function isFresh(cacheKey, force) {
        if (force) return false;
        const fetchedAt = state.cacheMeta?.[cacheKey] || 0;
        return fetchedAt && (Date.now() - fetchedAt) < CACHE_TTL;
    }

    function markFetched(cacheKey) {
        if (!state.cacheMeta) state.cacheMeta = {};
        state.cacheMeta[cacheKey] = Date.now();
    }

    // 透過核心事件匯流排通知其他模組資料已更新。
    function emitUpdate(eventName, payload) {
        if (Admin.core && typeof Admin.core.emit === 'function') {
            Admin.core.emit(eventName, payload);
        }
    }

    //
    //  loadResource：共用載入流程，並在成功／失敗時更新 state 與發送事件。
    //
    async function loadResource(cacheKey, stateKey, url, parser, options = {}) {
        if (isFresh(cacheKey, options.force)) {
            emitUpdate(`${cacheKey}:updated`, { data: parser(state[stateKey]), cached: true });
            return state[stateKey];
        }
        try {
            const raw = await data.fetchJson(url);
            state[stateKey] = parser(raw);
            markFetched(cacheKey);
            emitUpdate(`${cacheKey}:updated`, { data: state[stateKey], cached: false });
            return state[stateKey];
        } catch (err) {
            state[stateKey] = Array.isArray(state[stateKey]) ? [] : null;
            emitUpdate(`${cacheKey}:updated`, { data: state[stateKey], error: err });
            if (!options.silent && Admin.core && typeof Admin.core.handleError === 'function') {
                const label = RESOURCE_LABELS[cacheKey] || cacheKey;
                Admin.core.handleError(err, `${label}資料載入失敗`);
            }
            throw err;
        }
    }

    /**
     * 載入商品清單，可透過 options.force 強制刷新。
     * @param {{force?: boolean, silent?: boolean}} [options]
     * @returns {Promise<Array>}
     */
    data.loadProducts = function (options = {}) {
        return loadResource(
            'products',
            'allProducts',
            config.endpoints.product,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    /**
     * 依照快取 TTL 決定是否重新抓取商品清單。
     */
    data.ensureProducts = function (options = {}) {
        return data.loadProducts(options);
    };

    /**
     * 載入分類清單，與商品流程共用快取邏輯。
     * @param {{force?: boolean, silent?: boolean}} [options]
     */
    data.loadCategories = function (options = {}) {
        return loadResource(
            'categories',
            'allCategories',
            config.endpoints.category,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    /**
     * 依照快取 TTL 決定是否重新抓取分類清單。
     */
    data.ensureCategories = function (options = {}) {
        return data.loadCategories(options);
    };

    /**
     * 載入訂單資料，若非陣列則回傳空陣列避免錯誤。
     * @param {{force?: boolean, silent?: boolean}} [options]
     */
    data.loadOrders = function (options = {}) {
        return loadResource(
            'orders',
            'allOrders',
            config.endpoints.order,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    /**
     * 依照快取 TTL 決定是否重新抓取訂單資料。
     */
    data.ensureOrders = function (options = {}) {
        return data.loadOrders(options);
    };

    /**
     * 同步刷新商品、分類、訂單三種資源，並廣播結果。
     * @returns {Promise<PromiseSettledResult<any>[]>}
     */
    data.refreshAllData = async function () {
        const results = await Promise.allSettled([
            data.loadProducts({ force: true, silent: true }),
            data.loadCategories({ force: true, silent: true }),
            data.loadOrders({ force: true, silent: true })
        ]);
        // 將各資源刷新結果廣播給訂閱者（含成功/失敗資訊）
        emitUpdate('data:refreshed', { results });
        return results;
    };


    // 將資料層 API 掛載回全域命名空間，方便其他管理端模組呼叫
    Admin.data = data;
})(window);
