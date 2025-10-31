// SnackForest client-side scripts are now split across multiple files under js/.
// This loader keeps backward compatibility for pages that still include main.js directly.
(function(){
    const files = [
        'js/env.js',
        'js/footer.js',
        'js/navigation.js',
        'js/utils.js',
        'js/session.js',
        'js/cart.js',
        'js/popover.js',
        'js/product-list.js',
        'js/product-detail.js',
        'js/cart-page.js',
        'js/home.js',
        'js/init.js'
    ];

    const currentScript = document.currentScript;
    const base = currentScript ? currentScript.src.replace(/main\.js(?:\?.*)?$/, '') : '';

    function loadScriptSequentially(list, index) {
        if (index >= list.length) return Promise.resolve();
        const path = list[index];
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = base + path;
            script.async = false;
            script.onload = () => resolve(loadScriptSequentially(list, index + 1));
            script.onerror = () => reject(new Error('Failed to load script ' + path));
            document.head.appendChild(script);
        });
    }

    loadScriptSequentially(files, 0).catch((err) => {
        console.error('[SnackForest] main.js fallback loader failed:', err);
    });
})();