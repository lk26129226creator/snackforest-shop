(function() {
    //
    //  商品詳情頁面模組，負責載入與渲染指定商品。
    //
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';

    const {
        formatPrice = (v) => v,
        normalizeProduct = (p) => p,
    } = utils;

    /**
     * Initializes the product detail page.
     */
    async function initProductDetail() {
        const container = document.getElementById('product-detail-container');
        if (!container) return;

        const productId = new URLSearchParams(window.location.search).get('id');
        if (!productId) {
            container.innerHTML = '<div class="alert alert-warning">未提供商品 ID。</div>';
            return;
        }

        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>`;
        try {
            const res = await fetch(`${API_BASE}/products/${productId}`);
            if (!res.ok) {
                throw new Error(res.status === 404 ? '找不到該商品。' : `無法載入商品 (HTTP ${res.status})`);
            }
            const rawProduct = await res.json();
            const product = normalizeProduct(rawProduct);
            if (!product) throw new Error('商品資料格式不正確。');
            
            renderProductDetail(container, product);
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
            console.error(e);
        }
    }

    /**
     * Renders the product detail view into the container.
     */
    function renderProductDetail(container, product) {
        const metaItems = [
            { label: '產地', value: product.origin },
            { label: '生產日期', value: product.productionDate },
            { label: '有效日期', value: product.expiryDate },
        ].filter(item => item.value);

        container.innerHTML = `
            <div class="row g-5 pt-4">
                <div class="col-lg-7" id="gallery-col"></div>
                <div class="col-lg-5" id="info-col"></div>
            </div>
            <div class="row mt-4"><div class="col-12" id="intro-col"></div></div>
        `;

        // --- Render Gallery ---
        const galleryCol = container.querySelector('#gallery-col');
        galleryCol.innerHTML = `
            <img id="main-product-image" src="${product.imageUrl}" class="img-fluid rounded shadow-lg mb-3" alt="${product.name}">
            <div class="thumbs-wrapper d-flex align-items-center ${product.imageUrls.length <= 4 ? 'justify-content-center' : ''}">
                <button class="btn btn-outline-secondary thumb-nav me-2" id="thumb-prev" style="display:none;">◀</button>
                <div id="product-thumbs" class="thumbs-container d-flex gap-2">
                    ${product.imageUrls.map(src => `<img src="${src}" class="product-thumb img-thumbnail" alt="縮圖">`).join('')}
                </div>
                <button class="btn btn-outline-secondary thumb-nav ms-2" id="thumb-next" style="display:none;">▶</button>
            </div>`;

        // --- Render Info ---
        const infoCol = container.querySelector('#info-col');
        infoCol.innerHTML = `
            <h1 class="h3 mb-1">${product.name}</h1>
            <p class="text-muted mb-2">分類: ${product.categoryName}</p>
            <p class="fs-4 fw-bold text-primary mb-3">${formatPrice(product.price)}</p>
            
            ${metaItems.length ? `
            <div class="card mb-4 p-3">
                <div class="text-muted" style="font-size:0.95rem;">
                    ${metaItems.map(item => `<div>${item.label}：${item.value}</div>`).join('')}
                </div>
            </div>` : ''}

            <div class="card p-3">
                <div class="mb-3">
                    <label class="form-label">數量</label>
                    <div class="input-group" style="width:170px;">
                        <button class="btn btn-outline-secondary" id="dec-qty">-</button>
                        <input type="number" id="qty" class="form-control text-center" value="1" min="1">
                        <button class="btn btn-outline-secondary" id="inc-qty">+</button>
                    </div>
                </div>
                <div class="d-grid"><button id="add-to-cart-btn" class="btn btn-success btn-lg">加入購物車</button></div>
            </div>`;

        // --- Render Introduction ---
        container.querySelector('#intro-col').innerHTML = `
            <h3 class="h5 mb-2">商品介紹</h3>
            <div class="product-intro text-secondary" style="white-space: pre-wrap;">${product.introduction}</div>`;

        // --- Bind Events ---
        bindGalleryEvents(container, product);
        bindCartEvents(container, product);
    }

    function bindGalleryEvents(container, product) {
        const mainImage = container.querySelector('#main-product-image');
        container.querySelectorAll('.product-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => mainImage.src = thumb.src);
        });

        const thumbContainer = container.querySelector('#product-thumbs');
        const btnPrev = container.querySelector('#thumb-prev');
        const btnNext = container.querySelector('#thumb-next');
        
        const updateThumbNav = () => {
            if (!thumbContainer) return;
            const canScroll = thumbContainer.scrollWidth > thumbContainer.clientWidth;
            btnPrev.style.display = canScroll ? 'inline-block' : 'none';
            btnNext.style.display = canScroll ? 'inline-block' : 'none';
        };
        
        btnPrev.addEventListener('click', () => thumbContainer.scrollBy({ left: -100, behavior: 'smooth' }));
        btnNext.addEventListener('click', () => thumbContainer.scrollBy({ left: 100, behavior: 'smooth' }));
        
        setTimeout(updateThumbNav, 50);
        window.addEventListener('resize', updateThumbNav, { passive: true });
    }

    function bindCartEvents(container, product) {
        const qtyInput = container.querySelector('#qty');
        container.querySelector('#inc-qty')?.addEventListener('click', () => qtyInput.value = Math.max(1, Number(qtyInput.value) + 1));
        container.querySelector('#dec-qty')?.addEventListener('click', () => qtyInput.value = Math.max(1, Number(qtyInput.value) - 1));
        
        container.querySelector('#add-to-cart-btn')?.addEventListener('click', () => {
            if (window.addToCart) {
                window.addToCart(product.id, product.name, product.price, product.imageUrl, Number(qtyInput.value));
            } else {
                console.error('addToCart function is not available.');
            }
        });
    }

    // --- Global Interface & Initialization ---
    window.initProductDetail = initProductDetail;
    initProductDetail();
})();
