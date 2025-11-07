//
//  訂單管理模組：渲染訂單列表與詳情展開、事件綁定。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { state } = Admin;
    const orders = Admin.orders || {};

    /**
     * 建立訂單表格並配置詳情列、錯誤與空狀態提示。
     * @param {Array} [list] 指定渲染的訂單。
     * @param {{error?: Error}} [options] 錯誤資訊。
     */
    orders.renderOrders = function (list, options = {}) {
        const container = document.getElementById('order-list');
        if (!container) return;
        container.innerHTML = '';
        // API 失敗時顯示錯誤提醒，包含詳細訊息方便排查
        if (options.error) {
            container.innerHTML = `<div class="alert alert-danger">訂單資料載入失敗：${options.error.message || options.error}</div>`;
            return;
        }
        // 若未傳入參數則採用全域 state 快取的訂單清單
        const ordersData = Array.isArray(list) ? list : state.allOrders;
        if (!ordersData || ordersData.length === 0) {
            container.innerHTML = '<div class="alert alert-info">目前沒有訂單。</div>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        table.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th>訂單ID</th>
                    <th>顧客</th>
                    <th>日期</th>
                    <th>總金額</th>
                    <th>詳情</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        // 逐筆建立表格列與對應的詳情列（預設隱藏）
        ordersData.forEach((order) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.customerName || 'N/A'}</td>
                <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                <td>$${order.totalAmount.toFixed(2)}</td>
                <td><button class="btn btn-sm btn-info" onclick="toggleOrderDetails(this, ${order.id})">查看</button></td>`;
            const detailsRow = tbody.insertRow();
            detailsRow.id = `order-details-${order.id}`;
            detailsRow.style.display = 'none';
            const detailsCell = detailsRow.insertCell();
            detailsCell.colSpan = 5;
            // 詳情列中顯示收件資訊與商品明細，若後端尚未附帶 details 則顯示空清單
            const items = (order.details || []).map((d) => `<li class="list-group-item">${d.productName} x ${d.quantity}</li>`).join('');
            detailsCell.innerHTML = `
                <div class="p-3 bg-light">
                    <h6>訂單 #${order.id} 詳情</h6>
                    <p><strong>收件人:</strong> ${order.recipientName || ''}</p>
                    <p><strong>地址:</strong> ${order.recipientAddress || ''}</p>
                    <p><strong>電話:</strong> ${order.recipientPhone || ''}</p>
                    <ul class="list-group">${items}</ul>
                </div>`;
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    };

    /**
     * 切換訂單詳情列顯示狀態並更新按鈕文字。
     * @param {HTMLButtonElement} button 觸發按鈕。
     * @param {number} orderId 訂單編號。
     */
    orders.toggleOrderDetails = function (button, orderId) {
        const detailsRow = document.getElementById(`order-details-${orderId}`);
        if (!detailsRow) return;
        // 以狀態切換 display，並同步調整按鈕文案
        const hidden = detailsRow.style.display === 'none';
        detailsRow.style.display = hidden ? 'table-row' : 'none';
        button.textContent = hidden ? '隱藏' : '查看';
    };

    Admin.orders = orders;

    if (Admin.core && typeof Admin.core.on === 'function') {
        if (!orders._eventsBound) {
            orders._eventsBound = true;
            Admin.core.on('orders:updated', (event) => {
                const detail = event?.detail || {};
                orders.renderOrders(detail.data, { error: detail.error });
            });
        }
    }
})(window);
