/*
 * Consolidated client script for index/product/cart pages.
 * - Handles product listing, product detail, cart operations and badge updates.
 * - Minimal, defensive code to avoid duplicate definitions and race conditions.
 */

const STORAGE_KEY = 'sf_cart';
const API_ORIGIN = (new URL('http://localhost:8000')).origin;
const API_BASE = API_ORIGIN + '/api';

// --- Cart utilities ---
function getCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
}
function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    dispatchCartUpdated();
}
function clearCart() { localStorage.removeItem(STORAGE_KEY); dispatchCartUpdated(); }

function dispatchCartUpdated() {
    try {
        const cart = getCart();
        const evt = new CustomEvent('cart:updated', { detail: { count: cart.reduce((s,i) => s + (i.quantity||0), 0) } });
        window.dispatchEvent(evt);
    } catch (e) { /* ignore */ }
}

// Badge animation helper: add a temporary class to bump the badge
function bumpCartBadge() {
    try {
        const badge = document.getElementById('cart-badge');
        if (!badge) return;
        badge.classList.remove('badge-bump');
        // force reflow
        // eslint-disable-next-line no-unused-expressions
        void badge.offsetWidth;
        badge.classList.add('badge-bump');
        setTimeout(()=> badge.classList.remove('badge-bump'), 400);
    } catch (e) {}
}

// Expose addToCart globally
window.addToCart = function(id, name, price, imageUrl, quantity = 1, metadata = null) {
    const cid = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id,10) : id;
    const cart = getCart();
    let item = cart.find(i => i.id === cid || String(i.id) === String(cid));
    if (item) {
        // If same product exists, increment quantity and optionally merge metadata
        item.quantity = (item.quantity||0) + quantity;
        // do not overwrite existing metadata to avoid losing earlier choices
        if (metadata) item.metadata = Object.assign({}, item.metadata || {}, metadata);
    } else {
        const newItem = { id: cid, name, price: Number(price)||0, quantity, imageUrl };
        if (metadata) newItem.metadata = metadata;
        cart.push(newItem);
    }
    saveCart(cart);
    // show a simple non-blocking feedback if toast exists
    const toastBody = document.querySelector('#liveToast .toast-body');
    if (toastBody) {
        // build a compact card: thumbnail | name (bold) + small qty badge | action
        const thumb = imageUrl ? `<img src="${imageUrl}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;margin-right:10px;">` : '';
        const safeName = String(name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        toastBody.innerHTML = `
            <div class="toast-item d-flex align-items-center">
                ${thumb}
                <div style="flex:1;min-width:0;">
                    <div class="toast-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>
                    <div class="toast-sub text-muted" style="font-size:0.85rem;">已加入購物車</div>
                </div>
                <div style="margin-left:12px;">
                    <span class="toast-qty badge bg-success">x${quantity}</span>
                </div>
            </div>
            <div class="mt-2 text-end"><button type="button" id="toast-go-cart" class="btn btn-sm btn-success toast-cta">前往購物車</button></div>
        `;
    }
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const live = document.getElementById('liveToast');
            live.classList.add('toast-success');
            const toastEl = document.querySelector('#liveToast .toast');
            const bsToast = new bootstrap.Toast(toastEl);
            bsToast.show();
            // bind the CTA button to a reliable static path (frontend client cart)
            try {
                const goBtn = document.getElementById('toast-go-cart');
                if (goBtn) {
                    goBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        // prefer absolute frontend path which the server serves
                        window.location.href = '/frontend/client/cart.html';
                    });
                }
            } catch (e) { console.error('Failed to bind toast go-cart button', e); }
            setTimeout(()=> live.classList.remove('toast-success'), 3800);
        }
    } catch(e){}
        // bump handled by cart:updated listener
};

