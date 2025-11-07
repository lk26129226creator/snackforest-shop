(function(){
    // 客戶端入口初始化：判斷當前頁面需要載入哪些模組並延遲等候 DOM 完成。

    /**
     * DOM ready helper：若文件仍在載入，延後執行直到 DOMContentLoaded。
     * @param {Function} fn 初始化回呼。
     */
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(() => {
        // --- 共用購物車按鈕相關 ---
        // 為每個「加入購物車」按鈕綁定點擊處理（若定義於 cart.js）。
        if (typeof window.registerAddToCartHandler === 'function') {
            window.registerAddToCartHandler();
        }

        // 更新導覽列購物車徽章，並在 cart:updated 時重新計算。
        if (typeof window.updateCartBadge === 'function') {
            window.updateCartBadge();
            window.addEventListener('cart:updated', () => {
                window.updateCartBadge();
                if (typeof window.bumpCartBadge === 'function') window.bumpCartBadge();
            });
        }

        // 初始化商品懸浮快覽（若有載入 popover.js）。
        const popover = window.SF_Popover;
        if (popover && typeof popover.initializeProductPopover === 'function') {
            popover.initializeProductPopover();
        }

        // 首頁英雄區與輪播初始化。
        if (document.getElementById('homeCarousel')) {
            if (typeof window.initHomePage === 'function') window.initHomePage();
        }

        // 商品列表頁載入：fetchProductsAndRender 會自動渲染卡片。
        const productListEl = document.getElementById('product-list');
        if (productListEl) {
            if (typeof window.fetchProductsAndRender === 'function') window.fetchProductsAndRender();
        }

        // 商品詳情頁：依 URL 參數是否帶 id 決定是否觸發初始化。
        const productDetailContainer = document.getElementById('product-detail-container');
        if (productDetailContainer) {
            const pid = new URLSearchParams(window.location.search).get('id');
            if (pid && typeof window.initProductDetail === 'function') {
                window.initProductDetail();
            }
        }

        // 購物車頁面載入：觸發 cart-page.js 的初始化流程。
        if (document.getElementById('cart-items-container')) {
            if (typeof window.initCartPage === 'function') window.initCartPage();
        }
    });
})();
