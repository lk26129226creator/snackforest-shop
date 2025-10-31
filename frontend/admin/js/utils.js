(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const utils = Admin.utils || {};

    utils.escapeAttr = function (value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    utils.deepClone = function (value, fallback = null) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return fallback;
        }
    };

    utils.tryParseJson = function (value, fallback = null) {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    };

    utils.withRetry = async function (task, options = {}) {
        const retries = Number.isInteger(options.retries) ? options.retries : 0;
        const delay = options.delay || 0;
        let attempt = 0;
        let lastErr;
        while (attempt <= retries) {
            try {
                return await task();
            } catch (err) {
                lastErr = err;
                attempt += 1;
                if (attempt > retries) break;
                if (delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        throw lastErr;
    };

    utils.createHttpError = function (response, body) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.body = body;
        return error;
    };

    utils.handleHttpError = async function (response) {
        const text = await response.text();
        let payload;
        try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = text; }
        throw utils.createHttpError(response, payload);
    };

    utils.fetchJson = async function (url, options = {}) {
        const res = await fetch(url, Object.assign({ cache: 'no-store' }, options));
        if (!res.ok) {
            await utils.handleHttpError(res);
        }
        return res.json();
    };

    utils.debounce = function (fn, wait) {
        let timeoutId;
        return function debounced(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), wait);
        };
    };

    Admin.utils = utils;
})(window);
