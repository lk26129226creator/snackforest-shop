/*
 * GitHub Pages 版本的客戶端腳本
 * 使用模擬資料取代後端 API
 */

const STORAGE_KEY = 'sf_cart';

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

// Badge animation helper
function bumpCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.classList.add('bump');
        setTimeout(() => badge.classList.remove('bump'), 200);
    }
}

// --- API functions (使用模擬資料) ---
async function fetchProducts() {
    if (window.DEMO_MODE && window.mockApiCall) {
        const response = await window.mockApiCall('/api/products');
        return await response.json();
    }
    // 如果沒有模擬資料，返回空陣列
    return [];
}

async function fetchCategories() {
    if (window.DEMO_MODE && window.mockApiCall) {
        const response = await window.mockApiCall('/api/categories');
        return await response.json();
    }
    return [];
}

// --- Product display ---
function displayProducts(products, containerId = 'product-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = '<p class="text-center">目前沒有商品</p>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.ImagePath || 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(product.ProductName)}" 
                 alt="${product.ProductName}" 
                 class="product-image">
            <div class="product-info">
                <h5 class="product-name">${product.ProductName}</h5>
                <p class="product-price">NT$ ${product.Price}</p>
                <p class="product-quantity">庫存: ${product.Quantity}</p>
                <button class="btn btn-primary btn-sm" onclick="addToCart(${product.id}, '${product.ProductName}', ${product.Price})">
                    加入購物車
                </button>
            </div>
        </div>
    `).join('');
}

// --- Cart operations ---
function addToCart(id, name, price) {
    const cart = getCart();
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    
    saveCart(cart);
    bumpCartBadge();
    
    // 顯示成功訊息
    showToast(`${name} 已加入購物車`);
}

function removeFromCart(id) {
    const cart = getCart().filter(item => item.id !== id);
    saveCart(cart);
}

function updateCartQuantity(id, quantity) {
    const cart = getCart();
    const item = cart.find(item => item.id === id);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(id);
        } else {
            item.quantity = quantity;
            saveCart(cart);
        }
    }
}

// --- UI helpers ---
function showToast(message) {
    // 創建簡單的 toast 通知
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #198754;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // 動畫顯示
    setTimeout(() => toast.style.opacity = '1', 10);
    
    // 3秒後移除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'block' : 'none';
    }
}

// --- Page initialization ---
document.addEventListener('DOMContentLoaded', async function() {
    // 更新購物車徽章
    updateCartBadge();
    
    // 監聽購物車更新事件
    window.addEventListener('cart:updated', function(e) {
        updateCartBadge();
    });
    
    // 如果在商品列表頁面
    if (document.getElementById('product-list')) {
        try {
            const [products, categories] = await Promise.all([
                fetchProducts(),
                fetchCategories()
            ]);
            
            // 顯示商品
            displayProducts(products);
            
            // 填充類別選擇器
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter && categories.length > 0) {
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.categoryname;
                    categoryFilter.appendChild(option);
                });
                
                // 類別篩選功能
                categoryFilter.addEventListener('change', function() {
                    const selectedCategory = this.value;
                    const filteredProducts = selectedCategory === 'all' 
                        ? products 
                        : products.filter(p => p.CategoriesID == selectedCategory);
                    displayProducts(filteredProducts);
                });
            }
            
            // 搜尋功能
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const filteredProducts = products.filter(p => 
                        p.ProductName.toLowerCase().includes(searchTerm)
                    );
                    displayProducts(filteredProducts);
                });
            }
            
        } catch (error) {
            console.error('載入商品失敗:', error);
            document.getElementById('product-list').innerHTML = '<p class="text-center text-danger">載入商品失敗</p>';
        }
    }
    
    // 如果在購物車頁面
    if (document.getElementById('cart-items')) {
        displayCartItems();
    }
});

// --- Cart page functions ---
function displayCartItems() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    
    if (!container) return;
    
    const cart = getCart();
    
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center">購物車是空的</p>';
        if (totalElement) totalElement.textContent = 'NT$ 0';
        return;
    }
    
    let total = 0;
    container.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <div class="cart-item">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h6>${item.name}</h6>
                        <p class="text-muted">NT$ ${item.price}</p>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
                            <input type="number" class="form-control text-center" value="${item.quantity}" readonly>
                            <button class="btn btn-outline-secondary" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <strong>NT$ ${itemTotal}</strong>
                    </div>
                    <div class="col-md-1">
                        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${item.id}); displayCartItems();">移除</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (totalElement) {
        totalElement.textContent = `NT$ ${total}`;
    }
}

// --- Logout function ---
function logout() {
    localStorage.clear();
    alert('已登出');
    window.location.href = '../login.html';
}