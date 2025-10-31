// SnackForest admin legacy loader. Please include main.js instead.
(function () {
    console.warn('[SnackForest] admin.js is deprecated. Loading main.js fallback.');
    const currentScript = document.currentScript;
    const base = currentScript ? currentScript.src.replace(/admin\.js(?:\?.*)?$/, '') : '';
    const script = document.createElement('script');
    script.src = base + 'main.js';
    script.async = false;
    document.head.appendChild(script);
})();
