(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state, images } = Admin;
    const viewer = Admin.viewer || {};

    function cleanupModalState() {
        state.imageViewer.blobUrls.forEach((url) => URL.revokeObjectURL(url));
        state.imageViewer.blobUrls = [];
        state.imageViewer.images = [];
        state.imageViewer.rendered = [];
        state.imageViewer.current = 0;
        state.imageViewer.thumbWindowStart = 0;
        const main = document.getElementById('iv-main-img');
        if (main) main.src = '';
        const thumbs = document.getElementById('iv-thumbs');
        if (thumbs) thumbs.innerHTML = '';
    }

    function highlightThumb(idx) {
        document.querySelectorAll('.iv-thumb').forEach((node, i) => {
            node.classList.toggle('active', i === idx);
        });
    }

    function refreshThumbWindow() {
        const total = state.imageViewer.images.length;
        if (total === 0) return;
        state.imageViewer.thumbWindowStart = Math.max(0, Math.min(state.imageViewer.thumbWindowStart, Math.max(0, total - config.VISIBLE_THUMBS)));
        const thumbs = document.querySelectorAll('#iv-thumbs .iv-thumb');
        thumbs.forEach((node, index) => {
            node.classList.remove('visible', 'active');
            if (index >= state.imageViewer.thumbWindowStart && index < state.imageViewer.thumbWindowStart + config.VISIBLE_THUMBS) {
                node.classList.add('visible');
            }
            if (index === state.imageViewer.current) {
                node.classList.add('active');
            }
        });
    }

    function ensureThumbVisibility(idx) {
        const container = document.querySelector('.iv-thumbs');
        const target = document.querySelectorAll('.iv-thumb')[idx];
        if (container && target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    function updateMainImage() {
        const main = document.getElementById('iv-main-img');
        const current = state.imageViewer.images[state.imageViewer.current];
        if (!main || !current) {
            if (main) main.src = config.IMAGE_PLACEHOLDER_DATAURI;
            return;
        }
        const rendered = state.imageViewer.rendered[state.imageViewer.current];
        if (rendered) {
            main.src = rendered;
            return;
        }
        if (current instanceof File) {
            const blob = URL.createObjectURL(current);
            state.imageViewer.blobUrls.push(blob);
            state.imageViewer.rendered[state.imageViewer.current] = blob;
            main.src = blob;
        } else {
            const normalized = images.normalizeImageUrl(current);
            state.imageViewer.rendered[state.imageViewer.current] = normalized;
            main.src = normalized;
        }
    }

    function updateThumbNav() {
        const prevBtn = document.getElementById('iv-thumb-prev');
        const nextBtn = document.getElementById('iv-thumb-next');
        const count = state.imageViewer.images.length;
        if (prevBtn) prevBtn.classList.toggle('disabled', count <= 1);
        if (nextBtn) nextBtn.classList.toggle('disabled', count <= 1);
    }

    function populateModal() {
        const main = document.getElementById('iv-main-img');
        const thumbs = document.getElementById('iv-thumbs');
        if (!main || !thumbs) return;
        thumbs.innerHTML = '';
        const imagesList = state.imageViewer.images;
        const viewerEl = document.querySelector('#imageViewModal .image-viewer');
        if (viewerEl) viewerEl.classList.remove('show-thumbs');
        if (!imagesList || imagesList.length === 0) {
            main.src = config.IMAGE_PLACEHOLDER_DATAURI;
            return;
        }
        imagesList.forEach((item, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'iv-thumb';
            const img = document.createElement('img');
            let src;
            if (item instanceof File) {
                src = URL.createObjectURL(item);
                state.imageViewer.blobUrls.push(src);
                state.imageViewer.rendered[idx] = src;
            } else {
                src = images.normalizeImageUrl(item);
                state.imageViewer.rendered[idx] = src;
            }
            img.src = src;
            img.alt = `圖片 ${idx + 1}`;
            wrapper.appendChild(img);
            wrapper.addEventListener('click', () => {
                state.imageViewer.current = idx;
                updateMainImage();
                highlightThumb(idx);
                ensureThumbVisibility(idx);
            });
            thumbs.appendChild(wrapper);
        });
        updateMainImage();
        highlightThumb(state.imageViewer.current);
        ensureThumbVisibility(state.imageViewer.current);
        refreshThumbWindow();
        setTimeout(updateThumbNav, 80);
    }

    viewer.ivPrev = function () {
        if (!state.imageViewer.images.length) return;
        state.imageViewer.current = (state.imageViewer.current - 1 + state.imageViewer.images.length) % state.imageViewer.images.length;
        updateMainImage();
        highlightThumb(state.imageViewer.current);
        if (state.imageViewer.current < state.imageViewer.thumbWindowStart) {
            state.imageViewer.thumbWindowStart = Math.max(0, state.imageViewer.current);
        }
        refreshThumbWindow();
        ensureThumbVisibility(state.imageViewer.current);
    };

    viewer.ivNext = function () {
        if (!state.imageViewer.images.length) return;
        state.imageViewer.current = (state.imageViewer.current + 1) % state.imageViewer.images.length;
        updateMainImage();
        highlightThumb(state.imageViewer.current);
        if (state.imageViewer.current >= state.imageViewer.thumbWindowStart + config.VISIBLE_THUMBS) {
            state.imageViewer.thumbWindowStart = state.imageViewer.current - config.VISIBLE_THUMBS + 1;
        }
        refreshThumbWindow();
        ensureThumbVisibility(state.imageViewer.current);
    };

    viewer.viewProductImages = function (productId) {
        const product = state.allProducts.find((p) => p.id === productId);
        if (!product) return alert('找不到商品');
        const imagesList = Array.isArray(product.imageUrls) ? product.imageUrls : [];
        state.imageViewer.images = imagesList.slice();
        state.imageViewer.rendered = [];
        state.imageViewer.current = 0;
        state.imageViewer.blobUrls.forEach((url) => URL.revokeObjectURL(url));
        state.imageViewer.blobUrls = [];
        populateModal();
        if (state.modals.imageView) state.modals.imageView.show();
    };

    viewer.viewImage = function (url) {
        state.imageViewer.images = [url];
        state.imageViewer.rendered = [url];
        state.imageViewer.current = 0;
        populateModal();
        if (state.modals.imageView) state.modals.imageView.show();
    };

    viewer.updateThumbNav = updateThumbNav;
    viewer.ensureThumbVisibility = ensureThumbVisibility;

    viewer.init = function () {
        const modalEl = document.getElementById('imageViewModal');
        if (modalEl && window.bootstrap) {
            state.modals.imageView = new bootstrap.Modal(modalEl);
            modalEl.addEventListener('hidden.bs.modal', cleanupModalState);
            modalEl.addEventListener('shown.bs.modal', () => {
                setTimeout(updateThumbNav, 80);
            });
        }

        if (!viewer._keydownBound) {
            viewer._keydownBound = true;
            document.addEventListener('keydown', (event) => {
                if (!state.modals.imageView) return;
                const element = state.modals.imageView._element;
                if (!element) return;
                if (!element.classList.contains('show')) return;
                if (event.key === 'ArrowLeft') viewer.ivPrev();
                if (event.key === 'ArrowRight') viewer.ivNext();
            });
        }

        const thumbPrev = document.getElementById('iv-thumb-prev');
        if (thumbPrev && !thumbPrev.dataset.bound) {
            thumbPrev.dataset.bound = '1';
            thumbPrev.addEventListener('click', () => {
                viewer.ivPrev();
                ensureThumbVisibility(state.imageViewer.current);
            });
        }

        const thumbNext = document.getElementById('iv-thumb-next');
        if (thumbNext && !thumbNext.dataset.bound) {
            thumbNext.dataset.bound = '1';
            thumbNext.addEventListener('click', () => {
                viewer.ivNext();
                ensureThumbVisibility(state.imageViewer.current);
            });
        }

        if (!viewer._resizeBound) {
            viewer._resizeBound = true;
            window.addEventListener('resize', updateThumbNav);
        }
    };

    Admin.viewer = viewer;
})(window);