// --- Helpers ---
function normalizeImageUrl(u) {
    if (!u) return 'https://via.placeholder.com/420x260?text=No+Image';
    try {
        const s = String(u).trim().replace(/['"]/g,'');
        if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
        if (s.startsWith('/')) return API_ORIGIN + s;
        return API_ORIGIN + '/frontend/images/products/' + s;
    } catch (e) { return 'https://via.placeholder.com/420x260?text=No+Image'; }
}

function formatPrice(n) {
    try { const num = Number(n||0); return 'NT$' + num.toLocaleString('zh-TW'); } catch(e){ return n; }
}

function safeStr(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && v.trim().toLowerCase() === 'null') return '';
    return String(v);
}

// --- Product Hover Popover Logic ---
let hoverTimer;
let currentPopoverProductId = null;
let currentPopoverCard = null;
// popover elements are resolved after DOMContentLoaded to avoid null references
let productHoverPopover = null;
let popoverProductName = null;
let popoverProductImage = null;
let popoverProductPrice = null;
let popoverProductCategory = null;
let popoverViewDetailsBtn = null;

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

async function showProductPopover(productElement, productId) {
    if (!productHoverPopover || currentPopoverProductId === productId) return;
    // debug log to help trace popover invocation
    try { console.debug('[popover] showProductPopover called for', productId); } catch(e){}

    // If switching from another card, remove its scale class
    if (currentPopoverCard && currentPopoverCard !== productElement) {
        currentPopoverCard.classList.remove('hover-pop-scale');
    }

    currentPopoverProductId = productId;
    // ensure popover is hidden before populating
    productHoverPopover.classList.remove('show'); // hide previous if any
    productHoverPopover.style.display = 'none';

    const product = await fetchProductDetailsForPopover(productId);
    if (!product) {
        currentPopoverProductId = null;
        return;
    }

    // Populate popover
    popoverProductName.textContent = product.name;
    popoverProductPrice.textContent = formatPrice(product.price);
    popoverProductCategory.textContent = `分類: ${product.categoryName || ''}`;
    let imgs = [];
    if (Array.isArray(product.imageUrls) && product.imageUrls.length>0) imgs = product.imageUrls.slice();
    else if (product.imageUrl) imgs = [product.imageUrl];
    imgs = imgs.map(u => normalizeImageUrl(u));
    // default to first image or placeholder
    popoverProductImage.src = imgs.length ? imgs[0] : normalizeImageUrl(null);
    // populate product introduction
    const popIntro = document.getElementById('popover-introduction');
    if (popIntro) popIntro.textContent = safeStr(product.introduction || product.remark || '');
    popoverViewDetailsBtn.href = `product.html?id=${productId}`;

    // thumbnails - show all images (allow scrolling)
    const thumbsContainer = document.getElementById('popover-thumbs');
    if (thumbsContainer) {
        thumbsContainer.innerHTML = '';
        imgs.forEach((u, idx) => {
            const t = document.createElement('img');
            t.src = u;
            t.className = 'img-thumbnail popover-thumb';
            t.style.cursor = 'pointer';
            t.dataset.index = idx;
            t.addEventListener('click', ()=> { showIndex(idx); // use showIndex to sync highlight
                // ensure clicked thumb is visible
                try { t.scrollIntoView({behavior:'smooth', inline:'center'}); } catch(e) {}
            });
            thumbsContainer.appendChild(t);
        });
    }

    // current image index for prev/next navigation (lifted scope)
    if (typeof window._currentPopoverIndex === 'undefined') window._currentPopoverIndex = 0;
    let currentPopoverIndex = window._currentPopoverIndex || 0;
    function updateThumbHighlight() {
        const nodes = document.querySelectorAll('#popover-thumbs .popover-thumb');
        nodes.forEach(n => n.classList.remove('active-thumb'));
        const active = document.querySelector(`#popover-thumbs .popover-thumb[data-index='${currentPopoverIndex}']`);
        if (active) active.classList.add('active-thumb');
    }

    function showIndex(idx) {
        if (!imgs || imgs.length===0) return;
        currentPopoverIndex = (idx + imgs.length) % imgs.length;
        popoverProductImage.src = imgs[currentPopoverIndex];
        updateThumbHighlight();
        // persist to global so subsequent openings can restore index
        window._currentPopoverIndex = currentPopoverIndex;
    }

    // wire prev/next buttons inside popover to scroll the thumbs container and sync main image
    const popPrev = document.getElementById('popover-thumb-prev');
    const popNext = document.getElementById('popover-thumb-next');
    function scrollThumbs(delta) {
        if (!thumbsContainer) return;
        const single = thumbsContainer.querySelector('.popover-thumb');
        const width = single ? single.clientWidth + 12 : 100; // approx item width + gap
        thumbsContainer.scrollBy({ left: delta * width * 2, behavior: 'smooth' });
    }
    if (popPrev) popPrev.onclick = (ev) => { ev.stopPropagation(); showIndex(currentPopoverIndex - 1); scrollThumbs(-1); };
    if (popNext) popNext.onclick = (ev) => { ev.stopPropagation(); showIndex(currentPopoverIndex + 1); scrollThumbs(1); };

    // initialize highlight
    showIndex(currentPopoverIndex || 0);

    // popover quantity controls
    const popQtyEl = document.getElementById('popover-qty');
    const popInc = document.getElementById('popover-inc-qty');
    const popDec = document.getElementById('popover-dec-qty');
    const popAdd = document.getElementById('popover-add-to-cart');
    if (popQtyEl) popQtyEl.value = 1;
    if (popInc) popInc.onclick = () => {
        const el = document.getElementById('popover-qty'); if (!el) return; el.value = Number(el.value||1)+1;
    };
    if (popDec) popDec.onclick = () => {
        const el = document.getElementById('popover-qty'); if (!el) return; if (Number(el.value)>1) el.value = Number(el.value)-1;
    };
    if (popAdd) popAdd.onclick = () => {
        const qtyEl = document.getElementById('popover-qty'); const q = qtyEl ? Number(qtyEl.value||1) : 1;
        // delegate to the global addToCart which will show the unified toast UI
        window.addToCart(product.id || product.idProducts, product.name, product.price, popoverProductImage ? popoverProductImage.src : '', q);
        // keep popover open per UX decision
    };

    // populate metadata: origin / production / expiry into right column
    const popOrigin = document.getElementById('popover-origin');
    const popProd = document.getElementById('popover-production-date');
    const popExp = document.getElementById('popover-expiry-date');
    try {
        const originTxt = safeStr(product.origin || product.Origin || '—');
        const prodTxt = safeStr(product.productionDate || product.ProductionDate || '—');
        const expTxt = safeStr(product.expiryDate || product.ExpiryDate || '—');
        if (popOrigin) popOrigin.querySelector('span').textContent = originTxt;
        if (popProd) popProd.querySelector('span').textContent = prodTxt;
        if (popExp) popExp.querySelector('span').textContent = expTxt;
    } catch(e) { /* ignore DOM quirks */ }

    // Positioning is handled by CSS (fixed fullscreen-like popover)
    // show popover and add scale class to the card to trigger image scale
    productHoverPopover.style.display = 'block';
    // show overlay (create if missing)
    let overlay = document.getElementById('popover-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'popover-overlay';
        document.body.appendChild(overlay);
    }
    overlay.classList.add('show');
    overlay.onclick = () => { hideProductPopover(); };
    // small timeout to allow CSS transition
    setTimeout(()=> productHoverPopover.classList.add('show'), 10);
    productElement.classList.add('hover-pop-scale');
    currentPopoverCard = productElement;
}

function hideProductPopover() {
    if (productHoverPopover) {
        productHoverPopover.classList.remove('show');
        // after transition remove from flow
        setTimeout(()=> { productHoverPopover.style.display = 'none'; }, 260);
        // hide overlay
        const overlay = document.getElementById('popover-overlay'); if (overlay) overlay.classList.remove('show');
        // remove scale class from current card
        if (currentPopoverCard) { currentPopoverCard.classList.remove('hover-pop-scale'); currentPopoverCard = null; }
        currentPopoverProductId = null;
        // cleanup thumbs and reset qty
        const thumbsContainer = document.getElementById('popover-thumbs'); if (thumbsContainer) thumbsContainer.innerHTML = '';
        const popQtyEl = document.getElementById('popover-qty'); if (popQtyEl) popQtyEl.value = 1;
    }
}

function handleProductMouseOver(e) {
    const productCard = e.target.closest('.product-card');
    if (!productCard) return;
    const productId = productCard.querySelector('a').href.split('id=')[1];
    if (!productId) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
        showProductPopover(productCard, productId);
    }, 3000); // 3000ms delay (restore to 3 seconds per UX request)
}

