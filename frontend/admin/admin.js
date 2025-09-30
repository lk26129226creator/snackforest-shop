/*
 * SnackForest Admin Panel Logic v2
 * - Refactored rendering to use Bootstrap tables for a cleaner UI.
 */

// --- State & Configuration ---
let allProducts = [];
let allCategories = [];
let allOrders = [];
let editProductModal = null;
let editCategoryModal = null;
let imageViewModal = null;
let newProductImages = [];
let editProductImages = [];
let _iv_state = { images: [], current: 0, blobUrls: [], rendered: [], thumbWindowStart: 0 };

const API_BASE_URL = 'http://localhost:8000/api';
const productApiUrl = `${API_BASE_URL}/products`;
const categoryApiUrl = `${API_BASE_URL}/categories`;
const orderApiUrl = `${API_BASE_URL}/order`;
const imageUploadApiUrl = `${API_BASE_URL}/upload/image`;
const imageDeleteApiUrl = `${API_BASE_URL}/upload/image/delete`;
const IMAGE_PLACEHOLDER_DATAURI = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" fill="#bbb" font-size="14">無圖</text></svg>');

// --- Image Handling --- 
const MAX_IMAGES = 10;

async function uploadImage(file) {
    try {
        const res = await fetch(imageUploadApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': file.type, // e.g., 'image/jpeg'
                'Slug': encodeURIComponent(file.name) // Encode the filename
            },
            body: file, // Send the file blob directly
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server error ${res.status}: ${errorText}`);
        }
        const data = await res.json();
        return data.imageUrl; // The backend returns { "imageUrl": "..." }
    } catch (err) {
        console.error('Image upload failed:', err);
        alert('圖片上傳失敗: ' + err.message);
        return null;
    }
}

function normalizeImageUrl(u) {
    if (!u) return IMAGE_PLACEHOLDER_DATAURI;
    let s = String(u).trim().replace(/["']/g, '');
    if (s.startsWith('http') || s.startsWith('data:')) return s;
    const backendOrigin = new URL(API_BASE_URL).origin;
    return s.startsWith('/') ? `${backendOrigin}${s}` : `${backendOrigin}/frontend/images/products/${s}`;
}

function renderPreviewsFromArray(arr, previewContainer, isEditForm = false) {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    arr.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-preview-item position-relative'; // Added position-relative for button positioning
        const img = document.createElement('img');
        img.src = (typeof item === 'string') ? normalizeImageUrl(item) : URL.createObjectURL(item);
        img.onerror = () => { img.src = IMAGE_PLACEHOLDER_DATAURI; };
        img.className = 'img-thumbnail'; // Added Bootstrap class for styling
        // make preview clickable to view full image
        img.classList.add('clickable');
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            // use the already rendered src on the img element (handles placeholders, blob: and remote urls)
            const renderedSrc = img.src;
            viewImage(renderedSrc);
        });
        wrapper.appendChild(img);

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm position-absolute top-0 end-0 m-1'; // Bootstrap classes for styling
        deleteBtn.innerHTML = '&times;'; // 'x' icon
        deleteBtn.onclick = () => deleteImageFromPreview(idx, isEditForm, previewContainer);
        wrapper.appendChild(deleteBtn);

        previewContainer.appendChild(wrapper);
    });
}

async function deleteImageFromPreview(index, isEditForm, previewContainer) {
    console.log('deleteImageFromPreview called. Index:', index, 'isEditForm:', isEditForm);
    const imageArray = isEditForm ? editProductImages : newProductImages;
    console.log('Image array BEFORE splice:', imageArray);
    const imageItem = imageArray[index];

    if (typeof imageItem === 'string') { // It's an existing image URL, attempt to delete from backend
        if (!confirm('確定要刪除這張圖片嗎？')) return;
        try {
            const res = await fetch(imageDeleteApiUrl, {
                method: 'POST', // Using POST as defined in Server.java
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: imageItem })
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server error ${res.status}: ${errorText}`);
            }
            const data = await res.json();
            console.log('Image deleted from backend:', data);
        } catch (err) {
            console.error('圖片刪除失敗:', err);
            alert('圖片刪除失敗: ' + err.message);
            return; // Don't remove from frontend if backend deletion failed
        }
    } else if (imageItem instanceof File) { // It's a new file not yet uploaded
        if (!confirm('確定要移除這張新圖片嗎？')) return;
    }

    // Remove from array and re-render previews
    imageArray.splice(index, 1);
    console.log('Image array AFTER splice:', imageArray);
    renderPreviewsFromArray(imageArray, previewContainer, isEditForm);
}

