//
//  站台設定模組：管理首頁 Hero、優勢、促銷、客服、精選商品與頁腳設定。
//  提供快取、表單綁定、儲存與預覽功能，協助管理員快速調整前台內容。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state, images } = Admin;
    const { escapeAttr, deepClone } = Admin.utils;
    const site = Admin.site || {};
    const STORAGE_KEY = 'sf-admin-site-config-cache';

    /**
     * 從 localStorage 讀取上次編輯的站台設定暫存。
     * @returns {?Object}
     */
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

    /**
     * 將站台設定寫入或清除本機暫存。
     * @param {?Object} value 要寫入的設定；為 null 或 undefined 時清除暫存。
     */
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
        promotions: 'site-promotions-save',
        support: 'site-support-save',
        featured: 'site-featured-save',
        footer: 'site-footer-save'
    };

    if (!state.siteConfig) {
        state.siteConfig = {
            data: null,
            original: null,
            dirty: { hero: false, benefits: false, promotions: false, support: false, featured: false, footer: false },
            bound: false,
            saving: false
        };
    } else {
        state.siteConfig.dirty = Object.assign({ hero: false, benefits: false, promotions: false, support: false, featured: false, footer: false }, state.siteConfig.dirty || {});
        state.siteConfig.bound = !!state.siteConfig.bound;
        state.siteConfig.saving = !!state.siteConfig.saving;
    }

    /**
     * 確保 `state.siteConfig.data` 存在並補齊必要欄位，防止表單操作遇到 undefined。
     * @returns {Object} 可安全操作的站台設定資料物件。
     */
    site.ensureData = function () {
        const defaults = site.getDefault();
        state.siteConfig.data = state.siteConfig.data || site.cloneConfig(state.siteConfig.original || config.DEFAULT_SITE_CONFIG);
        if (!Array.isArray(state.siteConfig.data.promotions)) {
            state.siteConfig.data.promotions = deepClone(defaults.promotions || []);
        }
        if (!state.siteConfig.data.support) {
            state.siteConfig.data.support = Object.assign({}, defaults.support);
        } else {
            const mergedSupport = Object.assign({}, defaults.support, state.siteConfig.data.support);
            state.siteConfig.data.support = mergedSupport;
        }
        if (!state.siteConfig.data.footer) {
            state.siteConfig.data.footer = Object.assign({}, defaults.footer);
        }
        return state.siteConfig.data;
    };

    /**
     * 取得網站設定的預設資料深拷貝，避免原始常數被改動。
     * @returns {Object}
     */
    site.getDefault = function () {
        return site.cloneConfig(config.DEFAULT_SITE_CONFIG);
    };

    /**
     * 深拷貝站台設定物件，確保不會修改到傳入來源。
     * @param {Object} [cfg] 來源設定；缺省時使用預設值。
     * @returns {Object}
     */
    site.cloneConfig = function (cfg) {
        return deepClone(cfg || config.DEFAULT_SITE_CONFIG, deepClone(config.DEFAULT_SITE_CONFIG));
    };

    const cachedConfig = readCachedConfig();
    if (!state.siteConfig.data && cachedConfig) {
        state.siteConfig.data = site.cloneConfig(cachedConfig);
        state.siteConfig.original = site.cloneConfig(cachedConfig);
    }

    /**
     * 將後端或本機暫存的資料正規化：
     * hero/support 會補齊預設值、陣列會過濾空項目、精選列表會去重並轉成數字。
     * @param {Object} raw 原始設定資料。
     * @returns {Object}
     */
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
        const promotionsSource = Array.isArray(raw?.promotions) ? raw.promotions : base.promotions || [];
        const promotions = promotionsSource
            .map((item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    const text = item.trim();
                    return text ? { text, link: '' } : null;
                }
                const text = String(item.text ?? item.title ?? '').trim();
                if (!text) return null;
                const linkRaw = item.link ?? item.href ?? item.url;
                const link = typeof linkRaw === 'string' ? linkRaw.trim() : '';
                return link ? { text, link } : { text, link: '' };
            })
            .filter(Boolean);
        const supportRaw = (raw && typeof raw.support === 'object') ? raw.support : {};
        const support = {
            email: String(supportRaw.email ?? supportRaw.mail ?? base.support?.email ?? '').trim(),
            phone: String(supportRaw.phone ?? supportRaw.tel ?? base.support?.phone ?? '').trim(),
            hours: String(supportRaw.hours ?? supportRaw.businessHours ?? base.support?.hours ?? '').trim(),
            liveChatUrl: String(supportRaw.liveChatUrl ?? supportRaw.chatUrl ?? base.support?.liveChatUrl ?? '').trim(),
            liveChatLabel: String(supportRaw.liveChatLabel ?? supportRaw.liveChatText ?? supportRaw.chatLabel ?? base.support?.liveChatLabel ?? '').trim()
        };
        const footer = Object.assign({}, base.footer, raw?.footer || {});
        footer.text = String(footer.text ?? '').trim();
        if (!footer.text) footer.text = base.footer.text;
        return {
            hero,
            benefits: cleanedBenefits,
            promotions,
            support,
            featuredProductIds: featured,
            footer
        };
    };

    /**
     * 更新指定區塊的儲存按鈕文字與樣式，顯示是否存在未儲存變更。
     * @param {string} section 對應的區塊識別，例如 hero、benefits。
     */
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

    /**
     * 標記指定區塊為 dirty，並更新按鈕狀態顯示。
     * @param {string} section 區塊名稱。
     * @param {boolean} dirty 是否有未儲存變更。
     */
    site.setDirty = function (section, dirty) {
        state.siteConfig.dirty = state.siteConfig.dirty || { hero: false, benefits: false, promotions: false, support: false, featured: false, footer: false };
        state.siteConfig.dirty[section] = !!dirty;
        site.updateButtonState(section);
    };

    /**
     * 控制儲存按鈕忙碌狀態，顯示「儲存中...」並鎖定互動。
     * @param {string|'all'} section 單一區塊或 'all' 表全域按鈕。
     * @param {boolean} busy 是否處於忙碌狀態。
     */
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

    /**
     * 更新站台設定區塊上方的提示訊息。
     * @param {string} message 顯示的訊息文字。
     * @param {string} [level='secondary'] Bootstrap 警示層級，如 info、warning。
     */
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

    /**
     * 隱藏站台設定區塊提示訊息。
     */
    site.clearStatus = function () {
        const section = document.getElementById('site-section');
        if (!section) return;
        const status = section.querySelector('[data-role="site-config-status"]');
        if (status) status.classList.add('d-none');
    };

    /**
     * 進入站台設定頁時，綁定事件並在必要時重新載入資料。
     * @param {{force?: boolean}} [options] force 為 true 時強制重新抓取資料。
     */
    site.ensureSection = async function (options) {
        site.initBindings();
        if (!state.siteConfig.data || options?.force) {
            await site.loadConfig(options);
        } else {
            site.render(state.siteConfig.data, { resetDirty: false });
        }
    };

    /**
     * 更新頁腳預覽區域，會依內容換行並處理空值提示。
     * @param {string} text 頁腳輸入的文字內容。
     */
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

    /**
     * 渲染頁腳輸入欄位與預覽，若缺值則補預設資料。
     * @param {Object} [footer]
     */
    site.renderFooter = function (footer) {
        const defaults = site.getDefault().footer;
        const data = Object.assign({}, defaults, footer || {});
        const textarea = document.getElementById('site-footer-text');
        if (textarea) textarea.value = data.text || '';
        site.updateFooterPreview(data.text);
    };

    /**
     * 綁定各輸入欄位、按鈕與狀態，確保表單操作會同步更新 state。
     */
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

        const promoAddBtn = document.getElementById('site-promo-add');
        if (promoAddBtn && !promoAddBtn.dataset.bound) {
            promoAddBtn.dataset.bound = '1';
            promoAddBtn.addEventListener('click', (event) => {
                event.preventDefault();
                site.ensureData();
                const list = state.siteConfig.data.promotions || (state.siteConfig.data.promotions = []);
                list.push({ text: '', link: '' });
                site.renderPromotions(list);
                site.setDirty('promotions', true);
            });
        }

        const promoList = document.getElementById('site-promo-list');
        if (promoList && !promoList.dataset.bound) {
            promoList.dataset.bound = '1';
            promoList.addEventListener('input', site.handlePromoInput);
            promoList.addEventListener('click', site.handlePromoActionClick);
        }

        const promoSave = document.getElementById('site-promotions-save');
        if (promoSave && !promoSave.dataset.bound) {
            promoSave.dataset.bound = '1';
            promoSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('promotions');
            });
        }

        const supportFields = [
            { id: 'site-support-email', key: 'email' },
            { id: 'site-support-phone', key: 'phone' },
            { id: 'site-support-hours', key: 'hours' },
            { id: 'site-support-livechat', key: 'liveChatUrl' },
            { id: 'site-support-livechat-label', key: 'liveChatLabel' }
        ];
        supportFields.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (!input || input.dataset.bound) return;
            input.dataset.bound = '1';
            input.addEventListener('input', (event) => {
                site.ensureData();
                const support = state.siteConfig.data.support || (state.siteConfig.data.support = {});
                support[key] = event.target.value;
                site.setDirty('support', true);
            });
        });

        const supportSave = document.getElementById('site-support-save');
        if (supportSave && !supportSave.dataset.bound) {
            supportSave.dataset.bound = '1';
            supportSave.addEventListener('click', (event) => {
                event.preventDefault();
                site.saveConfig('support');
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

    /**
     * 處理 Hero 圖片上傳，成功後更新預覽與資料狀態。
     * @param {Event} event 來自 file input 的 change 事件。
     */
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

    /**
     * 從後端抓取最新站台設定；若失敗則回退至本機快取。
     * @returns {Promise<void>}
     */
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

    /**
     * 依據目前 state 或指定資料重新渲染站台設定頁面。
     * @param {Object} [data] 傳入時將作為最新資料來源。
     * @param {{resetDirty?: boolean}} [options] 控制是否重置 dirty 狀態。
     */
    site.render = function (data, options) {
        const resetDirty = options?.resetDirty !== false;
        if (data && (resetDirty || !state.siteConfig.data)) {
            state.siteConfig.data = site.cloneConfig(data);
        } else if (!state.siteConfig.data) {
            site.ensureData();
        }
        const current = state.siteConfig.data || site.getDefault();
        site.applyHeroInputs(current.hero);
        site.renderBenefits(current.benefits);
        site.renderPromotions(current.promotions);
        site.renderSupport(current.support);
        site.renderFeaturedList();
        site.renderFooter(current.footer);
        const sections = ['hero', 'benefits', 'promotions', 'support', 'featured', 'footer'];
        if (resetDirty) {
            sections.forEach((section) => site.setDirty(section, false));
        } else {
            sections.forEach((section) => site.updateButtonState(section));
        }
    };

    /**
     * 將 Hero 欄位資料寫回輸入框並同步預覽圖。
     * @param {Object} [hero] Hero 設定物件。
     */
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

    /**
     * 更新 Hero 圖片預覽，有路徑時顯示圖像、無值則隱藏。
     * @param {string} url Hero 圖片網址。
     */
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

    /**
     * 渲染首頁亮點清單並附上互動按鈕。
     * @param {Array} benefits 亮點資料陣列。
     */
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

    /**
     * 監聽亮點輸入欄位變化，更新對應陣列並標記 dirty。
     * @param {InputEvent} event input 事件。
     */
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

    /**
     * 處理亮點卡片的上移、下移與刪除交互。
     * @param {MouseEvent} event 點擊事件。
     */
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

    /**
     * 渲染首頁促銷公告卡片列表。
     * @param {Array} promotions 促銷資料陣列。
     */
    site.renderPromotions = function (promotions) {
        const list = document.getElementById('site-promo-list');
        if (!list) return;
        list.innerHTML = '';
        const items = Array.isArray(promotions) ? promotions : [];
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'text-muted';
            empty.textContent = '尚未新增優惠公告。按「新增一則」建立。';
            list.appendChild(empty);
            return;
        }
        items.forEach((promo, idx) => {
            const card = document.createElement('div');
            card.className = 'border rounded-3 p-3 bg-body-tertiary site-promo-item';
            card.dataset.index = String(idx);
            card.innerHTML = `
                <div class="row g-2 align-items-end">
                    <div class="col-lg-7">
                        <label class="form-label mb-1">顯示文字</label>
                        <input type="text" class="form-control" data-field="text" value="${escapeAttr(promo?.text || '')}" placeholder="例如：全館滿 NT$999 免運">
                    </div>
                    <div class="col-lg-5">
                        <label class="form-label mb-1">連結（選填）</label>
                        <input type="text" class="form-control" data-field="link" value="${escapeAttr(promo?.link || '')}" placeholder="例如：product.html">
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="text-muted small">第 ${idx + 1} 則</span>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-secondary" data-action="promo-up">上移</button>
                        <button type="button" class="btn btn-outline-secondary" data-action="promo-down">下移</button>
                        <button type="button" class="btn btn-outline-danger" data-action="promo-remove">移除</button>
                    </div>
                </div>`;
            list.appendChild(card);
        });
    };

    /**
     * 處理促銷欄位輸入，寫回資料陣列並標記 dirty。
     * @param {InputEvent} event input 事件。
     */
    site.handlePromoInput = function (event) {
        const field = event.target.getAttribute('data-field');
        if (!field) return;
        const container = event.target.closest('[data-index]');
        if (!container) return;
        const idx = Number(container.dataset.index);
        if (!Number.isFinite(idx)) return;
        site.ensureData();
        const items = state.siteConfig.data.promotions || (state.siteConfig.data.promotions = []);
        if (!items[idx]) items[idx] = { text: '', link: '' };
        items[idx][field] = event.target.value;
        site.setDirty('promotions', true);
    };

    /**
     * 處理促銷卡片的排序、移除操作。
     * @param {MouseEvent} event 點擊事件。
     */
    site.handlePromoActionClick = function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const container = button.closest('[data-index]');
        if (!container) return;
        const idx = Number(container.dataset.index);
        if (!Number.isFinite(idx)) return;
        site.ensureData();
        const items = state.siteConfig.data.promotions || (state.siteConfig.data.promotions = []);
        let changed = false;
        if (button.dataset.action === 'promo-remove') {
            items.splice(idx, 1);
            changed = true;
        } else if (button.dataset.action === 'promo-up' && idx > 0) {
            [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
            changed = true;
        } else if (button.dataset.action === 'promo-down' && idx < items.length - 1) {
            [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
            changed = true;
        }
        if (changed) {
            event.preventDefault();
            site.renderPromotions(items);
            site.setDirty('promotions', true);
        }
    };

    /**
     * 將客服資訊資料渲染回輸入欄位。
     * @param {Object} [support] 客服設定資料。
     */
    site.renderSupport = function (support) {
        const defaults = site.getDefault().support || {};
        const data = Object.assign({}, defaults, support || {});
        const emailInput = document.getElementById('site-support-email');
        if (emailInput) emailInput.value = data.email || '';
        const phoneInput = document.getElementById('site-support-phone');
        if (phoneInput) phoneInput.value = data.phone || '';
        const hoursInput = document.getElementById('site-support-hours');
        if (hoursInput) hoursInput.value = data.hours || '';
        const liveChatInput = document.getElementById('site-support-livechat');
        if (liveChatInput) liveChatInput.value = data.liveChatUrl || '';
        const liveChatLabelInput = document.getElementById('site-support-livechat-label');
        if (liveChatLabelInput) liveChatLabelInput.value = data.liveChatLabel || '';
    };

    /**
     * 渲染精選商品清單與選擇器，支援排序與刪除。
     */
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

    /**
     * 處理精選商品新增、排序與移除的互動邏輯。
     * @param {MouseEvent} event 點擊事件。
     */
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

    /**
     * 組裝要送往後端的儲存 payload，並完成字串 trim 以及去重。
     * @returns {Object}
     */
    site.buildPayload = function () {
        site.ensureData();
        const hero = Object.assign({}, config.DEFAULT_SITE_CONFIG.hero, state.siteConfig.data.hero || {});
        Object.keys(hero).forEach((key) => { hero[key] = String(hero[key] ?? '').trim(); });
        const benefits = (state.siteConfig.data.benefits || []).map((item) => ({
            icon: String(item?.icon ?? '').trim(),
            title: String(item?.title ?? '').trim(),
            desc: String(item?.desc ?? '').trim()
        })).filter((item) => item.icon || item.title || item.desc);
        const promotions = (state.siteConfig.data.promotions || [])
            .map((item) => {
                const text = String(item?.text ?? '').trim();
                if (!text) return null;
                const link = String(item?.link ?? item?.href ?? '').trim();
                return link ? { text, link } : { text };
            })
            .filter(Boolean);
        const featured = Array.from(new Set((state.siteConfig.data.featuredProductIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))));
        const footerDefaults = site.getDefault().footer;
        const footerText = String(state.siteConfig.data.footer?.text ?? '').trim();
        const footer = {
            text: footerText || footerDefaults.text || ''
        };
        const supportDefaults = site.getDefault().support || {};
        const supportData = Object.assign({}, supportDefaults, state.siteConfig.data.support || {});
        Object.keys(supportData).forEach((key) => {
            supportData[key] = String(supportData[key] ?? '').trim();
        });
        return { hero, benefits, promotions, support: supportData, featuredProductIds: featured, footer };
    };

    /**
     * 儲存指定區塊或整體站台設定，成功後清除 dirty 狀態。
     * @param {string|'all'} section 目標區塊；使用 'all' 代表全區塊。
     */
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
            ['hero', 'benefits', 'promotions', 'support', 'featured', 'footer'].forEach((part) => site.setDirty(part, false));
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