function handleProductMouseOut(e) {
    // If user moves away before the 3s delay, cancel the pending popover.
    // Do NOT auto-hide the popover once it is shown; require explicit close.
    clearTimeout(hoverTimer);
}

// --- PAGE: INDEX (product list) ---
async function fetchProductsAndRender() {
    const productListEl = document.getElementById('product-list');
    if (!productListEl) return;
    productListEl.innerHTML = `<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>`;
    try {
        const res = await fetch(API_BASE + '/products');
        if (!res.ok) throw new Error('Failed to fetch products: ' + res.status);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response');
        renderProductGrid(data);
    } catch (e) {
        productListEl.innerHTML = `<div class="alert alert-danger">無法載入商品：${e.message}</div>`;
        console.error(e);
    }
}

function renderProductGrid(products) {
    const productListEl = document.getElementById('product-list');
    if (!productListEl) return;
    productListEl.innerHTML = '';
    if (!products || products.length === 0) { productListEl.textContent = '沒有商品'; return; }

    products.forEach(p => {
        const id = p.id || p.idProducts || p.idProduct;
        const name = p.name || p.ProductName || '';
        const price = p.price !== undefined ? p.price : (p.Price || 0);
        let img = null;
        if (Array.isArray(p.imageUrls) && p.imageUrls.length>0) img = p.imageUrls[0];
        else if (p.imageUrl) img = p.imageUrl;
        const imageUrl = normalizeImageUrl(img);

        const card = document.createElement('div');
        card.className = 'product-card card';
        card.innerHTML = `
            <a href="product.html?id=${id}" class="text-decoration-none text-dark d-flex flex-column h-100">
                <div class="product-image-wrapper"><img src="${imageUrl}" class="product-card-img" alt="${name}"></div>
                <div class="card-body">
                    <h5 class="card-title">${name}</h5>
                    <p class="price">${formatPrice(price)}</p>
                </div>
            </a>
            <div class="card-footer text-center"><button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${imageUrl}">加入購物車</button></div>
        `;
    // Add event listeners for hover - use mouseenter/leave to avoid bubbling issues
    card.addEventListener('mouseenter', (e) => { try { console.debug('[popover] mouseenter on card', id); } catch(_){}; handleProductMouseOver(e); });
    card.addEventListener('mouseleave', (e) => { try { console.debug('[popover] mouseleave on card', id); } catch(_){}; handleProductMouseOut(e); });

        productListEl.appendChild(card);
    });
}

