(function(){
    if (typeof window.logout !== 'function') {
        window.logout = function logout() {
            try {
                localStorage.removeItem('sf_cart');
                localStorage.removeItem('customerName');
                localStorage.removeItem('customerId');
                localStorage.removeItem('sf-client-name');
                localStorage.removeItem('sf-client-id');
                localStorage.removeItem('sf-client-role');
                localStorage.removeItem('sf-client-session');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
            } catch (e) {
                // ignore storage errors
            }
            try {
                window.location.href = '/frontend/login.html';
            } catch (e) {
                window.location.href = 'login.html';
            }
        };
    }
})();
