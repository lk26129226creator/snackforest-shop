document.addEventListener("DOMContentLoaded", function() {
    fetchProducts();
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
                    <button class="btn btn-sm btn-outline-success w-100">加入購物車</button>
                </div>
            </div>
        </div>
    `;
}