// --- PAGE: PRODUCT DETAIL ---
async function initProductDetail() {
    const container = document.getElementById('product-detail-container');
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) { container.innerHTML = '<div class="alert alert-danger">找不到商品 ID。</div>'; return; }
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
    const API_BASE_URL = API_ORIGIN;
    const container = document.getElementById('product-detail-container');
    if (!container) return;
    // normalize images
    let rawImgs = [];
    if (Array.isArray(product.imageUrls)) rawImgs = product.imageUrls;
    else if (product.imageUrl) rawImgs = [product.imageUrl];
    const imgs = rawImgs.map(u => u && !/^https?:\/\//.test(u) ? (API_BASE_URL + u) : u).filter(Boolean);
    const mainImage = imgs.length ? imgs[0] : 'https://via.placeholder.com/400x400?text=No+Image';

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

                <!-- product metadata card (separate from purchase controls) -->
                <div id="product-meta-card" class="card my-3 p-3">
                    <div id="product-metadata" class="text-muted" style="font-size:0.95rem;"></div>
                </div>

                <!-- purchase controls -->
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
    imgs.forEach(s => {
        const img = document.createElement('img');
        img.src = s; img.className = 'product-thumb img-thumbnail';
        img.style.width='80px'; img.style.height='80px'; img.style.objectFit='cover'; img.style.cursor='pointer';
        img.addEventListener('click', ()=>{ document.getElementById('main-product-image').src = s; });
        thumbs.appendChild(img);
    });

    // Thumbnail scroller behavior
    const thumbContainer = document.getElementById('product-thumbs');
    const btnPrev = document.getElementById('thumb-prev');
    const btnNext = document.getElementById('thumb-next');
    function updateThumbNav() {
        if (!thumbContainer || !btnPrev || !btnNext) return;
        const canScroll = thumbContainer.scrollWidth > thumbContainer.clientWidth + 2;
        btnPrev.style.display = canScroll ? 'inline-block' : 'none';
        btnNext.style.display = canScroll ? 'inline-block' : 'none';
    }
    // scroll amount: approx visible width minus one thumb
    function scrollThumbs(delta) {
        if (!thumbContainer) return;
        const amount = Math.round(thumbContainer.clientWidth * 0.8) * (delta>0?1: -1);
        thumbContainer.scrollBy({ left: amount, behavior: 'smooth' });
    }
    if (btnPrev) btnPrev.addEventListener('click', ()=> scrollThumbs(-1));
    if (btnNext) btnNext.addEventListener('click', ()=> scrollThumbs(1));
    // update nav visibility on load and resize
    setTimeout(updateThumbNav, 50);
    window.addEventListener('resize', updateThumbNav);

    const incBtn = document.getElementById('inc-qty');
    const decBtn = document.getElementById('dec-qty');
    const qtyInput = document.getElementById('qty');
    if (incBtn) incBtn.addEventListener('click', ()=> { qtyInput.value = Number(qtyInput.value||1)+1; });
    if (decBtn) decBtn.addEventListener('click', ()=> { if (Number(qtyInput.value)>1) qtyInput.value = Number(qtyInput.value)-1; });

    document.getElementById('add-to-cart-btn').addEventListener('click', ()=>{
        const q = Number(document.getElementById('qty').value||1);
        const main = document.getElementById('main-product-image');
        window.addToCart(product.id || product.idProducts, product.name, product.price, main ? main.src : '', q);
    });

    // populate metadata container (origin / productionDate / expiryDate) as stacked items
    const mdEl = document.getElementById('product-metadata');
    const metaCard = document.getElementById('product-meta-card');
    if (mdEl && metaCard) {
        mdEl.innerHTML = '';
        const origin = safeStr(product.origin || product.Origin);
        const productionDate = safeStr(product.productionDate || product.ProductionDate);
        const expiryDate = safeStr(product.expiryDate || product.ExpiryDate);
        let any = false;
        if (origin) {
            const s = document.createElement('div');
            s.className = 'meta-item';
            s.textContent = '產地：' + origin;
            mdEl.appendChild(s);
            any = true;
        }
        if (productionDate) {
            const s = document.createElement('div');
            s.className = 'meta-item';
            s.textContent = '生產：' + productionDate;
            mdEl.appendChild(s);
            any = true;
        }
        if (expiryDate) {
            const s = document.createElement('div');
            s.className = 'meta-item';
            s.textContent = '有效至：' + expiryDate;
            mdEl.appendChild(s);
            any = true;
        }
        metaCard.style.display = any ? 'block' : 'none';
    }

    // ensure introduction preserves whitespace and line breaks
    const introEl = document.getElementById('product-introduction');
    if (introEl) {
        const introText = safeStr(product.introduction || product.remark || '');
        introEl.textContent = introText;
    }
}

