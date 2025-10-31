(function () {
    const DEFAULT_TEXT = '© 2025 SnackForest. 保留所有權利。';

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
