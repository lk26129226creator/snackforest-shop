(function(){
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(() => {
        if (typeof window.registerAddToCartHandler === 'function') {
            window.registerAddToCartHandler();
        }

        if (typeof window.updateCartBadge === 'function') {
            window.updateCartBadge();
            window.addEventListener('cart:updated', () => {
                window.updateCartBadge();
                if (typeof window.bumpCartBadge === 'function') window.bumpCartBadge();
            });
        }

        const popover = window.SF_Popover;
        if (popover && typeof popover.initializeProductPopover === 'function') {
            popover.initializeProductPopover();
        }

        if (document.getElementById('homeCarousel')) {
            if (typeof window.initHomePage === 'function') window.initHomePage();
        }

        const productListEl = document.getElementById('product-list');
        if (productListEl) {
            if (typeof window.fetchProductsAndRender === 'function') window.fetchProductsAndRender();
        }

        const productDetailContainer = document.getElementById('product-detail-container');
        if (productDetailContainer) {
            const pid = new URLSearchParams(window.location.search).get('id');
            if (pid && typeof window.initProductDetail === 'function') {
                window.initProductDetail();
            }
        }

        if (document.getElementById('cart-items-container')) {
            if (typeof window.initCartPage === 'function') window.initCartPage();
        }
    });
})();