async function collectImageUrls(imageArray) {
    const urls = [];
    for (const item of imageArray) {
        if (typeof item === 'string') {
            urls.push(item);
        } else if (item instanceof File) {
            const uploadedUrl = await uploadImage(item);
            if (uploadedUrl) urls.push(uploadedUrl);
            else throw new Error('部分圖片上傳失敗');
        }
    }
    return urls;
}

function handleImageUploadChange(event, isEditForm = false) {
    const files = Array.from(event.target.files);
    const imageArray = isEditForm ? editProductImages : newProductImages;
    const previewContainer = document.getElementById(isEditForm ? 'edit-p-image-preview-container' : 'p-image-preview-container');
    if (imageArray.length + files.length > MAX_IMAGES) {
        alert(`最多只能上傳 ${MAX_IMAGES} 張圖片。`);
        return;
    }
    files.forEach(file => imageArray.push(file));
    renderPreviewsFromArray(imageArray, previewContainer, isEditForm);
    event.target.value = '';
}

// --- Rendering Functions ---
function createTable(headers) {
    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
    table.innerHTML = `
        <thead class="table-light">
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody></tbody>`;
    return table;
}

function renderProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = '';
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有商品。</div>';
        return;
    }
    const table = createTable(['圖片', '名稱', '分類', '價格', '操作']);
    const tbody = table.querySelector('tbody');
    products.forEach(p => {
        const mainImage = (p.imageUrls && p.imageUrls.length > 0) ? normalizeImageUrl(p.imageUrls[0]) : IMAGE_PLACEHOLDER_DATAURI;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${mainImage}" class="table-product-img"></td>
            <td>${p.name}</td>
            <td>${p.categoryName || 'N/A'}</td>
            <td>${p.price}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="openEditProductModal(${p.id})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">刪除</button>
            </td>
        `;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);
}

function renderCategories(categories) {
    const container = document.getElementById('category-list');
    if (!container) return;
    container.innerHTML = '';
    if (!categories || categories.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有分類。</div>';
        return;
    }
    const table = createTable(['ID', '分類名稱', '操作']);
    const tbody = table.querySelector('tbody');
    categories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td>${c.name}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="openEditCategoryModal(${c.id})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">刪除</button>
            </td>
        `;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);

    // Populate dropdowns
    const catSelects = [document.getElementById('p-category'), document.getElementById('edit-p-category')];
    catSelects.forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">請選擇分類</option>';
            categories.forEach(c => select.appendChild(new Option(c.name, c.id)));
        }
    });
}

