document.addEventListener('DOMContentLoaded', () => {
    const apiUrl = 'http://localhost:8000/api/products';
    const categoriesApiUrl = 'http://localhost:8000/api/categories';
    const productList = document.getElementById('product-list');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');

    let products = [], allProducts = [], filtered = [], pageSize = 8, currentPage = 1;
    let cart = (window.getCart && window.getCart()) || [];

    function normalizeImageUrl(u) {
        if (!u) return 'https://via.placeholder.com/420x260?text=No+Image';
        let s = String(u).trim().replace(/["']/g, '');
        if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
            return s;
        }
        const backendOrigin = new URL(apiUrl).origin;
        if (s.startsWith('/')) {
            return `${backendOrigin}${s}`;
        }
        return `${backendOrigin}/frontend/images/products/${s}`;
    }

    async function fetchProducts() {
        if (!productList) return;
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) {
                throw new Error('Network response was not ok: ' + res.statusText);
            }
            const data = await res.json();
            if (!Array.isArray(data)) {
                throw new Error('Data is not an array');
            }
            allProducts = data.map(p => {
                let imgs = [];
                if (Array.isArray(p.imageUrls)) imgs = p.imageUrls;
                else if (Array.isArray(p.ImageUrls)) imgs = p.ImageUrls;
                else if (p.ImageUrl) imgs = [p.ImageUrl];
                else if (p.imageUrl) imgs = [p.imageUrl];
                return {
                    id: p.id || p.idProducts || p.idProduct || p.id_products,
                    name: p.name || p.ProductName || p.ProductName || p.Product || p.productName,
                    price: p.price !== undefined ? p.price : (p.Price !== undefined ? p.Price : 0),
                    imageUrls: imgs,
                    imageUrl: (imgs && imgs.length > 0) ? imgs[0] : (p.imageUrl || p.image || p.ImageUrl || null),
                    categoryName: p.categoryName || p.categoryname || p.CategoryName || null,
                    __raw: p
                };
            });
            products = [...allProducts];
            applyFilters();
        } catch (e) {
            console.error('Error fetching products:', e);
            productList.innerHTML = `<div class="alert alert-danger">商品載入失敗: ${e.message}</div>`;
        }
    }

    async function fetchCategories() {
        if (!categoryFilter) return;
        try {
            const res = await fetch(categoriesApiUrl);
            if (!res.ok) {
                throw new Error('Network response was not ok: ' + res.statusText);
            }
            const categories = await res.json();
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    }

    function applyFilters() {
        if (!searchInput || !categoryFilter) return;
        let currentProducts = [...allProducts];
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            currentProducts = currentProducts.filter(p => {
                const name = (p.name || '').toString().toLowerCase();
                return name.includes(searchTerm);
            });
        }
        const selectedCategory = categoryFilter.value;
        if (selectedCategory !== 'all') {
            currentProducts = currentProducts.filter(p => p.categoryName === selectedCategory);
        }
        filtered = currentProducts;
        currentPage = 1;
        renderPage();
    }

    function renderPage() {
        if (!productList) return;
        productList.innerHTML = '';
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = filtered.slice(start, end);

        if (pageData.length === 0) {
            productList.textContent = '沒有商品';
            return;
        }

        pageData.forEach(p => {
            const id = p.id;
            const name = p.name;
            const price = p.price || 0;
            const rawImageUrl = (p.imageUrl || (p.imageUrls && p.imageUrls[0]));
            const imageUrl = normalizeImageUrl(rawImageUrl);

            const cardDiv = document.createElement('div');
            cardDiv.className = 'card h-100 product-item product-card';
            cardDiv.innerHTML = `
                <a href="product.html?id=${id}" class="text-decoration-none text-dark d-flex flex-column h-100">
                    <div class="product-image-wrapper">
                        <img src="${imageUrl}" class="img-fluid product-card-img" alt="${name}">
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">${name}</h5>
                        <p class="card-text price">價格：${typeof formatPrice === 'function' ? formatPrice(price) : price}</p>
                    </div>
                </a>
                <div class="card-footer text-center">
                    <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${imageUrl}">加入購物車</button>
                </div>
            `;
            productList.appendChild(cardDiv);
        });
        renderPagination();
    }

    function renderPagination() {
        const paginationEl = document.getElementById('pagination');
        if (!paginationEl) return;
        const totalPages = Math.ceil(filtered.length / pageSize);
        paginationEl.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'pagination';
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = i;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                renderPage();
            });
            li.appendChild(a);
            ul.appendChild(li);
        }
        paginationEl.appendChild(ul);
    }

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }

    function logout() {
        localStorage.removeItem('sf_cart');
        localStorage.removeItem('customerName');
        localStorage.removeItem('customerId');
        window.location.href = '../login.html';
    }
    window.logout = logout;

    // Only populate categories here. Product rendering is handled by main.js
    fetchCategories();

    // NOTE: product list rendering and hover handlers are implemented in main.js.
    // Avoid adding a second renderer or duplicate event bindings here to prevent
    // overwriting DOM or removing listeners that main.js depends on.
});