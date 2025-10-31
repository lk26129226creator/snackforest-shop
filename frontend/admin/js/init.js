(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { state } = Admin;

    function ensureAdminAccess() {
        const role = (localStorage.getItem('sf-admin-role') || localStorage.getItem('userRole') || '').toLowerCase();
        if (role === 'admin') return true;
        try {
            sessionStorage.setItem('sf-admin-return', window.location.pathname + window.location.search + window.location.hash);
        } catch (_) {}
        window.location.replace('../login.html');
        return false;
    }

    function bindNavLinks() {
        const mapping = {
            'nav-dashboard': 'dashboard-section',
            'nav-products': 'products-section',
            'nav-categories': 'categories-section',
            'nav-orders': 'orders-section',
            'nav-carousel': 'carousel-section',
            'nav-site': 'site-section'
        };
        Object.entries(mapping).forEach(([id, section]) => {
            const link = document.getElementById(id);
            if (!link || link.dataset.bound) return;
            link.dataset.bound = '1';
            link.addEventListener('click', (event) => {
                event.preventDefault();
                if (Admin.navigation && typeof Admin.navigation.switchToSection === 'function') {
                    Admin.navigation.switchToSection(section, { force: true });
                }
            });
        });
    }

    function initializeAdmin() {
        if (!ensureAdminAccess()) {
            return;
        }

        const safeInvoke = (label, fn) => {
            if (typeof fn !== 'function') return;
            try {
                const result = fn();
                if (result && typeof result.then === 'function') {
                    result.catch((err) => {
                        console.error(`[SnackForest] ${label} 發生錯誤`, err);
                        Admin.core?.handleError?.(err, `${label} 發生錯誤`);
                    });
                }
                return result;
            } catch (err) {
                console.error(`[SnackForest] ${label} 發生錯誤`, err);
                Admin.core?.handleError?.(err, `${label} 發生錯誤`);
            }
        };

        if (window.bootstrap) {
            safeInvoke('初始化商品編輯視窗', () => {
                const editProductModalEl = document.getElementById('editProductModal');
                if (editProductModalEl) state.modals.editProduct = new bootstrap.Modal(editProductModalEl);
            });
            safeInvoke('初始化分類編輯視窗', () => {
                const editCategoryModalEl = document.getElementById('editCategoryModal');
                if (editCategoryModalEl) state.modals.editCategory = new bootstrap.Modal(editCategoryModalEl);
            });
        }

        safeInvoke('綁定首頁快捷鍵', () => Admin.navigation?.bindAdminHomeLink?.());
        safeInvoke('綁定側邊欄按鈕', () => Admin.navigation?.bindAdminMenu?.());
        safeInvoke('儀表板按鈕設定', () => Admin.dashboard?.bindActions?.());
        safeInvoke('渲染儀表板', () => Admin.dashboard?.render?.());
        safeInvoke('圖片檢視器初始化', () => Admin.viewer?.init?.());

        if (!document.body.dataset.sectionNavDelegate) {
            document.body.dataset.sectionNavDelegate = '1';
            document.addEventListener('click', (event) => {
                const trigger = event.target.closest('[data-target-section]');
                if (!trigger) return;
                const targetSection = trigger.getAttribute('data-target-section');
                if (!targetSection) return;
                event.preventDefault();
                if (Admin.navigation && typeof Admin.navigation.switchToSection === 'function') {
                    Admin.navigation.switchToSection(targetSection, { force: true });
                }
                if (Admin.navigation && typeof Admin.navigation.closeSidebar === 'function') {
                    const overlayMode = typeof Admin.navigation.isSidebarOverlayMode === 'function'
                        ? Admin.navigation.isSidebarOverlayMode()
                        : false;
                    if (overlayMode) {
                        Admin.navigation.closeSidebar({ focusTrigger: false });
                    }
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        safeInvoke('DOM 檢查', () => {
            Admin.core?.verifyDom?.([
                '#product-list',
                '#category-list',
                '#order-list',
                '#carousel-editor-list'
            ]);
        });

        safeInvoke('綁定導覽列', () => bindNavLinks());

        safeInvoke('綁定商品表單', () => {
            const productForm = document.getElementById('product-form');
            if (productForm && Admin.products?.createProduct) {
                productForm.addEventListener('submit', Admin.products.createProduct);
            }
        });

        safeInvoke('綁定分類表單', () => {
            const categoryForm = document.getElementById('category-form');
            if (categoryForm && Admin.categories?.createCategory) {
                categoryForm.addEventListener('submit', Admin.categories.createCategory);
            }
        });

        safeInvoke('綁定商品儲存按鈕', () => {
            const saveEditProductBtn = document.getElementById('save-edit-product-btn');
            if (saveEditProductBtn && Admin.products?.handleUpdateProduct) {
                saveEditProductBtn.addEventListener('click', Admin.products.handleUpdateProduct);
            }
        });

        safeInvoke('綁定分類儲存按鈕', () => {
            const saveEditCategoryBtn = document.getElementById('save-edit-category-btn');
            if (saveEditCategoryBtn && Admin.categories?.handleUpdateCategory) {
                saveEditCategoryBtn.addEventListener('click', Admin.categories.handleUpdateCategory);
            }
        });

        safeInvoke('綁定商品搜尋', () => {
            const productSearch = document.getElementById('product-search');
            if (productSearch && Admin.products) {
                productSearch.addEventListener('input', (event) => {
                    if (typeof Admin.products.debouncedFilter === 'function') {
                        Admin.products.debouncedFilter(event.target.value);
                    } else if (typeof Admin.products.filterProducts === 'function') {
                        Admin.products.filterProducts(event.target.value);
                    }
                });
            }
        });

        safeInvoke('綁定新增圖片上傳', () => {
            const newImageInput = document.getElementById('p-image-upload');
            if (newImageInput && Admin.images?.handleImageUploadChange) {
                newImageInput.addEventListener('change', (event) => {
                    Admin.images.handleImageUploadChange(event, false);
                });
            }
        });

        safeInvoke('綁定編輯圖片上傳', () => {
            const editImageInput = document.getElementById('edit-p-image-upload');
            if (editImageInput && Admin.images?.handleImageUploadChange) {
                editImageInput.addEventListener('change', (event) => {
                    Admin.images.handleImageUploadChange(event, true);
                });
            }
        });

        safeInvoke('輪播按鈕綁定', () => Admin.carousel?.bindEditorButtons?.());
        safeInvoke('輪播按鈕狀態', () => Admin.carousel?.updateSaveButtonState?.());

        const defaultSection = Admin.config?.DEFAULT_SECTION || 'dashboard-section';
        const initialSection = Admin.navigation?.getSavedSection?.() || defaultSection;
        safeInvoke('切換初始分頁', () => Admin.navigation?.switchToSection?.(initialSection, { force: true }));

        safeInvoke('初次載入資料', () => Admin.data?.refreshAllData?.().catch(() => {}));

        setTimeout(() => {
            safeInvoke('更新圖片縮圖導航', () => Admin.viewer?.updateThumbNav?.());
        }, 120);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAdmin);
    } else {
        initializeAdmin();
    }

    window.openEditProductModal = (id) => Admin.products?.openEditProductModal?.(id);
    window.deleteProduct = (id) => Admin.products?.deleteProduct?.(id);
    window.openEditCategoryModal = (id) => Admin.categories?.openEditCategoryModal?.(id);
    window.deleteCategory = (id) => Admin.categories?.deleteCategory?.(id);
    window.toggleOrderDetails = (button, id) => Admin.orders?.toggleOrderDetails?.(button, id);
    window.deleteImageFromPreview = (index, isEdit, container) => Admin.images?.deleteImageFromPreview?.(index, isEdit, container);
    window.viewProductImages = (id) => Admin.viewer?.viewProductImages?.(id);
    window.viewImage = (url) => Admin.viewer?.viewImage?.(url);
    window.logout = () => Admin.navigation?.logout?.();
})(window);
