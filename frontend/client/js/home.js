(function(){
    // 首頁模組整合輪播、分類與精選商品，從後端載入資料並套用客製化站台設定。
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((v) => v);
    const fetchSiteConfig = window.fetchSiteConfig || (async () => ({}));

    // 依分類名稱關鍵字推測最適合的 Font Awesome icon，用於分類卡片視覺呈現。
    const CATEGORY_ICON_RULES = [
        { pattern: /(餅|cookie|cracker|biscuit)/i, icon: 'fa-cookie-bite' },
        { pattern: /(糖|candy|sweet|巧克|choco)/i, icon: 'fa-candy-cane' },
        { pattern: /(肉|jerky|meat|牛肉|豬肉|雞)/i, icon: 'fa-drumstick-bite' },
        { pattern: /(飲|drink|beverage|茶|coffee|酒|汁)/i, icon: 'fa-mug-hot' },
        { pattern: /(組|禮盒|combo|pack|箱|合)/i, icon: 'fa-box-open' },
        { pattern: /(果|fruit|莓|乾|nut|堅果)/i, icon: 'fa-apple-whole' }
    ];

    /**
     * 依分類名稱關鍵字推測最適合的 Font Awesome icon。
     * @param {string} name 分類名稱。
     * @returns {string}
     */
    function resolveCategoryIcon(name) {
        const value = (name || '').toString().trim();
        if (!value) return 'fa-basket-shopping';
        for (const rule of CATEGORY_ICON_RULES) {
            if (rule.pattern.test(value)) {
                return rule.icon;
            }
        }
        return 'fa-basket-shopping';
    }

    // bootstrap.Carousel 初始化設定，確保首頁輪播具備自動播放與觸控體驗。
    const HOME_CAROUSEL_CONFIG = {
        interval: 3000,
        ride: 'carousel',
        pause: false,
        wrap: true,
        touch: true,
        keyboard: true
    };

    // 初始化輪播流程：取得資料、渲染 DOM、啟動 bootstrap Carousel，並緩存於 localStorage。
    /**
     * 初始化首頁輪播：載入資料並啟動 bootstrap Carousel。
     * @returns {Promise<void>}
     */
    async function setupHomeCarousel() {
        const root = document.getElementById('homeCarousel');
        if (!root) return;
        const slides = await loadCarouselSlides();
        renderCarousel(root, slides);
        bootHomeCarousel(root);
        try { localStorage.setItem('sf_carousel_slides', JSON.stringify(slides)); } catch (e) {}
    }

    // 優先走後端資料，若缺少則回落至本機快取或預設示意圖片。
    /**
     * 優先抓取後端輪播資料，失敗時回落至快取或預設。
     * @returns {Promise<Array>}
     */
    async function loadCarouselSlides() {
        const cacheKey = 'sf_carousel_slides';
        let slides = await fetchCarouselFromBackend();
        if (!Array.isArray(slides) || slides.length === 0) {
            try {
                slides = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            } catch (e) {
                slides = [];
            }
        }
        if (!Array.isArray(slides) || slides.length === 0) {
            slides = [
                { imageUrl: 'https://picsum.photos/1200/380?random=11', title: '精選零食推薦', text: '發掘這週最新上架' },
                { imageUrl: 'https://picsum.photos/1200/380?random=12', title: '甜鹹一次滿足', text: '逛逛更多人氣組合' },
                { imageUrl: 'https://picsum.photos/1200/380?random=13', title: '限時優惠', text: '折扣商品不要錯過' }
            ];
        }
        return slides;
    }

    // 從後端同步輪播設定，盡可能避免 cache 以確保顯示最新內容。
    /**
     * 從後端抓取輪播設定。
     * @returns {Promise<Array>}
     */
    async function fetchCarouselFromBackend() {
        try {
            const res = await fetch((env.API_BASE || 'http://localhost:8000/api') + '/carousel', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                return Array.isArray(data) ? data : [];
            }
            if (res.status === 404) return [];
            throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('載入輪播資料失敗，改用本機快取/預設值', e);
            return [];
        }
    }

    // 根據傳入的 slides 重新產生 indicators 與 carousel-item，並處理載入優化設定。
    /**
     * 根據輪播資料重新渲染 indicators 與 carousel-item。
     * @param {HTMLElement} root 目標 carousel 元素。
     * @param {Array} slides 輪播資料。
     */
    function renderCarousel(root, slides) {
        const indicators = root.querySelector('.carousel-indicators');
        const inner = root.querySelector('.carousel-inner');
        if (!indicators || !inner) return;
        indicators.innerHTML = '';
        inner.innerHTML = '';

        slides.forEach((slide, idx) => {
            const indicator = document.createElement('button');
            indicator.type = 'button';
            indicator.setAttribute('data-bs-target', '#homeCarousel');
            indicator.setAttribute('data-bs-slide-to', String(idx));
            indicator.setAttribute('aria-label', 'Slide ' + (idx + 1));
            if (idx === 0) {
                indicator.classList.add('active');
                indicator.setAttribute('aria-current', 'true');
            }
            indicators.appendChild(indicator);

            const item = document.createElement('div');
            item.className = 'carousel-item' + (idx === 0 ? ' active' : '');

            const img = document.createElement('img');
            const resolved = normalizeImageUrl(slide.imageUrlResolved || slide.imageUrl || '');
            img.src = resolved || '';
            img.alt = slide.title || ('Slide ' + (idx + 1));
            img.className = 'd-block w-100';
            if (idx === 0) {
                img.loading = 'eager';
                img.decoding = 'sync';
                img.setAttribute('importance', 'high');
            } else {
                img.loading = 'lazy';
                img.decoding = 'async';
            }

            const linkTarget = typeof slide.link === 'string' ? slide.link.trim() : '';
            if (linkTarget) {
                const anchor = document.createElement('a');
                anchor.href = linkTarget;
                anchor.className = 'carousel-slide-link d-block h-100';
                anchor.appendChild(img);
                item.appendChild(anchor);
            } else {
                item.appendChild(img);
            }

            if (slide.title || slide.text) {
                const caption = document.createElement('div');
                caption.className = 'carousel-caption d-none d-md-block';
                if (slide.title) {
                    const h5 = document.createElement('h5');
                    h5.textContent = slide.title;
                    caption.appendChild(h5);
                }
                if (slide.text) {
                    const p = document.createElement('p');
                    p.textContent = slide.text;
                    caption.appendChild(p);
                }
                item.appendChild(caption);
            }

            inner.appendChild(item);
        });

        inner.querySelectorAll('img').forEach((imgEl) => {
            imgEl.draggable = false;
            imgEl.addEventListener('dragstart', (ev) => ev.preventDefault());
        });
    }

    // 將最新內容交給 bootstrap.Carousel 控制，確保重新渲染後狀態一致。
    /**
     * 啟動或重建 bootstrap.Carousel 實例，並重設狀態。
     * @param {HTMLElement} root carousel 根節點。
     */
    function bootHomeCarousel(root) {
        if (!root || typeof bootstrap === 'undefined' || !bootstrap.Carousel) return;
        const items = Array.from(root.querySelectorAll('.carousel-item'));
        if (!items.length) return;

        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === 0);
        });

        const indicators = Array.from(root.querySelectorAll('[data-bs-slide-to]'));
        indicators.forEach((btn, idx) => {
            if (idx === 0) {
                btn.classList.add('active');
                btn.setAttribute('aria-current', 'true');
            } else {
                btn.classList.remove('active');
                btn.removeAttribute('aria-current');
            }
        });

        const existing = bootstrap.Carousel.getInstance(root);
        if (existing) existing.dispose();

        try {
            const instance = new bootstrap.Carousel(root, HOME_CAROUSEL_CONFIG);
            instance.to(0);
            instance.cycle();
        } catch (e) {
            console.warn('初始化輪播失敗', e);
        }
    }

    // 將後端 Site Config 套用至 hero 區塊與優勢列表，輔以預設 fallback。
    /**
     * 套用站台設定至首頁 hero 與優勢列表。
     * @returns {Promise<void>}
     */
    async function applySiteConfig() {
        const DEFAULT_CONFIG = {
            hero: {
                title: '探索世界零食的靈感地圖',
                subtitle: '精挑細選、快速到貨、安心付款。從人氣熱銷到限時新品，一鍵帶你吃遍全球風味。',
                imageUrl: '',
                primaryText: '開始購物',
                primaryLink: 'product.html',
                secondaryText: '逛逛全部',
                secondaryLink: 'product.html?category=all'
            },
            benefits: [
                { icon: 'truck-fast', title: '快速到貨', desc: '下單 24 小時內出貨' },
                { icon: 'shield-halved', title: '安全付款', desc: '多元支付、SSL 安全' },
                { icon: 'arrows-rotate', title: '七日鑑賞', desc: '不滿意可退換' },
                { icon: 'gift', title: '會員回饋', desc: '點數折抵更划算' }
            ]
        };

        try {
            const cfg = await fetchSiteConfig();
            const hero = (cfg && cfg.hero) ? cfg.hero : DEFAULT_CONFIG.hero;
            const heroTitleEl = document.getElementById('hero-title');
            const heroSubEl = document.getElementById('hero-subtitle');
            const heroImageEl = document.getElementById('hero-image');
            const primaryBtn = document.getElementById('hero-cta-primary');
            const secondaryBtn = document.getElementById('hero-cta-secondary');

            if (heroTitleEl) heroTitleEl.textContent = hero.title || DEFAULT_CONFIG.hero.title;
            if (heroSubEl) heroSubEl.textContent = hero.subtitle || DEFAULT_CONFIG.hero.subtitle;

            if (primaryBtn) {
                const span = primaryBtn.querySelector('span');
                if (span) span.textContent = hero.primaryText || DEFAULT_CONFIG.hero.primaryText;
                if (hero.primaryLink) primaryBtn.href = hero.primaryLink;
            }
            if (secondaryBtn) {
                const span = secondaryBtn.querySelector('span');
                if (span) span.textContent = hero.secondaryText || DEFAULT_CONFIG.hero.secondaryText;
                if (hero.secondaryLink) secondaryBtn.href = hero.secondaryLink;
            }

            if (heroImageEl) {
                const src = hero.imageUrlResolved || hero.imageUrl || heroImageEl.getAttribute('data-default-src') || heroImageEl.src;
                try {
                    heroImageEl.src = normalizeImageUrl(src);
                } catch (e) {
                    heroImageEl.src = src;
                }
            }

            const benefits = (cfg && Array.isArray(cfg.benefits) && cfg.benefits.length)
                ? cfg.benefits
                : DEFAULT_CONFIG.benefits;
            const benefitsWrap = document.getElementById('benefits-list');
            if (benefitsWrap) {
                benefitsWrap.innerHTML = '';
                benefits.forEach((benefit) => {
                    const col = document.createElement('div');
                    col.className = 'col-6 col-lg-3';
                    const iconName = String(benefit.icon || 'circle').trim();
                    const iconClass = iconName.startsWith('fa-') ? iconName : `fa-${iconName}`;
                    col.innerHTML = `
                        <div class="benefit d-flex align-items-start">
                            <i class="fa-solid ${iconClass} me-2"></i>
                            <div>
                                <div class="title">${benefit.title || ''}</div>
                                <p class="desc">${benefit.desc || ''}</p>
                            </div>
                        </div>`;
                    benefitsWrap.appendChild(col);
                });
            }
        } catch (e) {
            console.warn('套用網站設定失敗', e);
        }
    }

    // 載入分類資料後以 8 張卡片快速導向對應的商品列表頁面。
    /**
     * 載入分類資料並渲染首頁分類卡片。
     * @returns {Promise<void>}
     */
    async function loadCategories() {
        const grid = document.getElementById('home-categories-grid');
        if (!grid) return;
        try {
            const res = await fetch(API_BASE + '/categories');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            grid.innerHTML = '';
            (data || []).slice(0, 8).forEach((category) => {
                const name = category.name || category.categoryname || '分類';
                const iconClass = resolveCategoryIcon(name);
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `<div class="icon"><i class="fa-solid ${iconClass}" aria-hidden="true"></i></div><div class="name">${name}</div>`;
                card.setAttribute('role', 'button');
                card.setAttribute('aria-label', `${name}分類`);
                card.addEventListener('click', () => {
                    window.location.href = 'product.html?category=' + encodeURIComponent(name);
                });
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<div class="text-muted">無法載入分類</div>';
        }
    }

    // 精選商品區塊：依 Site Config 指定的 featured IDs 排序顯示，缺少設定則抓前 8 筆商品。
    /**
     * 依站台設定載入精選商品卡片，無設定時取前幾筆商品。
     * @returns {Promise<void>}
     */
    async function loadFeaturedProducts() {
        const grid = document.getElementById('home-featured-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="text-muted">載入中...</div>';
        try {
            const [res, cfg] = await Promise.all([
                fetch(API_BASE + '/products', { cache: 'no-store' }),
                fetchSiteConfig()
            ]);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const productsArray = await res.json();
            const cfgObj = cfg && typeof cfg === 'object' ? cfg : {};
            const featuredIds = Array.isArray(cfgObj.featuredProductIds)
                ? cfgObj.featuredProductIds.map((id) => String(id)).filter((id) => id && id !== 'undefined')
                : [];

            const productMap = new Map();
            (Array.isArray(productsArray) ? productsArray : []).forEach((p) => {
                const rawId = p.id ?? p.idProducts ?? p.idProduct;
                if (rawId === undefined || rawId === null) return;
                productMap.set(String(rawId), p);
            });

            const selected = [];
            const added = new Set();
            if (featuredIds.length > 0) {
                featuredIds.forEach((id) => {
                    const key = String(id);
                    if (!key || added.has(key)) return;
                    const product = productMap.get(key);
                    if (product) {
                        selected.push(product);
                        added.add(key);
                    }
                });
            }

            if (selected.length === 0 && featuredIds.length === 0) {
                (Array.isArray(productsArray) ? productsArray : []).slice(0, 8).forEach((p) => {
                    const rawId = p.id ?? p.idProducts ?? p.idProduct;
                    if (rawId === undefined || rawId === null) return;
                    const key = String(rawId);
                    if (!key || added.has(key)) return;
                    selected.push(p);
                    added.add(key);
                });
            }

            grid.innerHTML = '';
            if (selected.length === 0) {
                if (featuredIds.length > 0) {
                    grid.innerHTML = '<div class="text-muted">管理端所選精選商品已下架或不存在。</div>';
                } else {
                    grid.innerHTML = '<div class="text-muted">目前沒有精選商品。</div>';
                }
                return;
            }

            selected.forEach((p) => {
                const rawId = p.id ?? p.idProducts ?? p.idProduct;
                const id = rawId !== undefined && rawId !== null ? rawId : '';
                const name = p.name || p.ProductName || '';
                const price = p.price !== undefined ? p.price : (p.Price || 0);
                let image = null;
                if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) image = p.imageUrls[0];
                else if (p.imageUrl) image = p.imageUrl;
                const imageUrl = normalizeImageUrl(image);
                const card = document.createElement('div');
                card.className = 'card featured-card';
                card.innerHTML = `
                    <img src="${imageUrl}" alt="${name}">
                    <div class="p-3">
                        <div class="fw-semibold text-truncate" title="${name}">${name}</div>
                        <div class="price mt-1">${formatPrice(price)}</div>
                        <div class="mt-2"><a href="product.html?id=${encodeURIComponent(id)}" class="btn btn-sm btn-primary">查看</a></div>
                    </div>`;
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<div class="text-muted">無法載入商品</div>';
        }
    }

    // 首頁進入點，依序開啟輪播、站台設定、分類與精選商品。
    /**
     * 首頁進入點：依序初始化輪播、站台設定、分類與精選商品。
     */
    function initHomePage() {
        setupHomeCarousel();
        applySiteConfig();
        loadCategories();
        loadFeaturedProducts();
    }

    window.initHomePage = initHomePage;
})();
