const API_URL = '/api/admin/products';
const PUBLIC_API_URL = '/api/products'; // 用於讀取列表
const ORDER_API_URL = '/api/admin/orders';

let productModal;
let orderModal;

let allProducts = []; // 在記憶體中儲存一份商品列表
let currentOrderCount = -1; // 用於追蹤訂單數量變化
let currentView = 'products'; // 當前視圖

document.addEventListener('DOMContentLoaded', () => {
    productModal = new bootstrap.Modal(document.getElementById('productModal'));
    orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
    loadProducts();
    startOrderPolling(); // 啟動訂單通知監聽
});

// 載入商品列表
function loadProducts() {
    fetch(PUBLIC_API_URL)
        .then(res => res.json())
        .then(products => {
            allProducts = products; // 儲存到全域變數
            const tbody = document.getElementById('product-list');
            tbody.innerHTML = '';
            products.forEach(p => {
                tbody.innerHTML += `
                    <tr>
                        <td><img src="${p.imageUrl || 'https://via.placeholder.com/50'}" class="product-img-thumb"></td>
                        <td>${p.name}</td>
                        <td>$${p.price}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="editProduct(${p.id})">
                                <i class="bi bi-pencil"></i> 編輯
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">
                                <i class="bi bi-trash"></i> 刪除
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
}

// 開啟 Modal (新增或編輯)
function openModal(product = null) {
    const title = document.getElementById('modalTitle');
    const idInput = document.getElementById('pId');
    const nameInput = document.getElementById('pName');
    const priceInput = document.getElementById('pPrice');
    const imageInput = document.getElementById('pImage');

    // 清空或填入資料
    if (product) {
        title.textContent = '編輯商品';
        idInput.value = product.id;
        nameInput.value = product.name;
        priceInput.value = product.price;
    } else {
        title.textContent = '新增商品';
        idInput.value = '';
        nameInput.value = '';
        priceInput.value = '';
        imageInput.value = '';
    }
    productModal.show();
}

// 觸發編輯
function editProduct(productId) {
    const productToEdit = allProducts.find(p => p.id === productId);
    if (productToEdit) openModal(productToEdit);
}

// 儲存商品 (新增或更新)
function saveProduct() {
    const id = document.getElementById('pId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('pName').value);
    formData.append('price', document.getElementById('pPrice').value);
    
    const imageFile = document.getElementById('pImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    fetch(url, { method: method, body: formData })
        .then(res => {
            if (res.ok) {
                productModal.hide();
                loadProducts();
            } else {
                return res.text().then(text => alert('儲存失敗: ' + text));
            }
        })
        .catch(err => alert('網路錯誤: ' + err));
}

// 刪除商品
function deleteProduct(id) {
    if (confirm('確定要刪除此商品嗎？')) {
        fetch(`${API_URL}/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) loadProducts();
                else alert('刪除失敗');
            });
    }
}

// --- 訂單管理功能 ---

// 切換視圖
function switchView(view) {
    currentView = view;
    const productsView = document.getElementById('view-products');
    const ordersView = document.getElementById('view-orders');
    const navProducts = document.getElementById('nav-products');
    const navOrders = document.getElementById('nav-orders');

    if (view === 'products') {
        productsView.classList.remove('d-none');
        ordersView.classList.add('d-none');
        navProducts.classList.add('active', 'text-white');
        navOrders.classList.remove('active', 'text-white');
        navOrders.classList.add('text-white'); // 保持文字顏色
    } else {
        productsView.classList.add('d-none');
        ordersView.classList.remove('d-none');
        navProducts.classList.remove('active');
        navProducts.classList.add('text-white');
        navOrders.classList.add('active');
        loadOrders();
    }
}

// 載入訂單列表
function loadOrders() {
    fetch(ORDER_API_URL)
        .then(res => res.json())
        .then(orders => {
            const tbody = document.getElementById('order-list');
            tbody.innerHTML = '';
            // 反向排序，讓新訂單在上面
            orders.reverse().forEach(o => {
                let statusBadge = o.status === 'Pending' ? 'bg-warning' : 
                                  o.status === 'Shipped' ? 'bg-info' : 
                                  o.status === 'Completed' ? 'bg-success' : 'bg-secondary';
                
                tbody.innerHTML += `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${o.recipientName}<br><small class="text-muted">${o.recipientPhone}</small></td>
                        <td>$${o.totalAmount}</td>
                        <td><span class="badge ${statusBadge}">${o.status}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${o.id})">詳情</button>
                        </td>
                    </tr>
                `;
            });
        });
}

// 查看訂單詳情
function viewOrder(id) {
    fetch(`${ORDER_API_URL}/${id}`)
        .then(res => res.json())
        .then(data => {
            const o = data.order;
            const items = data.items;
            
            // 填充訂單資訊
            document.getElementById('order-details-content').innerHTML = `
                <p><strong>訂單編號:</strong> #${o.id}</p>
                <p><strong>收件人:</strong> ${o.recipientName} (${o.recipientPhone})</p>
                <p><strong>地址:</strong> ${o.recipientAddress}</p>
                <p><strong>總金額:</strong> $${o.totalAmount}</p>
                <div class="mb-3">
                    <label class="form-label"><strong>狀態:</strong></label>
                    <select class="form-select d-inline-block w-auto" onchange="updateOrderStatus(${o.id}, this.value)">
                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>處理中 (Pending)</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>已出貨 (Shipped)</option>
                        <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>已完成 (Completed)</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>已取消 (Cancelled)</option>
                    </select>
                </div>
            `;

            // 填充商品列表
            const tbody = document.getElementById('order-items-list');
            tbody.innerHTML = '';
            items.forEach(item => {
                tbody.innerHTML += `
                    <tr>
                        <td>
                            <img src="${item.imageUrl || 'https://via.placeholder.com/30'}" style="width:30px;height:30px;object-fit:cover;" class="me-2">
                            ${item.productName}
                        </td>
                        <td>$${item.unitPrice}</td>
                        <td>${item.quantity}</td>
                        <td>$${item.unitPrice * item.quantity}</td>
                    </tr>
                `;
            });

            orderModal.show();
        });
}

// 更新訂單狀態
function updateOrderStatus(id, status) {
    fetch(`${ORDER_API_URL}/${id}/status`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status: status })
    }).then(res => {
        if(res.ok) {
            alert('狀態已更新');
            loadOrders(); // 重新整理列表
        } else alert('更新失敗');
    });
}

// 輪詢檢查新訂單 (每 5 秒檢查一次)
function startOrderPolling() {
    setInterval(() => {
        fetch(`${ORDER_API_URL}/count`)
            .then(res => res.json())
            .then(count => {
                // 如果是第一次載入，先記錄數量
                if (currentOrderCount === -1) {
                    currentOrderCount = count;
                } 
                // 如果數量增加，代表有新訂單
                else if (count > currentOrderCount) {
                    alert(`🔔 您有 ${count - currentOrderCount} 筆新訂單！`);
                    currentOrderCount = count;
                    // 如果當前在訂單頁面，自動重新整理
                    if (currentView === 'orders') {
                        loadOrders();
                    }
                }
            })
            .catch(() => {}); // 忽略網路錯誤
    }, 5000);
}