(function(){
    const STORAGE_KEY = 'sf_cart';
    const utils = window.SF_UTILS || {};
    const normalizeImageUrl = utils.normalizeImageUrl || (window.normalizeImageUrl || ((u) => u || ''));
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || '/frontend/images/products/no-image.svg';

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        dispatchCartUpdated();
    }

    function clearCart() {
        localStorage.removeItem(STORAGE_KEY);
        dispatchCartUpdated();
    }

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

    function resolveCartBadges() {
        return Array.from(document.querySelectorAll('[data-cart-badge]'));
    }

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

    function showAddToCartToast(name, quantity, imageUrl) {
        const toastBody = document.querySelector('#liveToast .toast-body');
        if (toastBody) {
            const resolvedImg = normalizeImageUrl(imageUrl) || fallbackImage;
            const thumb = resolvedImg ? `<img src="${resolvedImg}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;margin-right:10px;">` : '';
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
                if (live) live.classList.add('toast-success');
                const toastEl = document.querySelector('#liveToast .toast');
                if (toastEl) {
                    const bsToast = new bootstrap.Toast(toastEl);
                    bsToast.show();
                }
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

    window.getCart = getCart;
    window.saveCart = saveCart;
    window.clearCart = clearCart;
    window.dispatchCartUpdated = dispatchCartUpdated;
    window.bumpCartBadge = bumpCartBadge;
    window.updateCartBadge = updateCartBadge;
    window.addToCart = addToCart;
    window.registerAddToCartHandler = registerAddToCartHandler;
})();
