(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { config, state } = Admin;
    const categories = Admin.categories || {};

    categories.renderCategories = function (list, options = {}) {
        const container = document.getElementById('category-list');
        if (!container) return;
        container.innerHTML = '';
        if (options.error) {
            container.innerHTML = `<div class="alert alert-danger">分類資料載入失敗：${options.error.message || options.error}</div>`;
            const selects = [document.getElementById('p-category'), document.getElementById('edit-p-category')];
            selects.forEach((select) => {
                if (!select) return;
                select.innerHTML = '<option value="">分類載入失敗</option>';
                select.disabled = true;
            });
            return;
        }
        const categoriesData = Array.isArray(list) ? list : state.allCategories;
        if (!categoriesData || categoriesData.length === 0) {
            container.innerHTML = '<div class="alert alert-info">目前沒有分類。</div>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        table.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th>ID</th>
                    <th>分類名稱</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        categoriesData.forEach((c) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditCategoryModal(${c.id})">編輯</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">刪除</button>
                </td>`;
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        wrapper.appendChild(table);
        container.appendChild(wrapper);

        const catSelects = [document.getElementById('p-category'), document.getElementById('edit-p-category')];
        catSelects.forEach((select) => {
            if (!select) return;
            select.innerHTML = '<option value="">請選擇分類</option>';
            select.disabled = false;
            categoriesData.forEach((c) => {
                const option = new Option(c.name, c.id);
                select.appendChild(option);
            });
        });
    };

    categories.createCategory = async function (event) {
        event.preventDefault();
        const form = event.target;
        const payload = { name: form.elements['c-name'].value };
        try {
            await fetch(config.endpoints.category, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            form.reset();
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('分類建立成功');
            }
            if (Admin.data && typeof Admin.data.loadCategories === 'function') {
                Admin.data.loadCategories({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '新增分類失敗');
            } else {
                alert('新增分類失敗: ' + err.message);
            }
        }
    };

    categories.openEditCategoryModal = function (id) {
        const category = state.allCategories.find((c) => c.id === id);
        if (!category) return;
        const form = document.getElementById('edit-category-form');
        if (!form) return;
        form.elements['edit-c-id'].value = category.id;
        form.elements['edit-c-name'].value = category.name;
        if (state.modals.editCategory) state.modals.editCategory.show();
    };

    categories.handleUpdateCategory = async function () {
        const form = document.getElementById('edit-category-form');
        if (!form) return;
        const id = form.elements['edit-c-id'].value;
        const payload = { id: Number(id), name: form.elements['edit-c-name'].value };
        try {
            await fetch(`${config.endpoints.category}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (state.modals.editCategory) state.modals.editCategory.hide();
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('分類已更新');
            }
            if (Admin.data && typeof Admin.data.loadCategories === 'function') {
                Admin.data.loadCategories({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '更新分類失敗');
            } else {
                alert('更新分類失敗: ' + err.message);
            }
        }
    };

    categories.deleteCategory = async function (id) {
        if (!confirm(`確定要刪除分類 #${id} 嗎?`)) return;
        try {
            await fetch(`${config.endpoints.category}/${id}`, { method: 'DELETE' });
            if (Admin.core && typeof Admin.core.notifySuccess === 'function') {
                Admin.core.notifySuccess('分類已刪除');
            }
            if (Admin.data && typeof Admin.data.loadCategories === 'function') {
                Admin.data.loadCategories({ force: true });
            }
        } catch (err) {
            if (Admin.core && typeof Admin.core.handleError === 'function') {
                Admin.core.handleError(err, '刪除分類失敗');
            } else {
                alert('刪除分類失敗: ' + err.message);
            }
        }
    };

    Admin.categories = categories;

    if (Admin.core && typeof Admin.core.on === 'function') {
        if (!categories._eventsBound) {
            categories._eventsBound = true;
            Admin.core.on('categories:updated', (event) => {
                const detail = event?.detail || {};
                categories.renderCategories(detail.data, { error: detail.error });
            });
        }
    }
})(window);
