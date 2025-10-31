(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const formatPrice = utils.formatPrice || ((v) => v);
    const safeStr = utils.safeStr || ((v) => v ?? '');
    const normalizeImageUrl = utils.normalizeImageUrl || (window.normalizeImageUrl || ((u) => u || ''));
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || '/frontend/images/products/no-image.svg';

    async function initProductDetail() {
        const container = document.getElementById('product-detail-container');
        if (!container) return;
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        if (!productId) {
            container.innerHTML = '<div class="alert alert-danger">找不到商品 ID。</div>';
            return;
        }
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>`;
        try {
            const res = await fetch(API_BASE + '/products/' + productId);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const product = await res.json();
            renderProductDetail(product);
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
            console.error(e);
        }
    }

    function renderProductDetail(product) {
        const container = document.getElementById('product-detail-container');
        if (!container) return;
        let rawImgs = [];
        if (Array.isArray(product.imageUrls)) rawImgs = product.imageUrls;
        else if (product.imageUrl) rawImgs = [product.imageUrl];
        const imgs = rawImgs.map((u) => normalizeImageUrl(u)).filter(Boolean);
        const mainImage = imgs.length ? imgs[0] : fallbackImage;

        container.innerHTML = `
            <div class="row g-5 pt-4">
                <div class="col-lg-7">
                    <img id="main-product-image" src="${mainImage}" class="img-fluid rounded shadow-lg" alt="${product.name}">
                    <div class="thumbs-wrapper d-flex align-items-center mt-3">
                        <button class="btn btn-outline-secondary thumb-nav me-2" id="thumb-prev" aria-label="上一張">◀</button>
                        <div id="product-thumbs" class="thumbs-container d-flex gap-2"></div>
                        <button class="btn btn-outline-secondary thumb-nav ms-2" id="thumb-next" aria-label="下一張">▶</button>
                    </div>
                </div>
                <div class="col-lg-5">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h1 class="h3 mb-1">${product.name}</h1>
                            <p class="text-muted mb-1">分類: ${product.categoryName || ''}</p>
                            <p class="fs-4 fw-bold text-primary mb-0">${formatPrice(product.price)}</p>
                        </div>
                    </div>

                    <div id="product-meta-card" class="card my-3 p-3">
                        <div id="product-metadata" class="text-muted" style="font-size:0.95rem;"></div>
                    </div>

                    <div class="card my-4 p-3">
                        <div class="mb-3">
                            <label class="form-label">數量</label>
                            <div class="input-group" style="width:170px;">
                                <button class="btn btn-outline-secondary" id="dec-qty">-</button>
                                <input type="number" id="qty" class="form-control text-center" value="1" min="1">
                                <button class="btn btn-outline-secondary" id="inc-qty">+</button>
                            </div>
                        </div>
                        <div class="d-grid gap-2"><button id="add-to-cart-btn" class="btn btn-success btn-lg">加入購物車</button></div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div id="product-introduction-wrapper" class="mt-4">
                        <h3 class="h5 mb-2">商品介紹</h3>
                        <div id="product-introduction" class="product-intro text-secondary" style="white-space: pre-wrap;">${product.introduction || product.remark || ''}</div>
                    </div>
                </div>
            </div>
        `;

        const thumbs = document.getElementById('product-thumbs');
        imgs.forEach((src) => {
            const thumbImg = document.createElement('img');
            thumbImg.src = src;
            thumbImg.className = 'product-thumb img-thumbnail';
            thumbImg.style.width = '80px';
            thumbImg.style.height = '80px';
            thumbImg.style.objectFit = 'cover';
            thumbImg.style.cursor = 'pointer';
            thumbImg.addEventListener('click', () => {
                const main = document.getElementById('main-product-image');
                if (main) main.src = src;
            });
            thumbs.appendChild(thumbImg);
        });

        const thumbContainer = document.getElementById('product-thumbs');
        const btnPrev = document.getElementById('thumb-prev');
        const btnNext = document.getElementById('thumb-next');

        function updateThumbNav() {
            if (!thumbContainer || !btnPrev || !btnNext) return;
            const canScroll = thumbContainer.scrollWidth > thumbContainer.clientWidth + 2;
            btnPrev.style.display = canScroll ? 'inline-block' : 'none';
            btnNext.style.display = canScroll ? 'inline-block' : 'none';
        }

        function scrollThumbs(delta) {
            if (!thumbContainer) return;
            const amount = Math.round(thumbContainer.clientWidth * 0.8) * (delta > 0 ? 1 : -1);
            thumbContainer.scrollBy({ left: amount, behavior: 'smooth' });
        }

        if (btnPrev) btnPrev.addEventListener('click', () => scrollThumbs(-1));
        if (btnNext) btnNext.addEventListener('click', () => scrollThumbs(1));
        setTimeout(updateThumbNav, 50);
        window.addEventListener('resize', updateThumbNav);

        const incBtn = document.getElementById('inc-qty');
        const decBtn = document.getElementById('dec-qty');
        const qtyInput = document.getElementById('qty');
        if (incBtn && qtyInput) incBtn.addEventListener('click', () => { qtyInput.value = Number(qtyInput.value || 1) + 1; });
        if (decBtn && qtyInput) decBtn.addEventListener('click', () => { if (Number(qtyInput.value) > 1) qtyInput.value = Number(qtyInput.value) - 1; });

        const addBtn = document.getElementById('add-to-cart-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const qty = qtyInput ? Number(qtyInput.value || 1) : 1;
                const main = document.getElementById('main-product-image');
                const preview = main ? main.src : '';
                try {
                    window.addToCart(product.id || product.idProducts, product.name, product.price, preview, qty);
                } catch (e) {
                    console.error('Failed to add product to cart', e);
                }
            });
        }

        const mdEl = document.getElementById('product-metadata');
        const metaCard = document.getElementById('product-meta-card');
        if (mdEl && metaCard) {
            mdEl.innerHTML = '';
            const origin = safeStr(product.origin || product.Origin);
            const productionDate = safeStr(product.productionDate || product.ProductionDate);
            const expiryDate = safeStr(product.expiryDate || product.ExpiryDate);
            let hasMeta = false;
            if (origin) {
                const item = document.createElement('div');
                item.className = 'meta-item';
                item.textContent = '產地：' + origin;
                mdEl.appendChild(item);
                hasMeta = true;
            }
            if (productionDate) {
                const item = document.createElement('div');
                item.className = 'meta-item';
                item.textContent = '生產：' + productionDate;
                mdEl.appendChild(item);
                hasMeta = true;
            }
            if (expiryDate) {
                const item = document.createElement('div');
                item.className = 'meta-item';
                item.textContent = '有效至：' + expiryDate;
                mdEl.appendChild(item);
                hasMeta = true;
            }
            metaCard.style.display = hasMeta ? 'block' : 'none';
        }

        const introEl = document.getElementById('product-introduction');
        if (introEl) introEl.textContent = safeStr(product.introduction || product.remark || '');
    }

    window.initProductDetail = initProductDetail;
    window.renderProductDetail = renderProductDetail;
})();
