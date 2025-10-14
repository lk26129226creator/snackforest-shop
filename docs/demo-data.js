// 模擬商品資料 (取代後端 API)
const DEMO_PRODUCTS = [
    {
        id: 1,
        ProductName: "巧克力餅乾",
        Price: 89,
        Quantity: 50,
        CategoriesID: 1,
        category: "餅乾",
        ImagePath: "https://via.placeholder.com/300x200?text=巧克力餅乾"
    },
    {
        id: 2,
        ProductName: "草莓軟糖",
        Price: 45,
        Quantity: 30,
        CategoriesID: 2,
        category: "糖果",
        ImagePath: "https://via.placeholder.com/300x200?text=草莓軟糖"
    },
    {
        id: 3,
        ProductName: "綜合堅果",
        Price: 120,
        Quantity: 25,
        CategoriesID: 3,
        category: "堅果",
        ImagePath: "https://via.placeholder.com/300x200?text=綜合堅果"
    },
    {
        id: 4,
        ProductName: "檸檬汽水",
        Price: 35,
        Quantity: 100,
        CategoriesID: 4,
        category: "飲料",
        ImagePath: "https://via.placeholder.com/300x200?text=檸檬汽水"
    },
    {
        id: 5,
        ProductName: "芝麻餅乾",
        Price: 78,
        Quantity: 40,
        CategoriesID: 1,
        category: "餅乾",
        ImagePath: "https://via.placeholder.com/300x200?text=芝麻餅乾"
    },
    {
        id: 6,
        ProductName: "水果軟糖",
        Price: 52,
        Quantity: 35,
        CategoriesID: 2,
        category: "糖果",
        ImagePath: "https://via.placeholder.com/300x200?text=水果軟糖"
    }
];

const DEMO_CATEGORIES = [
    { id: 1, categoryname: "餅乾" },
    { id: 2, categoryname: "糖果" },
    { id: 3, categoryname: "堅果" },
    { id: 4, categoryname: "飲料" }
];

// 模擬 API 函數
window.DEMO_MODE = true;

// 覆寫 API 呼叫
window.mockApiCall = function(endpoint, options = {}) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (endpoint.includes('/api/products')) {
                resolve({ ok: true, json: () => Promise.resolve(DEMO_PRODUCTS) });
            } else if (endpoint.includes('/api/categories')) {
                resolve({ ok: true, json: () => Promise.resolve(DEMO_CATEGORIES) });
            } else {
                resolve({ ok: true, json: () => Promise.resolve([]) });
            }
        }, 100); // 模擬網路延遲
    });
};