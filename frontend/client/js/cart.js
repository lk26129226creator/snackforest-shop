(function(){
    // 客戶端購物車核心邏輯：管理 localStorage 購物車資料及導覽列徽章。

    /** localStorage key，用於儲存購物車陣列。 */
    const STORAGE_KEY = 'sf_cart';
    /** 共用工具庫（若未載入 utils.js，改用全域 fallback）。 */
    const utils = window.SF_UTILS || {};
    const normalizeImageUrl = utils.normalizeImageUrl || (window.normalizeImageUrl || ((u) => u || ''));
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || 'https://picsum.photos/320/320?snack';

    /**
     * 取得目前購物車內容，解析失敗時回傳空陣列避免流程中斷。
     * @returns {Array}
     */
    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * 儲存購物車內容並廣播 cart:updated 事件。
     * @param {Array} cart
     */
    function saveCart(cart) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        dispatchCartUpdated();
    }

    /**
     * 清除購物車內容並廣播更新事件。
     */
    function clearCart() {
        localStorage.removeItem(STORAGE_KEY);
        dispatchCartUpdated();
    }

    /**
     * 廣播購物車更新事件，detail 內含總數，提供徽章同步。
     */
    function dispatchCartUpdated() {
        try {
            const cart = getCart();
            const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const evt = new CustomEvent('cart:updated', { detail: { count } });
            window.dispatchEvent(evt);
        } catch (e) {
            // ignore
        }
    }

    /**
     * 取得所有需同步的購物車徽章元素。
     * @returns {Element[]}
     */
    function resolveCartBadges() {
        return Array.from(document.querySelectorAll('[data-cart-badge]'));
    }

    /**
     * 觸發購物車徽章的震動動畫效果。
     */
    function bumpCartBadge() {
        try {
            const badges = resolveCartBadges();
            if (!badges.length) return;
            badges.forEach((badge) => {
                badge.classList.remove('badge-bump');
                void badge.offsetWidth;
                badge.classList.add('badge-bump');
                setTimeout(() => badge.classList.remove('badge-bump'), 400);
            });
        } catch (e) {
            // ignore
        }
    }

    /**
     * 計算購物車商品數量並更新所有徽章文字與顯示狀態。
     */
    function updateCartBadge() {
        const badges = resolveCartBadges();
        if (!badges.length) return;
        const cart = getCart();
        const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        badges.forEach((badge) => {
            badge.textContent = count;
            if (count > 0) {
                badge.style.display = 'inline-flex';
                badge.setAttribute('aria-hidden', 'false');
            } else {
                badge.style.display = 'none';
                badge.setAttribute('aria-hidden', 'true');
            }
        });
    }

    /**
     * 新增商品至購物車，舊項目會累加數量並更新圖片。
     * @param {(number|string)} id 商品識別碼。
     * @param {string} name 商品名稱。
     * @param {number} price 單價。
     * @param {string} imageUrl 圖片網址。
     * @param {number} [quantity=1] 加入的數量。
     * @param {Object} [metadata] 額外資訊。
     */
    function addToCart(id, name, price, imageUrl, quantity, metadata) {
        const parsedId = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
        const qty = quantity ? Number(quantity) : 1;
        const normalizedImage = normalizeImageUrl(imageUrl) || fallbackImage;
        const cart = getCart();
        let item = cart.find((entry) => entry.id === parsedId || String(entry.id) === String(parsedId));
        if (item) {
            item.quantity = (item.quantity || 0) + qty;
            if (metadata) item.metadata = Object.assign({}, item.metadata || {}, metadata);
            item.imageUrl = normalizedImage;
        } else {
            const newItem = {
                id: parsedId,
                name,
                price: Number(price) || 0,
                quantity: qty,
                imageUrl: normalizedImage
            };
            if (metadata) newItem.metadata = metadata;
            cart.push(newItem);
        }
        saveCart(cart);
        showAddToCartToast(name, qty, normalizedImage);
    }

    /**
     * 顯示加入購物車提示 Toast，提供快速前往購物車的按鈕。
     * @param {string} name 商品名稱。
     * @param {number} quantity 新增的件數。
     * @param {string} imageUrl 商品圖片。
     */
    function showAddToCartToast(name, quantity, imageUrl) {
        const toastBody = document.querySelector('#liveToast .toast-body');
        if (toastBody) {
            const resolvedImg = normalizeImageUrl(imageUrl) || fallbackImage;
            const thumb = resolvedImg ? `<img src="${resolvedImg}" alt="" class="sf-thumb-sm">` : '';
            const safeName = String(name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            toastBody.innerHTML = `
                <div class="toast-item d-flex align-items-center">
                    ${thumb}
                    <div class="sf-truncate">
                        <div class="toast-name sf-ellipsis">${safeName}</div>
                        <div class="toast-sub text-muted sf-small-text">已加入購物車</div>
                    </div>
                    <div class="sf-ml-12">
                        <span class="toast-qty badge bg-success">x${quantity}</span>
                    </div>
                </div>
                <div class="mt-2 text-end"><button type="button" id="toast-go-cart" class="btn btn-sm btn-success toast-cta">前往購物車</button></div>
            `;
        }

        try {
            if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
                const live = document.getElementById('liveToast');
                if (live) live.classList.add('toast-success');
                const toastEl = document.querySelector('#liveToast .toast');
                if (toastEl) {
                    const bsToast = new bootstrap.Toast(toastEl);
                    bsToast.show();
                }
                // 成功載入 Toast 後再綁定「前往購物車」按鈕，一律以單次事件避免重複觸發
                const goBtn = document.getElementById('toast-go-cart');
                if (goBtn) {
                    goBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        try {
                            window.location.href = '/frontend/client/cart.html';
                        } catch (e) {
                            window.location.href = 'cart.html';
                        }
                    }, { once: true });
                }
                if (live) {
                    setTimeout(() => live.classList.remove('toast-success'), 3800);
                }
            }
        } catch (e) {
            console.error('Failed to display toast', e);
        }
    }

    /**
     * 綁定全站「加入購物車」按鈕的點擊處理，讀取 data-* 資訊。
     */
    function registerAddToCartHandler() {
        document.addEventListener('click', function onAddToCartClick(event) {
            const btn = event.target && event.target.closest ? event.target.closest('.add-to-cart-btn') : null;
            if (!btn) return;
            event.preventDefault();
            const id = btn.dataset.id ? (isNaN(btn.dataset.id) ? btn.dataset.id : Number(btn.dataset.id)) : null;
            const name = btn.dataset.name || '';
            const price = btn.dataset.price ? Number(btn.dataset.price) : 0;
            const image = btn.dataset.image || '';
            addToCart(id, name, price, image, 1);
        });
    }

    // 對舊版頁面或靜態 HTML 暴露購物車 API，避免必須改寫既有 script 引用
    window.getCart = getCart;
    window.saveCart = saveCart;
    window.clearCart = clearCart;
    window.dispatchCartUpdated = dispatchCartUpdated;
    window.bumpCartBadge = bumpCartBadge;
    window.updateCartBadge = updateCartBadge;
    window.addToCart = addToCart;
    window.registerAddToCartHandler = registerAddToCartHandler;
})();