function renderOrders(orders) {
    const container = document.getElementById('order-list');
    if (!container) return;
    container.innerHTML = '';
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有訂單。</div>';
        return;
    }
    const table = createTable(['訂單ID', '顧客', '日期', '總金額', '詳情']);
    const tbody = table.querySelector('tbody');
    orders.forEach(order => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customerName || 'N/A'}</td>
            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
            <td>${order.totalAmount.toFixed(2)}</td>
            <td><button class="btn btn-sm btn-info" onclick="toggleOrderDetails(this, ${order.id})">查看</button></td>
        `;
        const detailsRow = tbody.insertRow();
        detailsRow.id = `order-details-${order.id}`;
        detailsRow.style.display = 'none';
        const detailsCell = detailsRow.insertCell();
        detailsCell.colSpan = 5;
                detailsCell.innerHTML = `
            <div class="p-3 bg-light">
                <h6>訂單 #${order.id} 詳情</h6>
                <p><strong>收件人:</strong> ${order.recipientName || ''}</p>
                <p><strong>地址:</strong> ${order.recipientAddress || ''}</p>
                <p><strong>電話:</strong> ${order.recipientPhone || ''}</p>
                <ul class="list-group">${(order.details || []).map(d => `<li class="list-group-item">${d.productName} x ${d.quantity}</li>`).join('')}</ul>
            </div>`;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);
}

function toggleOrderDetails(btn, orderId) {
    const detailsRow = document.getElementById(`order-details-${orderId}`);
    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        btn.textContent = '隱藏';
    } else {
        detailsRow.style.display = 'none';
        btn.textContent = '查看';
    }
}

// --- Data Fetching ---
async function fetchData(url) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.json();
    } catch (e) {
        console.error(`Fetch Error from ${url}:`, e);
        throw e;
    }
}

async function refreshAllData() {
    try {
        [allProducts, allCategories, allOrders] = await Promise.all([
            fetchData(productApiUrl),
            fetchData(categoryApiUrl),
            fetchData(orderApiUrl)
        ]);
        renderProducts(allProducts);
        renderCategories(allCategories);
        renderOrders(allOrders);
    } catch (err) {
        document.getElementById('product-list').innerHTML = '<div class="alert alert-danger">載入資料失敗，請檢查後端服務與資料庫連線。</div>';
    }
}

// --- CRUD Actions ---
async function createProduct(e) {
    e.preventDefault();
    const form = e.target;
    try {
        const imageUrls = await collectImageUrls(newProductImages);
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
        await fetch(productApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        form.reset();
        newProductImages = [];
        renderPreviewsFromArray([], document.getElementById('p-image-preview-container'), false);
        refreshAllData();
    } catch (err) {
        alert('新增商品失敗: ' + err.message);
    }
}

async function createCategory(e) {
    e.preventDefault();
    const form = e.target;
    const payload = { name: form.elements['c-name'].value };
    await fetch(categoryApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    form.reset();
    refreshAllData();
}

async function deleteProduct(id) {
    if (!confirm(`確定要刪除商品 #${id} 嗎?`)) return;
    await fetch(`${productApiUrl}/${id}`, { method: 'DELETE' });
    refreshAllData();
}

async function deleteCategory(id) {
    if (!confirm(`確定要刪除分類 #${id} 嗎?`)) return;
    await fetch(`${categoryApiUrl}/${id}`, { method: 'DELETE' });
    refreshAllData();
}

function openEditProductModal(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;
    const form = document.getElementById('edit-product-form');
    form.elements['edit-p-id'].value = product.id;
    form.elements['edit-p-name'].value = product.name;
    form.elements['edit-p-price'].value = product.price;
    form.elements['edit-p-category'].value = product.categoryId;
    // populate introduction and origin/date fields
    if (form.elements['edit-p-introduction']) form.elements['edit-p-introduction'].value = product.introduction || product.remark || '';
    if (form.elements['edit-p-origin']) form.elements['edit-p-origin'].value = product.origin || '';
    if (form.elements['edit-p-production-date']) form.elements['edit-p-production-date'].value = product.productionDate || '';
    if (form.elements['edit-p-expiry-date']) form.elements['edit-p-expiry-date'].value = product.expiryDate || '';
    editProductImages = product.imageUrls || [];
    console.log('openEditProductModal: editProductImages initialized to:', editProductImages);
    renderPreviewsFromArray(editProductImages, document.getElementById('edit-p-image-preview-container'), true);
    editProductModal.show();
}

function openEditCategoryModal(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;
    const form = document.getElementById('edit-category-form');
    form.elements['edit-c-id'].value = category.id;
    form.elements['edit-c-name'].value = category.name;
    editCategoryModal.show();
}

