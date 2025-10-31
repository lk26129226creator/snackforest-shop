(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const popover = window.SF_Popover || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((v) => v);

    const state = {
        allProducts: [],
        filteredProducts: [],
        pageSize: 8,
        currentPage: 1,
        loadErrorMessage: '',
        elements: {
            productList: null,
            pagination: null,
            searchInput: null,
            categoryFilter: null,
            listingSection: null,
            detailSection: null
        }
    };

    async function initProductListPage() {
        cacheElements();
        if (!state.elements.productList) return;
        toggleSectionsByQueryParam();
        await Promise.all([loadCategories(), loadProducts()]);
        bindFilters();
        applyFilters();
    }

    function cacheElements() {
        state.elements.productList = document.getElementById('product-list');
        state.elements.pagination = document.getElementById('pagination');
        state.elements.searchInput = document.getElementById('searchInput');
        state.elements.categoryFilter = document.getElementById('categoryFilter');
        state.elements.listingSection = document.getElementById('listing-section');
        state.elements.detailSection = document.getElementById('detail-section');
    }

    function toggleSectionsByQueryParam() {
        const params = new URLSearchParams(window.location.search);
        const hasId = !!params.get('id');
        const { listingSection, detailSection } = state.elements;
        if (listingSection) listingSection.style.display = hasId ? 'none' : 'block';
        if (detailSection) detailSection.style.display = hasId ? 'block' : 'none';
        try {
            document.title = hasId ? '商品詳情 - SnackForest' : '商品列表 - SnackForest';
        } catch (e) {
            // ignore title update errors
        }
    }

    async function loadProducts() {
        const productListEl = state.elements.productList;
        if (!productListEl) return;
        productListEl.innerHTML = `<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>`;
        try {
            const res = await fetch(API_BASE + '/products');
            if (!res.ok) throw new Error('Failed to fetch products: ' + res.status);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid response');
            state.allProducts = data.map(normalizeProductShape);
            state.loadErrorMessage = '';
        } catch (e) {
            productListEl.innerHTML = `<div class="alert alert-danger">無法載入商品：${e.message}</div>`;
            console.error(e);
            state.allProducts = [];
            state.loadErrorMessage = e.message || '無法載入商品';
        }
    }

    async function loadCategories() {
        const select = state.elements.categoryFilter;
        if (!select) return;
        try {
            const res = await fetch(API_BASE + '/categories');
            if (!res.ok) throw new Error('Failed to fetch categories: ' + res.status);
            const categories = await res.json();
            if (Array.isArray(categories)) {
                const preserved = select.value;
                select.innerHTML = '<option value="all">所有類別</option>';
                categories.forEach((category) => {
                    const option = document.createElement('option');
                    option.value = category.name || category.categoryname || '';
                    option.textContent = category.name || category.categoryname || '';
                    select.appendChild(option);
                });
                if (preserved) select.value = preserved;
            }
            preselectCategoryFromUrl();
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    }

    function preselectCategoryFromUrl() {
        const select = state.elements.categoryFilter;
        if (!select) return;
        const params = new URLSearchParams(window.location.search);
        const urlCategory = params.get('category');
        if (!urlCategory) return;
        let matched = false;
        Array.from(select.options).forEach((option) => {
            if ((option.value || '').toLowerCase() === urlCategory.toLowerCase()) {
                option.selected = true;
                matched = true;
            }
        });
        if (!matched) {
            const opt = document.createElement('option');
            opt.value = urlCategory;
            opt.textContent = urlCategory;
            opt.selected = true;
            select.appendChild(opt);
        }
    }

    function normalizeProductShape(product) {
        let imgs = [];
        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) imgs = product.imageUrls;
        else if (Array.isArray(product.ImageUrls) && product.ImageUrls.length > 0) imgs = product.ImageUrls;
        else if (product.ImageUrl) imgs = [product.ImageUrl];
        else if (product.imageUrl) imgs = [product.imageUrl];
        return {
            id: product.id || product.idProducts || product.idProduct || product.id_products,
            name: product.name || product.ProductName || product.productName || '',
            price: product.price !== undefined ? product.price : (product.Price !== undefined ? product.Price : 0),
            imageUrls: imgs,
            imageUrl: imgs.length ? imgs[0] : (product.imageUrl || product.image || product.ImageUrl || null),
            categoryName: product.categoryName || product.categoryname || product.CategoryName || null,
            __raw: product
        };
    }

    function bindFilters() {
        const { searchInput, categoryFilter } = state.elements;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                state.currentPage = 1;
                applyFilters();
            });
        }
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                state.currentPage = 1;
                applyFilters();
            });
        }
    }

    function applyFilters() {
        if (state.loadErrorMessage) {
            const list = state.elements.productList;
            const pagination = state.elements.pagination;
            if (list) {
                list.innerHTML = `<div class="alert alert-danger">無法載入商品：${state.loadErrorMessage}</div>`;
            }
            if (pagination) pagination.innerHTML = '';
            return;
        }
        const { searchInput, categoryFilter } = state.elements;
        let filtered = [...state.allProducts];
        const keyword = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';
        if (keyword) {
            filtered = filtered.filter((product) => (product.name || '').toLowerCase().includes(keyword));
        }
        const selectedCategory = categoryFilter ? (categoryFilter.value || 'all').toLowerCase() : 'all';
        if (selectedCategory !== 'all') {
            filtered = filtered.filter((product) => (product.categoryName || '').toLowerCase() === selectedCategory);
        }
        state.filteredProducts = filtered;
        renderCurrentPage();
    }

    function renderCurrentPage() {
        const start = (state.currentPage - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageData = state.filteredProducts.slice(start, end).map((item) => item.__raw || item);
        renderProductGrid(pageData);
        renderPagination();
    }

    function renderProductGrid(products) {
        const list = state.elements.productList || document.getElementById('product-list');
        if (!list) return;
        list.innerHTML = '';
        if (!products || products.length === 0) {
            list.textContent = '沒有商品';
            return;
        }

        products.forEach((product) => {
            const rawId = product.id || product.idProducts || product.idProduct;
            const id = rawId !== undefined && rawId !== null ? rawId : '';
            const name = product.name || product.ProductName || '';
            const price = product.price !== undefined ? product.price : (product.Price || 0);
            let img = null;
            if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) img = product.imageUrls[0];
            else if (product.imageUrl) img = product.imageUrl;
            const imageUrl = normalizeImageUrl(img);

            const card = document.createElement('div');
            card.className = 'product-card card';
            card.innerHTML = `
                <a href="product.html?id=${id}" class="text-decoration-none text-dark d-flex flex-column h-100">
                    <div class="product-image-wrapper"><img src="${imageUrl}" class="product-card-img" alt="${name}"></div>
                    <div class="card-body">
                        <h5 class="card-title">${name}</h5>
                        <p class="price">${formatPrice(price)}</p>
                    </div>
                </a>
                <div class="card-footer text-center">
                    <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${imageUrl}">加入購物車</button>
                </div>
            `;

            if (popover && typeof popover.bindProductCard === 'function') {
                popover.bindProductCard(card);
            } else {
                card.addEventListener('mouseenter', window.handleProductMouseOver || (() => {}));
                card.addEventListener('mouseleave', window.handleProductMouseOut || (() => {}));
            }

            list.appendChild(card);
        });
    }

    function renderPagination() {
        const pagination = state.elements.pagination;
        if (!pagination) return;
        const totalPages = Math.ceil((state.filteredProducts.length || 0) / state.pageSize);
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'pagination';
        for (let page = 1; page <= totalPages; page += 1) {
            const li = document.createElement('li');
            li.className = `page-item ${page === state.currentPage ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = String(page);
            a.addEventListener('click', (event) => {
                event.preventDefault();
                if (state.currentPage === page) return;
                state.currentPage = page;
                renderCurrentPage();
            });
            li.appendChild(a);
            ul.appendChild(li);
        }
        pagination.innerHTML = '';
        pagination.appendChild(ul);
    }

    window.fetchProductsAndRender = initProductListPage;
    window.renderProductGrid = renderProductGrid;
    window.applyProductFilters = applyFilters;
    window.SF_ProductList = {
        initProductListPage,
        applyFilters,
        renderProductGrid,
        renderPagination,
        toggleSectionsByQueryParam
    };
})();
