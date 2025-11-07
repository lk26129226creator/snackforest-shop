//
//  SnackForest Admin 舊版載入器：提醒改用 main.js，並動態導向新版順序載入流程。
//
(function () {
    console.warn('[SnackForest] admin.js is deprecated. Loading main.js fallback.');
    const currentScript = document.currentScript;
    const base = currentScript ? currentScript.src.replace(/admin\.js(?:\?.*)?$/, '') : '';
    const script = document.createElement('script');
    script.src = base + 'main.js';
    script.async = false;
    document.head.appendChild(script);
})();
