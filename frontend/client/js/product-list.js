
//
//  商品列表頁面主模組，負責資料載入、篩選、分頁與卡片互動繫結。
//  透過公開的 window.SF_ProductList 介面，讓其他腳本能重複觸發篩選或重繪。
//
(function(){
    // 取用在其他模組預先掛載的環境設定與工具函式，若不存在則使用安全的預設值。
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const popover = window.SF_Popover || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const fallbackImage = utils.fallbackProductImage || window.SF_FALLBACK_PRODUCT_IMAGE || '';
    const normalizeImageUrl = typeof utils.normalizeImageUrl === 'function'
        ? (value) => utils.normalizeImageUrl(value)
        : (typeof window.normalizeImageUrl === 'function'
            ? (value) => window.normalizeImageUrl(value)
            : (value) => {
                if (value === undefined || value === null) return fallbackImage;
                const str = String(value).trim();
                return str || fallbackImage;
            });
    const formatPrice = utils.formatPrice || ((v) => v);

    //
    //  state 物件集中維護頁面狀態，避免全域散落變數：
    //    - allProducts / filteredProducts：分別保存完整資料與篩選後結果。
    //    - pageSize / currentPage：控制分頁。
    //    - loadErrorMessage：保留載入失敗訊息，方便重繪時一併顯示。
    //    - elements：快取頁面上常用的 DOM，減少重複查詢成本。
    //
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

    /**
     * 頁面初始化流程：
     * 1. 快取常用 DOM；2. 檢查是否為商品列表頁；3. 依網址參數還原狀態；4. 平行載入資料後綁定篩選。
     * @returns {Promise<void>}
     */
    async function initProductListPage() {
        cacheElements();
        if (!state.elements.productList) return;
        prefillSearchFromUrl();
        toggleSectionsByQueryParam();
        await Promise.all([loadCategories(), loadProducts()]);
        bindFilters();
        applyFilters();
    }

    /**
     * 快取畫面所需的 DOM 參照，降低多次查詢的成本並集中管理。
     * @returns {void}
     */
    function cacheElements() {
        state.elements.productList = document.getElementById('product-list');
        state.elements.pagination = document.getElementById('pagination');
        state.elements.searchInput = document.getElementById('searchInput');
        state.elements.categoryFilter = document.getElementById('categoryFilter');
        state.elements.listingSection = document.getElementById('listing-section');
        state.elements.detailSection = document.getElementById('detail-section');
    }

    /**
     * 根據網址上的 id 參數決定顯示列表或詳情區塊，並同步調整頁面標題。
     * @returns {void}
     */
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

    /**
     * 從 API 載入所有商品並轉換為標準資料結構，遇到錯誤時更新畫面提示。
     * @returns {Promise<void>}
     */
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

    /**
     * 從 API 取得所有商品類別，建立篩選選單並保留使用者原有的選擇。
     * @returns {Promise<void>}
     */
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

    /**
     * 根據網址中的 category 參數預選下拉選項，若不存在則動態補入。
     * @returns {void}
     */
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

    /**
     * 解析網址中的 search 參數並設定搜尋欄位，方便分享篩選結果。
     * @returns {void}
     */
    function prefillSearchFromUrl() {
        const input = state.elements.searchInput;
        if (!input) return;
        const params = new URLSearchParams(window.location.search);
        const keyword = params.get('search');
        if (keyword) {
            input.value = keyword;
        }
    }

    /**
     * 將後端回傳的商品物件統一為前端使用的欄位命名，並保留原始資料於 __raw。
     * @param {object} product 後端回傳的商品資料（可能含不同欄位名稱）。
     * @returns {{id: *, name: string, price: *, imageUrls: string[], imageUrl: string|null, categoryName: string|null, __raw: object}}
     */
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

    /**
     * 綁定搜尋欄與類別選單事件，觸發時會重設頁碼並重新套用篩選。
     * @returns {void}
     */
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

    /**
     * 根據搜尋關鍵字與類別篩選商品，若先前載入失敗則直接顯示錯誤資訊。
     * @returns {void}
     */
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

    /**
     * 計算目前頁面該呈現的資料範圍，並觸發列表與分頁的渲染。
     * @returns {void}
     */
    function renderCurrentPage() {
        const start = (state.currentPage - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageData = state.filteredProducts.slice(start, end).map((item) => item.__raw || item);
        renderProductGrid(pageData);
        renderPagination();
    }

    /**
     * 將商品資料陣列渲染成卡片列表，並套用價格與圖片的標準化行為。
     * @param {Array<object>} products 已轉換為前端結構的商品陣列。
     * @returns {void}
     */
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

    /**
     * 建立分頁元件並處理點擊事件，確保頁碼切換後重新渲染列表。
     * @returns {void}
     */
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
