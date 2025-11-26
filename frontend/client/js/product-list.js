(function() {
    //
    //  商品列表頁面主模組，負責資料載入、篩選、分頁與卡片互動繫結。
    //
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const popover = window.SF_Popover || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    
    const {
        formatPrice = (v) => v,
        normalizeImageUrl = (v) => String(v || '').trim(),
        normalizeProduct = (p) => p,
        getFirstValue = () => null,
    } = utils;

    const state = {
        allProducts: [],
        filteredProducts: [],
        pageSize: 8,
        currentPage: 1,
        loadErrorMessage: '',
        elements: {},
    };

    /**
     * 頁面初始化流程
     */
    async function initProductListPage() {
        cacheElements();
        if (!state.elements.productList) return;

        const urlParams = new URLSearchParams(window.location.search);
        toggleSectionsByQueryParam(urlParams);
        prefillSearchFromUrl(urlParams);

        await Promise.all([loadCategories(urlParams), loadProducts()]);
        
        bindFilters();
        applyFilters();
    }

    function cacheElements() {
        state.elements = {
            productList: document.getElementById('product-list'),
            pagination: document.getElementById('pagination'),
            searchInput: document.getElementById('searchInput'),
            categoryFilter: document.getElementById('categoryFilter'),
            listingSection: document.getElementById('listing-section'),
            detailSection: document.getElementById('detail-section'),
        };
    }

    function toggleSectionsByQueryParam(urlParams) {
        const hasId = urlParams.has('id');
        const { listingSection, detailSection } = state.elements;
        if (listingSection) listingSection.style.display = hasId ? 'none' : 'block';
        if (detailSection) detailSection.style.display = hasId ? 'block' : 'none';
        // Only change the document title when on the standalone product page or viewing a product detail.
        // Avoid overriding the homepage title when this module is loaded as part of the home page.
        try {
            const pathname = (window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
            const isProductHtml = pathname.endsWith('/product.html') || pathname.endsWith('product.html');
            if (hasId) {
                document.title = '商品詳情 - SnackForest';
            } else if (isProductHtml) {
                document.title = '商品列表 - SnackForest';
            }
        } catch (_) {
            // ignore
        }
    }

    async function loadProducts() {
        const { productList } = state.elements;
        if (!productList) return;
        productList.innerHTML = `<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>`;
        try {
            const res = await fetch(`${API_BASE}/products`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid API response');
            
            state.allProducts = data.map(normalizeProduct).filter(Boolean);
            state.loadErrorMessage = '';
        } catch (e) {
            state.loadErrorMessage = e.message || '無法載入商品';
            console.error(e);
            if (productList) productList.innerHTML = `<div class="alert alert-danger">${state.loadErrorMessage}</div>`;
        }
    }

    async function loadCategories(urlParams) {
        const select = state.elements.categoryFilter;
        if (!select) return;
        try {
            const res = await fetch(`${API_BASE}/categories`);
            if (!res.ok) return;
            const categories = await res.json();
            if (!Array.isArray(categories)) return;

            const preservedValue = select.value;
            select.innerHTML = '<option value="all">所有類別</option>';
            categories.forEach(cat => {
                const name = getFirstValue(cat, ['name', 'categoryname']);
                if (name) select.add(new Option(name, name));
            });
            if (preservedValue) select.value = preservedValue;
            
            preselectCategoryFromUrl(urlParams);
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    }

    function preselectCategoryFromUrl(urlParams) {
        const select = state.elements.categoryFilter;
        const urlCategory = urlParams.get('category');
        if (!urlCategory || !select) return;

        const optionExists = [...select.options].some(opt => opt.value.toLowerCase() === urlCategory.toLowerCase());
        if (!optionExists) {
            select.add(new Option(urlCategory, urlCategory, true, true));
        } else {
            select.value = urlCategory;
        }
    }

    function prefillSearchFromUrl(urlParams) {
        const input = state.elements.searchInput;
        const keyword = urlParams.get('search');
        if (input && keyword) {
            input.value = keyword;
        }
    }

    function bindFilters() {
        const { searchInput, categoryFilter } = state.elements;
        const handler = () => {
            state.currentPage = 1;
            applyFilters();
        };
        searchInput?.addEventListener('input', handler);
        categoryFilter?.addEventListener('change', handler);
    }

    function applyFilters() {
        if (state.loadErrorMessage) {
            state.elements.productList.innerHTML = `<div class="alert alert-danger">無法載入商品：${state.loadErrorMessage}</div>`;
            state.elements.pagination.innerHTML = '';
            return;
        }
        const { searchInput, categoryFilter } = state.elements;
        const keyword = (searchInput?.value || '').toLowerCase().trim();
        const category = (categoryFilter?.value || 'all').toLowerCase();

        state.filteredProducts = state.allProducts.filter(product => {
            const nameMatch = !keyword || (product.name || '').toLowerCase().includes(keyword);
            const categoryMatch = category === 'all' || (product.categoryName || '').toLowerCase() === category;
            return nameMatch && categoryMatch;
        });
        renderCurrentPage();
    }

    function renderCurrentPage() {
        const start = (state.currentPage - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageData = state.filteredProducts.slice(start, end);
        renderProductGrid(pageData);
        renderPagination();
    }

    function renderProductGrid(products) {
        const list = state.elements.productList;
        if (!list) return;
        if (!products.length) {
            list.innerHTML = '<div class="text-center p-5 text-muted">沒有找到符合條件的商品。</div>';
            return;
        }
        list.innerHTML = products.map(p => {
            const imageUrl = normalizeImageUrl(p.imageUrl);
            return `
            <div class="product-card card">
                <a href="product.html?id=${p.id}" class="text-decoration-none text-dark d-flex flex-column h-100 product-link">
                    <div class="product-image-wrapper"><img src="${imageUrl}" class="product-card-img" alt="${p.name}"></div>
                    <div class="card-body">
                        <h5 class="card-title">${p.name}</h5>
                        <p class="price">${formatPrice(p.price)}</p>
                    </div>
                </a>
                <div class="card-footer text-center">
                    <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${imageUrl}">加入購物車</button>
                </div>
            </div>`;
        }).join('');

        // Attach behavior: bind popover and intercept product link clicks for SPA navigation
        list.querySelectorAll('.product-card').forEach(card => {
            if (popover?.bindProductCard) popover.bindProductCard(card);
        });

        // SPA: intercept product links to avoid full page reload and use history API
        list.querySelectorAll('.product-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    const href = a.getAttribute('href') || '';
                    const url = new URL(href, window.location.href);
                    // push search param (e.g. ?id=123) and trigger detail init
                    history.pushState({}, '', url.search);
                    toggleSectionsByQueryParam(new URLSearchParams(url.search));
                    if (typeof window.initProductDetail === 'function') {
                        window.initProductDetail();
                    }
                } catch (err) {
                    // fallback to normal navigation if anything fails
                    window.location.href = a.href;
                }
            });
        });
    }

    function renderPagination() {
        const pagination = state.elements.pagination;
        if (!pagination) return;
        const totalPages = Math.ceil(state.filteredProducts.length / state.pageSize);
        
        pagination.innerHTML = '';
        if (totalPages <= 1) return;

        const ul = document.createElement('ul');
        ul.className = 'pagination';
        for (let page = 1; page <= totalPages; page++) {
            const li = document.createElement('li');
            li.className = `page-item ${page === state.currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#" data-page="${page}">${page}</a>`;
            ul.appendChild(li);
        }
        pagination.appendChild(ul);
        
        pagination.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.closest('a[data-page]');
            if (target) {
                const page = parseInt(target.dataset.page, 10);
                if (state.currentPage !== page) {
                    state.currentPage = page;
                    renderCurrentPage();
                }
            }
        });
    }

    // --- Global Interface ---
    window.SF_ProductList = {
        init: initProductListPage,
        applyFilters,
        renderGrid: renderProductGrid,
        renderPagination,
        toggleSections: toggleSectionsByQueryParam,
    };

    // Compatibility: some legacy code calls fetchProductsAndRender
    window.fetchProductsAndRender = initProductListPage;

    // Auto-initialize if on the correct page
    initProductListPage();
})();
