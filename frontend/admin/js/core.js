(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const core = Admin.core || {};

    const eventBus = typeof EventTarget === 'function' ? new EventTarget() : document.createElement('span');
    const registeredHandlers = new Map();

    function createCustomEvent(type, detail) {
        if (typeof CustomEvent === 'function') {
            return new CustomEvent(type, { detail });
        }
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, false, false, detail);
        return evt;
    }

    core.on = function (type, handler, options) {
        eventBus.addEventListener(type, handler, options);
        if (!registeredHandlers.has(handler)) {
            registeredHandlers.set(handler, { type, options });
        }
        return function unsubscribe() {
            core.off(type, handler, options);
        };
    };

    core.off = function (type, handler, options) {
        eventBus.removeEventListener(type, handler, options);
        if (registeredHandlers.has(handler)) {
            registeredHandlers.delete(handler);
        }
    };

    core.emit = function (type, detail) {
        eventBus.dispatchEvent(createCustomEvent(type, detail));
    };

    core.resetHandlers = function () {
        registeredHandlers.forEach(({ type, options }, handler) => {
            eventBus.removeEventListener(type, handler, options);
        });
        registeredHandlers.clear();
    };

    function ensureNotificationHost() {
        if (!document || !document.body) return null;
        let host = document.getElementById('sf-admin-notifications');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'sf-admin-notifications';
        host.className = 'sf-admin-notifications position-fixed top-0 start-50 translate-middle-x p-3';
        host.style.zIndex = '1080';
        document.body.appendChild(host);
        return host;
    }

    function createAlertElement(level, message) {
        const div = document.createElement('div');
        div.className = `alert alert-${level} shadow-sm d-flex align-items-center gap-2`;
        div.setAttribute('role', 'alert');
        div.innerHTML = `<span class="flex-grow-1">${message}</span>`;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('aria-label', '關閉通知');
        closeBtn.addEventListener('click', () => {
            div.remove();
        });
        div.appendChild(closeBtn);
        return div;
    }

    core.notify = function (level, message, options = {}) {
        const host = ensureNotificationHost();
        if (!host || !message) return;
        const alertEl = createAlertElement(level, message);
        host.appendChild(alertEl);
        const ttl = typeof options.ttl === 'number' ? options.ttl : 4000;
        if (ttl > 0) {
            setTimeout(() => {
                alertEl.remove();
            }, ttl);
        }
    };

    core.notifySuccess = function (message, options) {
        core.notify('success', message, options);
    };

    core.notifyInfo = function (message, options) {
        core.notify('info', message, options);
    };

    core.notifyWarning = function (message, options) {
        core.notify('warning', message, options);
    };

    core.notifyError = function (message, options) {
        core.notify('danger', message, options);
    };

    core.handleError = function (error, context) {
        const prefix = context ? `[${context}] ` : '';
        console.error('[SnackForest] ' + prefix + (error?.message || error), error);
        core.notifyError(prefix + (error?.message || '發生未知錯誤'));
    };

    core.verifyDom = function (selectors) {
        if (!Array.isArray(selectors) || selectors.length === 0 || !document) return [];
        const missing = selectors.filter((selector) => !document.querySelector(selector));
        if (missing.length) {
            console.warn('[SnackForest] DOM verification missing elements:', missing);
        }
        return missing;
    };

    Admin.core = core;
    Admin.events = eventBus;
})(window);
