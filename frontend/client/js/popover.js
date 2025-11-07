
//
//  商品卡片滑過預覽 Popover 模組：
//    - 延遲顯示，以避免使用者只是快速滑過卡片。
//    - 從 API 抓取商品詳情並顯示多張圖片、價格、分類等資訊。
//    - 提供加入購物車、切換縮圖等互動。
//
(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((n) => n);
    const safeStr = utils.safeStr || ((v) => v ?? '');

    // 快取 DOM 參照與狀態，避免重複查找造成效能浪費。
    let hoverTimer;
    let productHoverPopover = null;
    let popoverProductName = null;
    let popoverProductImage = null;
    let popoverProductPrice = null;
    let popoverProductCategory = null;
    let popoverViewDetailsBtn = null;
    let currentPopoverProductId = null;
    let currentPopoverCard = null;

    /**
     * 依卡片上的 id 向後端取得完整商品資訊，失敗時回傳 null。
     * @param {string|number} productId 商品編號。
     * @returns {Promise<?Object>}
     */
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

    /**
     * 從商品卡片的連結解析出商品編號。
     * @param {HTMLElement} card 商品卡片元素。
     * @returns {?string}
     */
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

    /**
     * 確保背景遮罩存在，提供點擊背景關閉 popover 的體驗。
     * @returns {HTMLElement}
     */
    function ensureOverlay() {
        let overlay = document.getElementById('popover-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'popover-overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    //
    //  進入顯示流程：
    //    1. 若同一商品已顯示則跳過。
    //    2. 取得詳細資料與圖片後填入內容。
    //    3. 顯示 popover 並在卡片上套用視覺效果。
    //
    /**
     * 顯示商品 popover，並載入詳細資料與圖片。
     * @param {HTMLElement} productElement 觸發的商品卡片。
     * @param {string|number} productId 商品編號。
     */
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

    /**
     * 整理商品圖片陣列，缺圖時回傳 normalize 後的空字串陣列。
     * @param {Object} product 商品資料。
     * @returns {string[]}
     */
    function collectProductImages(product) {
        let imgs = [];
        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            imgs = product.imageUrls.slice();
        } else if (product.imageUrl) {
            imgs = [product.imageUrl];
        }
        return imgs.map((src) => normalizeImageUrl(src));
    }

    //
    //  將資料填入 popover：標題、價格、分類、介紹與縮圖列表。
    //  會串接 wirePopoverControls 與 populateMetadata 做細部互動設定。
    //
    /**
     * 將資料填入 popover，並綁定互動控制。
     * @param {Object} product 商品資料。
     * @param {string[]} imgs 圖片陣列。
     * @param {string|number} productId 商品編號。
     */
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

    // 註冊縮圖導覽、數量調整與加入購物車按鈕的事件。
    /**
     * 註冊縮圖導覽、數量調整與加入購物車按鈕事件。
     * @param {string[]} imgs 圖片陣列。
     * @param {Object} product 商品資料。
     */
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

    // 額外補充資訊（產地、效期）若缺少則以破折號顯示，保持欄位整齊。
    /**
     * 填入產地/生產/效期等補充資訊。
     * @param {Object} product 商品資料。
     */
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

    // 顯示指定索引的圖片，支援循環切換並同步更新縮圖高亮。
    /**
     * 顯示指定索引的圖片並同步縮圖高亮。
     * @param {number} idx 目標索引。
     * @param {string[]} imgs 圖片陣列。
     */
    function showIndex(idx, imgs) {
        if (!imgs || imgs.length === 0 || !popoverProductImage) return;
        const len = imgs.length;
        const index = ((idx % len) + len) % len;
        popoverProductImage.src = imgs[index];
        window._currentPopoverIndex = index;
        updateThumbHighlight(index);
    }

    /**
     * 更新縮圖的選取狀態。
     * @param {number} activeIndex 當前索引。
     */
    function updateThumbHighlight(activeIndex) {
        const nodes = document.querySelectorAll('#popover-thumbs .popover-thumb');
        nodes.forEach((node) => node.classList.remove('active-thumb'));
        const active = document.querySelector(`#popover-thumbs .popover-thumb[data-index='${activeIndex}']`);
        if (active) active.classList.add('active-thumb');
    }

    // 關閉 popover 並重置相關狀態與動畫樣式。
    /**
     * 關閉 popover 並重置狀態與動畫。
     */
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

    // 滑入卡片時啟動定時器，停留超過 3 秒才展開 popover，降低干擾感。
    /**
     * 滑入商品卡片時啟動延遲顯示 popover。
     * @param {MouseEvent} event
     */
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

    /**
     * 滑出商品卡片時清除定時器，避免觸發 popover。
     */
    function handleProductMouseOut() {
        clearTimeout(hoverTimer);
    }

    // 快取常用 DOM 元件、註冊關閉與 ESC 熱鍵，並預設隱藏 popup。
    /**
     * 快取常用 DOM 元件並註冊關閉與熱鍵事件。
     */
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

    // 將滑入／滑出事件綁在商品卡片上，供列表渲染後呼叫。
    /**
     * 將滑入／滑出事件綁在商品卡片上，供列表渲染後呼叫。
     * @param {HTMLElement} card 商品卡片。
     */
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
