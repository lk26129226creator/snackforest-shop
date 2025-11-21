(function() {
    // 首頁模組整合輪播、分類與精選商品，從後端載入資料並套用客製化站台設定。
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';

    const {
        normalizeImageUrl = (u) => u || '',
        formatPrice = (v) => v,
        normalizeProduct = (p) => p,
        getFirstValue = () => null,
    } = utils;
    const fetchSiteConfig = window.fetchSiteConfig || (async () => ({}));

    // safeNormalize: sanitize + normalizeImageUrl with fallback and safe try/catch
    function safeNormalize(value, fallback = '') {
        try {
            const s = (typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim()));
            if (!s) return fallback;
            const r = normalizeImageUrl(s);
            return r || s || fallback;
        } catch (e) {
            return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
        }
    }

    async function fetchJSON(url, options) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (res.status === 404 || res.headers.get('content-length') === '0') return [];
            return await res.json() || [];
        } catch (e) {
            console.warn(`Failed to fetch JSON from ${url}`, e);
            return [];
        }
    }

    function resolveCategoryIcon(name) {
        const value = (name || '').toString().trim();
        if (!value) return 'fa-basket-shopping';
        const rule = CATEGORY_ICON_RULES.find(({ pattern }) => pattern.test(value));
        return rule ? rule.icon : 'fa-basket-shopping';
    }

    // --- 常數設定 ---
    const MOBILE_PRODUCT_BREAKPOINT = 768;
    const FALLBACK_PRODUCT_IMAGE = utils.fallbackProductImage || 'https://picsum.photos/320/320?snack';
    const CAROUSEL_FALLBACK_IMAGE = FALLBACK_PRODUCT_IMAGE;
    const CAROUSEL_CACHE_KEY = 'sf_carousel_slides_v2';
    const CAROUSEL_DEFAULT_LINK = 'product.html';
    const HOME_CAROUSEL_CONFIG = { interval: 3000, ride: 'carousel', pause: false, wrap: true, touch: true, keyboard: true };

    const CATEGORY_ICON_RULES = [
        { pattern: /(餅|cookie|cracker|biscuit)/i, icon: 'fa-cookie-bite' },
        { pattern: /(糖|candy|sweet|巧克|choco)/i, icon: 'fa-candy-cane' },
        { pattern: /(肉|jerky|meat|牛肉|豬肉|雞)/i, icon: 'fa-drumstick-bite' },
        { pattern: /(飲|drink|beverage|茶|coffee|酒|汁)/i, icon: 'fa-mug-hot' },
        { pattern: /(組|禮盒|combo|pack|箱|合)/i, icon: 'fa-box-open' },
        { pattern: /(果|fruit|莓|乾|nut|堅果)/i, icon: 'fa-apple-whole' }
    ];

    // --- DOM 元素與狀態 ---
    const mobileProductMediaQuery = window.matchMedia?.(`(max-width: ${MOBILE_PRODUCT_BREAKPOINT}px)`);

    const categorySectionMeta = (() => {
        const gridEl = document.getElementById('home-categories-grid');
        if (!gridEl) return null;
        const sectionEl = gridEl.closest('section');
        const titleEl = sectionEl?.querySelector('h2');
        const ctaEl = sectionEl?.querySelector('a.btn');
        return {
            gridEl,
            titleEl,
            ctaEl,
            defaultTitle: titleEl?.textContent.trim() || '',
            defaultCtaText: ctaEl?.textContent.trim() || '',
            defaultCtaHref: ctaEl?.getAttribute('href') || ''
        };
    })();

    // --- 核心功能 ---

    function renderMobileProductItem(meta) {
        const href = `product.html?id=${encodeURIComponent(meta.id)}`;
        const cardContent = `
            <div class="mobile-product-card__thumb"><img src="${meta.imageUrl}" alt="${meta.name}"></div>
            <div class="mobile-product-card__body">
                <div class="mobile-product-card__name" title="${meta.name}">${meta.name}</div>
                <div class="mobile-product-card__meta">
                    <span class="mobile-product-card__price">${formatPrice(meta.price)}</span>
                    ${meta.categoryName ? `<span class="mobile-product-card__category">${meta.categoryName}</span>` : ''}
                </div>
            </div>`;
        return `<div class="col-6"><a class="mobile-product-card" href="${href}">${cardContent}</a></div>`;
    }

    function renderCategoryItem(category) {
        const name = getFirstValue(category, ['name', 'categoryname']) || '分類';
        const href = `product.html?category=${encodeURIComponent(name)}`;
        return `
            <div class="col-6 col-md-4 col-lg">
                <div class="category-card" role="button" tabindex="0" aria-label="${name}分類" data-href="${href}">
                    <div class="icon"><i class="fa-solid ${resolveCategoryIcon(name)}" aria-hidden="true"></i></div>
                    <div class="name">${name}</div>
                </div>
            </div>`;
    }

    function shouldUseMobileProductLayout() {
        return mobileProductMediaQuery ? mobileProductMediaQuery.matches : window.innerWidth <= MOBILE_PRODUCT_BREAKPOINT;
    }

    function updateCategorySectionHeading(mode) {
        if (!categorySectionMeta) return;
        const { titleEl, ctaEl, defaultTitle, defaultCtaText, defaultCtaHref } = categorySectionMeta;
        if (mode === 'mobile-products') {
            if (titleEl) titleEl.textContent = '行動精選商品';
            if (ctaEl) {
                ctaEl.textContent = '更多商品';
                ctaEl.href = 'product.html';
            }
        } else {
            if (titleEl) titleEl.textContent = defaultTitle || '依分類逛逛';
            if (ctaEl) {
                ctaEl.textContent = defaultCtaText || '全部商品';
                if (defaultCtaHref) ctaEl.href = defaultCtaHref;
            }
        }
    }

    function sanitizeCarouselSlides(list) {
        if (!Array.isArray(list)) return [];
        const seen = new Set();
        return list.reduce((acc, raw) => {
            if (!raw || typeof raw !== 'object') return acc;
            const title = (raw.title || '').toString().trim();
            const text = (raw.text || '').toString().trim();
            const link = (raw.link || '').toString().trim() || CAROUSEL_DEFAULT_LINK;
            const imageUrlResolved = safeNormalize(getFirstValue(raw, ['imageUrlResolved', 'imageUrl', 'imageUrlOriginal']), CAROUSEL_FALLBACK_IMAGE);
            
            const dedupeKey = `${imageUrlResolved}::${title}::${text}`;
            if (imageUrlResolved !== CAROUSEL_FALLBACK_IMAGE && seen.has(dedupeKey)) return acc;
            
            seen.add(dedupeKey);
            acc.push({ ...raw, title, text, link, imageUrlResolved });
            return acc;
        }, []);
    }

    async function loadCarouselSlides() {
        let fromBackend = sanitizeCarouselSlides(await fetchJSON(`${API_BASE}/carousel`, { cache: 'no-store' }));
        if (fromBackend.length) return fromBackend;

        // If backend returned no slides, attempt to fetch images directly from gallery uploads/Carousel
        try {
            const gallery = await fetchJSON(`${API_BASE}/gallery/hero?prefix=${encodeURIComponent('uploads/Carousel')}`, { cache: 'no-store' });
            if (Array.isArray(gallery) && gallery.length > 0) {
                const slides = gallery.map((u) => ({ imageUrl: u, imageUrlResolved: u, title: '', text: '', link: '' }));
                const s = sanitizeCarouselSlides(slides);
                if (s.length) return s;
            }
        } catch (e) { /* ignore gallery fetch errors */ }

        try {
            const fromCache = sanitizeCarouselSlides(JSON.parse(localStorage.getItem(CAROUSEL_CACHE_KEY) || '[]'));
            if (fromCache.length) return fromCache;
        } catch (e) { /* Ignore cache parsing errors */ }

        return sanitizeCarouselSlides([
            { imageUrl: 'https://picsum.photos/1200/380?random=11', title: '精選零食推薦', text: '發掘這週最新上架' },
            { imageUrl: 'https://picsum.photos/1200/380?random=12', title: '甜鹹一次滿足', text: '逛逛更多人氣組合' },
            { imageUrl: 'https://picsum.photos/1200/380?random=13', title: '限時優惠', text: '折扣商品不要錯過' }
        ]);
    }

    function renderCarousel(root, slides) {
        const indicators = root.querySelector('.carousel-indicators');
        const inner = root.querySelector('.carousel-inner');
        if (!indicators || !inner) return;

        indicators.innerHTML = slides.map((_, idx) => `
            <button type="button" data-bs-target="#homeCarousel" data-bs-slide-to="${idx}"
                ${idx === 0 ? 'class="active" aria-current="true"' : ''}
                aria-label="Slide ${idx + 1}"></button>
        `).join('');

        inner.innerHTML = slides.map((slide, idx) => {
            const imgHtml = `<img src="${slide.imageUrlResolved}" alt="${slide.title || `Slide ${idx + 1}`}" class="d-block w-100" draggable="false"
                ${idx === 0 ? 'loading="eager" decoding="sync" fetchpriority="high"' : 'loading="lazy" decoding="async"'}>`;
            const content = slide.link ? `<a href="${slide.link}" class="carousel-slide-link d-block h-100">${imgHtml}</a>` : imgHtml;
            const captionHtml = (slide.title || slide.text) ? `
                <div class="carousel-caption d-none d-md-block">
                    ${slide.title ? `<h5>${slide.title}</h5>` : ''}
                    ${slide.text ? `<p>${slide.text}</p>` : ''}
                </div>` : '';
            return `<div class="carousel-item${idx === 0 ? ' active' : ''}">${content}${captionHtml}</div>`;
        }).join('');
    }

    async function setupHomeCarousel() {
        const root = document.getElementById('homeCarousel');
        if (!root) return;
        const slides = await loadCarouselSlides();
        if (!slides.length) return;

        renderCarousel(root, slides);
        
        if (window.bootstrap?.Carousel) {
            window.bootstrap.Carousel.getOrCreateInstance(root, HOME_CAROUSEL_CONFIG)?.to(0);
        }
        
        try {
            localStorage.setItem(CAROUSEL_CACHE_KEY, JSON.stringify(slides));
        } catch (e) {
            console.warn('Failed to cache carousel slides', e);
        }
    }

    async function applySiteConfig() {
        const DEFAULT_HERO = {
            title: '探索世界零食的靈感地圖',
            subtitle: '精挑細選、快速到貨、安心付款。從人氣熱銷到限時新品，一鍵帶你吃遍全球風味。',
            imageUrl: '', primaryText: '開始購物', primaryLink: 'product.html',
            secondaryText: '逛逛全部', secondaryLink: 'product.html?category=all'
        };
        const DEFAULT_BENEFITS = [
            { icon: 'truck-fast', title: '快速到貨', desc: '下單 24 小時內出貨' },
            { icon: 'shield-halved', title: '安全付款', desc: '多元支付、SSL 安全' },
            { icon: 'arrows-rotate', title: '七日鑑賞', desc: '不滿意可退換' },
            { icon: 'gift', title: '會員回饋', desc: '點數折抵更划算' }
        ];

        try {
            const cfg = await fetchSiteConfig();
            const hero = { ...DEFAULT_HERO, ...(cfg.hero || {}) };
            
            document.getElementById('hero-title').textContent = hero.title;
            document.getElementById('hero-subtitle').textContent = hero.subtitle;
            
            const primaryBtn = document.getElementById('hero-cta-primary');
            if (primaryBtn) {
                primaryBtn.querySelector('span').textContent = hero.primaryText;
                primaryBtn.href = hero.primaryLink;
            }
            const secondaryBtn = document.getElementById('hero-cta-secondary');
            if (secondaryBtn) {
                secondaryBtn.querySelector('span').textContent = hero.secondaryText;
                secondaryBtn.href = hero.secondaryLink;
            }

            const heroImageEl = document.getElementById('hero-image');
            if (heroImageEl) {
                // 優先使用 site-config 裡的 hero 圖片，若沒有則嘗試從 hero 圖庫 (/api/gallery/hero) 取得第一張圖
                const finalSrc = safeNormalize(getFirstValue(hero, ['imageUrl', 'imageUrlOriginal']), '');
                if (finalSrc) {
                    if (heroImageEl.src !== finalSrc) heroImageEl.src = finalSrc;
                } else {
                    try {
                        const gallery = await fetchJSON(`${API_BASE}/gallery/hero`, { cache: 'no-store' });
                        if (Array.isArray(gallery) && gallery.length > 0) {
                            const first = safeNormalize(gallery[0], '');
                            if (first && heroImageEl.src !== first) heroImageEl.src = first;
                        }
                    } catch (e) {
                        // 如果取得圖庫失敗，保持目前 src（可為空或 data-default-src）
                        console.warn('無法取得 hero 圖庫作為 fallback', e);
                    }
                }
            }

            const benefits = (cfg?.benefits?.length) ? cfg.benefits : DEFAULT_BENEFITS;
            const benefitsWrap = document.getElementById('benefits-list');
            if (benefitsWrap) {
                benefitsWrap.innerHTML = benefits.map(b => `
                    <div class="col-6 col-lg-3">
                        <div class="benefit d-flex align-items-start">
                            <i class="fa-solid fa-${String(b.icon || 'circle').trim().replace(/^fa-/, '')} me-2"></i>
                            <div>
                                <div class="title">${b.title || ''}</div>
                                <p class="desc">${b.desc || ''}</p>
                            </div>
                        </div>
                    </div>`).join('');
            }
        } catch (e) {
            console.warn('套用網站設定失敗', e);
        }
    }

    async function renderGrid(grid, { className, fetchUrl, processItems, renderItem, emptyMessage, errorMessage, onSuccess }) {
        grid.className = className;
        grid.innerHTML = '<div class="text-muted">載入中...</div>';
        try {
            let items = await fetchJSON(fetchUrl);
            if (processItems) items = processItems(items);

            if (!items.length) {
                grid.innerHTML = `<div class="text-muted">${emptyMessage}</div>`;
                return;
            }
            grid.innerHTML = items.map(renderItem).join('');
            if (onSuccess) onSuccess(grid);
        } catch (e) {
            grid.innerHTML = `<div class="text-muted">${errorMessage}</div>`;
        }
    }

    async function loadCategories(layoutOverride) {
        const grid = categorySectionMeta?.gridEl;
        if (!grid) return;

        const nextMode = layoutOverride || (shouldUseMobileProductLayout() ? 'mobile-products' : 'categories');
        if (grid.dataset.layout === nextMode) return;
        
        grid.dataset.layout = nextMode;
        updateCategorySectionHeading(nextMode);

        if (nextMode === 'mobile-products') {
            await renderGrid(grid, {
                className: 'row g-2 home-categories-grid mobile-product-grid',
                fetchUrl: `${API_BASE}/products`,
                processItems: items => items.map(normalizeProduct).filter(Boolean).slice(0, 6),
                renderItem: renderMobileProductItem,
                emptyMessage: '暫時沒有商品',
                errorMessage: '暫時無法載入商品'
            });
        } else {
            await renderGrid(grid, {
                className: 'row g-3 home-categories-grid category-grid row-cols-lg-5',
                fetchUrl: `${API_BASE}/categories`,
                processItems: items => items.slice(0, 5),
                renderItem: renderCategoryItem,
                emptyMessage: '目前沒有分類資料',
                errorMessage: '無法載入分類',
                onSuccess: (g) => g.addEventListener('click', (e) => {
                    const card = e.target.closest('.category-card[data-href]');
                    if (card) window.location.href = card.dataset.href;
                })
            });
        }
    }

    async function loadFeaturedProducts() {
        const grid = document.getElementById('home-featured-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="text-muted">載入中...</div>';
        try {
            const [allProducts, cfg] = await Promise.all([
                fetchJSON(`${API_BASE}/products`),
                fetchSiteConfig()
            ]);

            const featuredIds = new Set(cfg?.featuredProductIds?.map(String).filter(id => id && id !== 'undefined'));
            let selected;

            if (featuredIds.size > 0) {
                const productMap = new Map(allProducts.map(p => [String(getFirstValue(p, ['id', 'idProducts', 'idProduct'])), p]));
                selected = Array.from(featuredIds).map(id => productMap.get(id));
            } else {
                selected = allProducts.slice(0, 8);
            }
            
            const productsToRender = selected.map(normalizeProduct).filter(Boolean);

            if (!productsToRender.length) {
                grid.innerHTML = `<div class="text-muted">${featuredIds.size > 0 ? '管理端所選精選商品已下架或不存在。' : '目前沒有精選商品。'}</div>`;
                return;
            }

            grid.innerHTML = productsToRender.map(meta => {
                const href = `product.html?id=${encodeURIComponent(meta.id)}`;
                return `
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="card featured-card">
                            <a href="${href}" class="d-block">
                                <img src="${meta.imageUrl}" alt="${meta.name}" class="card-img-top">
                            </a>
                            <div class="card-body">
                                <div class="fw-semibold text-truncate" title="${meta.name}">${meta.name}</div>
                                <div class="price mt-1">${formatPrice(meta.price)}</div>
                                <div class="mt-2"><a href="${href}" class="btn btn-sm btn-primary">查看</a></div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
        } catch (e) {
            console.error('無法載入精選商品', e);
            grid.innerHTML = '<div class="text-muted">無法載入商品</div>';
        }
    }

    function initHomePage() {
        setupHomeCarousel();
        applySiteConfig();
        loadCategories();
        loadFeaturedProducts();

        if (mobileProductMediaQuery) {
            mobileProductMediaQuery.addEventListener?.('change', () => loadCategories());
        }
    }

    window.initHomePage = initHomePage;
})();