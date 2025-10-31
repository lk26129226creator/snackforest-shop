(function () {
    // Redirect users to the login page if no role is recorded in localStorage.
    document.addEventListener('DOMContentLoaded', function () {
        const body = document.body;
        if (!body) return;
        const requireAttr = body.getAttribute('data-require-auth');
        if (requireAttr && requireAttr.toLowerCase() === 'false') return;
        const clientRole = (localStorage.getItem('sf-client-role') || localStorage.getItem('userRole') || '').toLowerCase();
        if (clientRole === 'customer') return;
        let loginPath = body.getAttribute('data-login-path');
        if (!loginPath) {
            loginPath = window.location.pathname.includes('/client/') ? '../login.html' : 'login.html';
        }
        window.location.replace(loginPath);
    }, { once: true });
})();