// --- PAGE: CART ---
function initCartPage() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    renderCartPage();
    document.getElementById('cart-items-container').addEventListener('click', handleCartClick);
    document.getElementById('checkout-form')?.addEventListener('submit', handleCheckout);
    // populate shipping & payment selects
    populateShippingAndPayment();
}

// Populate shipping & payment selects from API
async function populateShippingAndPayment() {
    try {
        const shipSel = document.getElementById('shipping-method');
        const paySel = document.getElementById('payment-method');
        if (!shipSel && !paySel) return;
        // fetch shipping methods
        try {
            const res = await fetch(API_BASE + '/shippingmethod');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && shipSel) {
                    shipSel.innerHTML = '';
                    data.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.name || s.methodName || s.name || '';
                        opt.textContent = s.name || s.methodName || '';
                        shipSel.appendChild(opt);
                    });
                }
            }
        } catch (e) { console.error('Failed to load shipping methods', e); }

        // fetch payment methods
        try {
            const pres = await fetch(API_BASE + '/paymentmethod');
            if (pres.ok) {
                const pdata = await pres.json();
                if (Array.isArray(pdata) && paySel) {
                    paySel.innerHTML = '';
                    pdata.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.name || p.methodName || '';
                        opt.textContent = p.name || p.methodName || '';
                        paySel.appendChild(opt);
                    });
                }
            }
        } catch (e) { console.error('Failed to load payment methods', e); }
    } catch (e) { console.error(e); }
}

