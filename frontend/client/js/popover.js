(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((n) => n);
    const safeStr = utils.safeStr || ((v) => v ?? '');

    let hoverTimer;
    let productHoverPopover = null;
    let popoverProductName = null;
    let popoverProductImage = null;
    let popoverProductPrice = null;
    let popoverProductCategory = null;
    let popoverViewDetailsBtn = null;
    let currentPopoverProductId = null;
    let currentPopoverCard = null;

    async function fetchProductDetailsForPopover(productId) {
        try {
            const res = await fetch(API_BASE + '/products/' + productId);
            if (!res.ok) throw new Error('Failed to fetch product details: ' + res.status);
            return await res.json();
        } catch (e) {
            console.error('Error fetching product details for popover:', e);
            return null;
        }
    }

    function computeProductIdFromCard(card) {
        if (!card) return null;
        const anchor = card.querySelector('a[href*="id="]');
        if (!anchor) return null;
        try {
            const url = new URL(anchor.href, window.location.href);
            return url.searchParams.get('id');
        } catch (e) {
            const href = anchor.getAttribute('href') || '';
            const match = href.match(/id=([^&]+)/);
            return match ? decodeURIComponent(match[1]) : null;
        }
    }

    function ensureOverlay() {
        let overlay = document.getElementById('popover-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'popover-overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    async function showProductPopover(productElement, productId) {
        if (!productHoverPopover || !productId) return;
        if (currentPopoverProductId === productId) return;
        const product = await fetchProductDetailsForPopover(productId);
        if (!product) {
            currentPopoverProductId = null;
            return;
        }
        currentPopoverProductId = productId;

        const imgs = collectProductImages(product);
        populatePopoverContent(product, imgs, productId);

        productHoverPopover.style.display = 'block';
        const overlay = ensureOverlay();
        overlay.classList.add('show');
        overlay.onclick = () => hideProductPopover();
        setTimeout(() => productHoverPopover.classList.add('show'), 10);
        if (currentPopoverCard && currentPopoverCard !== productElement) {
            currentPopoverCard.classList.remove('hover-pop-scale');
        }
        currentPopoverCard = productElement;
        currentPopoverCard.classList.add('hover-pop-scale');
    }

    function collectProductImages(product) {
        let imgs = [];
        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            imgs = product.imageUrls.slice();
        } else if (product.imageUrl) {
            imgs = [product.imageUrl];
        }
        return imgs.map((src) => normalizeImageUrl(src));
    }

    function populatePopoverContent(product, imgs, productId) {
        if (popoverProductName) popoverProductName.textContent = product.name || '';
        if (popoverProductPrice) popoverProductPrice.textContent = formatPrice(product.price);
        if (popoverProductCategory) popoverProductCategory.textContent = '分類: ' + (product.categoryName || '');
        if (popoverViewDetailsBtn) popoverViewDetailsBtn.href = 'product.html?id=' + encodeURIComponent(productId);

        if (popoverProductImage) {
            popoverProductImage.src = imgs.length ? imgs[0] : normalizeImageUrl(null);
        }

        const introEl = document.getElementById('popover-introduction');
        if (introEl) introEl.textContent = safeStr(product.introduction || product.remark || '');

        const thumbsContainer = document.getElementById('popover-thumbs');
        if (thumbsContainer) {
            thumbsContainer.innerHTML = '';
            imgs.forEach((url, idx) => {
                const thumb = document.createElement('img');
                thumb.src = url;
                thumb.className = 'img-thumbnail popover-thumb';
                thumb.style.cursor = 'pointer';
                thumb.dataset.index = String(idx);
                thumb.addEventListener('click', () => {
                    showIndex(idx, imgs);
                    try { thumb.scrollIntoView({ behavior: 'smooth', inline: 'center' }); } catch (e) {}
                });
                thumbsContainer.appendChild(thumb);
            });
        }

        window._currentPopoverIndex = window._currentPopoverIndex || 0;
        showIndex(window._currentPopoverIndex, imgs);

        wirePopoverControls(imgs, product);
        populateMetadata(product);
    }

    function wirePopoverControls(imgs, product) {
        const popPrev = document.getElementById('popover-thumb-prev');
        const popNext = document.getElementById('popover-thumb-next');
        const thumbsContainer = document.getElementById('popover-thumbs');
        const popQtyEl = document.getElementById('popover-qty');
        const popInc = document.getElementById('popover-inc-qty');
        const popDec = document.getElementById('popover-dec-qty');
        const popAdd = document.getElementById('popover-add-to-cart');

        function scrollThumbs(delta) {
            if (!thumbsContainer) return;
            const firstThumb = thumbsContainer.querySelector('.popover-thumb');
            const width = firstThumb ? firstThumb.clientWidth + 12 : 100;
            thumbsContainer.scrollBy({ left: delta * width * 2, behavior: 'smooth' });
        }

        if (popPrev) popPrev.onclick = (ev) => { ev.stopPropagation(); showIndex(window._currentPopoverIndex - 1, imgs); scrollThumbs(-1); };
        if (popNext) popNext.onclick = (ev) => { ev.stopPropagation(); showIndex(window._currentPopoverIndex + 1, imgs); scrollThumbs(1); };
        if (popQtyEl) popQtyEl.value = 1;
        if (popInc) popInc.onclick = () => {
            if (!popQtyEl) return;
            popQtyEl.value = Number(popQtyEl.value || 1) + 1;
        };
        if (popDec) popDec.onclick = () => {
            if (!popQtyEl) return;
            const next = Number(popQtyEl.value || 1) - 1;
            popQtyEl.value = next > 0 ? next : 1;
        };
        if (popAdd) popAdd.onclick = () => {
            const qty = popQtyEl ? Number(popQtyEl.value || 1) : 1;
            const preview = popoverProductImage ? popoverProductImage.src : '';
            try {
                window.addToCart(product.id || product.idProducts, product.name, product.price, preview, qty);
            } catch (e) {
                console.error('Unable to add item from popover', e);
            }
        };
    }

    function populateMetadata(product) {
        try {
            const originEl = document.getElementById('popover-origin');
            const prodEl = document.getElementById('popover-production-date');
            const expEl = document.getElementById('popover-expiry-date');
            const originTxt = safeStr(product.origin || product.Origin || '—');
            const prodTxt = safeStr(product.productionDate || product.ProductionDate || '—');
            const expTxt = safeStr(product.expiryDate || product.ExpiryDate || '—');
            if (originEl) originEl.querySelector('span').textContent = originTxt;
            if (prodEl) prodEl.querySelector('span').textContent = prodTxt;
            if (expEl) expEl.querySelector('span').textContent = expTxt;
        } catch (e) {
            console.warn('Failed to populate popover metadata', e);
        }
    }

    function showIndex(idx, imgs) {
        if (!imgs || imgs.length === 0 || !popoverProductImage) return;
        const len = imgs.length;
        const index = ((idx % len) + len) % len;
        popoverProductImage.src = imgs[index];
        window._currentPopoverIndex = index;
        updateThumbHighlight(index);
    }

    function updateThumbHighlight(activeIndex) {
        const nodes = document.querySelectorAll('#popover-thumbs .popover-thumb');
        nodes.forEach((node) => node.classList.remove('active-thumb'));
        const active = document.querySelector(`#popover-thumbs .popover-thumb[data-index='${activeIndex}']`);
        if (active) active.classList.add('active-thumb');
    }

    function hideProductPopover() {
        if (!productHoverPopover) return;
        productHoverPopover.classList.remove('show');
        setTimeout(() => { productHoverPopover.style.display = 'none'; }, 260);
        const overlay = document.getElementById('popover-overlay');
        if (overlay) overlay.classList.remove('show');
        if (currentPopoverCard) {
            currentPopoverCard.classList.remove('hover-pop-scale');
            currentPopoverCard = null;
        }
        currentPopoverProductId = null;
        const thumbsContainer = document.getElementById('popover-thumbs');
        if (thumbsContainer) thumbsContainer.innerHTML = '';
        const popQtyEl = document.getElementById('popover-qty');
        if (popQtyEl) popQtyEl.value = 1;
    }

    function handleProductMouseOver(event) {
        const productCard = event.target.closest('.product-card');
        if (!productCard) return;
        const productId = computeProductIdFromCard(productCard);
        if (!productId) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            showProductPopover(productCard, productId);
        }, 3000);
    }

    function handleProductMouseOut() {
        clearTimeout(hoverTimer);
    }

    function initializeProductPopover() {
        productHoverPopover = document.getElementById('product-hover-popover');
        popoverProductName = document.getElementById('popover-product-name');
        popoverProductImage = document.getElementById('popover-product-image');
        popoverProductPrice = document.getElementById('popover-product-price');
        popoverProductCategory = document.getElementById('popover-product-category');
        popoverViewDetailsBtn = document.getElementById('popover-view-details-btn');
        if (productHoverPopover) {
            productHoverPopover.addEventListener('mouseover', () => clearTimeout(hoverTimer));
            productHoverPopover.style.display = 'none';
        }
        const popoverCloseBtn = document.getElementById('popover-close-btn');
        if (popoverCloseBtn) popoverCloseBtn.addEventListener('click', hideProductPopover);
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' || ev.key === 'Esc') {
                hideProductPopover();
            }
        });
    }

    function bindProductCard(card) {
        if (!card) return;
        card.addEventListener('mouseenter', handleProductMouseOver);
        card.addEventListener('mouseleave', handleProductMouseOut);
    }

    window.SF_Popover = {
        initializeProductPopover,
        bindProductCard,
        showProductPopover,
        hideProductPopover,
        handleProductMouseOver,
        handleProductMouseOut
    };

    window.showProductPopover = showProductPopover;
    window.hideProductPopover = hideProductPopover;
    window.handleProductMouseOver = handleProductMouseOver;
    window.handleProductMouseOut = handleProductMouseOut;
})();
