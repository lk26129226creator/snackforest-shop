(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state } = Admin;
    const images = Admin.images || {};

    images.uploadImage = async function (file) {
        const apiUrl = config.endpoints.imageUpload;
        const fileName = file?.name || (`upload-${Date.now()}`);
        const contentType = file?.type || 'application/octet-stream';
        try {
            const headers = {
                'Content-Type': contentType,
                'Slug': encodeURIComponent(fileName)
            };
            const fetchOptions = {
                method: 'POST',
                headers,
                body: file
            };

            const res = await fetch(apiUrl, fetchOptions);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                const err = new Error(`HTTP ${res.status} ${res.statusText} – ${text}`);
                throw err;
            }
            const data = await res.json();
            if (!data || !data.imageUrl) {
                const err = new Error('上傳成功但未取得 imageUrl');
                throw err;
            }
            return data.imageUrl;
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '圖片上傳失敗');
            } else {
                alert('圖片上傳失敗: ' + (err?.message || err));
            }
            return null;
        }
    };

    images.normalizeImageUrl = function (value) {
        if (!value) return config.IMAGE_PLACEHOLDER_DATAURI;
        let source = String(value).trim().replace(/["']/g, '');
        if (source.startsWith('http') || source.startsWith('data:')) return source;
        if (!source.startsWith('/') && source.toLowerCase().startsWith('frontend/')) {
            source = `/${source.replace(/^\/+/, '')}`;
        }
        const backendOrigin = new URL(config.API_BASE_URL).origin;
        return source.startsWith('/') ? `${backendOrigin}${source}` : `${backendOrigin}/frontend/images/products/${source}`;
    };

    images.renderPreviewsFromArray = function (list, previewContainer, isEditForm) {
        const container = typeof previewContainer === 'string' ? document.getElementById(previewContainer) : previewContainer;
        if (!container) return;
        container.innerHTML = '';
        list.forEach((item, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-preview-item position-relative';
            const img = document.createElement('img');
            img.src = typeof item === 'string' ? images.normalizeImageUrl(item) : URL.createObjectURL(item);
            img.onerror = () => { img.src = config.IMAGE_PLACEHOLDER_DATAURI; };
            img.className = 'img-thumbnail clickable';
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                const src = img.src;
                if (Admin.viewer && typeof Admin.viewer.viewImage === 'function') {
                    Admin.viewer.viewImage(src);
                }
            });
            wrapper.appendChild(img);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm position-absolute top-0 end-0 m-1';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', () => {
                images.deleteImageFromPreview(idx, !!isEditForm, container);
            });
            wrapper.appendChild(deleteBtn);

            container.appendChild(wrapper);
        });
    };

    images.deleteImageFromPreview = async function (index, isEditForm, previewContainer) {
        const imageArray = isEditForm ? state.editProductImages : state.newProductImages;
        const target = imageArray[index];
        if (typeof target === 'string') {
            if (!confirm('確定要刪除這張圖片嗎？')) return;
            try {
                const res = await fetch(config.endpoints.imageDelete, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: target })
                });
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Server error ${res.status}: ${errorText}`);
                }
                await res.json();
            } catch (err) {
                if (Admin.core && typeof Admin.core.handleError === 'function') {
                    Admin.core.handleError(err, '圖片刪除失敗');
                } else {
                    console.error('圖片刪除失敗:', err);
                    alert('圖片刪除失敗: ' + err.message);
                }
                return;
            }
        } else if (target instanceof File) {
            if (!confirm('確定要移除這張新圖片嗎？')) return;
        }

        imageArray.splice(index, 1);
        images.renderPreviewsFromArray(imageArray, previewContainer, isEditForm);
    };

    images.collectImageUrls = async function (imageArray) {
        const urls = [];
        for (const item of imageArray) {
            if (typeof item === 'string') {
                urls.push(item);
            } else if (item instanceof File) {
                const uploaded = await images.uploadImage(item);
                if (uploaded) {
                    urls.push(uploaded);
                } else {
                    throw new Error('部分圖片上傳失敗');
                }
            }
        }
        return urls;
    };

    images.handleImageUploadChange = function (event, isEditForm) {
        const files = Array.from(event.target.files || []);
        const targetList = isEditForm ? state.editProductImages : state.newProductImages;
        const containerId = isEditForm ? 'edit-p-image-preview-container' : 'p-image-preview-container';
        if (targetList.length + files.length > config.MAX_IMAGES) {
            if (Admin.core && typeof Admin.core.notifyWarning === 'function') {
                Admin.core.notifyWarning(`最多只能上傳 ${config.MAX_IMAGES} 張圖片。`);
            } else {
                alert(`最多只能上傳 ${config.MAX_IMAGES} 張圖片。`);
            }
            event.target.value = '';
            return;
        }
        files.forEach((file) => targetList.push(file));
        images.renderPreviewsFromArray(targetList, containerId, isEditForm);
        event.target.value = '';
    };

    Admin.images = images;
})(window);
