//
//  商品管理模組：負責渲染列表、搜尋、建立 / 編輯 / 刪除與圖片預覽流程。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state, images } = Admin;
    const products = Admin.products || {};

    //
    //  將商品陣列渲染為表格：
    //    - 提供錯誤提示或空列表訊息。
    //    - 預設使用 state.allProducts。
    //    - 每列附上編輯、刪除、查看圖片按鈕。
    //
    /**
     * 將商品陣列渲染為表格，並處理錯誤或空資料顯示。
     * @param {Array} [list] 指定要渲染的商品清單；預設取 state.allProducts。
     * @param {{error?: Error}} [options] 可傳入錯誤物件顯示提示。
     */
    products.renderProducts = function (list, options = {}) {
        const container = document.getElementById('product-list');
        if (!container) return;
        container.innerHTML = '';
        if (options.error) {
            container.innerHTML = `<div class="alert alert-danger">商品資料載入失敗：${options.error.message || options.error}</div>`;
            return;
        }
        const productsData = Array.isArray(list) ? list : state.allProducts;
        if (!productsData || productsData.length === 0) {
            container.innerHTML = '<div class="alert alert-info">目前沒有商品。</div>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        table.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th>圖片</th>
                    <th>名稱</th>
                    <th>分類</th>
                    <th>價格</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        productsData.forEach((p) => {
            const mainImage = (p.imageUrls && p.imageUrls.length > 0)
                ? images.normalizeImageUrl(p.imageUrls[0])
                : config.IMAGE_PLACEHOLDER_DATAURI;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><img src="${mainImage}" class="table-product-img"></td>
                <td>${p.name}</td>
                <td>${p.categoryName || 'N/A'}</td>
                <td>$${p.price}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditProductModal(${p.id})">編輯</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">刪除</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewProductImages(${p.id})">查看圖片</button>
                </td>`;
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    };

    /**
     * 依關鍵字在前端過濾商品列表，僅比對名稱欄位。
     * @param {string} query 搜尋字串。
     */
    products.filterProducts = function (query) {
        const q = String(query || '').trim().toLowerCase();
        const filtered = state.allProducts.filter((p) => p.name && p.name.toLowerCase().includes(q));
        products.renderProducts(filtered);
    };

    products.debouncedFilter = Admin.utils && typeof Admin.utils.debounce === 'function'
        ? Admin.utils.debounce(products.filterProducts, 150)
        : products.filterProducts;

    /**
     * 新增商品：收集表單資料與圖片上傳結果後送出 API。
     * @param {SubmitEvent} event 表單提交事件。
     */
    products.createProduct = async function (event) {
        event.preventDefault();
        const form = event.target;
        try {
            const imageUrls = await images.collectImageUrls(state.newProductImages);
            const payload = {
                name: form.elements['p-name'].value,
                price: Number(form.elements['p-price'].value),
                categoryId: Number(form.elements['p-category'].value),
                imageUrls,
                introduction: form.elements['p-introduction'] ? form.elements['p-introduction'].value : '',
                origin: form.elements['p-origin'] ? form.elements['p-origin'].value : '',
                productionDate: form.elements['p-production-date'] ? form.elements['p-production-date'].value : '',
                expiryDate: form.elements['p-expiry-date'] ? form.elements['p-expiry-date'].value : ''
            };
            await fetch(config.endpoints.product, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            form.reset();
            state.newProductImages = [];
            images.renderPreviewsFromArray([], 'p-image-preview-container', false);
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('商品建立成功');
            }
            if (Admin.data && typeof Admin.data.loadProducts === 'function') {
                Admin.data.loadProducts({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '新增商品失敗');
            } else {
                alert('新增商品失敗: ' + err.message);
            }
        }
    };

    /**
     * 開啟商品編輯視窗並帶入原始資料。
     * @param {number} id 商品編號。
     */
    products.openEditProductModal = function (id) {
        const product = state.allProducts.find((p) => p.id === id);
        if (!product) return;
        const form = document.getElementById('edit-product-form');
        if (!form) return;
        form.elements['edit-p-id'].value = product.id;
        form.elements['edit-p-name'].value = product.name;
        form.elements['edit-p-price'].value = product.price;
        form.elements['edit-p-category'].value = product.categoryId;
        if (form.elements['edit-p-introduction']) form.elements['edit-p-introduction'].value = product.introduction || product.remark || '';
        if (form.elements['edit-p-origin']) form.elements['edit-p-origin'].value = product.origin || '';
        if (form.elements['edit-p-production-date']) form.elements['edit-p-production-date'].value = product.productionDate || '';
        if (form.elements['edit-p-expiry-date']) form.elements['edit-p-expiry-date'].value = product.expiryDate || '';
        state.editProductImages = product.imageUrls ? product.imageUrls.slice() : [];
        images.renderPreviewsFromArray(state.editProductImages, 'edit-p-image-preview-container', true);
        if (state.modals.editProduct) state.modals.editProduct.show();
    };

    /**
     * 提交編輯後的商品資料並刷新列表。
     */
    products.handleUpdateProduct = async function () {
        const form = document.getElementById('edit-product-form');
        if (!form) return;
        const id = form.elements['edit-p-id'].value;
        try {
            const imageUrls = await images.collectImageUrls(state.editProductImages);
            const payload = {
                id: Number(id),
                name: form.elements['edit-p-name'].value,
                price: Number(form.elements['edit-p-price'].value),
                categoryId: Number(form.elements['edit-p-category'].value),
                imageUrls,
                introduction: form.elements['edit-p-introduction'] ? form.elements['edit-p-introduction'].value : '',
                origin: form.elements['edit-p-origin'] ? form.elements['edit-p-origin'].value : '',
                productionDate: form.elements['edit-p-production-date'] ? form.elements['edit-p-production-date'].value : '',
                expiryDate: form.elements['edit-p-expiry-date'] ? form.elements['edit-p-expiry-date'].value : ''
            };
            await fetch(`${config.endpoints.product}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (state.modals.editProduct) state.modals.editProduct.hide();
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('商品已更新');
            }
            if (Admin.data && typeof Admin.data.loadProducts === 'function') {
                Admin.data.loadProducts({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '更新商品失敗');
            } else {
                alert('更新商品失敗: ' + err.message);
            }
        }
    };

    /**
     * 刪除指定商品，完成後重新整理資料。
     * @param {number} id 商品編號。
     */
    products.deleteProduct = async function (id) {
        if (!confirm(`確定要刪除商品 #${id} 嗎?`)) return;
        try {
            await fetch(`${config.endpoints.product}/${id}`, { method: 'DELETE' });
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('商品已刪除');
            }
            if (Admin.data && typeof Admin.data.loadProducts === 'function') {
                Admin.data.loadProducts({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '刪除商品失敗');
            } else {
                alert('刪除商品失敗: ' + err.message);
            }
        }
    };

    Admin.products = products;

    if (Admin.core && typeof Admin.core.on === 'function') {
        if (!products._eventsBound) {
            products._eventsBound = true;
            Admin.core.on('products:updated', (event) => {
                const detail = event?.detail || {};
                products.renderProducts(detail.data, { error: detail.error });
            });
        }
    }
})(window);
