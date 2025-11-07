//
//  管理後台核心模組：提供事件匯流排、通知提醒與錯誤處理基礎功能，
//  讓其他 admin JS 可以共享統一的工具與狀態。
//
(function (window) {
    // 建立全域命名空間，避免多個模組互相覆寫
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const core = Admin.core || {};

    // 事件匯流排：若瀏覽器支援 EventTarget 則直接使用，否則建立一個 span 元素代替。
    const eventBus = typeof EventTarget === 'function' ? new EventTarget() : document.createElement('span');
    const registeredHandlers = new Map();

    // 建立 CustomEvent，兼容舊版瀏覽器。
    function createCustomEvent(type, detail) {
        if (typeof CustomEvent === 'function') {
            return new CustomEvent(type, { detail });
        }
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(type, false, false, detail);
        return evt;
    }

    /**
     * 訂閱管理端事件匯流排，讓模組之間以自訂事件交換資料。
     * @param {string} type 事件名稱，建議加上模組前綴。
     * @param {EventListener} handler 觸發時要執行的監聽函式。
     * @param {AddEventListenerOptions|boolean} [options] 傳遞給 addEventListener 的選項。
     * @returns {Function} 解除訂閱的便捷函式。
     */
    core.on = function (type, handler, options) {
        eventBus.addEventListener(type, handler, options);
        if (!registeredHandlers.has(handler)) {
            registeredHandlers.set(handler, { type, options });
        }
        return function unsubscribe() {
            core.off(type, handler, options);
        };
    };

    /**
     * 取消事件訂閱，避免重複處理或記憶體洩漏。
     * @param {string} type 事件名稱。
     * @param {EventListener} handler 先前註冊的函式。
     * @param {AddEventListenerOptions|boolean} [options] 與訂閱時相同的參數。
     */
    core.off = function (type, handler, options) {
        eventBus.removeEventListener(type, handler, options);
        if (registeredHandlers.has(handler)) {
            registeredHandlers.delete(handler);
        }
    };

    /**
     * 對事件匯流排廣播資料，通知其他模組執行對應處理。
     * @param {string} type 自訂事件名稱。
     * @param {*} detail 傳遞的附加資料。
     */
    core.emit = function (type, detail) {
        eventBus.dispatchEvent(createCustomEvent(type, detail));
    };

    /**
     * 一次性移除所有已註冊的監聽函式，多用於登出或熱載場景。
     */
    core.resetHandlers = function () {
        registeredHandlers.forEach(({ type, options }, handler) => {
            eventBus.removeEventListener(type, handler, options);
        });
        registeredHandlers.clear();
    };

    // 確保通知容器存在於 DOM 中，並採用固定定位顯示於畫面上方。
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

    // 訂單提示容器：如未預先存在則建立在 body 底部，方便顯示客製浮動提示。
    function ensureOrderToastHost() {
        if (!document || !document.body) return null;
        let host = document.getElementById('sf-admin-order-toasts');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'sf-admin-order-toasts';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-atomic', 'true');
        document.body.appendChild(host);
        return host;
    }

    // 產生 Bootstrap alert 結構，附帶關閉按鈕，可透過 core.notify 重複使用。
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

    // 顯示通知訊息，可選擇 TTL 自動消失，預設 4 秒。
    /**
     * 以 Bootstrap Alert 顯示通知訊息，預設自動淡出。
     * @param {string} level 對應 Bootstrap alert 類型，例如 success、info。
     * @param {string} message 提示內容。
     * @param {{ttl?: number}} [options] 可調整停留時間（毫秒）。
     */
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

    /**
     * 顯示成功通知樣式，底層沿用 core.notify。
     * @param {string} message 提示內容。
     * @param {{ttl?: number}} [options] 可調整停留時間。
     */
    core.notifySuccess = function (message, options) {
        core.notify('success', message, options);
    };

    /**
     * 顯示資訊通知樣式。
     */
    core.notifyInfo = function (message, options) {
        core.notify('info', message, options);
    };

    /**
     * 顯示警告通知樣式。
     */
    core.notifyWarning = function (message, options) {
        core.notify('warning', message, options);
    };

    /**
     * 顯示錯誤通知樣式。
     */
    core.notifyError = function (message, options) {
        core.notify('danger', message, options);
    };

    function createOrderToastElement(options = {}) {
        const {
            icon = '🛒',
            orderId,
            recipientName,
            total,
            createdAt,
            title,
            message,
            subtitle
        } = options;

        const wrapper = document.createElement('div');
        wrapper.className = 'admin-order-toast';
        wrapper.setAttribute('role', 'status');

        const iconEl = document.createElement('div');
        iconEl.className = 'admin-order-toast-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.textContent = icon;

        const contentEl = document.createElement('div');
        contentEl.className = 'admin-order-toast-content';

        const titleEl = document.createElement('p');
        titleEl.className = 'admin-order-toast-title';
        titleEl.textContent = title || `新訂單 #${orderId || '?'}`;

        const defaultMessage = recipientName
            ? `${recipientName} 的訂單已送出`
            : '收到一筆新的客戶訂單';
        const messageEl = document.createElement('p');
        messageEl.className = 'admin-order-toast-message';
        messageEl.textContent = message || defaultMessage;

        let timeLabel = '';
        if (createdAt) {
            const parsed = new Date(createdAt);
            if (!Number.isNaN(parsed.getTime())) {
                try {
                    timeLabel = parsed.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                } catch (_) {
                    timeLabel = parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                }
            }
        }

        const amountLabel = typeof total === 'number' && !Number.isNaN(total)
            ? `金額 NT$${Number(total || 0).toLocaleString()}`
            : '';

        const subtitleText = subtitle || [amountLabel, timeLabel].filter(Boolean).join(' · ');
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'admin-order-toast-sub';
        if (subtitleText) {
            subtitleEl.textContent = subtitleText;
        } else {
            subtitleEl.textContent = '請前往訂單管理查看詳情';
        }

        contentEl.appendChild(titleEl);
        contentEl.appendChild(messageEl);
        contentEl.appendChild(subtitleEl);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'admin-order-toast-close';
        closeBtn.setAttribute('aria-label', '關閉提示');
        closeBtn.textContent = '✕';

        wrapper.appendChild(iconEl);
        wrapper.appendChild(contentEl);
        wrapper.appendChild(closeBtn);

        return { wrapper, closeBtn };
    }

    /**
     * 顯示管理端訂單提示：於右下角淡入，支援滑鼠暫停與自動關閉。
     * @param {Object} options 提示內容與外觀設定。
     * @param {string} [options.toastId] 自訂識別碼，可避免重複顯示。
     * @param {string|number} [options.orderId] 訂單編號。
     * @param {string} [options.recipientName] 收件人名稱。
     * @param {number} [options.total] 訂單金額。
     * @param {string} [options.createdAt] ISO 格式時間，會轉成小字說明。
     * @param {number} [options.ttl=6500] 停留毫秒數，<=0 則不自動關閉。
     * @returns {HTMLElement|null} 成功時回傳提示元素。
     */
    core.showOrderToast = function (options = {}) {
        const host = ensureOrderToastHost();
        if (!host) return null;

        const toastId = options.toastId || options.id;
        if (toastId) {
            const existing = host.querySelector(`.admin-order-toast[data-toast-id="${toastId}"]`);
            if (existing) {
                existing.classList.remove('hide');
                existing.classList.add('show');
                return existing;
            }
        }

        const { wrapper, closeBtn } = createOrderToastElement(options);
        if (toastId) {
            wrapper.dataset.toastId = toastId;
        }

        while (host.children.length >= 4) {
            host.removeChild(host.firstElementChild);
        }

        host.appendChild(wrapper);

        const ttl = typeof options.ttl === 'number' ? options.ttl : 6500;
        let hideTimer = null;

        const removeToast = () => {
            wrapper.remove();
        };

        const hideToast = () => {
            if (wrapper.classList.contains('hide')) return;
            wrapper.classList.remove('show');
            wrapper.classList.add('hide');
            setTimeout(removeToast, 220);
        };

        const scheduleHide = (delay) => {
            if (ttl <= 0) return;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(hideToast, Math.max(delay, 280));
        };

        closeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            hideToast();
        });

        wrapper.addEventListener('mouseenter', () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        });

        wrapper.addEventListener('mouseleave', () => {
            if (ttl > 0) {
                scheduleHide(2000);
            }
        });

        requestAnimationFrame(() => {
            wrapper.classList.add('show');
            if (ttl > 0) {
                scheduleHide(ttl);
            }
        });

        return wrapper;
    };

    /**
     * 統一錯誤處理：除了輸出 console 錯誤，也會彈出紅色提示。
     * @param {Error|string} error 捕捉到的錯誤物件或字串。
     * @param {string} [context] 來源描述，會加到訊息前綴。
     */
    core.handleError = function (error, context) {
        const prefix = context ? `[${context}] ` : '';
        console.error('[SnackForest] ' + prefix + (error?.message || error), error);
        core.notifyError(prefix + (error?.message || '發生未知錯誤'));
    };

    /**
     * 快速檢查必要的 DOM 節點是否存在，便於在開發階段及早發現缺漏。
     * @param {string[]} selectors 要檢查的 CSS 選擇器陣列。
     * @returns {string[]} 未找到的選擇器清單。
     */
    core.verifyDom = function (selectors) {
        if (!Array.isArray(selectors) || selectors.length === 0 || !document) return [];
        const missing = selectors.filter((selector) => !document.querySelector(selector));
        if (missing.length) {
            console.warn('[SnackForest] DOM verification missing elements:', missing);
        }
        return missing;
    };

    // 將核心 API 與事件匯流排掛載至全域，供其他 admin 模組共用
    Admin.core = core;
    Admin.events = eventBus;
})(window);