async function handleUpdateProduct() {
    const form = document.getElementById('edit-product-form');
    const id = form.elements['edit-p-id'].value;
    try {
        console.log('handleUpdateProduct: editProductImages before collectImageUrls:', editProductImages);
        const imageUrls = await collectImageUrls(editProductImages);
        console.log('handleUpdateProduct: imageUrls after collectImageUrls:', imageUrls);
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
        await fetch(`${productApiUrl}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        editProductModal.hide();
        refreshAllData();
    } catch (err) {
        alert('更新商品失敗: ' + err.message);
    }
}

async function handleUpdateCategory() {
    const form = document.getElementById('edit-category-form');
    const id = form.elements['edit-c-id'].value;
    const payload = { id: Number(id), name: form.elements['edit-c-name'].value };
    await fetch(`${categoryApiUrl}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    editCategoryModal.hide();
    refreshAllData();
}

// --- Initialization ---
function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    editProductModal = new bootstrap.Modal(document.getElementById('editProductModal'));
    editCategoryModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
    imageViewModal = new bootstrap.Modal(document.getElementById('imageViewModal'));

    document.getElementById('nav-products')?.addEventListener('click', () => showSection('products-section'));
    document.getElementById('nav-categories')?.addEventListener('click', () => showSection('categories-section'));
    document.getElementById('nav-orders')?.addEventListener('click', () => showSection('orders-section'));

    document.getElementById('product-form')?.addEventListener('submit', createProduct);
    document.getElementById('category-form')?.addEventListener('submit', createCategory);
    document.getElementById('save-edit-product-btn')?.addEventListener('click', handleUpdateProduct);
    document.getElementById('save-edit-category-btn')?.addEventListener('click', handleUpdateCategory);
    document.getElementById('product-search')?.addEventListener('input', (e) => filterProducts(e.target.value));
    
    document.getElementById('p-image-upload')?.addEventListener('change', (e) => handleImageUploadChange(e, false));
    document.getElementById('edit-p-image-upload')?.addEventListener('change', (e) => handleImageUploadChange(e, true));

    // activate nav highlighting
    document.querySelectorAll('.navbar .nav-link').forEach(a => {
        a.addEventListener('click', (ev) => {
            document.querySelectorAll('.navbar .nav-link').forEach(x => x.classList.remove('active'));
            a.classList.add('active');
        });
    });

    showSection('products-section');
    refreshAllData();
    // hook thumbnail nav once DOM is ready
    // bind prev/next: replace nodes to clear old listeners then bind
    const thumbPrev = document.getElementById('iv-thumb-prev');
    const thumbNext = document.getElementById('iv-thumb-next');
    if (thumbPrev) {
        const np = thumbPrev.cloneNode(true);
        thumbPrev.parentNode.replaceChild(np, thumbPrev);
        np.addEventListener('click', ()=> { ivPrev(); ensureThumbVisibility(_iv_state.current); });
    }
    if (thumbNext) {
        const nn = thumbNext.cloneNode(true);
        thumbNext.parentNode.replaceChild(nn, thumbNext);
        nn.addEventListener('click', ()=> { ivNext(); ensureThumbVisibility(_iv_state.current); });
    }
    // initial update
    setTimeout(()=> updateIVThumbNav(), 120);
    // update when image viewer modal shows
    const ivModalEl = document.getElementById('imageViewModal');
    if (ivModalEl) ivModalEl.addEventListener('shown.bs.modal', ()=> { setTimeout(()=> updateIVThumbNav(), 80); });
});

function logout() {
    window.location.href = '../login.html';
}

// Expose functions to global scope for inline onclicks
window.openEditProductModal = openEditProductModal;
window.deleteProduct = deleteProduct;
window.openEditCategoryModal = openEditCategoryModal;
window.deleteCategory = deleteCategory;
window.toggleOrderDetails = toggleOrderDetails;
window.deleteImageFromPreview = deleteImageFromPreview;

// --- Rendering Functions ---
function createTable(headers) {
    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
    table.innerHTML = `
        <thead class="table-light">
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody></tbody>`;
    return table;
}

