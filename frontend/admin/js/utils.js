//
//  Admin 共用工具函式：涵蓋字串跳脫、深拷貝、HTTP helper 與非同步控制。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const utils = Admin.utils || {};

    /**
     * 將文字轉成安全的 HTML attribute 內容，避免 XSS。
     * @param {*} value 原始輸入值。
     * @returns {string}
     */
    utils.escapeAttr = function (value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /**
     * 深層拷貝物件，失敗時回傳 fallback。
     * @param {*} value 要拷貝的資料。
     * @param {*} [fallback=null] 拷貝失敗時的預設值。
     * @returns {*}
     */
    utils.deepClone = function (value, fallback = null) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return fallback;
        }
    };

    /**
     * 嘗試解析 JSON 字串，失敗時回傳 fallback。
     * @param {string} value 輸入的 JSON 字串。
     * @param {*} [fallback=null] 解析失敗時的回傳值。
     * @returns {*}
     */
    utils.tryParseJson = function (value, fallback = null) {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    };

    /**
     * 提供簡易重試機制，可設定次數與延遲。
     * @param {Function} task 要執行的非同步函式。
     * @param {{retries?: number, delay?: number}} [options]
     * @returns {Promise<*>}
     */
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

    /**
     * 以 fetch response 建立具備狀態碼資訊的錯誤物件。
     * @param {Response} response fetch 回傳的 Response。
     * @param {*} body 錯誤內容，用於除錯。
     * @returns {Error}
     */
    utils.createHttpError = function (response, body) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.body = body;
        return error;
    };

    /**
     * 將非 2xx 的 response 轉成帶狀態碼的錯誤並拋出。
     * @param {Response} response fetch 回傳的 Response。
     * @returns {Promise<never>}
     */
    utils.handleHttpError = async function (response) {
        const text = await response.text();
        let payload;
        try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = text; }
        throw utils.createHttpError(response, payload);
    };

    /**
     * fetch 包裝：自動關閉 cache 並在非 2xx 時拋錯。
     * @param {string} url 目標網址。
     * @param {RequestInit} [options] fetch 選項。
     * @returns {Promise<*>}
     */
    utils.fetchJson = async function (url, options = {}) {
        const res = await fetch(url, Object.assign({ cache: 'no-store' }, options));
        if (!res.ok) {
            await utils.handleHttpError(res);
        }
        return res.json();
    };

    /**
     * debounce helper，避免頻繁觸發造成效能問題。
     * @param {Function} fn 目標函式。
     * @param {number} wait 延遲毫秒數。
     * @returns {Function} 包裝後的 debounced 函式。
     */
    utils.debounce = function (fn, wait) {
        let timeoutId;
        return function debounced(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), wait);
        };
    };

    Admin.utils = utils;
})(window);
