//
//  管理後台環境設定：
//    - 統一定義 API 端點、常數與預設資料。
//    - 初始化 Admin.state 儲存全域狀態。
//
(function (window) {
    const Admin = window.SFAdmin || (window.SFAdmin = {});

    const config = Admin.config || {};

    const API_ORIGIN = (() => {
        try {
            const protocol = window.location?.protocol || 'http:';
            const hostname = window.location?.hostname || 'localhost';
            const port = 8000;
            return `${protocol}//${hostname}:${port}`;
        } catch (_) {
            return 'http://localhost:8000';
        }
    })();

    config.API_BASE_URL = `${API_ORIGIN}/api`;
    // API 路徑集中於 config.endpoints，方便其他模組復用。
    config.endpoints = {
        product: `${config.API_BASE_URL}/products`,
        category: `${config.API_BASE_URL}/categories`,
        order: `${config.API_BASE_URL}/order`,
        imageUpload: `${config.API_BASE_URL}/upload/image`,
        imageDelete: `${config.API_BASE_URL}/upload/image/delete`,
        carousel: `${config.API_BASE_URL}/carousel`,
        siteConfig: `${config.API_BASE_URL}/site-config`
    };
    config.IMAGE_PLACEHOLDER_DATAURI = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" fill="#bbb" font-size="14">無圖</text></svg>');
    config.CAROUSEL_KEY = 'sf_carousel_slides';
    config.DEFAULT_SECTION = 'dashboard-section';
    config.SECTION_NAV_MAP = {
        'dashboard-section': 'nav-dashboard',
        'products-section': 'nav-products',
        'categories-section': 'nav-categories',
        'orders-section': 'nav-orders',
        'carousel-section': 'nav-carousel',
        'site-section': 'nav-site'
    };
    config.SIDEBAR_BREAKPOINT = 992;
    config.MAX_IMAGES = 10;
    config.VISIBLE_THUMBS = 5;

    // 當後端尚未設定站台資訊時，提供預設輸出以避免界面空白。
    config.DEFAULT_SITE_CONFIG = {
        hero: {
            title: '探索世界零食的靈感地圖',
            subtitle: '精挑細選、快速到貨、安心付款。從人氣熱銷到限時新品，一鍵帶你吃遍全球風味。',
            imageUrl: '/frontend/images/products/3f762ad0-97b0-46a8-9bfc-df3561fd2662.png',
            primaryText: '開始購物',
            primaryLink: 'product.html',
            secondaryText: '逛逛全部',
            secondaryLink: 'product.html?category=all'
        },
        benefits: [
            { icon: 'truck-fast', title: '快速到貨', desc: '下單 24 小時內出貨' },
            { icon: 'shield-halved', title: '安全付款', desc: '多元支付、SSL 安全' },
            { icon: 'arrows-rotate', title: '七日鑑賞', desc: '不滿意可退換' },
            { icon: 'gift', title: '會員回饋', desc: '點數折抵更划算' }
        ],
        featuredProductIds: [],
        promotions: [
            { text: '全館滿 NT$999 免運', link: 'product.html' },
            { text: '加入會員立即享 95 折優惠', link: 'member.html' },
            { text: '最新上架零食！把握限量好味道', link: 'product.html?category=all' }
        ],
        support: {
            email: 'snackforest1688@gmail.com',
            phone: '0909-585-898',
            hours: '週一至週五 09:00 - 18:00',
            liveChatUrl: '',
            liveChatLabel: ''
        },
        footer: {
            text: '© 2025 SnackForest. 保留所有權利。'
        }
    };

    Admin.config = config;

    // 初始化全域 state，供資料快取、模態視窗與 carousel 等模組共用。
    const state = Admin.state || {};
    state.allProducts = [];
    state.allCategories = [];
    state.allOrders = [];
    state.modals = {
        editProduct: null,
        editCategory: null,
        imageView: null
    };
    state.newProductImages = [];
    state.editProductImages = [];
    state.imageViewer = { images: [], current: 0, blobUrls: [], rendered: [], thumbWindowStart: 0 };
    state.carousel = { slides: [], dirty: false, busy: false, loading: false };
    state.siteConfig = {
        data: null,
        original: null,
        // 逐一標記各區段是否有異動，方便決定是否需要儲存。
        dirty: { hero: false, benefits: false, featured: false, promotions: false, support: false, footer: false },
        loading: false,
        saving: false,
        bound: false
    };
    state.activeSection = config.DEFAULT_SECTION;
    state.sidebarResizeBound = false;
    state.cacheMeta = {
        products: 0,
        categories: 0,
        orders: 0
    };

    Admin.state = state;
})(window);
