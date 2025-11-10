(function () {
    //
    //  Admin 主 loader：維持舊版 admin/index.html 直接載入 main.js 的相容性，
    //  依序注入模組以建立全域命名空間與依賴。
    //
    const files = [
        '../client/js/utils.js',
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

    /**
     * 依序載入 Admin 模組腳本，確保全域依賴準備完成。
     * @param {string[]} list 需載入的腳本列表。
     * @param {number} index 當前載入的索引。
     * @returns {Promise<void>} 全部載入完成後 resolve。
     */
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
