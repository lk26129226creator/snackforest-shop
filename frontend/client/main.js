//
//  SnackForest 主 loader：維持舊版頁面引入 main.js 的相容性，
//  依序載入拆分在 js/ 目錄下的各個模組，避免同步依賴出現 race condition。
//
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

    /**
     * 逐檔載入腳本，確保模組依序執行避免全域依賴錯置。
     * @param {string[]} list 需載入的腳本相對路徑陣列。
     * @param {number} index 目前要載入的索引。
     * @returns {Promise<void>} 全部載入完成時解決的 Promise。
     */
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

    // 若任一腳本載入失敗，輸出明確錯誤方便偵錯舊版引用。
    loadScriptSequentially(files, 0).catch((err) => {
        console.error('[SnackForest] main.js fallback loader failed:', err);
    });
})();