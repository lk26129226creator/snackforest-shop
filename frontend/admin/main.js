(function () {
    const files = [
    'js/env.js',
    'js/core.js',
    'js/utils.js',
        'js/images.js',
        'js/viewer.js',
        'js/carousel.js',
        'js/site-config.js',
        'js/products.js',
        'js/categories.js',
        'js/orders.js',
        'js/dashboard.js',
        'js/data.js',
        'js/navigation.js',
        'js/init.js'
    ];

    const currentScript = document.currentScript;
    const base = currentScript ? currentScript.src.replace(/main\.js(?:\?.*)?$/, '') : '';

    function loadSequential(list, index) {
        if (index >= list.length) return Promise.resolve();
        const path = list[index];
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = base + path;
            script.async = false;
            script.onload = () => resolve(loadSequential(list, index + 1));
            script.onerror = () => reject(new Error('Failed to load script ' + path));
            document.head.appendChild(script);
        });
    }

    loadSequential(files, 0).catch((err) => {
        console.error('[SnackForest] admin main loader failed:', err);
    });
})();
