(function(){
    document.addEventListener('DOMContentLoaded', function(){
        var body = document.body;
        if (!body) { return; }
        var requireAttr = body.getAttribute('data-require-auth');
        if (requireAttr && requireAttr.toLowerCase() === 'false') { return; }
    var hasAdmin = (localStorage.getItem('sf-admin-role') || '').toLowerCase() === 'admin';
    var hasCustomer = (localStorage.getItem('sf-client-role') || '').toLowerCase() === 'customer';
    var legacyRole = (localStorage.getItem('userRole') || '').toLowerCase();
    if (hasAdmin || hasCustomer || legacyRole) { return; }
        var loginPath = body.getAttribute('data-login-path');
        if (!loginPath) {
            loginPath = window.location.pathname.indexOf('/client/') > -1 ? '../login.html' : 'login.html';
        }
        window.location.replace(loginPath);
    }, { once: true });
})();