// Make product list "加入購物車" buttons work without entering detail page
document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('.add-to-cart-btn');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.id ? (isNaN(btn.dataset.id)? btn.dataset.id : Number(btn.dataset.id)) : null;
    const name = btn.dataset.name || '';
    const price = btn.dataset.price ? Number(btn.dataset.price) : 0;
    const image = btn.dataset.image || '';
    const qty = 1;
    try {
        window.addToCart(id, name, price, image, qty);
    } catch (err) { console.error('add-to-cart failed', err); }
});

function renderCartPage(){
    const container = document.getElementById('cart-items-container');
    const cart = getCart();
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<div class="card text-center p-5"><div class="card-body"><h2 class="card-title">您的購物車是空的</h2><p class="card-text">快去選購！</p><a href="index.html" class="btn btn-primary">前往購物</a></div></div>`;
        renderCartSummary();
        return;
    }
    container.innerHTML = cart.map((item, idx) => {
        const md = item.metadata || {};
        const metaHtml = (md.origin || md.productionDate || md.expiryDate) ? `
            <div class="mb-2"><small class="text-muted">${md.origin?('產地: '+md.origin):''} ${md.productionDate?(' 生產: '+md.productionDate):''} ${md.expiryDate?(' 有效至: '+md.expiryDate):''}</small></div>
        ` : '';
        return `
        <div class="card cart-item-card mb-3">
            <div class="row g-0">
                <div class="col-md-3"><img src="${item.imageUrl||'https://via.placeholder.com/150'}" class="img-fluid rounded-start" alt="${item.name}"></div>
                <div class="col-md-9"><div class="card-body">
                    <div class="d-flex justify-content-between"><h5 class="card-title">${item.name}</h5><button class="btn-close" data-action="remove" data-index="${idx}"></button></div>
                    ${metaHtml}
                    <p class="card-text mb-2">單價: ${item.price}</p>
                    <div class="d-flex align-items-center mb-2"><p class="me-3 mb-0">數量:</p><div class="input-group" style="width:130px;"><button class="btn btn-outline-secondary btn-sm" data-action="decrease" data-index="${idx}">-</button><input type="text" class="form-control text-center" value="${item.quantity}" readonly><button class="btn btn-outline-secondary btn-sm" data-action="increase" data-index="${idx}">+</button></div></div>
                    <p class="card-text mt-2"><strong>小計: ${(item.price*item.quantity).toFixed(2)}</strong></p>
                </div></div></div></div>`;
    }).join('');
    renderCartSummary();
}

function renderCartSummary(){
    const container = document.getElementById('cart-summary-container');
    if (!container) return;
    const cart = getCart();
    const subtotal = cart.reduce((s,i)=>s + (i.price||0)*(i.quantity||0),0);
    const shipping = cart.length>0 ? 60 : 0;
    container.innerHTML = `
        <div class="d-flex justify-content-between"><p>商品小計</p><p>${subtotal.toFixed(2)}</p></div>
        <div class="d-flex justify-content-between"><p>運費</p><p>${shipping.toFixed(2)}</p></div>
        <hr>
        <div class="d-flex justify-content-between fw-bold fs-5"><p>總計</p><p>${(subtotal+shipping).toFixed(2)}</p></div>
    `;
}

function handleCartClick(e){
    const action = e.target.dataset.action;
    const idx = parseInt(e.target.dataset.index,10);
    if (isNaN(idx)) return;
    const cart = getCart();
    if (!cart[idx]) return;
    if (action === 'increase') { cart[idx].quantity++; saveCart(cart); renderCartPage(); }
    if (action === 'decrease') { cart[idx].quantity--; if (cart[idx].quantity<=0) cart.splice(idx,1); saveCart(cart); renderCartPage(); }
    if (action === 'remove') { cart.splice(idx,1); saveCart(cart); renderCartPage(); }
}

async function handleCheckout(e){
    e.preventDefault();
    const cart = getCart(); if (cart.length===0) return;
    const form = e.target;
    const recipientName = form.elements['recipient-name']?.value || '';
    const recipientAddress = form.elements['recipient-address']?.value || '';
    const recipientPhone = form.elements['recipient-phone']?.value || '';
    const shippingMethod = form.elements['shipping-method']?.value || '';
    const paymentMethod = form.elements['payment-method']?.value || '';
    if (!recipientName||!recipientAddress||!recipientPhone||!shippingMethod||!paymentMethod) { alert('所有欄位皆為必填'); return; }
    const subtotal = cart.reduce((s,i)=>s+(i.price||0)*(i.quantity||0),0);
    const payload = { items: cart, total: subtotal+60, shippingMethod, paymentMethod, recipientName, recipientAddress, recipientPhone, customerId: localStorage.getItem('customerId')||1 };
    try {
        const res = await fetch(API_BASE + '/order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        if (!res.ok) throw new Error('建立訂單失敗: '+res.status);
        const data = await res.json();
        alert('訂單建立成功，編號: ' + data.orderId);
        clearCart();
        setTimeout(()=>window.location.href='index.html',1500);
    } catch (err) { console.error(err); alert(err.message || '結帳失敗'); }
}

// --- Misc UI wiring ---
function updateCartBadge() {
    const badge = document.getElementById('cart-badge'); if (!badge) return;
    const cart = getCart(); const count = cart.reduce((s,i)=>s+(i.quantity||0),0);
    badge.textContent = count; badge.style.display = count>0? 'inline-block':'none';
}

// Initialize depending on page
document.addEventListener('DOMContentLoaded', ()=>{
    // badge
    updateCartBadge(); window.addEventListener('cart:updated', ()=>{ updateCartBadge(); bumpCartBadge(); });

    // resolve popover elements here to ensure DOM is ready
    productHoverPopover = document.getElementById('product-hover-popover');
    popoverProductName = document.getElementById('popover-product-name');
    popoverProductImage = document.getElementById('popover-product-image');
    popoverProductPrice = document.getElementById('popover-product-price');
    popoverProductCategory = document.getElementById('popover-product-category');
    popoverViewDetailsBtn = document.getElementById('popover-view-details-btn');
    if (productHoverPopover) {
        productHoverPopover.addEventListener('mouseover', () => clearTimeout(hoverTimer));
        // Do not auto-hide when mouse leaves the popover; require explicit close
        productHoverPopover.addEventListener('mouseout', () => {});
        // ensure it's hidden initially
        productHoverPopover.style.display = 'none';
    }

    // wire the close button and ESC key to explicitly close the popover
    const popoverCloseBtn = document.getElementById('popover-close-btn');
    if (popoverCloseBtn) popoverCloseBtn.addEventListener('click', hideProductPopover);
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' || ev.key === 'Esc') {
            if (productHoverPopover && productHoverPopover.classList.contains('show')) {
                hideProductPopover();
            }
        }
    });

    // index page
    if (document.getElementById('product-list')) {
        fetchProductsAndRender();
        // Event listeners for product hover are now attached in renderProductGrid
    }

    // product detail
    if (document.getElementById('product-detail-container')) {
        initProductDetail();
    }

    // cart page
    if (document.getElementById('cart-items-container')) {
        initCartPage();
    }
});