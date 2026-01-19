document.addEventListener("DOMContentLoaded", function() {
    updateCartBadge(); // 初始化購物車數量
    checkLoginState(); // 檢查登入狀態

    // 如果是首頁 (有商品列表)
    if (document.getElementById('product-list-hot')) {
        fetchProducts();
        fetchCategories();
    }
    // 如果是購物車頁面 (有購物車表格)
    else if (document.getElementById('cart-items')) {
        loadCart();
        loadOptions();
    }
});

function fetchProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(products => {
            const hotContainer = document.getElementById('product-list-hot');
            const newContainer = document.getElementById('product-list-new');
            
            hotContainer.innerHTML = '';
            newContainer.innerHTML = '';

            if (products.length === 0) {
                hotContainer.innerHTML = '<div class="col-12 text-center">目前沒有商品</div>';
                return;
            }

            // 這裡簡單模擬：前 4 個放熱銷，後面的放新款
            // 實際專案可以根據後端欄位 (例如 isHot, createdAt) 來篩選
            products.forEach((product, index) => {
                const cardHtml = createProductCard(product);
                
                if (index < 4) {
                    hotContainer.innerHTML += cardHtml;
                } else {
                    newContainer.innerHTML += cardHtml;
                }
            });
        })
        .catch(error => console.error('Error fetching products:', error));
}

function fetchCategories() {
    fetch('/api/categories')
        .then(res => res.json())
        .then(data => {
            const list = document.querySelector('#sidebarMenu .list-group');
            if(list && data.length > 0) {
                list.innerHTML = '<a href="#" class="list-group-item list-group-item-action">所有商品</a>';
                data.forEach(c => {
                    list.innerHTML += `<a href="#" class="list-group-item list-group-item-action">${c.categoryName}</a>`;
                });
            }
        });
}

function createProductCard(product) {
    // 如果沒有圖片，使用預設圖
    const imgUrl = product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image';
    
    return `
        <div class="col-md-3 col-sm-6">
            <div class="card h-100 product-card border-0 shadow-sm">
                <img src="${imgUrl}" class="card-img-top" alt="${product.productName}" style="height: 200px; object-fit: cover;">
                <div class="card-body text-center">
                    <h5 class="card-title fs-6">${product.productName}</h5>
                    <p class="card-text text-danger fw-bold">$${product.price}</p>
                    <button class="btn btn-sm btn-outline-success w-100" onclick='addToCart(${JSON.stringify(product).replace(/'/g, "&#39;")})'>加入購物車</button>
                </div>
            </div>
        </div>
    `;
}

function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('snackforest_cart')) || [];
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.productName,
            price: product.price,
            quantity: 1
        });
    }
    localStorage.setItem('snackforest_cart', JSON.stringify(cart));
    alert('已加入購物車！');
    updateCartBadge();
}

// 更新購物車圖示數量 (通用)
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('snackforest_cart')) || [];
    const badge = document.getElementById('cart-badge');
    if(badge) badge.innerText = cart.reduce((acc, item) => acc + item.quantity, 0);
}

// 檢查登入狀態 (需要後端提供 /api/me 接口)
function checkLoginState() {
    fetch('/api/me').then(res => {
        if(res.ok) {
            const loginBtn = document.getElementById('login-btn');
            if(loginBtn) {
                loginBtn.textContent = '登出';
                loginBtn.href = '/logout';
            }
        }
    }).catch(() => {});
}

// --- 以下為購物車頁面功能 ---

function loadCart() {
    const cart = JSON.parse(localStorage.getItem('snackforest_cart')) || [];
    const tbody = document.getElementById('cart-items');
    let total = 0;
    
    if (!tbody) return;

    tbody.innerHTML = cart.map((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
            <tr>
                <td>${item.name}</td>
                <td>$${item.price}</td>
                <td>${item.quantity}</td>
                <td>$${subtotal}</td>
                <td><button class="btn btn-sm btn-danger" onclick="removeItem(${index})">移除</button></td>
            </tr>
        `;
    }).join('');
    
    const totalEl = document.getElementById('totalPrice');
    if(totalEl) totalEl.innerText = total;
}

function removeItem(index) {
    let cart = JSON.parse(localStorage.getItem('snackforest_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('snackforest_cart', JSON.stringify(cart));
    loadCart();
    updateCartBadge();
}

function loadOptions() {
    fetch('/api/shipping-methods').then(res => res.json()).then(data => {
        const el = document.getElementById('shippingMethod');
        if(el) el.innerHTML = data.map(s => `<option value="${s.id}">${s.methodName}</option>`).join('');
    });
    fetch('/api/payment-methods').then(res => res.json()).then(data => {
        const el = document.getElementById('paymentMethod');
        if(el) el.innerHTML = data.map(p => `<option value="${p.id}">${p.methodName}</option>`).join('');
    });
}

function submitOrder() {
    const cart = JSON.parse(localStorage.getItem('snackforest_cart')) || [];
    if (cart.length === 0) { alert('購物車是空的'); return; }

    const orderData = {
        totalAmount: parseInt(document.getElementById('totalPrice').innerText),
        shippingMethodId: document.getElementById('shippingMethod').value,
        paymentMethodId: document.getElementById('paymentMethod').value,
        recipientName: document.getElementById('recName').value,
        recipientPhone: document.getElementById('recPhone').value,
        recipientAddress: document.getElementById('recAddr').value,
        items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            unitPrice: item.price
        }))
    };

    fetch('/api/orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(orderData)
    })
    .then(res => {
        if (res.ok) return res.text();
        throw new Error('請先登入會員');
    })
    .then(msg => {
        alert(msg);
        localStorage.removeItem('snackforest_cart');
        window.location.href = 'client.html';
    })
    .catch(err => {
        alert(err.message);
        window.location.href = 'login.html';
    });
}