function renderProducts(products) {
    const container = document.getElementById('product-list');
    if (!container) return;
    container.innerHTML = '';
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有商品。</div>';
        return;
    }
    const table = createTable(['圖片', '名稱', '分類', '價格', '操作']);
    const tbody = table.querySelector('tbody');
    products.forEach(p => {
        const mainImage = (p.imageUrls && p.imageUrls.length > 0) ? normalizeImageUrl(p.imageUrls[0]) : IMAGE_PLACEHOLDER_DATAURI;
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
            </td>
        `;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);
}

function viewProductImages(productId){
    const product = allProducts.find(p => p.id === productId);
    if (!product) return alert('找不到商品');
    const images = product.imageUrls || [];
    _iv_state.images = images.slice();
    _iv_state.rendered = [];
    _iv_state.current = 0;
    _iv_state.blobUrls.forEach(u => URL.revokeObjectURL(u));
    _iv_state.blobUrls = [];
    populateIVModal();
    imageViewModal.show();
}

function viewImage(url){
    // open modal showing a single image (url may be blob or remote)
    _iv_state.images = [url];
    _iv_state.current = 0;
    populateIVModal();
    imageViewModal.show();
}

function populateIVModal(){
    const main = document.getElementById('iv-main-img');
    const thumbs = document.getElementById('iv-thumbs');
    thumbs.innerHTML = '';
    const images = _iv_state.images;
    // ensure thumbnail strip is hidden by default; consumer can toggle via .image-viewer.show-thumbs
    const ivViewer = document.querySelector('#imageViewModal .image-viewer');
    if (ivViewer) ivViewer.classList.remove('show-thumbs');
    if (!images || images.length === 0){
        main.src = IMAGE_PLACEHOLDER_DATAURI;
        return;
    }
    images.forEach((it, idx) => {
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'iv-thumb';
        const img = document.createElement('img');
        let src;
        if (it instanceof File){
            // create object url once and store
            src = URL.createObjectURL(it);
            _iv_state.blobUrls.push(src);
            _iv_state.rendered[idx] = src;
        } else {
            src = normalizeImageUrl(it);
            _iv_state.rendered[idx] = src;
        }
        img.src = src;
        img.alt = `圖片 ${idx+1}`;
        thumbWrap.appendChild(img);
        thumbWrap.addEventListener('click', () => {
            _iv_state.current = idx;
            updateIVMain();
            highlightThumb(idx);
        });
        thumbs.appendChild(thumbWrap);
    });
    // set main
    updateIVMain();
    highlightThumb(_iv_state.current);
    ensureThumbVisibility(_iv_state.current);
    // mark visible thumbnails window
    refreshThumbWindow();
    // update thumb nav visibility
    setTimeout(updateIVThumbNav, 80);
}

function updateIVMain(){
    const main = document.getElementById('iv-main-img');
    const it = _iv_state.images[_iv_state.current];
    if (!it) { main.src = IMAGE_PLACEHOLDER_DATAURI; return; }
    // use precomputed rendered src if available
    const rendered = _iv_state.rendered[_iv_state.current];
    if (rendered) main.src = rendered;
    else {
        if (it instanceof File){
            const blob = URL.createObjectURL(it);
            _iv_state.blobUrls.push(blob);
            _iv_state.rendered[_iv_state.current] = blob;
            main.src = blob;
        } else {
            const r = normalizeImageUrl(it);
            _iv_state.rendered[_iv_state.current] = r;
            main.src = r;
        }
    }
}

// Thumbnail window: show at most VISIBLE_THUMBS thumbnails (add .visible class)
const VISIBLE_THUMBS = 5;
function refreshThumbWindow(){
    const total = (_iv_state.images && _iv_state.images.length) ? _iv_state.images.length : 0;
    if (total === 0) return;
    // ensure thumbWindowStart is within valid range
    _iv_state.thumbWindowStart = Math.max(0, Math.min(_iv_state.thumbWindowStart, Math.max(0, total - VISIBLE_THUMBS)));
    const thumbs = document.querySelectorAll('#iv-thumbs .iv-thumb');
    thumbs.forEach((t, i)=>{
        t.classList.remove('visible');
        t.classList.remove('active');
        if (i >= _iv_state.thumbWindowStart && i < _iv_state.thumbWindowStart + VISIBLE_THUMBS) t.classList.add('visible');
        if (i === _iv_state.current) t.classList.add('active');
    });
}

function ensureThumbVisibility(idx){
    const thumbs = document.querySelectorAll('.iv-thumb');
    if (!thumbs || thumbs.length===0) return;
    const visibleCount = 5;
    // if idx >= visibleCount, we still keep thumbnails but highlight the active. Optionally scroll
    const container = document.querySelector('.iv-thumbs');
    const target = thumbs[idx];
    if (target && container && typeof target.scrollIntoView === 'function'){
        // smooth scroll so the active thumb is visible
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

function updateIVThumbNav(){
    const container = document.getElementById('iv-thumbs');
    const prevBtn = document.getElementById('iv-thumb-prev');
    const nextBtn = document.getElementById('iv-thumb-next');
    const imagesCount = (_iv_state.images && _iv_state.images.length) ? _iv_state.images.length : 0;
    // Enable arrows when there is more than one image. Previously we relied on thumb container scrollability;
    // but the modal may hide thumbnails, so we base enablement on the image count instead.
    if (prevBtn) {
        if (imagesCount > 1) prevBtn.classList.remove('disabled'); else prevBtn.classList.add('disabled');
    }
    if (nextBtn) {
        if (imagesCount > 1) nextBtn.classList.remove('disabled'); else nextBtn.classList.add('disabled');
    }
}

function scrollIVThumbs(direction){
    // legacy: replaced by ivPrev/ivNext behavior. Keep for compatibility by mapping to index change.
    if (!_iv_state.images || _iv_state.images.length === 0) return;
    if (direction > 0) ivNext(); else ivPrev();
    ensureThumbVisibility(_iv_state.current);
}

// event listeners for thumb nav are added inside DOMContentLoaded to ensure elements exist
window.addEventListener('resize', ()=> { updateIVThumbNav(); });

function highlightThumb(idx){
    document.querySelectorAll('.iv-thumb').forEach((n,i)=>{
        if (i===idx) n.classList.add('active'); else n.classList.remove('active');
    });
}

function ivPrev(){
    if (!_iv_state.images || _iv_state.images.length === 0) return;
    _iv_state.current = (_iv_state.current -1 + _iv_state.images.length) % _iv_state.images.length;
    updateIVMain(); highlightThumb(_iv_state.current);
    // if current moved before visible window, shift window left and refresh
    if (_iv_state.current < _iv_state.thumbWindowStart) _iv_state.thumbWindowStart = Math.max(0, _iv_state.current);
    refreshThumbWindow();
}

function ivNext(){
    if (!_iv_state.images || _iv_state.images.length === 0) return;
    _iv_state.current = (_iv_state.current +1) % _iv_state.images.length;
    updateIVMain(); highlightThumb(_iv_state.current);
    // if current moved past visible window, shift window right and refresh
    if (_iv_state.current >= _iv_state.thumbWindowStart + VISIBLE_THUMBS) _iv_state.thumbWindowStart = _iv_state.current - VISIBLE_THUMBS + 1;
    refreshThumbWindow();
}

// keyboard navigation and cleanup when modal hides
document.addEventListener('keydown', (e)=>{
    const modalEl = document.getElementById('imageViewModal');
    if (!modalEl) return;
    const isShown = modalEl.classList.contains('show');
    if (!isShown) return;
    if (e.key === 'ArrowLeft') ivPrev();
    if (e.key === 'ArrowRight') ivNext();
    if (e.key === 'Escape') {
        // let bootstrap handle hide
    }
});

document.getElementById('iv-prev')?.addEventListener('click', ivPrev);
document.getElementById('iv-next')?.addEventListener('click', ivNext);

// cleanup blob urls when modal hidden
const ivModalEl = document.getElementById('imageViewModal');
if (ivModalEl) ivModalEl.addEventListener('hidden.bs.modal', ()=>{
    _iv_state.blobUrls.forEach(u=>URL.revokeObjectURL(u));
    _iv_state.blobUrls = [];
    _iv_state.images = [];
    _iv_state.current = 0;
    const main = document.getElementById('iv-main-img'); if (main) main.src='';
});

function filterProducts(query){
    const q = String(query || '').trim().toLowerCase();
    const filtered = allProducts.filter(p => p.name && p.name.toLowerCase().includes(q));
    renderProducts(filtered);
}

function renderCategories(categories) {
    const container = document.getElementById('category-list');
    if (!container) return;
    container.innerHTML = '';
    if (!categories || categories.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有分類。</div>';
        return;
    }
    const table = createTable(['ID', '分類名稱', '操作']);
    const tbody = table.querySelector('tbody');
    categories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td>${c.name}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="openEditCategoryModal(${c.id})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">刪除</button>
            </td>
        `;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);

    // Populate dropdowns
    const catSelects = [document.getElementById('p-category'), document.getElementById('edit-p-category')];
    catSelects.forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">請選擇分類</option>';
            categories.forEach(c => select.appendChild(new Option(c.name, c.id)));
        }
    });
}

