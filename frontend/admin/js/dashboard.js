//
//  Admin 儀表板模組：負責顯示使用者資訊、統計數字與刷新操作。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});
    const { state } = Admin;
    const dashboard = Admin.dashboard || {};

    /**
     * 將儲存在 localStorage 的角色代碼轉為易讀中文標籤。
     * @param {string} role 角色英文代碼。
     * @returns {string} 對應的顯示文字。
     */
    dashboard.resolveRoleLabel = function (role) {
        if (!role) return '管理者';
        const normalized = String(role).trim().toLowerCase();
        switch (normalized) {
            case 'admin':
            case 'administrator':
                return '系統管理者';
            case 'manager':
                return '管理者';
            case 'staff':
            case 'editor':
                return '內容管理';
            case 'customer':
                return '會員';
            default:
                return role;
        }
    };

    /**
     * 聚合儀表板所需的管理者資訊（名稱、帳號、角色）。
     * @returns {{name: string, username: string, role: string, roleKey: string}}
     */
    dashboard.getProfile = function () {
        let session = null;
        try {
            session = JSON.parse(localStorage.getItem('sf-admin-session') || 'null');
        } catch (_) {
            session = null;
        }

        const username = localStorage.getItem('sf-admin-username')
            || session?.username
            || localStorage.getItem('username')
            || localStorage.getItem('userAccount')
            || 'admin';
        const displayName = localStorage.getItem('sf-admin-name')
            || session?.name
            || localStorage.getItem('adminName')
            || localStorage.getItem('userName')
            || username
            || '管理者';
        const userRole = localStorage.getItem('userRole') || '';
        const roleKey = localStorage.getItem('sf-admin-role')
            || (userRole.toLowerCase() === 'admin' ? userRole : 'admin');
        return {
            name: displayName,
            username,
            role: dashboard.resolveRoleLabel(roleKey),
            roleKey
        };
    };

    /**
     * 根據名稱產生頭像顯示用縮寫，預設取前兩個字元。
     * @param {string} name 管理者顯示姓名。
     * @returns {string} 兩個字元縮寫。
     */
    dashboard.getAvatarInitials = function (name) {
        const chars = Array.from(String(name || '').trim());
        if (chars.length === 0) return 'AD';
        if (chars.length === 1) return chars[0].toUpperCase();
        return (chars[0] + chars[1]).toUpperCase();
    };

    /**
     * 將管理者資料填入首頁的個人資訊卡。
     */
    dashboard.renderProfile = function () {
        const profile = dashboard.getProfile();
        const nameEl = document.getElementById('admin-profile-name');
        const roleEl = document.getElementById('admin-profile-role');
        const usernameEl = document.getElementById('admin-profile-username');
        const avatarEl = document.getElementById('admin-profile-avatar');
        if (nameEl) nameEl.textContent = profile.name;
        if (roleEl) roleEl.textContent = profile.role;
        if (usernameEl) usernameEl.textContent = profile.username;
        if (avatarEl) avatarEl.textContent = dashboard.getAvatarInitials(profile.name);
    };

    /**
     * 依據快取狀態更新商品、分類、訂單數量統計。
     */
    dashboard.updateStats = function () {
        const productEl = document.getElementById('admin-stat-products');
        const categoryEl = document.getElementById('admin-stat-categories');
        const orderEl = document.getElementById('admin-stat-orders');
        if (productEl) productEl.textContent = Array.isArray(state.allProducts) ? state.allProducts.length : 0;
        if (categoryEl) categoryEl.textContent = Array.isArray(state.allCategories) ? state.allCategories.length : 0;
        if (orderEl) orderEl.textContent = Array.isArray(state.allOrders) ? state.allOrders.length : 0;
    };

    /**
     * 綁定儀表板重新整理按鈕，觸發資料刷新並展示載入狀態。
     */
    dashboard.bindActions = function () {
        const refreshBtn = document.getElementById('dashboard-refresh');
        if (refreshBtn && !refreshBtn.dataset.bound) {
            refreshBtn.dataset.bound = '1';
            if (!refreshBtn.dataset.baseText) {
                refreshBtn.dataset.baseText = refreshBtn.textContent || '重新整理資料';
            }
            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault();
                refreshBtn.disabled = true;
                refreshBtn.textContent = '更新中...';
                if (Admin.data && typeof Admin.data.refreshAllData === 'function') {
                    Admin.data.refreshAllData().finally(() => {
                        refreshBtn.disabled = false;
                        refreshBtn.textContent = refreshBtn.dataset.baseText || '重新整理資料';
                    });
                } else {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = refreshBtn.dataset.baseText || '重新整理資料';
                }
            });
        }
    };

    /**
     * 首頁渲染入口：顯示管理者資訊並更新統計數字。
     */
    dashboard.render = function () {
        dashboard.renderProfile();
        dashboard.updateStats();
    };

    Admin.dashboard = dashboard;

    if (Admin.core && typeof Admin.core.on === 'function') {
        if (!dashboard._eventsBound) {
            dashboard._eventsBound = true;
            const refreshStats = () => dashboard.updateStats();
            Admin.core.on('products:updated', refreshStats);
            Admin.core.on('categories:updated', refreshStats);
            Admin.core.on('orders:updated', refreshStats);
        }
    }
})(window);
