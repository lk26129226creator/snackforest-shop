(function(){
    // 購物車頁面初始化：負責渲染商品列表、摘要與送出訂單。

    /** 當前環境設定（由 env.js 提供）。 */
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    /** 後端 API 基底網址：若未提供則預設指向本機 8000 port。 */
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || (window.normalizeImageUrl || ((u) => u || ''));
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || 'https://picsum.photos/320/320?snack';

    /**
     * 顯示訂單建立成功的覆蓋式對話框，帶有快捷操作鈕。
     * @param {number|string} orderId 訂單編號。
     * @param {number} total 訂單總額。
     * @param {string} [recipientName] 收件人名字。
     */
    function showOrderSuccessDialog(orderId, total, recipientName) {
        const existing = document.querySelector('.order-success-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'order-success-overlay';
        overlay.innerHTML = `
            <div class="order-success-dialog" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
                <div class="order-success-icon" aria-hidden="true">✅</div>
                <h2 id="order-success-title">訂單已建立</h2>
                <p class="order-success-message">${recipientName ? `${recipientName}，` : ''}感謝您的訂購！<br/>訂單編號 <span class="order-id">#${orderId}</span></p>
                <p class="order-success-sub">已為您預留商品，應付金額 <strong>NT$${Number(total || 0).toLocaleString()}</strong></p>
                <div class="order-success-actions">
                    <button type="button" class="order-success-btn primary" data-action="orders">查看訂單紀錄</button>
                    <button type="button" class="order-success-btn subtle" data-action="continue">繼續逛逛</button>
                </div>
                <button type="button" class="order-success-close" aria-label="關閉" data-action="close">✕</button>
            </div>`;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDialog();
            }
        };

        const autoCloseTimer = setTimeout(() => closeDialog(), 9000);

        const closeDialog = () => {
            document.body.classList.remove('order-success-active');
            overlay.classList.remove('is-visible');
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(autoCloseTimer);
            setTimeout(() => overlay.remove(), 180);
        };

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeDialog();
            }
        });

        overlay.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
        overlay.querySelector('[data-action="orders"]').addEventListener('click', () => {
            closeDialog();
            window.location.href = 'member.html#orders';
        });
        overlay.querySelector('[data-action="continue"]').addEventListener('click', () => {
            closeDialog();
            window.location.href = 'index.html';
        });

        document.body.appendChild(overlay);
        document.body.classList.add('order-success-active');
        requestAnimationFrame(() => overlay.classList.add('is-visible'));
        document.addEventListener('keydown', handleKeyDown);

        const primaryBtn = overlay.querySelector('[data-action="orders"]');
        if (primaryBtn) {
            try {
                primaryBtn.focus({ preventScroll: true });
            } catch (_) {
                primaryBtn.focus();
            }
        }
    }

    /**
     * 廣播訂單建立事件給管理端，利用 localStorage 觸發 storage 事件。
     * @param {number|string} orderId 訂單編號。
     * @param {{total?:number,recipientName?:string}} payload 額外資訊。
     */
    function notifyAdminOfNewOrder(orderId, payload) {
        try {
            const notice = {
                id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                orderId,
                total: Number(payload.total || 0),
                recipientName: payload.recipientName || '',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('sf-order-notify', JSON.stringify(notice));
            localStorage.setItem('sf-order-notify-latest', JSON.stringify(notice));
            setTimeout(() => {
                try {
                    localStorage.removeItem('sf-order-notify');
                } catch (removeErr) {
                    console.warn('無法清除訂單通知暫存', removeErr);
                }
            }, 150);
        } catch (err) {
            console.warn('廣播訂單通知給管理端時發生錯誤', err);
        }
    }

    /**
     * 頁面進入點：渲染列表、綁定事件並載入運送/付款選項。
     */
    function initCartPage() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        renderCartPage();
        const itemsContainer = document.getElementById('cart-items-container');
        if (itemsContainer) itemsContainer.addEventListener('click', handleCartClick);
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
        const gotoBtn = document.getElementById('goto-order-summary-btn');
        if (gotoBtn) gotoBtn.addEventListener('click', createDraftAndRedirect);
        populateShippingAndPayment();
    }

    /**
     * 建立訂單草稿（包含購物車商品與小計）並導向 `order-summary.html`。
     */
    function createDraftAndRedirect() {
        const cart = window.getCart ? window.getCart() : [];
        if (!cart || cart.length === 0) {
            showCartEmptyOverlay();
            return;
        }
        const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
        const draft = {
            items: cart,
            total: subtotal + (cart.length > 0 ? 60 : 0),
            shippingMethod: '',
            paymentMethod: '',
            recipientName: localStorage.getItem('sf_recipient_name') || '',
            recipientAddress: localStorage.getItem('sf_recipient_address') || '',
            recipientPhone: localStorage.getItem('sf_recipient_phone') || '',
            customerId: localStorage.getItem('customerId') || 1
        };
        try {
            sessionStorage.setItem('sf_order_draft', JSON.stringify(draft));
        } catch (e) {
            console.warn('無法儲存訂單草稿到 sessionStorage', e);
        }
        window.location.href = 'order-summary.html';
    }

    /**
     * 透過 API 載入運送與付款方式並填入下拉選單。
     * @returns {Promise<void>}
     */
    async function populateShippingAndPayment() {
        const shipSel = document.getElementById('shipping-method');
        const paySel = document.getElementById('payment-method');
        if (!shipSel && !paySel) return;
        try {
            const res = await fetch(API_BASE + '/shippingmethod');
            if (res.ok && shipSel) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    shipSel.innerHTML = '';
                    data.forEach((s) => {
                        const opt = document.createElement('option');
                        opt.value = s.name || s.methodName || '';
                        opt.textContent = s.name || s.methodName || '';
                        shipSel.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load shipping methods', e);
        }

        try {
            const pres = await fetch(API_BASE + '/paymentmethod');
            if (pres.ok && paySel) {
                const pdata = await pres.json();
                if (Array.isArray(pdata)) {
                    paySel.innerHTML = '';
                    pdata.forEach((p) => {
                        const opt = document.createElement('option');
                        opt.value = p.name || p.methodName || '';
                        opt.textContent = p.name || p.methodName || '';
                        paySel.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load payment methods', e);
        }
    }

    /**
     * 渲染購物車內容卡片，無項目時顯示引導畫面。
     */
    function renderCartPage() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        const cart = window.getCart ? window.getCart() : [];
        if (!cart || cart.length === 0) {
            // 購物車為空：改為內嵌空狀態卡片（不要自動彈出 overlay）
            container.innerHTML = `<div class="card text-center p-5"><div class="card-body"><h2 class="card-title">您的購物車是空的</h2><p class="card-text">快去選購！</p><a href="product.html" class="btn btn-primary">前往購物</a></div></div>`;
            renderCartSummary();
            return;
        }

        container.innerHTML = cart.map((item, idx) => {
            const md = item.metadata || {};
            const metaHtml = (md.origin || md.productionDate || md.expiryDate)
                ? `<div class="mb-2"><small class="text-muted">${md.origin ? ('產地: ' + md.origin) : ''}${md.productionDate ? (' 生產: ' + md.productionDate) : ''}${md.expiryDate ? (' 有效至: ' + md.expiryDate) : ''}</small></div>`
                : '';
            return `
                <div class="card cart-item-card mb-3">
                    <div class="row g-0">
                        <div class="col-md-3"><img src="${normalizeImageUrl(item.imageUrl) || fallbackImage}" class="img-fluid rounded-start" alt="${item.name}"></div>
                        <div class="col-md-9">
                            <div class="card-body">
                                <div class="d-flex justify-content-between">
                                    <h5 class="card-title">${item.name}</h5>
                                    <button class="btn-close" data-action="remove" data-index="${idx}"></button>
                                </div>
                                ${metaHtml}
                                <p class="card-text mb-2">單價: ${item.price}</p>
                                <div class="d-flex align-items-center mb-2">
                                    <p class="me-3 mb-0">數量:</p>
                                    <div class="cart-qty-group">
                                        <button class="btn btn-outline-secondary btn-sm" data-action="decrease" data-index="${idx}">-</button>
                                        <input type="text" class="form-control" value="${item.quantity}" readonly>
                                        <button class="btn btn-outline-secondary btn-sm" data-action="increase" data-index="${idx}">+</button>
                                    </div>
                                </div>
                                <p class="card-text mt-2"><strong>小計: ${(item.price * item.quantity).toFixed(2)}</strong></p>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
        // 若曾經顯示空購物車的 overlay，移除它。
        hideCartEmptyOverlay();
        renderCartSummary();
    }

    /**
     * 更新右側訂單摘要：計算商品小計、運費與總金額。
     */
    function renderCartSummary() {
        const container = document.getElementById('cart-summary-container');
        if (!container) return;
        const cart = window.getCart ? window.getCart() : [];
        const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
        const shipping = cart.length > 0 ? 60 : 0;
        container.innerHTML = `
            <div class="d-flex justify-content-between"><p>商品小計</p><p>${subtotal.toFixed(2)}</p></div>
            <div class="d-flex justify-content-between"><p>運費</p><p>${shipping.toFixed(2)}</p></div>
            <hr>
            <div class="d-flex justify-content-between fw-bold fs-5"><p>總計</p><p>${(subtotal + shipping).toFixed(2)}</p></div>
        `;
    }

    /**
     * 顯示購物車為空的懸浮視窗。
     */
    function showCartEmptyOverlay() {
        // 若已存在則不重複建立
        if (document.querySelector('.cart-empty-overlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'cart-empty-overlay';
        overlay.innerHTML = `
            <div class="cart-empty-dialog" role="dialog" aria-modal="true">
                <img src="/frontend/images/branding/%E9%9B%B6%E9%A3%9F%E6%A3%AE%E6%9E%97LOGO.png" alt="logo">
                <div class="cart-empty-body">
                    <h3>購物車為空</h3>
                    <p class="mb-3">您的購物車是空的，快去挑選喜歡的零食吧！</p>
                    <div class="cart-empty-actions">
                        <a href="product.html" class="btn btn-primary">前往購物</a>
                        <button type="button" class="btn btn-outline-secondary" id="close-cart-empty">關閉</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        // bind close
        overlay.querySelector('#close-cart-empty')?.addEventListener('click', hideCartEmptyOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) hideCartEmptyOverlay();
        });
    }

    function hideCartEmptyOverlay(){
        const el = document.querySelector('.cart-empty-overlay');
        if (el) el.remove();
    }

    /**
     * 處理購物車項目的增減刪除操作。
     * @param {MouseEvent} event 點擊事件。
     */
    function handleCartClick(event) {
        const target = event.target;
        if (!target || !target.dataset) return;
        const action = target.dataset.action;
        const idx = Number(target.dataset.index);
        if (!action || Number.isNaN(idx)) return;
        const cart = window.getCart ? window.getCart() : [];
        if (!cart[idx]) return;
        if (action === 'increase') {
            cart[idx].quantity++;
        } else if (action === 'decrease') {
            cart[idx].quantity--;
            if (cart[idx].quantity <= 0) cart.splice(idx, 1);
        } else if (action === 'remove') {
            cart.splice(idx, 1);
        }
        window.saveCart && window.saveCart(cart);
        renderCartPage();
    }

    /**
     * 結帳流程：驗證表單後送出訂單。
     * @param {SubmitEvent} event 表單提交事件。
     */
    async function handleCheckout(event) {
        event.preventDefault();
        const cart = window.getCart ? window.getCart() : [];
        if (cart.length === 0) return;
        const form = event.target;
        const recipientName = form.elements['recipient-name']?.value || '';
        const recipientAddress = form.elements['recipient-address']?.value || '';
        const recipientPhone = form.elements['recipient-phone']?.value || '';
        const shippingMethod = form.elements['shipping-method']?.value || '';
        const paymentMethod = form.elements['payment-method']?.value || '';
        if (!recipientName || !recipientAddress || !recipientPhone || !shippingMethod || !paymentMethod) {
            alert('所有欄位皆為必填');
            return;
        }
        const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
        const payload = {
            items: cart,
            total: subtotal + 60,
            shippingMethod,
            paymentMethod,
            recipientName,
            recipientAddress,
            recipientPhone,
            customerId: localStorage.getItem('customerId') || 1
        };
        try {
            // 若為手機版，先將訂單資料暫存並導向訂單摘要頁，讓使用者在手機上確認後再完成結帳。
            const isMobile = (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
            if (isMobile) {
                try {
                    sessionStorage.setItem('sf_order_draft', JSON.stringify(payload));
                } catch (e) {
                    console.warn('無法儲存訂單草稿到 sessionStorage', e);
                }
                window.location.href = 'order-summary.html';
                return;
            }

            const res = await fetch(API_BASE + '/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('建立訂單失敗: ' + res.status);
            const data = await res.json();
            showOrderSuccessDialog(data.orderId, payload.total, recipientName);
            notifyAdminOfNewOrder(data.orderId, { total: payload.total, recipientName });
            form.reset();
            window.clearCart && window.clearCart();
            renderCartPage();
        } catch (err) {
            console.error(err);
            alert(err.message || '結帳失敗');
        }
    }

    window.initCartPage = initCartPage;
    window.renderCartPage = renderCartPage;
    window.renderCartSummary = renderCartSummary;
})();
