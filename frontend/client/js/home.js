(function(){
    // 首頁模組整合輪播、分類與精選商品，從後端載入資料並套用客製化站台設定。
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((v) => v);
    const fetchSiteConfig = window.fetchSiteConfig || (async () => ({}));
    const MOBILE_PRODUCT_BREAKPOINT = 768;
    const mobileProductMediaQuery = typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${MOBILE_PRODUCT_BREAKPOINT}px)`)
        : null;
    const FALLBACK_PRODUCT_IMAGE = (() => {
        const candidate = typeof utils.fallbackProductImage === 'string' && utils.fallbackProductImage.trim()
            ? utils.fallbackProductImage.trim()
            : (typeof window.SF_FALLBACK_PRODUCT_IMAGE === 'string' && window.SF_FALLBACK_PRODUCT_IMAGE.trim()
                ? window.SF_FALLBACK_PRODUCT_IMAGE.trim()
                : 'https://picsum.photos/320/320?snack');
        try {
            return normalizeImageUrl(candidate);
        } catch (_) {
            return candidate;
        }
    })();
    const CAROUSEL_FALLBACK_IMAGE = (() => {
        try {
            return normalizeImageUrl('/frontend/images/products/no-image.svg');
        } catch (_) {
            return '/frontend/images/products/no-image.svg';
        }
    })();
    const CAROUSEL_DEFAULT_LINK = 'product.html';
    const categorySectionMeta = (() => {
        const gridEl = document.getElementById('home-categories-grid');
        if (!gridEl) return null;
        const sectionEl = gridEl.closest('section');
        if (!sectionEl) return null;
        const titleEl = sectionEl.querySelector('h2');
        const ctaEl = sectionEl.querySelector('a.btn');
        return {
            gridEl,
            sectionEl,
            titleEl,
            ctaEl,
            defaultTitle: titleEl ? titleEl.textContent.trim() : '',
            defaultCtaText: ctaEl ? ctaEl.textContent.trim() : '',
            defaultCtaHref: ctaEl ? ctaEl.getAttribute('href') : ''
        };
    })();

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

    function shouldUseMobileProductLayout() {
        if (mobileProductMediaQuery) {
            return mobileProductMediaQuery.matches;
        }
        return window.innerWidth <= MOBILE_PRODUCT_BREAKPOINT;
    }

    function updateCategorySectionHeading(mode) {
        if (!categorySectionMeta) return;
        const { titleEl, ctaEl, defaultTitle, defaultCtaText, defaultCtaHref } = categorySectionMeta;
        if (mode === 'mobile-products') {
            if (titleEl) titleEl.textContent = '行動精選商品';
            if (ctaEl) {
                ctaEl.textContent = '更多商品';
                ctaEl.setAttribute('href', 'product.html');
            }
        } else {
            if (titleEl) titleEl.textContent = defaultTitle || '依分類逛逛';
            if (ctaEl) {
                ctaEl.textContent = defaultCtaText || '全部商品';
                if (defaultCtaHref) {
                    ctaEl.setAttribute('href', defaultCtaHref);
                }
            }
        }
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

    function resolveCarouselLink(value) {
        const raw = (value || '').toString().trim();
        if (!raw) return CAROUSEL_DEFAULT_LINK;
        if (/^(https?:)?\/\//i.test(raw)) return raw;
        if (raw.startsWith('/') || raw.startsWith('#')) return raw;
        return raw;
    }

    function resolveCarouselImage(entry) {
        const candidates = [
            entry?.imageUrlResolved,
            entry?.imageUrl,
            entry?.imageUrlOriginal
        ];
        for (const candidate of candidates) {
            const trimmed = (candidate || '').toString().trim();
            if (!trimmed) continue;
            try {
                const resolved = normalizeImageUrl(trimmed);
                if (resolved) return resolved;
            } catch (_) {
                if (trimmed) return trimmed;
            }
        }
        return CAROUSEL_FALLBACK_IMAGE;
    }

    function sanitizeCarouselSlides(list) {
        if (!Array.isArray(list)) return [];
        const normalized = [];
        const seen = new Set();
        list.forEach((raw) => {
            if (!raw || typeof raw !== 'object') return;
            const title = (raw.title || '').toString().trim();
            const text = (raw.text || '').toString().trim();
            const link = resolveCarouselLink(raw.link);
            const imageResolved = resolveCarouselImage(raw);
            const dedupeKey = `${imageResolved}::${title}::${text}::${link}`;
            const allowDuplicate = imageResolved === CAROUSEL_FALLBACK_IMAGE;
            if (!allowDuplicate && seen.has(dedupeKey)) return;
            if (!allowDuplicate) seen.add(dedupeKey);
            normalized.push({
                ...raw,
                title,
                text,
                link,
                imageUrlResolved: imageResolved,
                imageUrl: raw.imageUrl || raw.imageUrlResolved || raw.imageUrlOriginal || '',
                imageUrlOriginal: raw.imageUrlOriginal || raw.imageUrl || '',
                imageMissing: imageResolved === CAROUSEL_FALLBACK_IMAGE
            });
        });
        return normalized;
    }

    // 優先走後端資料，若缺少則回落至本機快取或預設示意圖片。
    /**
     * 優先抓取後端輪播資料，失敗時回落至快取或預設。
     * @returns {Promise<Array>}
     */
    async function loadCarouselSlides() {
        const cacheKey = 'sf_carousel_slides';
        let slides = sanitizeCarouselSlides(await fetchCarouselFromBackend());
        if (!slides.length) {
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
                slides = sanitizeCarouselSlides(cached);
            } catch (e) {
                slides = [];
            }
        }
        if (!slides.length) {
            slides = sanitizeCarouselSlides([
                { imageUrl: 'https://picsum.photos/1200/380?random=11', title: '精選零食推薦', text: '發掘這週最新上架' },
                { imageUrl: 'https://picsum.photos/1200/380?random=12', title: '甜鹹一次滿足', text: '逛逛更多人氣組合' },
                { imageUrl: 'https://picsum.photos/1200/380?random=13', title: '限時優惠', text: '折扣商品不要錯過' }
            ]);
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
    function normalizeMobileProductBrief(product) {
        if (!product || typeof product !== 'object') {
            return {
                id: '',
                name: '商品',
                price: 0,
                imageUrl: FALLBACK_PRODUCT_IMAGE,
                categoryName: '',
                href: ''
            };
        }

        const id = product.id ?? product.idProducts ?? product.idProduct ?? product.id_products ?? '';
        const name = product.name || product.ProductName || product.productName || product.title || '商品';
        const rawPrice = product.price !== undefined ? product.price
            : (product.Price !== undefined ? product.Price
                : (product.priceProducts !== undefined ? product.priceProducts
                    : (product.priceProduct !== undefined ? product.priceProduct : 0)));
        let imageCandidate = null;
        if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) imageCandidate = product.imageUrls[0];
        else if (Array.isArray(product.ImageUrls) && product.ImageUrls.length > 0) imageCandidate = product.ImageUrls[0];
        else if (product.imageUrl) imageCandidate = product.imageUrl;
        else if (product.image) imageCandidate = product.image;
        else if (product.ImageUrl) imageCandidate = product.ImageUrl;

        let imageUrl = imageCandidate || FALLBACK_PRODUCT_IMAGE;
        try {
            imageUrl = normalizeImageUrl(imageUrl);
        } catch (_) {
            imageUrl = imageCandidate || FALLBACK_PRODUCT_IMAGE;
        }
        if (!imageUrl) {
            imageUrl = FALLBACK_PRODUCT_IMAGE;
        }

        const categoryName = product.categoryName || product.categoryname || product.CategoryName || '';
        const priceNumber = Number(rawPrice);

        return {
            id,
            name,
            price: Number.isFinite(priceNumber) ? priceNumber : 0,
            imageUrl,
            categoryName,
            href: id ? `product.html?id=${encodeURIComponent(id)}` : ''
        };
    }

    async function renderCategoryCards(grid) {
        updateCategorySectionHeading('categories');
        grid.classList.add('category-grid');
        grid.classList.remove('mobile-product-grid');
        grid.dataset.layout = 'categories';
        grid.innerHTML = '<div class="text-muted">載入中...</div>';
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

            if (!grid.children.length) {
                grid.innerHTML = '<div class="text-muted">目前沒有分類資料</div>';
            }
        } catch (e) {
            grid.innerHTML = '<div class="text-muted">無法載入分類</div>';
        }
    }

    async function renderMobileProductShelf(grid) {
        updateCategorySectionHeading('mobile-products');
        grid.classList.add('mobile-product-grid');
        grid.classList.remove('category-grid');
        grid.dataset.layout = 'mobile-products';
        grid.innerHTML = '<div class="text-muted">載入中...</div>';
        try {
            const res = await fetch(API_BASE + '/products', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const items = Array.isArray(data) ? data.filter(Boolean).slice(0, 6) : [];
            grid.innerHTML = '';
            if (!items.length) {
                grid.innerHTML = '<div class="text-muted">暫時沒有商品</div>';
                return;
            }

            items.forEach((product) => {
                const meta = normalizeMobileProductBrief(product);
                const card = document.createElement(meta.href ? 'a' : 'div');
                card.className = 'mobile-product-card';
                if (meta.href) {
                    card.href = meta.href;
                }

                const thumb = document.createElement('div');
                thumb.className = 'mobile-product-card__thumb';
                const img = document.createElement('img');
                img.src = meta.imageUrl;
                img.alt = meta.name;
                thumb.appendChild(img);

                const body = document.createElement('div');
                body.className = 'mobile-product-card__body';
                const nameEl = document.createElement('div');
                nameEl.className = 'mobile-product-card__name';
                nameEl.textContent = meta.name;
                nameEl.title = meta.name;

                const metaRow = document.createElement('div');
                metaRow.className = 'mobile-product-card__meta';
                const priceEl = document.createElement('span');
                priceEl.className = 'mobile-product-card__price';
                priceEl.textContent = formatPrice(meta.price);
                metaRow.appendChild(priceEl);

                if (meta.categoryName) {
                    const categoryEl = document.createElement('span');
                    categoryEl.className = 'mobile-product-card__category';
                    categoryEl.textContent = meta.categoryName;
                    metaRow.appendChild(categoryEl);
                }

                body.appendChild(nameEl);
                body.appendChild(metaRow);
                card.appendChild(thumb);
                card.appendChild(body);
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<div class="text-muted">暫時無法載入商品</div>';
        }
    }

    async function loadCategories(layoutOverride) {
        const grid = document.getElementById('home-categories-grid');
        if (!grid) return;
        const nextMode = layoutOverride || (shouldUseMobileProductLayout() ? 'mobile-products' : 'categories');

        if (grid.dataset.layout === nextMode) {
            return;
        }

        if (nextMode === 'mobile-products') {
            await renderMobileProductShelf(grid);
        } else {
            await renderCategoryCards(grid);
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

        const handleCategoryLayoutChange = (event) => {
            const useMobile = event ? event.matches : shouldUseMobileProductLayout();
            loadCategories(useMobile ? 'mobile-products' : 'categories');
        };

        if (mobileProductMediaQuery) {
            handleCategoryLayoutChange();
            if (typeof mobileProductMediaQuery.addEventListener === 'function') {
                mobileProductMediaQuery.addEventListener('change', handleCategoryLayoutChange);
            } else if (typeof mobileProductMediaQuery.addListener === 'function') {
                mobileProductMediaQuery.addListener(handleCategoryLayoutChange);
            }
        } else {
            handleCategoryLayoutChange();
            window.addEventListener('resize', () => {
                handleCategoryLayoutChange();
            });
        }
    }

    window.initHomePage = initHomePage;
})();
