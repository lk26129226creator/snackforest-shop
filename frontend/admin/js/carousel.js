//
//  輪播管理模組：提供載入、儲存、編輯器渲染與本機暫存流程。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state, images } = Admin;
    const { escapeAttr, deepClone } = Admin.utils;
    const carousel = Admin.carousel || {};

    // 透過 deepClone 避免直接操作 state.carousel.slides。
    function cloneSlides(slides) {
        return deepClone(Array.isArray(slides) ? slides : [], []);
    }

    // 將輪播資料正規化，必要時過濾沒有圖片的項目。
    function sanitizeSlides(slides, options) {
        const dropEmptyImage = options && options.dropEmptyImage === true;
        const source = Array.isArray(slides) ? slides : [];
        const cleaned = [];
        source.forEach((slide) => {
            const normalized = {
                imageUrl: String(slide?.imageUrl ?? '').trim(),
                title: String(slide?.title ?? '').trim(),
                text: String(slide?.text ?? '').trim(),
                link: String(slide?.link ?? '').trim()
            };
            if (dropEmptyImage && !normalized.imageUrl) return;
            cleaned.push(normalized);
        });
        return cleaned;
    }

    // 將編輯內容暫存到 localStorage，避免網路不穩導致資料流失。
    function persistLocal(slides) {
        try {
            const payload = sanitizeSlides(slides, { dropEmptyImage: false });
            localStorage.setItem(config.CAROUSEL_KEY, JSON.stringify(payload));
        } catch (_) {
            // ignore storage errors
        }
    }

    /**
     * 取得輪播資料的深拷貝，避免直接修改 state。
     * @returns {Array}
     */
    carousel.getSlidesClone = function () {
        return cloneSlides(state.carousel.slides);
    };

    /**
     * 標記輪播編輯器是否有未儲存變更。
     * @param {boolean} dirty 是否有變更。
     */
    carousel.setDirty = function (dirty) {
        state.carousel.dirty = !!dirty;
        carousel.updateSaveButtonState();
    };

    /**
     * 控制輪播操作是否忙碌，用於阻擋重複操作。
     * @param {boolean} busy 是否忙碌。
     */
    carousel.setBusy = function (busy) {
        state.carousel.busy = !!busy;
        const addBtn = document.getElementById('carousel-add-btn');
        if (addBtn) addBtn.disabled = !!busy;
        carousel.updateSaveButtonState();
    };

    /**
     * 更新儲存按鈕的文字與狀態，顯示儲存中或未存變更。
     */
    carousel.updateSaveButtonState = function () {
        const saveBtn = document.getElementById('carousel-save-btn');
        if (!saveBtn) return;
        if (!saveBtn.dataset.baseText) {
            saveBtn.dataset.baseText = saveBtn.textContent || '儲存變更';
        }
        if (state.carousel.busy) {
            saveBtn.textContent = '儲存中...';
            saveBtn.disabled = true;
            return;
        }
        const base = saveBtn.dataset.baseText;
        saveBtn.textContent = state.carousel.dirty ? `${base}*` : base;
        saveBtn.disabled = false;
    };

    /**
     * 載入輪播資料，失敗時改讀本機暫存。
     * @param {{force?: boolean}} [options]
     * @returns {Promise<Array>}
     */
    carousel.loadSlides = async function (options) {
        const force = !!(options && options.force);
        if (!force && state.carousel.slides.length && !state.carousel.loading) {
            return carousel.getSlidesClone();
        }
        state.carousel.loading = true;
        let slides = [];
        try {
            const res = await fetch(config.endpoints.carousel, { cache: 'no-store' });
            if (res.ok) {
                slides = await res.json();
            } else if (res.status === 404) {
                slides = [];
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            console.error('Load carousel error:', err);
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '載入輪播資料失敗，已載入暫存內容');
            }
            slides = Admin.utils.tryParseJson(localStorage.getItem(config.CAROUSEL_KEY) || '[]', []);
        } finally {
            state.carousel.loading = false;
        }
        const normalized = sanitizeSlides(slides, { dropEmptyImage: false });
        state.carousel.slides = cloneSlides(normalized);
        carousel.setDirty(false);
        persistLocal(normalized);
        const cloned = carousel.getSlidesClone();
        if (Admin.core && typeof Admin.core.emit === 'function') {
            Admin.core.emit('carousel:loaded', { slides: cloned });
        }
        return cloned;
    };

    //
    //  儲存輪播設定：
    //    - 先 sanitize 移除空圖片。
    //    - 成功時同步事件與本機暫存。
    //    - 失敗時保留原資料並提示使用者。
    //
    /**
     * 儲存輪播設定，成功後同步事件並更新本機暫存。
     * @param {Array} slides 目前編輯器的資料。
     * @returns {Promise<boolean>} 是否儲存成功。
     */
    carousel.saveSlides = async function (slides) {
        const sanitized = sanitizeSlides(slides, { dropEmptyImage: true });
        const original = cloneSlides(slides);
        let success = false;
        carousel.setBusy(true);
        try {
            const res = await fetch(config.endpoints.carousel, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitized)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            persistLocal(sanitized);
            state.carousel.slides = cloneSlides(sanitized);
            success = true;
            if (Admin.core && typeof Admin.core.emit === 'function') {
                Admin.core.emit('carousel:updated', { slides: cloneSlides(sanitized) });
            }
        } catch (err) {
            console.error('Save carousel error:', err);
            persistLocal(sanitized);
            state.carousel.slides = original;
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '儲存輪播設定失敗');
                Admin.core.notifyInfo('已暫存於本機瀏覽器，待後端恢復後再點儲存即可同步。');
            } else {
                alert('後端暫時無法儲存（' + (err.message || '未知錯誤') + '），已暫存於本機瀏覽器。待後端恢復後再點儲存即可同步。');
            }
        } finally {
            carousel.setDirty(!success);
            carousel.setBusy(false);
            carousel.renderEditor();
        }
        return success;
    };

    /**
     * 渲染輪播編輯器 UI 並綁定互動事件。
     * @param {Array} [slides] 指定要顯示的資料。
     */
    carousel.renderEditor = function (slides) {
        const list = document.getElementById('carousel-editor-list');
        if (!list) return;
        const data = Array.isArray(slides) ? cloneSlides(slides) : carousel.getSlidesClone();
        list.innerHTML = '';
        if (data.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'alert alert-secondary';
            empty.textContent = '目前沒有輪播圖片，請點「新增一張」。';
            list.appendChild(empty);
        } else {
            data.forEach((slide, idx) => {
                const item = document.createElement('div');
                item.className = 'list-group-item carousel-editor-item';
                item.dataset.index = String(idx);
                const previewSrc = images.normalizeImageUrl(slide.imageUrl || '');
                item.innerHTML = `
                    <div class="row g-3 align-items-center">
                        <div class="col-md-3 text-center">
                            <img src="${escapeAttr(previewSrc)}" alt="預覽" class="img-fluid rounded border" data-role="carousel-preview" onerror="this.onerror=null;this.src='/frontend/images/products/no-image.svg'">
                            <div class="text-muted small mt-2">第 ${idx + 1} 張</div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-2">
                                <label class="form-label mb-1">圖片 URL</label>
                                <input type="text" class="form-control" data-field="imageUrl" data-index="${idx}" value="${escapeAttr(slide.imageUrl || '')}" placeholder="https://... 或 /frontend/images/...">
                            </div>
                            <div class="mb-2">
                                <button type="button" class="btn btn-sm btn-secondary" data-action="upload" data-index="${idx}">上傳圖片</button>
                                <input type="file" accept="image/*" class="d-none" data-file-index="${idx}">
                                <small class="text-muted ms-2">可直接上傳本機圖片，系統會自動取得 URL</small>
                            </div>
                            <div class="mb-2">
                                <label class="form-label mb-1">標題（可選）</label>
                                <input type="text" class="form-control" data-field="title" data-index="${idx}" value="${escapeAttr(slide.title || '')}" placeholder="主標題">
                            </div>
                            <div class="mb-2">
                                <label class="form-label mb-1">說明（可選）</label>
                                <input type="text" class="form-control" data-field="text" data-index="${idx}" value="${escapeAttr(slide.text || '')}" placeholder="副標／說明文字">
                            </div>
                            <div>
                                <label class="form-label mb-1">連結（可選）</label>
                                <input type="text" class="form-control" data-field="link" data-index="${idx}" value="${escapeAttr(slide.link || '')}" placeholder="例如：product.html?id=1">
                            </div>
                        </div>
                        <div class="col-md-3 text-end d-flex flex-column gap-2 align-items-end">
                            <div class="btn-group" role="group" aria-label="操作">
                                <button type="button" class="btn btn-outline-secondary" data-action="up" data-index="${idx}">上移</button>
                                <button type="button" class="btn btn-outline-secondary" data-action="down" data-index="${idx}">下移</button>
                                <button type="button" class="btn btn-outline-danger" data-action="remove" data-index="${idx}">刪除</button>
                            </div>
                        </div>
                    </div>`;
                list.appendChild(item);
            });
        }
        if (!list.dataset.bound) {
            list.dataset.bound = '1';
            list.addEventListener('click', carousel.handleListClick);
            list.addEventListener('change', carousel.handleFileChange);
            list.addEventListener('input', carousel.handleInputChange);
        }
        carousel.updateSaveButtonState();
    };

    /**
     * 偵測輸入框變更後更新 state，若變更圖片欄位則同步預覽。
     * @param {Event} event input 事件。
     */
    carousel.handleInputChange = function (event) {
        const target = event.target;
        if (!target || !target.dataset) return;
        const field = target.getAttribute('data-field');
        if (!field) return;
        const idx = Number(target.getAttribute('data-index'));
        if (!Number.isFinite(idx)) return;
        if (!state.carousel.slides[idx]) {
            state.carousel.slides[idx] = { imageUrl: '', title: '', text: '', link: '' };
        }
        state.carousel.slides[idx][field] = target.value;
        carousel.setDirty(true);
        if (field === 'imageUrl') {
            const preview = target.closest('.list-group-item')?.querySelector('img[data-role="carousel-preview"]');
            if (preview) preview.src = images.normalizeImageUrl(target.value);
        }
    };

    /**
     * 處理輪播編輯器內的按鈕事件（上移、下移、刪除、上傳）。
     * @param {MouseEvent} event 點擊事件。
     */
    carousel.handleListClick = function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.getAttribute('data-action');
        const idx = Number(button.getAttribute('data-index'));
        if (!Number.isFinite(idx)) return;
        if (action === 'upload') {
            const list = document.getElementById('carousel-editor-list');
            const input = list?.querySelector(`input[type="file"][data-file-index="${idx}"]`);
            if (input) input.click();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const slides = carousel.getSlidesClone();
        if (action === 'remove') {
            slides.splice(idx, 1);
        } else if (action === 'up' && idx > 0) {
            [slides[idx - 1], slides[idx]] = [slides[idx], slides[idx - 1]];
        } else if (action === 'down' && idx < slides.length - 1) {
            [slides[idx], slides[idx + 1]] = [slides[idx + 1], slides[idx]];
        } else {
            return;
        }
        state.carousel.slides = slides;
        carousel.setDirty(true);
        carousel.renderEditor(slides);
    };

    /**
     * 監聽隱藏的 file input，上傳完成後更新對應 slide。
     * @param {Event} event change 事件。
     */
    carousel.handleFileChange = async function (event) {
        const input = event.target;
        if (!input || input.type !== 'file') return;
        const idx = Number(input.getAttribute('data-file-index'));
        if (!Number.isFinite(idx)) return;
        const file = input.files && input.files[0];
        if (!file) return;
        const button = document.querySelector(`button[data-action="upload"][data-index="${idx}"]`);
        try {
            if (button) {
                button.disabled = true;
                button.textContent = '上傳中...';
            }
            const url = await images.uploadImage(file);
            if (!url) throw new Error('未取得圖片網址');
            const slides = carousel.getSlidesClone();
            if (!slides[idx]) slides[idx] = { imageUrl: '', title: '', text: '', link: '' };
            slides[idx].imageUrl = url;
            state.carousel.slides = slides;
            carousel.setDirty(true);
            carousel.renderEditor(slides);
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '輪播圖片上傳失敗');
            } else {
                alert('上傳失敗：' + (err.message || err));
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = '上傳圖片';
            }
            try { input.value = ''; } catch (_) {}
        }
    };

    /**
     * 在編輯器尾端新增一筆空白輪播項目。
     */
    carousel.addSlide = function () {
        const slides = carousel.getSlidesClone();
        slides.push({ imageUrl: '', title: '', text: '', link: '' });
        state.carousel.slides = slides;
        carousel.setDirty(true);
        carousel.renderEditor(slides);
    };

    /**
     * 回傳編輯器內容，可選擇是否保留缺少圖片的項目。
     * @param {{includeEmpty?: boolean}} [options]
     * @returns {Array}
     */
    carousel.collectEditorData = function (options) {
        const includeEmpty = options && options.includeEmpty === true;
        return sanitizeSlides(state.carousel.slides, { dropEmptyImage: !includeEmpty });
    };

    /**
     * 綁定輪播新增與儲存按鈕，並負責顯示結果通知。
     */
    carousel.bindEditorButtons = function () {
        const addBtn = document.getElementById('carousel-add-btn');
        const saveBtn = document.getElementById('carousel-save-btn');
        if (addBtn && !addBtn.dataset.bound) {
            addBtn.dataset.bound = '1';
            addBtn.addEventListener('click', (event) => {
                event.preventDefault();
                carousel.addSlide();
            });
        }
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = '1';
            saveBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                const currentSlides = carousel.getSlidesClone();
                const sanitized = sanitizeSlides(currentSlides, { dropEmptyImage: true });
                const dropped = currentSlides.length - sanitized.length;
                const ok = await carousel.saveSlides(currentSlides);
                if (ok) {
                    const notify = Admin.core && typeof Admin.core.notifySuccess === 'function'
                        ? Admin.core.notifySuccess
                        : (msg) => alert(msg);
                    if (sanitized.length === 0) {
                        notify('已儲存輪播設定，輪播列表已清空。');
                    } else if (dropped > 0) {
                        notify(`已儲存輪播設定，共 ${sanitized.length} 張（${dropped} 張未設定圖片已略過）。`);
                    } else {
                        notify('已儲存輪播設定，共 ' + sanitized.length + ' 張');
                    }
                }
            });
        }
    };

    Admin.carousel = carousel;
})(window);
