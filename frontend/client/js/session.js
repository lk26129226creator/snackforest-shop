(function(){
    // 將 logout() 綁定到全域，確保各頁面呼叫時能清除客戶端登入狀態並回到登入頁。
    if (typeof window.logout !== 'function') {
    /**
     * 全域登出函式：清除客戶端登入資訊與購物車，並導回登入頁。
     */
    window.logout = function logout() {
            // 清空瀏覽器儲存的使用者資訊與購物車，避免殘留舊身分。
            try {
                localStorage.removeItem('sf_cart');
                localStorage.removeItem('customerName');
                localStorage.removeItem('customerId');
                localStorage.removeItem('sf-client-name');
                localStorage.removeItem('sf-client-id');
                localStorage.removeItem('sf-client-role');
                localStorage.removeItem('sf-client-session');
                localStorage.removeItem('sf-client-avatar');
                localStorage.removeItem('sf-client-profile-sync');
                localStorage.removeItem('sf-client-profile-version');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
            } catch (e) {
                // ignore storage errors
            }
            // 通知導航列等元件更新狀態，移除個人頭像與名稱。
            try {
                window.dispatchEvent(new CustomEvent('sf:profile-updated', {
                    detail: { name: '', avatarUrl: '', customerId: '' }
                }));
            } catch (e) {
                // ignore event dispatch errors
            }
            // 優先導向絕對路徑，若失敗則回退相對路徑，避免不同目錄導致 404。
            try {
                window.location.href = '/frontend/login.html';
            } catch (e) {
                window.location.href = 'login.html';
            }
        };
    }
})();
