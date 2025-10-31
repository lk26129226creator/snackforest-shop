(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state, images } = Admin;
    const { escapeAttr, deepClone } = Admin.utils;
    const site = Admin.site || {};
    const STORAGE_KEY = 'sf-admin-site-config-cache';

    function readCachedConfig() {
        try {
            if (!('localStorage' in window)) return null;
        } catch (_) {
            return null;
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function writeCachedConfig(value) {
        try {
            if (!('localStorage' in window)) return;
        } catch (_) {
            return;
        }
        try {
            if (!value) {
                window.localStorage.removeItem(STORAGE_KEY);
            } else {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
            }
        } catch (_) {
            // ignore storage errors
        }
    }

    const BUTTON_MAP = {
        hero: 'site-hero-save',
        benefits: 'site-benefit-save',
        featured: 'site-featured-save',
        branding: 'site-branding-save',
        footer: 'site-footer-save'
    };

    if (!state.siteConfig) {
        state.siteConfig = {
            data: null,
            original: null,
            dirty: { hero: false, benefits: false, featured: false, branding: false, footer: false },
            bound: false,
            saving: false
        };
    } else {
    state.siteConfig.dirty = Object.assign({ hero: false, benefits: false, featured: false, branding: false, footer: false }, state.siteConfig.dirty || {});
        state.siteConfig.bound = !!state.siteConfig.bound;
        state.siteConfig.saving = !!state.siteConfig.saving;
    }

    site.ensureData = function () {
        state.siteConfig.data = state.siteConfig.data || site.cloneConfig(state.siteConfig.original || config.DEFAULT_SITE_CONFIG);
        if (!state.siteConfig.data.footer) {
            const defaults = site.getDefault();
            state.siteConfig.data.footer = Object.assign({}, defaults.footer);
            if (!state.siteConfig.data.branding) {
                state.siteConfig.data.branding = Object.assign({}, defaults.branding);
            }
        } else if (!state.siteConfig.data.branding) {
            const defaults = site.getDefault();
            state.siteConfig.data.branding = Object.assign({}, defaults.branding);
        }
        return state.siteConfig.data;
    };

    site.getDefault = function () {
        return site.cloneConfig(config.DEFAULT_SITE_CONFIG);
    };

    site.cloneConfig = function (cfg) {
        return deepClone(cfg || config.DEFAULT_SITE_CONFIG, deepClone(config.DEFAULT_SITE_CONFIG));
    };

    const cachedConfig = readCachedConfig();
    if (!state.siteConfig.data && cachedConfig) {
        state.siteConfig.data = site.cloneConfig(cachedConfig);
        state.siteConfig.original = site.cloneConfig(cachedConfig);
    }

    site.sanitizeData = function (raw) {
        const base = site.getDefault();
        const hero = Object.assign({}, base.hero, (raw && raw.hero) || {});
        Object.keys(hero).forEach((key) => {
            hero[key] = String(hero[key] ?? '').trim();
        });
        const benefits = Array.isArray(raw?.benefits) ? raw.benefits : base.benefits;
        const cleanedBenefits = benefits.map((item) => ({
            icon: String(item?.icon ?? '').trim(),
            title: String(item?.title ?? '').trim(),
            desc: String(item?.desc ?? '').trim()
        })).filter((item) => item.icon || item.title || item.desc);
        const featured = Array.from(new Set((raw?.featuredProductIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))));
        const footer = Object.assign({}, base.footer, raw?.footer || {});
        footer.text = String(footer.text ?? '').trim();
        if (!footer.text) footer.text = base.footer.text;
        const branding = Object.assign({}, base.branding, raw?.branding || {});
        branding.logoUrl = String(branding.logoUrl ?? '').trim();
        branding.brandName = String(branding.brandName ?? '').trim() || base.branding.brandName;
        branding.tagline = String(branding.tagline ?? '').trim();
        return {
            hero,
            benefits: cleanedBenefits,
            featuredProductIds: featured,
            branding,
            footer
        };
    };

    site.updateButtonState = function (section) {
        const btnId = BUTTON_MAP[section];
        if (!btnId) return;
        const btn = document.getElementById(btnId);
        if (!btn || btn.dataset.busyText) return;
        const baseText = btn.dataset.baseText || btn.textContent.replace(/\*$/, '');
        if (!btn.dataset.baseText) btn.dataset.baseText = baseText;
        const isDirty = !!state.siteConfig.dirty[section];
        btn.textContent = isDirty ? `${baseText}*` : baseText;
        btn.classList.toggle('btn-warning', isDirty);
    };

    site.setDirty = function (section, dirty) {
    state.siteConfig.dirty = state.siteConfig.dirty || { hero: false, benefits: false, featured: false, branding: false, footer: false };
        state.siteConfig.dirty[section] = !!dirty;
        site.updateButtonState(section);
    };

    site.setBusy = function (section, busy) {
        const buttonIds = section === 'all' ? Object.values(BUTTON_MAP) : [BUTTON_MAP[section]].filter(Boolean);
        buttonIds.forEach((btnId) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            if (busy) {
                if (!btn.dataset.busyText) btn.dataset.busyText = btn.textContent;
                btn.disabled = true;
                btn.textContent = '儲存中...';
            } else {
                btn.disabled = false;
                if (btn.dataset.busyText) {
                    btn.textContent = btn.dataset.busyText;
                    delete btn.dataset.busyText;
                }
                const entry = Object.entries(BUTTON_MAP).find(([, value]) => value === btnId);
                if (entry) site.updateButtonState(entry[0]);
            }
        });
    };

    site.setStatus = function (message, level) {
        const section = document.getElementById('site-section');
        if (!section) return;
        let status = section.querySelector('[data-role="site-config-status"]');
        if (!status) {
            status = document.createElement('div');
            status.dataset.role = 'site-config-status';
            section.prepend(status);
        }
        status.className = `alert alert-${level || 'secondary'} site-config-status mt-2`;
        status.textContent = message;
        status.classList.remove('d-none');
    };

    site.clearStatus = function () {
        const section = document.getElementById('site-section');
        if (!section) return;
        const status = section.querySelector('[data-role="site-config-status"]');
        if (status) status.classList.add('d-none');
    };

    site.ensureSection = async function (options) {
        site.initBindings();
        if (!state.siteConfig.data || options?.force) {
            await site.loadConfig(options);
        } else {
            site.render(state.siteConfig.data, { resetDirty: false });
        }
    };

    site.updateFooterPreview = function (text) {
        const preview = document.getElementById('site-footer-preview');
        if (!preview) return;
        const content = String(text || '').trim();
        preview.innerHTML = '';
        if (!content) {
            preview.textContent = '頁腳目前沒有內容，儲存後將套用預設文字。';
            preview.classList.add('text-muted');
            return;
        }
        preview.classList.remove('text-muted');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            if (index > 0) preview.appendChild(document.createElement('br'));
            preview.appendChild(document.createTextNode(line));
        });
    };

    site.renderFooter = function (footer) {
        const defaults = site.getDefault().footer;
        const data = Object.assign({}, defaults, footer || {});
        const textarea = document.getElementById('site-footer-text');
        if (textarea) textarea.value = data.text || '';
        site.updateFooterPreview(data.text);
    };

    site.updateBrandingPreview = function (url) {
        const preview = document.getElementById('site-branding-logo-preview');
        if (!preview) return;
        const trimmed = String(url || '').trim();
        if (trimmed) {
            try {
                const normalized = images && typeof images.normalizeImageUrl === 'function'
                    ? images.normalizeImageUrl(trimmed)
                    : trimmed;
                preview.src = normalized;
            } catch (_) {
                preview.src = trimmed;
            }
            preview.classList.remove('d-none');
            preview.removeAttribute('hidden');
        } else {
            preview.removeAttribute('src');
            preview.classList.add('d-none');
            preview.setAttribute('hidden', '');
        }
    };

    site.renderBranding = function (branding) {
        const defaults = site.getDefault().branding;
        const data = Object.assign({}, defaults, branding || {});
        const nameInput = document.getElementById('site-branding-name');
        if (nameInput) nameInput.value = data.brandName || '';
        const taglineInput = document.getElementById('site-branding-tagline');
        if (taglineInput) taglineInput.value = data.tagline || '';
        const logoInput = document.getElementById('site-branding-logo');
        if (logoInput) logoInput.value = data.logoUrl || '';
        site.updateBrandingPreview(data.logoUrl);
    };

    site.initBindings = function () {
        if (state.siteConfig.bound) return;
        state.siteConfig.bound = true;

        const heroFields = [
            { id: 'site-hero-title', key: 'title' },
            { id: 'site-hero-subtitle', key: 'subtitle' },
            { id: 'site-hero-primary-text', key: 'primaryText' },
            { id: 'site-hero-primary-link', key: 'primaryLink' },
            { id: 'site-hero-secondary-text', key: 'secondaryText' },
            { id: 'site-hero-secondary-link', key: 'secondaryLink' },
            { id: 'site-hero-image', key: 'imageUrl' }
        ];
        heroFields.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', (event) => {
                site.ensureData();
                const hero = state.siteConfig.data.hero || (state.siteConfig.data.hero = {});
                hero[key] = event.target.value;
                if (key === 'imageUrl') site.updateHeroPreview(hero.imageUrl);
                site.setDirty('hero', true);
            });
        });

        const heroReset = document.getElementById('site-hero-reset');
        if (heroReset) {
            heroReset.addEventListener('click', (event) => {
                event.preventDefault();
                const defaults = site.getDefault().hero;
                site.ensureData();
                state.siteConfig.data.hero = Object.assign({}, defaults);
                site.applyHeroInputs(state.siteConfig.data.hero);
                site.setDirty('hero', true);
            });
        }

        const heroSave = document.getElementById('site-hero-save');
        if (heroSave) {
            heroSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('hero');
            });
        }

        const heroUploadBtn = document.getElementById('site-hero-upload');
        const heroFileInput = document.getElementById('site-hero-image-file');
        if (heroUploadBtn && heroFileInput) {
            heroUploadBtn.addEventListener('click', (event) => {
                event.preventDefault();
                heroFileInput.click();
            });
            heroFileInput.addEventListener('change', site.handleHeroFileUpload);
        }

        const brandingFields = [
            { id: 'site-branding-name', key: 'brandName' },
            { id: 'site-branding-tagline', key: 'tagline' },
            { id: 'site-branding-logo', key: 'logoUrl' }
        ];
        brandingFields.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (!input) return;
            if (!input.dataset.bound) {
                input.dataset.bound = '1';
                input.addEventListener('input', (event) => {
                    site.ensureData();
                    const defaults = site.getDefault().branding;
                    const branding = state.siteConfig.data.branding || (state.siteConfig.data.branding = Object.assign({}, defaults));
                    branding[key] = event.target.value;
                    if (key === 'logoUrl') {
                        site.updateBrandingPreview(branding.logoUrl);
                    }
                    site.setDirty('branding', true);
                });
            }
        });

        const brandingUploadBtn = document.getElementById('site-branding-upload');
        const brandingFileInput = document.getElementById('site-branding-logo-file');
        if (brandingUploadBtn && brandingFileInput && !brandingUploadBtn.dataset.bound) {
            brandingUploadBtn.dataset.bound = '1';
            brandingUploadBtn.addEventListener('click', (event) => {
                event.preventDefault();
                brandingFileInput.click();
            });
            brandingFileInput.addEventListener('change', site.handleBrandingFileUpload);
        }

        const brandingSave = document.getElementById('site-branding-save');
        if (brandingSave && !brandingSave.dataset.bound) {
            brandingSave.dataset.bound = '1';
            brandingSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('branding');
            });
        }

        const benefitAddBtn = document.getElementById('site-benefit-add');
        if (benefitAddBtn) {
            benefitAddBtn.addEventListener('click', (event) => {
                event.preventDefault();
                site.ensureData();
                const list = state.siteConfig.data.benefits || (state.siteConfig.data.benefits = []);
                list.push({ icon: '', title: '', desc: '' });
                site.renderBenefits(list);
                site.setDirty('benefits', true);
            });
        }

        const benefitList = document.getElementById('site-benefit-list');
        if (benefitList && !benefitList.dataset.bound) {
            benefitList.dataset.bound = '1';
            benefitList.addEventListener('input', site.handleBenefitInput);
            benefitList.addEventListener('click', site.handleBenefitActionClick);
        }

        const benefitSave = document.getElementById('site-benefit-save');
        if (benefitSave) {
            benefitSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('benefits');
            });
        }

        const featuredList = document.getElementById('site-featured-list');
        if (featuredList && !featuredList.dataset.bound) {
            featuredList.dataset.bound = '1';
            featuredList.addEventListener('click', site.handleFeaturedActionClick);
        }

        const featuredSave = document.getElementById('site-featured-save');
        if (featuredSave) {
            featuredSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('featured');
            });
        }

        const footerText = document.getElementById('site-footer-text');
        if (footerText && !footerText.dataset.bound) {
            footerText.dataset.bound = '1';
            footerText.addEventListener('input', (event) => {
                site.ensureData();
                const footer = state.siteConfig.data.footer || (state.siteConfig.data.footer = {});
                footer.text = event.target.value;
                site.setDirty('footer', true);
                site.updateFooterPreview(footer.text);
            });
        }

        const footerSave = document.getElementById('site-footer-save');
        if (footerSave && !footerSave.dataset.bound) {
            footerSave.dataset.bound = '1';
            footerSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('footer');
            });
        }
    };

    site.handleHeroFileUpload = async function (event) {
        const input = event.target;
        const file = input.files && input.files[0];
        if (!file) return;
        site.setBusy('hero', true);
        try {
            const url = await images.uploadImage(file);
            if (!url) throw new Error('未取得圖片網址');
            site.ensureData();
            state.siteConfig.data.hero.imageUrl = url;
            site.applyHeroInputs(state.siteConfig.data.hero);
            site.setDirty('hero', true);
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, 'Hero 橫幅圖片上傳失敗');
            } else {
                alert('圖片上傳失敗：' + (err.message || err));
            }
        } finally {
            site.setBusy('hero', false);
            try { input.value = ''; } catch (_) {}
        }
    };

    site.handleBrandingFileUpload = async function (event) {
        const input = event.target;
        const file = input.files && input.files[0];
        if (!file) return;
        site.setBusy('branding', true);
        try {
            const url = await images.uploadImage(file);
            if (!url) throw new Error('未取得圖片網址');
            site.ensureData();
            const defaults = site.getDefault().branding;
            const branding = state.siteConfig.data.branding || (state.siteConfig.data.branding = Object.assign({}, defaults));
            branding.logoUrl = url;
            site.renderBranding(branding);
            site.setDirty('branding', true);
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, 'Logo 圖片上傳失敗');
            } else {
                alert('Logo 圖片上傳失敗：' + (err.message || err));
            }
        } finally {
            site.setBusy('branding', false);
            try { input.value = ''; } catch (_) {}
        }
    };

    site.loadConfig = async function () {
        if (state.siteConfig.loading) return;
        state.siteConfig.loading = true;
        site.setStatus('網站設定載入中...', 'info');
        try {
            const res = await fetch(config.endpoints.siteConfig, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const sanitized = site.sanitizeData(data);
            writeCachedConfig(sanitized);
            state.siteConfig.data = site.cloneConfig(sanitized);
            state.siteConfig.original = site.cloneConfig(sanitized);
            site.render(state.siteConfig.data, { resetDirty: true });
            site.clearStatus();
            if (Admin.core && typeof Admin.core.emit === 'function') {
                Admin.core.emit('site-config:loaded', { config: state.siteConfig.data });
            }
        } catch (err) {
            console.error('Load site config error:', err);
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '載入網站設定失敗');
            }
            const fallback = readCachedConfig();
            if (fallback) {
                state.siteConfig.data = site.cloneConfig(fallback);
                state.siteConfig.original = site.cloneConfig(fallback);
                site.render(state.siteConfig.data, { resetDirty: true });
                site.setStatus('遠端回應異常，已套用上次儲存的設定。', 'warning');
            } else {
                site.setStatus('載入網站設定失敗：' + (err.message || err), 'danger');
            }
        } finally {
            state.siteConfig.loading = false;
        }
    };

    site.render = function (data, options) {
        const resetDirty = options?.resetDirty !== false;
        if (data && (resetDirty || !state.siteConfig.data)) {
            state.siteConfig.data = site.cloneConfig(data);
        } else if (!state.siteConfig.data) {
            site.ensureData();
        }
        const current = state.siteConfig.data || site.getDefault();
        site.applyHeroInputs(current.hero);
        site.renderBranding(current.branding);
        site.renderBenefits(current.benefits);
        site.renderFeaturedList();
        site.renderFooter(current.footer);
        if (resetDirty) {
            ['hero', 'benefits', 'featured', 'branding', 'footer'].forEach((section) => site.setDirty(section, false));
        } else {
            ['hero', 'benefits', 'featured', 'branding', 'footer'].forEach((section) => site.updateButtonState(section));
        }
    };

    site.applyHeroInputs = function (hero) {
        const map = {
            title: 'site-hero-title',
            subtitle: 'site-hero-subtitle',
            primaryText: 'site-hero-primary-text',
            primaryLink: 'site-hero-primary-link',
            secondaryText: 'site-hero-secondary-text',
            secondaryLink: 'site-hero-secondary-link',
            imageUrl: 'site-hero-image'
        };
        Object.entries(map).forEach(([key, id]) => {
            const input = document.getElementById(id);
            if (input) input.value = hero?.[key] || '';
        });
        site.updateHeroPreview(hero?.imageUrl || '');
    };

    site.updateHeroPreview = function (url) {
        const preview = document.getElementById('site-hero-image-preview');
        if (!preview) return;
        const trimmed = String(url || '').trim();
        if (trimmed) {
            preview.src = images.normalizeImageUrl(trimmed);
            preview.style.display = 'block';
        } else {
            preview.removeAttribute('src');
            preview.style.display = 'none';
        }
    };

    site.renderBenefits = function (benefits) {
        const list = document.getElementById('site-benefit-list');
        if (!list) return;
        list.innerHTML = '';
        if (!benefits || benefits.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-muted';
            empty.textContent = '尚未新增首頁亮點。按「新增一則」開始建立。';
            list.appendChild(empty);
            return;
        }
        benefits.forEach((benefit, idx) => {
            const item = document.createElement('div');
            item.className = 'site-benefit-item';
            item.dataset.index = String(idx);
            item.innerHTML = `
                <div class="site-benefit-grid">
                    <div class="site-benefit-field">
                        <label class="form-label">Icon</label>
                        <input type="text" class="form-control" data-field="icon" value="${escapeAttr(benefit.icon || '')}" placeholder="如：truck-fast">
                    </div>
                    <div class="site-benefit-field">
                        <label class="form-label">標題</label>
                        <input type="text" class="form-control" data-field="title" value="${escapeAttr(benefit.title || '')}" placeholder="特色標題">
                    </div>
                    <div class="site-benefit-field">
                        <label class="form-label">描述</label>
                        <input type="text" class="form-control" data-field="desc" value="${escapeAttr(benefit.desc || '')}" placeholder="簡短說明">
                    </div>
                    <div class="site-benefit-actions">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-action="benefit-up">上移</button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-action="benefit-down">下移</button>
                        <button type="button" class="btn btn-outline-danger btn-sm" data-action="benefit-remove">刪除</button>
                    </div>
                </div>`;
            list.appendChild(item);
        });
    };

    site.handleBenefitInput = function (event) {
        const field = event.target.getAttribute('data-field');
        if (!field) return;
        const item = event.target.closest('.site-benefit-item');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (!Number.isFinite(idx)) return;
        site.ensureData();
        const benefits = state.siteConfig.data.benefits || (state.siteConfig.data.benefits = []);
        if (!benefits[idx]) benefits[idx] = { icon: '', title: '', desc: '' };
        benefits[idx][field] = event.target.value;
        site.setDirty('benefits', true);
    };

    site.handleBenefitActionClick = function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const item = button.closest('.site-benefit-item');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (!Number.isFinite(idx)) return;
        site.ensureData();
        const benefits = state.siteConfig.data.benefits || (state.siteConfig.data.benefits = []);
        let changed = false;
        if (button.dataset.action === 'benefit-remove') {
            benefits.splice(idx, 1);
            changed = true;
        } else if (button.dataset.action === 'benefit-up' && idx > 0) {
            [benefits[idx - 1], benefits[idx]] = [benefits[idx], benefits[idx - 1]];
            changed = true;
        } else if (button.dataset.action === 'benefit-down' && idx < benefits.length - 1) {
            [benefits[idx], benefits[idx + 1]] = [benefits[idx + 1], benefits[idx]];
            changed = true;
        }
        if (changed) {
            event.preventDefault();
            site.renderBenefits(benefits);
            site.setDirty('benefits', true);
        }
    };

    site.renderFeaturedList = function () {
        const list = document.getElementById('site-featured-list');
        if (!list) return;
        list.classList.add('site-featured-scroll');
        list.innerHTML = '';
        if (!state.siteConfig.data) {
            const empty = document.createElement('div');
            empty.className = 'text-muted site-featured-empty';
            empty.textContent = '網站設定尚未載入。';
            list.appendChild(empty);
            return;
        }
        const ids = Array.isArray(state.siteConfig.data.featuredProductIds) ? state.siteConfig.data.featuredProductIds : [];
        state.siteConfig.data.featuredProductIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))));

        const selectorCard = document.createElement('div');
        selectorCard.className = 'card p-3 mb-3 site-featured-selector shadow-sm';
        const available = (state.allProducts || []).filter((p) => !state.siteConfig.data.featuredProductIds.includes(p.id)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
        const optionsHtml = ['<option value="">選擇商品</option>']
            .concat(available.map((p) => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.name || '')}</option>`))
            .join('');
        selectorCard.innerHTML = `
            <div class="row g-2 align-items-center">
                <div class="col-12 col-md-8">
                    <select id="site-featured-selector" class="form-select">${optionsHtml}</select>
                </div>
                <div class="col-12 col-md-4 d-grid d-md-block">
                    <button type="button" class="btn btn-outline-secondary w-100" data-action="featured-add">加入精選</button>
                </div>
            </div>
            <div class="form-text mt-2">已加入的商品會依序顯示在首頁精選區塊。</div>`;
        list.appendChild(selectorCard);

        if (state.siteConfig.data.featuredProductIds.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-muted site-featured-empty';
            empty.textContent = '尚未選擇精選商品。使用下拉選單加入。';
            list.appendChild(empty);
            return;
        }

        state.siteConfig.data.featuredProductIds.forEach((id, index) => {
            const product = (state.allProducts || []).find((p) => Number(p.id) === Number(id));
            const title = product ? product.name : `#${id}`;
            const price = product ? `NT$${product.price}` : '';
            const imageUrl = product && product.imageUrls && product.imageUrls[0]
                ? images.normalizeImageUrl(product.imageUrls[0])
                : config.IMAGE_PLACEHOLDER_DATAURI;
            const card = document.createElement('div');
            card.className = 'card mb-2 site-featured-item';
            card.dataset.index = String(index);
            card.innerHTML = `
                <div class="card-body d-flex flex-wrap align-items-center gap-3">
                    <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(title || '')}" class="rounded" style="width:72px;height:72px;object-fit:cover;">
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${escapeAttr(title || '')}</div>
                        ${price ? `<div class="text-muted small">${escapeAttr(price)}</div>` : ''}
                    </div>
                    <div class="btn-group btn-group-sm ms-auto">
                        <button type="button" class="btn btn-outline-secondary" data-action="featured-up">上移</button>
                        <button type="button" class="btn btn-outline-secondary" data-action="featured-down">下移</button>
                        <button type="button" class="btn btn-outline-danger" data-action="featured-remove">移除</button>
                    </div>
                </div>`;
            list.appendChild(card);
        });
    };

    site.handleFeaturedActionClick = function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        site.ensureData();
        const ids = state.siteConfig.data.featuredProductIds || (state.siteConfig.data.featuredProductIds = []);
        if (button.dataset.action === 'featured-add') {
            const selector = document.getElementById('site-featured-selector');
            if (!selector) return;
            const value = Number(selector.value);
            if (!Number.isFinite(value) || ids.includes(value)) return;
            ids.push(value);
            selector.value = '';
            site.renderFeaturedList();
            site.setDirty('featured', true);
            return;
        }
        const item = button.closest('[data-index]');
        if (!item) return;
        const idx = Number(item.dataset.index);
        if (!Number.isFinite(idx)) return;
        if (button.dataset.action === 'featured-remove') {
            ids.splice(idx, 1);
        } else if (button.dataset.action === 'featured-up' && idx > 0) {
            [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
        } else if (button.dataset.action === 'featured-down' && idx < ids.length - 1) {
            [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
        } else {
            return;
        }
        event.preventDefault();
        site.renderFeaturedList();
        site.setDirty('featured', true);
    };

    site.buildPayload = function () {
        site.ensureData();
        const hero = Object.assign({}, config.DEFAULT_SITE_CONFIG.hero, state.siteConfig.data.hero || {});
        Object.keys(hero).forEach((key) => { hero[key] = String(hero[key] ?? '').trim(); });
        const benefits = (state.siteConfig.data.benefits || []).map((item) => ({
            icon: String(item?.icon ?? '').trim(),
            title: String(item?.title ?? '').trim(),
            desc: String(item?.desc ?? '').trim()
        })).filter((item) => item.icon || item.title || item.desc);
        const featured = Array.from(new Set((state.siteConfig.data.featuredProductIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))));
        const footerDefaults = site.getDefault().footer;
        const footerText = String(state.siteConfig.data.footer?.text ?? '').trim();
        const footer = {
            text: footerText || footerDefaults.text || ''
        };
        const brandingDefaults = site.getDefault().branding;
        const brandingSource = Object.assign({}, brandingDefaults, state.siteConfig.data.branding || {});
        const brandingTagline = String(brandingSource.tagline ?? '').trim();
        const branding = {
            logoUrl: String(brandingSource.logoUrl ?? '').trim(),
            brandName: (String(brandingSource.brandName ?? '').trim() || brandingDefaults.brandName || '').trim(),
            tagline: brandingTagline || brandingDefaults.tagline || ''
        };
        return { hero, benefits, featuredProductIds: featured, branding, footer };
    };

    site.saveConfig = async function (section) {
        if (state.siteConfig.saving) return;
        state.siteConfig.saving = true;
        site.setBusy(section, true);
        try {
            const payload = site.buildPayload();
            const res = await fetch(config.endpoints.siteConfig, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state.siteConfig.data = site.cloneConfig(payload);
            state.siteConfig.original = site.cloneConfig(payload);
            writeCachedConfig(state.siteConfig.data);
            ['hero', 'benefits', 'featured', 'branding', 'footer'].forEach((part) => site.setDirty(part, false));
            site.clearStatus();
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('網站設定已儲存');
                Admin.core.emit('site-config:updated', { config: state.siteConfig.data });
            } else {
                alert('網站設定已儲存');
            }
        } catch (err) {
            console.error('Save site config error:', err);
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '儲存網站設定失敗');
            } else {
                alert('儲存網站設定失敗：' + (err.message || err));
            }
        } finally {
            state.siteConfig.saving = false;
            site.setBusy(section, false);
        }
    };

    Admin.site = site;

    if (Admin.core && typeof Admin.core.on === 'function') {
        if (!site._productsListenerBound) {
            site._productsListenerBound = true;
            Admin.core.on('products:updated', () => {
                if (state.siteConfig?.data) {
                    site.renderFeaturedList();
                }
            });
        }
    }
})(window);
