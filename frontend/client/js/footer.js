(function () {
    // 頁腳模組：自動建立 footer 結構並帶入站台設定中的客製化文字。
    const DEFAULT_TEXT = '© 2025 SnackForest. 保留所有權利。';

    /**
     * 將文字內容依換行切段插入頁腳，若無內容則使用預設版權。
     * @param {HTMLElement} container 目標容器。
     * @param {string} text 站台設定提供的頁腳文字。
     */
    function applyFooterText(container, text) {
        if (!container) return;
        const content = String(text || '').trim();
        const inner = container.querySelector('[data-footer-text]') || container;
        inner.innerHTML = '';
        if (!content) {
            const fallback = document.createElement('p');
            fallback.textContent = DEFAULT_TEXT;
            inner.appendChild(fallback);
            return;
        }
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
            if (idx > 0) inner.appendChild(document.createElement('br'));
            inner.appendChild(document.createTextNode(line));
        });
    }

    /**
     * 建立頁腳 DOM 並嘗試從站台設定載入客製化文案。
     * @returns {Promise<void>}
     */
    async function renderFooter() {
        const footer = document.getElementById('site-footer');
        if (!footer) return;
        footer.classList.add('site-footer');
        if (!footer.querySelector('[data-footer-text]')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'container text-center';
            const paragraph = document.createElement('p');
            paragraph.className = 'mb-0';
            paragraph.setAttribute('data-footer-text', '');
            paragraph.textContent = DEFAULT_TEXT;
            wrapper.appendChild(paragraph);
            footer.innerHTML = '';
            footer.appendChild(wrapper);
        }
        try {
            const cfg = await (typeof window.fetchSiteConfig === 'function'
                ? window.fetchSiteConfig()
                : Promise.resolve({}));
            const footerCfg = cfg && typeof cfg === 'object' ? cfg.footer : null;
            const text = footerCfg && typeof footerCfg.text === 'string' ? footerCfg.text : DEFAULT_TEXT;
            applyFooterText(footer, text);
        } catch (err) {
            console.warn('載入頁腳設定失敗，使用預設文字', err);
            applyFooterText(footer, DEFAULT_TEXT);
        }
    }

    /**
     * DOM ready helper：確保頁腳在元素可用時才開始渲染。
     * @param {Function} fn 要執行的初始化函式。
     */
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(renderFooter);
    window.renderSiteFooter = renderFooter;
})();
