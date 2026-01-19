const API_URL = '/api/admin/products';
const PUBLIC_API_URL = '/api/products'; // 用於讀取列表
let productModal;

let allProducts = []; // 在記憶體中儲存一份商品列表

document.addEventListener('DOMContentLoaded', () => {
    productModal = new bootstrap.Modal(document.getElementById('productModal'));
    loadProducts();
});

// 載入商品列表
function loadProducts() {
    fetch(PUBLIC_API_URL)
        .then(res => res.json())
        .then(products => {
            allProducts = products; // 儲存到全域變數
            const tbody = document.getElementById('product-list');
            tbody.innerHTML = '';
            products.forEach(p => {
                tbody.innerHTML += `
                    <tr>
                        <td><img src="${p.imageUrl || 'https://via.placeholder.com/50'}" class="product-img-thumb"></td>
                        <td>${p.name}</td>
                        <td>$${p.price}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="editProduct(${p.id})">
                                <i class="bi bi-pencil"></i> 編輯
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">
                                <i class="bi bi-trash"></i> 刪除
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
}

// 開啟 Modal (新增或編輯)
function openModal(product = null) {
    const title = document.getElementById('modalTitle');
    const idInput = document.getElementById('pId');
    const nameInput = document.getElementById('pName');
    const priceInput = document.getElementById('pPrice');
    const imageInput = document.getElementById('pImage');

    // 清空或填入資料
    if (product) {
        title.textContent = '編輯商品';
        idInput.value = product.id;
        nameInput.value = product.name;
        priceInput.value = product.price;
    } else {
        title.textContent = '新增商品';
        idInput.value = '';
        nameInput.value = '';
        priceInput.value = '';
        imageInput.value = '';
    }
    productModal.show();
}

// 觸發編輯
function editProduct(productId) {
    const productToEdit = allProducts.find(p => p.id === productId);
    if (productToEdit) openModal(productToEdit);
}

// 儲存商品 (新增或更新)
function saveProduct() {
    const id = document.getElementById('pId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('pName').value);
    formData.append('price', document.getElementById('pPrice').value);
    
    const imageFile = document.getElementById('pImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    fetch(url, { method: method, body: formData })
        .then(res => {
            if (res.ok) {
                productModal.hide();
                loadProducts();
            } else {
                return res.text().then(text => alert('儲存失敗: ' + text));
            }
        })
        .catch(err => alert('網路錯誤: ' + err));
}

// 刪除商品
function deleteProduct(id) {
    if (confirm('確定要刪除此商品嗎？')) {
        fetch(`${API_URL}/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) loadProducts();
                else alert('刪除失敗');
            });
    }
}