function renderOrders(orders) {
    const container = document.getElementById('order-list');
    if (!container) return;
    container.innerHTML = '';
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="alert alert-info">目前沒有訂單。</div>';
        return;
    }
    const table = createTable(['訂單ID', '顧客', '日期', '總金額', '詳情']);
    const tbody = table.querySelector('tbody');
    orders.forEach(order => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customerName || 'N/A'}</td>
            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
            <td>$${order.totalAmount.toFixed(2)}</td>
            <td><button class="btn btn-sm btn-info" onclick="toggleOrderDetails(this, ${order.id})">查看</button></td>
        `;
        const detailsRow = tbody.insertRow();
        detailsRow.id = `order-details-${order.id}`;
        detailsRow.style.display = 'none';
        const detailsCell = detailsRow.insertCell();
        detailsCell.colSpan = 5;
        detailsCell.innerHTML = `
            <div class="p-3 bg-light">
                <h6>訂單 #${order.id} 詳情</h6>
                <p><strong>收件人:</strong> ${order.recipientName || ''}</p>
                <p><strong>地址:</strong> ${order.recipientAddress || ''}</p>
                <p><strong>電話:</strong> ${order.recipientPhone || ''}</p>
                <ul class="list-group">${(order.details || []).map(d => `<li class="list-group-item">${d.productName} x ${d.quantity}</li>`).join('')}</ul>
            </div>`;
    });
    const responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table);
    container.appendChild(responsiveWrapper);
}

function toggleOrderDetails(btn, orderId) {
    const detailsRow = document.getElementById(`order-details-${orderId}`);
    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        btn.textContent = '隱藏';
    } else {
        detailsRow.style.display = 'none';
        btn.textContent = '查看';
    }
}

// --- Data Fetching ---
async function fetchData(url) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.json();
    } catch (e) {
        console.error(`Fetch Error from ${url}:`, e);
        throw e;
    }
}

async function refreshAllData() {
    try {
        [allProducts, allCategories, allOrders] = await Promise.all([
            fetchData(productApiUrl),
            fetchData(categoryApiUrl),
            fetchData(orderApiUrl)
        ]);
        renderProducts(allProducts);
        renderCategories(allCategories);
        renderOrders(allOrders);
    } catch (err) {
        document.getElementById('product-list').innerHTML = '<div class="alert alert-danger">載入資料失敗，請檢查後端服務與資料庫連線。</div>';
    }
}

// --- CRUD Actions ---
async function createProduct(e) {
    e.preventDefault();
    const form = e.target;
    try {
        const imageUrls = await collectImageUrls(newProductImages);
        const payload = {
            name: form.elements['p-name'].value,
            price: Number(form.elements['p-price'].value),
            categoryId: Number(form.elements['p-category'].value),
            introduction: form.elements['p-introduction'] ? form.elements['p-introduction'].value : '',
            origin: form.elements['p-origin'] ? form.elements['p-origin'].value : '',
            productionDate: form.elements['p-production-date'] ? form.elements['p-production-date'].value : '',
            expiryDate: form.elements['p-expiry-date'] ? form.elements['p-expiry-date'].value : '',
            imageUrls
        };
        await fetch(productApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        form.reset();
        newProductImages = [];
        renderPreviewsFromArray([], document.getElementById('p-image-preview-container'));
        // clear introduction textarea if present
        const introEl = document.getElementById('p-introduction'); if (introEl) introEl.value = '';
        refreshAllData();
    } catch (err) {
        alert('新增商品失敗: ' + err.message);
    }
}

async function createCategory(e) {
    e.preventDefault();
    const form = e.target;
    const payload = { name: form.elements['c-name'].value };
    await fetch(categoryApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    form.reset();
    refreshAllData();
}

async function deleteProduct(id) {
    if (!confirm(`確定要刪除商品 #${id} 嗎?`)) return;
    await fetch(`${productApiUrl}/${id}`, { method: 'DELETE' });
    refreshAllData();
}

