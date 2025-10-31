(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || (window.normalizeImageUrl || ((u) => u || ''));
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || '/frontend/images/products/no-image.svg';

    function initCartPage() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        renderCartPage();
        const itemsContainer = document.getElementById('cart-items-container');
        if (itemsContainer) itemsContainer.addEventListener('click', handleCartClick);
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
        populateShippingAndPayment();
    }

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

    function renderCartPage() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        const cart = window.getCart ? window.getCart() : [];
        if (!cart || cart.length === 0) {
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
        renderCartSummary();
    }

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
            const res = await fetch(API_BASE + '/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('建立訂單失敗: ' + res.status);
            const data = await res.json();
            alert('訂單建立成功，編號: ' + data.orderId);
            window.clearCart && window.clearCart();
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        } catch (err) {
            console.error(err);
            alert(err.message || '結帳失敗');
        }
    }

    window.initCartPage = initCartPage;
    window.renderCartPage = renderCartPage;
    window.renderCartSummary = renderCartSummary;
})();
