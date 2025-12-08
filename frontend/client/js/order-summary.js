(function(){
    const env = window.SF_ENV || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = window.normalizeImageUrl || (u => u || '');

    function formatMoney(n){ return Number(n || 0).toFixed(2); }

    function renderEmpty(){
        const list = document.getElementById('order-items-list');
        if (list) list.innerHTML = `<div class="text-center p-4"><p>找不到訂單草稿。請先回到購物車填寫訂單資訊。</p><a class="btn btn-primary" href="cart.html">返回購物車</a></div>`;
        const form = document.getElementById('order-summary-form');
        if (form) form.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
    }

    function renderDraftAsForm(draft){
        const items = Array.isArray(draft.items) ? draft.items : [];
        const subtotal = items.reduce((s,i) => s + (i.price||0)*(i.quantity||0), 0);
        const shipping = items.length ? 60 : 0;
        const total = subtotal + shipping;

        const list = document.getElementById('order-items-list');
        list.innerHTML = items.map(it => `
            <div class="d-flex align-items-center mb-3">
                <img src="${normalizeImageUrl(it.imageUrl)}" alt="${it.name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;margin-right:12px;">
                <div class="flex-fill">
                    <div class="fw-semibold">${it.name}</div>
                    <div class="text-muted small">數量: ${it.quantity} × NT$${formatMoney(it.price)}</div>
                </div>
                <div class="ms-3 fw-bold">NT$${formatMoney((it.price||0)*(it.quantity||0))}</div>
            </div>
        `).join('') || '<div class="text-muted">購物車為空</div>';

        document.getElementById('order-subtotal').textContent = 'NT$' + formatMoney(subtotal);
        document.getElementById('order-shipping').textContent = 'NT$' + formatMoney(shipping);
        document.getElementById('order-total').textContent = 'NT$' + formatMoney(total);

        // populate form fields
        document.getElementById('recipient-name').value = draft.recipientName || '';
        document.getElementById('recipient-address').value = draft.recipientAddress || '';
        document.getElementById('recipient-phone').value = draft.recipientPhone || '';
        // shipping/payment selects will be populated async; set selected after load
        document.getElementById('order-summary-form').dataset.draftTotal = total;
        document.getElementById('order-summary-form').dataset.draftPayload = JSON.stringify(draft);
    }

    async function loadShippingAndPayment(){
        try{
            const shipSel = document.getElementById('shipping-method');
            const paySel = document.getElementById('payment-method');
            if (shipSel){
                const res = await fetch(API_BASE + '/shippingmethod');
                if (res.ok){
                    const data = await res.json();
                    shipSel.innerHTML = '';
                    (Array.isArray(data) ? data : []).forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.name || s.methodName || '';
                        opt.textContent = s.name || s.methodName || '';
                        shipSel.appendChild(opt);
                    });
                }
            }
            if (paySel){
                const pres = await fetch(API_BASE + '/paymentmethod');
                if (pres.ok){
                    const pdata = await pres.json();
                    paySel.innerHTML = '';
                    (Array.isArray(pdata) ? pdata : []).forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.name || p.methodName || '';
                        opt.textContent = p.name || p.methodName || '';
                        paySel.appendChild(opt);
                    });
                }
            }
        }catch(e){
            console.error('載入運送/付款選項失敗', e);
        }
    }

    async function confirmOrder(event){
        event && event.preventDefault && event.preventDefault();
        const form = document.getElementById('order-summary-form');
        const btn = document.getElementById('confirm-order-btn');
        btn.disabled = true;
        btn.textContent = '處理中...';
        try{
            const rawDraft = form.dataset.draftPayload;
            let draft = rawDraft ? JSON.parse(rawDraft) : null;
            if (!draft) throw new Error('找不到訂單草稿');

            // collect updated values from form
            const recipientName = document.getElementById('recipient-name').value || '';
            const recipientAddress = document.getElementById('recipient-address').value || '';
            const recipientPhone = document.getElementById('recipient-phone').value || '';
            const shippingMethod = document.getElementById('shipping-method').value || '';
            const paymentMethod = document.getElementById('payment-method').value || '';
            if (!recipientName || !recipientAddress || !recipientPhone || !shippingMethod || !paymentMethod){
                alert('所有欄位皆為必填');
                btn.disabled = false;
                btn.textContent = '完成結帳';
                return;
            }

            const subtotal = draft.items.reduce((s,i) => s + (i.price||0)*(i.quantity||0), 0);
            const payload = Object.assign({}, draft, {
                recipientName, recipientAddress, recipientPhone, shippingMethod, paymentMethod,
                total: subtotal + (draft.items && draft.items.length ? 60 : 0)
            });

            // Ensure customerId is included when available (from draft, localStorage or global)
            try{
                if (!payload.customerId) {
                    const cid = (localStorage && (localStorage.getItem('customerId') || localStorage.getItem('sf-client-id') || localStorage.getItem('sfClientId'))) || window.SF_CLIENT_ID || window.cid || null;
                    if (cid) {
                        const parsed = parseInt(cid, 10);
                        if (!Number.isNaN(parsed)) payload.customerId = parsed; else payload.customerId = cid;
                    }
                }
            }catch(e){ /* ignore */ }

            const res = await fetch(API_BASE + '/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('建立訂單失敗: ' + res.status);
            const data = await res.json();

            try{ sessionStorage.removeItem('sf_order_draft'); }catch(e){}
            try{ window.clearCart && window.clearCart(); }catch(e){}

            try{
                const notice = { id: `order-${Date.now()}`, orderId: data.orderId, total: payload.total || 0, recipientName: payload.recipientName || '', createdAt: new Date().toISOString() };
                localStorage.setItem('sf-order-notify', JSON.stringify(notice));
                localStorage.setItem('sf-order-notify-latest', JSON.stringify(notice));
                setTimeout(()=>{ try{ localStorage.removeItem('sf-order-notify'); }catch(_){} }, 150);
            }catch(e){}

            alert('訂單建立完成，訂單編號 #' + (data.orderId || ''));
            window.location.href = 'member.html#orders';
        }catch(err){
            console.error(err);
            alert(err.message || '結帳失敗');
            btn.disabled = false;
            btn.textContent = '完成結帳';
        }
    }

    async function init(){
        const raw = sessionStorage.getItem('sf_order_draft');
        if (!raw) return renderEmpty();
        let draft;
        try { draft = JSON.parse(raw); } catch (e) { return renderEmpty(); }
        renderDraftAsForm(draft);
        await loadShippingAndPayment();
        // try to set selects to draft values
        try{
            const shipSel = document.getElementById('shipping-method');
            const paySel = document.getElementById('payment-method');
            if (shipSel && draft.shippingMethod) shipSel.value = draft.shippingMethod;
            if (paySel && draft.paymentMethod) paySel.value = draft.paymentMethod;
        }catch(e){}

        document.getElementById('order-summary-form').addEventListener('submit', confirmOrder);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