async function deleteCategory(id) {
    if (!confirm(`確定要刪除分類 #${id} 嗎?`)) return;
    await fetch(`${categoryApiUrl}/${id}`, { method: 'DELETE' });
    refreshAllData();
}

function openEditProductModal(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;
    const form = document.getElementById('edit-product-form');
    form.elements['edit-p-id'].value = product.id;
    form.elements['edit-p-name'].value = product.name;
    form.elements['edit-p-price'].value = product.price;
    form.elements['edit-p-category'].value = product.categoryId;
    // populate introduction if available
    const editIntro = document.getElementById('edit-p-introduction'); if (editIntro) editIntro.value = product.introduction || product.remark || '';
    editProductImages = product.imageUrls || [];
    renderPreviewsFromArray(editProductImages, document.getElementById('edit-p-image-preview-container'));
    editProductModal.show();
}

function openEditCategoryModal(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;
    const form = document.getElementById('edit-category-form');
    form.elements['edit-c-id'].value = category.id;
    form.elements['edit-c-name'].value = category.name;
    editCategoryModal.show();
}

async function handleUpdateProduct() {
    const form = document.getElementById('edit-product-form');
    const id = form.elements['edit-p-id'].value;
    try {
        const imageUrls = await collectImageUrls(editProductImages);
        const payload = {
            id: Number(id),
            name: form.elements['edit-p-name'].value,
            price: Number(form.elements['edit-p-price'].value),
            categoryId: Number(form.elements['edit-p-category'].value),
            introduction: form.elements['edit-p-introduction'] ? form.elements['edit-p-introduction'].value : '',
            origin: form.elements['edit-p-origin'] ? form.elements['edit-p-origin'].value : '',
            productionDate: form.elements['edit-p-production-date'] ? form.elements['edit-p-production-date'].value : '',
            expiryDate: form.elements['edit-p-expiry-date'] ? form.elements['edit-p-expiry-date'].value : '',
            imageUrls
        };
        await fetch(`${productApiUrl}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        editProductModal.hide();
        refreshAllData();
    } catch (err) {
        alert('更新商品失敗: ' + err.message);
    }
}

async function handleUpdateCategory() {
    const form = document.getElementById('edit-category-form');
    const id = form.elements['edit-c-id'].value;
    const payload = { id: Number(id), name: form.elements['edit-c-name'].value };
    await fetch(`${categoryApiUrl}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    editCategoryModal.hide();
    refreshAllData();
}

// --- Initialization ---
function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    editProductModal = new bootstrap.Modal(document.getElementById('editProductModal'));
    editCategoryModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
    imageViewModal = new bootstrap.Modal(document.getElementById('imageViewModal'));

    document.getElementById('nav-products')?.addEventListener('click', () => showSection('products-section'));
    document.getElementById('nav-categories')?.addEventListener('click', () => showSection('categories-section'));
    document.getElementById('nav-orders')?.addEventListener('click', () => showSection('orders-section'));

    document.getElementById('product-form')?.addEventListener('submit', createProduct);
    document.getElementById('category-form')?.addEventListener('submit', createCategory);
    document.getElementById('save-edit-product-btn')?.addEventListener('click', handleUpdateProduct);
    document.getElementById('save-edit-category-btn')?.addEventListener('click', handleUpdateCategory);
    
    document.getElementById('p-image-upload')?.addEventListener('change', (e) => handleImageUploadChange(e, false));
    document.getElementById('edit-p-image-upload')?.addEventListener('change', (e) => handleImageUploadChange(e, true));

    showSection('products-section');
    refreshAllData();
});

function logout() {
    window.location.href = '../login.html';
}

// Expose functions to global scope for inline onclicks
window.openEditProductModal = openEditProductModal;
window.deleteProduct = deleteProduct;
window.openEditCategoryModal = openEditCategoryModal;
window.deleteCategory = deleteCategory;
window.toggleOrderDetails = toggleOrderDetails;