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

    function isFresh(cacheKey, force) {
        if (force) return false;
        const fetchedAt = state.cacheMeta?.[cacheKey] || 0;
        return fetchedAt && (Date.now() - fetchedAt) < CACHE_TTL;
    }

    function markFetched(cacheKey) {
        if (!state.cacheMeta) state.cacheMeta = {};
        state.cacheMeta[cacheKey] = Date.now();
    }

    function emitUpdate(eventName, payload) {
        if (Admin.core && typeof Admin.core.emit === 'function') {
            Admin.core.emit(eventName, payload);
        }
    }

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

    data.loadProducts = function (options = {}) {
        return loadResource(
            'products',
            'allProducts',
            config.endpoints.product,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    data.loadCategories = function (options = {}) {
        return loadResource(
            'categories',
            'allCategories',
            config.endpoints.category,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    data.loadOrders = function (options = {}) {
        return loadResource(
            'orders',
            'allOrders',
            config.endpoints.order,
            (raw) => Array.isArray(raw) ? raw : [],
            options
        );
    };

    data.refreshAllData = async function () {
        const results = await Promise.allSettled([
            data.loadProducts({ force: true, silent: true }),
            data.loadCategories({ force: true, silent: true }),
            data.loadOrders({ force: true, silent: true })
        ]);
        emitUpdate('data:refreshed', { results });
        return results;
    };

    data.ensureProducts = function () {
        return data.loadProducts({ force: false });
    };

    data.ensureCategories = function () {
        return data.loadCategories({ force: false });
    };

    data.ensureOrders = function () {
        return data.loadOrders({ force: false });
    };

    Admin.data = data;
})(window);
