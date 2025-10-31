(function(){
    const env = window.SF_ENV || {};
    const utils = window.SF_UTILS || {};
    const API_BASE = env.API_BASE || 'http://localhost:8000/api';
    const normalizeImageUrl = utils.normalizeImageUrl || ((u) => u || '');
    const formatPrice = utils.formatPrice || ((v) => v);
    const fetchSiteConfig = window.fetchSiteConfig || (async () => ({}));

    const HOME_CAROUSEL_CONFIG = {
        interval: 3000,
        ride: 'carousel',
        pause: false,
        wrap: true,
        touch: true,
        keyboard: true
    };

    async function setupHomeCarousel() {
        const root = document.getElementById('homeCarousel');
        if (!root) return;
        const slides = await loadCarouselSlides();
        renderCarousel(root, slides);
        bootHomeCarousel(root);
        try { localStorage.setItem('sf_carousel_slides', JSON.stringify(slides)); } catch (e) {}
    }

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
            const resolved = normalizeImageUrl(slide.imageUrl || '');
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
                const src = hero.imageUrl || heroImageEl.getAttribute('data-default-src') || heroImageEl.src;
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
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `<div class="icon"><i class="fa-solid fa-cookie-bite"></i></div><div class="name">${name}</div>`;
                card.addEventListener('click', () => {
                    window.location.href = 'product.html?category=' + encodeURIComponent(name);
                });
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<div class="text-muted">無法載入分類</div>';
        }
    }

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

    function initHomePage() {
        setupHomeCarousel();
        applySiteConfig();
        loadCategories();
        loadFeaturedProducts();
    }

    window.initHomePage = initHomePage;
})();
