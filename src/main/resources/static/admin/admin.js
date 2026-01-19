let allProducts = []; // 1. 宣告全域變數暫存商品資料

document.addEventListener("DOMContentLoaded", function() {
    loadProducts();
});

function loadProducts() {
    fetch('/api/products') // 載入商品列表
        .then(res => res.json())
        .then(data => {
            allProducts = data; // 2. 將資料存入全域變數
            const tbody = document.getElementById('product-table-body');
            if (!tbody) return;
            
            tbody.innerHTML = data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.imageUrl || 'https://via.placeholder.com/50'}" width="50" height="50" class="rounded object-fit-cover"></td>
                    <td>${p.productName || '未命名'}</td>
                    <td>$${p.price}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct(${p.id})">編輯</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">刪除</button>
                    </td>
                </tr>
            `).join('');
        }).catch(err => console.error('無法載入商品', err));
}

// 點擊編輯按鈕
function editProduct(id) {
    const p = allProducts.find(item => item.id === id);
    if (p) {
        document.getElementById('pId').value = p.id;
        document.getElementById('pName').value = p.productName;
        document.getElementById('pPrice').value = p.price;
        document.getElementById('pImgFile').value = ''; // 檔案無法預設，需重新上傳
        
        // 開啟 Modal
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        modal.show();
    }
}

// 點擊新增按鈕時重置表單
function resetForm() {
    document.getElementById('pId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pImgFile').value = '';
}

// 儲存商品 (新增或修改)
function saveProduct() {
    const id = document.getElementById('pId').value;
    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const fileInput = document.getElementById('pImgFile');
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    if (fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
    }

    // 判斷是新增 (POST) 還是修改 (PUT)
    const url = id ? '/api/admin/products/' + id : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => {
        if (response.ok) {
            alert(id ? '修改成功' : '新增成功');
            location.reload(); // 重新整理頁面
        } else {
            alert('操作失敗');
        }
    })
    .catch(error => console.error('Error:', error));
}

// 刪除商品
function deleteProduct(id) {
    if (!confirm('確定要刪除此商品嗎？')) return;
    
    fetch('/api/admin/products/' + id, { method: 'DELETE' })
        .then(response => {
            if (response.ok) loadProducts();
            else alert('刪除失敗');
        });
}

// 切換分頁功能
function showSection(sectionId, linkElement) {
    // 隱藏所有區塊
    document.querySelectorAll('.content > div').forEach(div => div.classList.add('d-none'));
    
    // 顯示選定區塊
    const targetSection = document.getElementById('section-' + sectionId);
    if (targetSection) {
        targetSection.classList.remove('d-none');
    }

    // 更新 Sidebar 狀態
    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
    linkElement.classList.add('active');
}