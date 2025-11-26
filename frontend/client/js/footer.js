(function () {
    // 頁腳模組：自動建立 footer 結構並帶入站台設定中的客製化文字。
    const DEFAULT_TEXT = '© ' + (new Date()).getFullYear() + ' SnackForest. 保留所有權利。';

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

    function createIconLink(href, iconClass, label) {
        const a = document.createElement('a');
        a.href = href || '#';
        a.setAttribute('aria-label', label || 'social');
        a.innerHTML = '<i class="' + iconClass + '"></i>';
        return a;
    }

    function renderFooter() {
        try {
            // 如果已存在則不重複建立
            if (document.querySelector('.client-footer')) return;

            const footer = document.createElement('footer');
            footer.className = 'client-footer';

            // mobile-first 主體區塊（也用於桌機）
            const mobile = document.createElement('div');
            mobile.className = 'client-footer-mobile';

            const inner = document.createElement('div');
            inner.className = 'client-footer-mobile-inner';

            // 左側：僅顯示品牌 (已移除商品/購物車/會員的連結)
            const left = document.createElement('div');
            left.className = 'footer-left';
            const brand = document.createElement('a');
            brand.className = 'brand-signature';
            brand.href = 'index.html';
            brand.textContent = 'SnackForest';
            left.appendChild(brand);

            // 右側：社群 + 聯絡
            const right = document.createElement('div');
            right.className = 'footer-right';

            const social = document.createElement('div');
            social.className = 'social-row';
            social.appendChild(createIconLink('#', 'fa-brands fa-facebook-f', 'facebook'));
            social.appendChild(createIconLink('#', 'fa-brands fa-instagram', 'instagram'));
            social.appendChild(createIconLink('#', 'fa-brands fa-youtube', 'youtube'));
            right.appendChild(social);

            const contact = document.createElement('div');
            contact.className = 'contact-row';
            const mail = document.createElement('a'); mail.href = 'mailto:snackforest1688@gmail.com'; mail.textContent = 'snackforest1688@gmail.com';
            const phone = document.createElement('a'); phone.href = 'tel:0909585898'; phone.textContent = '0909-585-898'; phone.style.fontWeight = '600';
            contact.appendChild(mail);
            contact.appendChild(phone);
            right.appendChild(contact);

            inner.appendChild(left);
            inner.appendChild(right);
            mobile.appendChild(inner);

            // 版權 / 自訂文字
            const textWrap = document.createElement('div');
            textWrap.className = 'client-footer-text';
            textWrap.setAttribute('data-footer-text', '');
            mobile.appendChild(textWrap);

            // add background image element so whole image is rendered (not cropped)
            const bgWrap = document.createElement('div');
            bgWrap.className = 'footer-bg';
            const bgImg = document.createElement('img');
            bgImg.alt = 'SnackForest footer background';
            bgImg.src = '/frontend/images/branding/去背森林風頁腳.png';
            bgWrap.appendChild(bgImg);
            footer.appendChild(bgWrap);

            footer.appendChild(mobile);

            // insert after main if exists, otherwise append to body
            const main = document.querySelector('main');
            if (main && main.parentNode) main.parentNode.insertBefore(footer, main.nextSibling);
            else document.body.appendChild(footer);

            // try to read footer text from various site config objects
            const cfg = window.SITE || window.SITE_CONFIG || window.SF_SITE || window.SF_SITE_CONFIG || window.site || window.sfSite || null;
            const footerText = cfg && cfg.footer && (cfg.footer.text || cfg.footer) ? (cfg.footer.text || cfg.footer) : '';
            applyFooterText(footer, footerText);
        } catch (e) {
            // avoid breaking page if footer rendering fails
            // eslint-disable-next-line no-console
            console && console.warn && console.warn('renderFooter error', e);
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
