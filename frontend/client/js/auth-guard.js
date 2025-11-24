(function () {
    // 客戶端簡易登入守門員：未找到角色時導向登入頁，支援客製化屬性與靜態站台例外。
    /**
     * DOM 完成後檢查登入狀態，必要時導向登入頁。
     */
    document.addEventListener('DOMContentLoaded', function onGuardReady() {
        const body = document.body;
        if (!body) return;

        // data-require-auth="false" 可在特定頁面停用守門員，例如行銷或公開頁。
        const requireAttr = body.getAttribute('data-require-auth');
        if (requireAttr && requireAttr.toLowerCase() === 'false') return;

        // 客戶端角色儲存在兩個可能的 key 中。
        // 設定允許訪客（'guest'）或標記 `sf-guest='1'` 的情況可繼續瀏覽（不被導回登入）。
        const clientRole = (localStorage.getItem('sf-client-role') || localStorage.getItem('userRole') || '').toLowerCase();
        const guestFlag = (localStorage.getItem('sf-guest') || '').toString();
        if (clientRole === 'customer' || clientRole === 'guest' || guestFlag === '1') return;

        // 支援自訂登入入口，若未指定則依路徑推斷回到 login.html。
        let loginPath = body.getAttribute('data-login-path');
        if (!loginPath) {
            loginPath = window.location.pathname.includes('/client/') ? '../login.html' : 'login.html';
        }

        // 如果部署在 GitHub Pages（純展示環境），允許未登入也能瀏覽。
        if (window.location.hostname.endsWith('github.io')) return;

        window.location.replace(loginPath);
    }, { once: true });
})();
