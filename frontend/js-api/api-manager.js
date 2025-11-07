/**
 * SnackForest API 管理工具類
 * 提供統一的 API 呼叫介面和資料載入功能
 */
class SnackForestAPI {
    /**
     * @param {string} [baseURL] 自訂 API 基底路徑；若未提供則自動偵測。
     */
    constructor(baseURL = '') {
        // 自動偵測後端 API 位置：
        // - 若目前頁面不是跑在 8000 連接埠（例如 Live Server 的 5500/5501），
        //   則預設走 http://localhost:8000 作為 API 伺服器；
        // - 也可透過 window.SF_API_BASE 進行覆寫。
        const on8000 = (typeof window !== 'undefined' && window.location && window.location.port === '8000');
        const detected = on8000 ? '' : 'http://localhost:8000';
        this.baseURL = baseURL || (typeof window !== 'undefined' && window.SF_API_BASE) || detected;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分鐘快取
    }

    /**
     * 通用 API 呼叫方法。
     * @param {string} endpoint API 路徑或絕對網址。
     * @param {string} [method='GET'] HTTP 方法。
     * @param {object|null} [data=null] 需送出的 JSON 主體。
     * @param {RequestInit} [options={}] 額外 fetch 設定，例如 headers。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async apiCall(endpoint, method = 'GET', data = null, options = {}) {
        try {
            // 若 endpoint 已是絕對網址，直接使用；否則以 baseURL 拼接
            const url = /^(https?:)?\/\//i.test(endpoint)
                ? endpoint
                : `${this.baseURL}${endpoint}`;
            const config = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return {
                success: true,
                status: response.status,
                data: result
            };

        } catch (error) {
            console.error(`API 呼叫失敗 [${method} ${endpoint}]:`, error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 以簡易記憶體快取取得資料，並在逾時或強制刷新時重新呼叫 API。
     * @param {string} endpoint API 路徑或絕對網址。
     * @param {boolean} [forceRefresh=false] 是否忽略快取重新抓取。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async loadWithCache(endpoint, forceRefresh = false) {
        const cacheKey = endpoint;
        const cached = this.cache.get(cacheKey);
        
        if (!forceRefresh && cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
            return cached.data;
        }

        const result = await this.apiCall(endpoint);
        if (result.success) {
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }
        
        return result;
    }

    /**
     * 查詢系統健康狀態（/ping）。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async checkHealth() {
        return await this.apiCall('/ping');
    }

    /**
     * 取得所有商品清單（含快取機制）。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getProducts() {
        return await this.loadWithCache('/api/products');
    }

    /**
     * 依商品編號取得單一商品。
     * @param {string|number} id 商品 ID。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getProduct(id) {
        return await this.apiCall(`/api/products/${id}`);
    }

    /**
     * 新增商品後清除快取。
     * @param {{name: string, price: number, categoryId: string|number}} productData 商品資料。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async addProduct(productData) {
        const result = await this.apiCall('/api/products', 'POST', {
            ProductName: productData.name,
            Price: productData.price,
            CategoriesID: productData.categoryId
        });
        
        if (result.success) {
            this.clearCache('/api/products'); // 清除快取
        }
        
        return result;
    }

    /**
     * 更新商品資料後清除列表快取。
     * @param {string|number} id 商品 ID。
     * @param {{name: string, price: number, categoryId: string|number}} productData 商品資料。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async updateProduct(id, productData) {
        const result = await this.apiCall(`/api/products?id=${id}`, 'PUT', {
            id: id,
            name: productData.name,
            price: productData.price,
            categoryId: productData.categoryId
        });
        
        if (result.success) {
            this.clearCache('/api/products');
        }
        
        return result;
    }

    /**
     * 刪除指定商品並刷新快取。
     * @param {string|number} id 商品 ID。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async deleteProduct(id) {
        const result = await this.apiCall(`/api/products/${id}`, 'DELETE');
        
        if (result.success) {
            this.clearCache('/api/products');
        }
        
        return result;
    }

    /**
     * 取得商品分類資料（含快取）。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getCategories() {
        return await this.loadWithCache('/api/categories');
    }

    /**
     * 新增分類並清除相關快取。
     * @param {string} name 類別名稱。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async addCategory(name) {
        const result = await this.apiCall('/api/categories', 'POST', {
            categoryname: name
        });
        
        if (result.success) {
            this.clearCache('/api/categories');
        }
        
        return result;
    }

    /**
     * 刪除分類並刷新快取。
     * @param {string|number} id 類別 ID。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async deleteCategory(id) {
        const result = await this.apiCall(`/api/categories/${id}`, 'DELETE');
        
        if (result.success) {
            this.clearCache('/api/categories');
        }
        
        return result;
    }

    /**
     * 取得所有訂單資料。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getOrders() {
        return await this.apiCall('/api/order');
    }

    /**
     * 建立新訂單。
     * @param {{items: Array, total: number, customerId: string|number}} orderData 訂單內容。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async createOrder(orderData) {
        return await this.apiCall('/api/order', 'POST', {
            items: orderData.items,
            total: orderData.total,
            customerId: orderData.customerId
        });
    }

    /**
     * 取得顧客檔案資訊。
     * @param {string|number} customerId 顧客 ID。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getCustomerProfile(customerId) {
        if (customerId == null || customerId === '') {
            return {
                success: false,
                error: '缺少顧客編號',
                data: null
            };
        }
        return await this.apiCall(`/api/customer-profile/${customerId}`);
    }

    /**
     * 更新顧客檔案。
     * @param {object} profileData 顧客資料物件，需包含 customerId。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async updateCustomerProfile(profileData) {
        if (!profileData || typeof profileData !== 'object') {
            return {
                success: false,
                error: '缺少更新資料',
                data: null
            };
        }
        const customerId = profileData.customerId ?? profileData.id ?? profileData.customerID;
        if (customerId == null || customerId === '') {
            return {
                success: false,
                error: '缺少顧客編號',
                data: null
            };
        }
        return await this.apiCall(`/api/customer-profile/${customerId}`, 'PUT', profileData);
    }

    /**
     * 取得 snackforest 綜合資料。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getSnackforestData() {
        return await this.apiCall('/api/snackforest');
    }

    /**
     * 查詢資料庫偵錯資訊。
     * @returns {Promise<{success: boolean, status?: number, data: any, error?: string}>}
     */
    async getDbDebug() {
        return await this.apiCall('/api/debug/db');
    }

    /**
     * 平行載入商品與分類，回傳整理後的結果物件。
     * @returns {Promise<{products: Array, categories: Array, errors: {products: string|null, categories: string|null}}>} 
     */
    async loadAllBasicData() {
        const [products, categories] = await Promise.all([
            this.getProducts(),
            this.getCategories()
        ]);

        return {
            products: products.success ? products.data : [],
            categories: categories.success ? categories.data : [],
            errors: {
                products: products.success ? null : products.error,
                categories: categories.success ? null : categories.error
            }
        };
    }

    /**
     * 將陣列資料轉為 HTML 表格結構字串。
     * @param {Array<object>} data 列表資料。
     * @param {{className?: string, excludeColumns?: string[], customColumns?: object, actions?: Array<{className: string, onclick: string, text: string}>}} [options={}] 顯示選項。
     * @returns {string}
     */
    generateTable(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return '<p>無資料</p>';
        }

        const {
            className = 'api-table',
            excludeColumns = [],
            customColumns = {},
            actions = []
        } = options;

        const headers = Object.keys(data[0]).filter(key => !excludeColumns.includes(key));
        
        let tableHTML = `<table class="${className}">`;
        
        // 標題行
        tableHTML += '<thead><tr>';
        headers.forEach(header => {
            const displayName = customColumns[header] || header;
            tableHTML += `<th>${displayName}</th>`;
        });
        if (actions.length > 0) {
            tableHTML += '<th>操作</th>';
        }
        tableHTML += '</tr></thead>';
        
        // 資料行
        tableHTML += '<tbody>';
        data.forEach(item => {
            tableHTML += '<tr>';
            headers.forEach(header => {
                let value = item[header];
                if (value === null || value === undefined) value = '';
                tableHTML += `<td>${value}</td>`;
            });
            
            if (actions.length > 0) {
                tableHTML += '<td>';
                actions.forEach(action => {
                    tableHTML += `<button class="btn btn-sm ${action.className}" onclick="${action.onclick.replace('{id}', item.id || item.ID)}">${action.text}</button> `;
                });
                tableHTML += '</td>';
            }
            
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';
        
        return tableHTML;
    }

    /**
     * 清除快取，可指定單一路徑或全部清空。
     * @param {string|null} [endpoint=null] 要移除的快取 key。
     * @returns {void}
     */
    clearCache(endpoint = null) {
        if (endpoint) {
            this.cache.delete(endpoint);
        } else {
            this.cache.clear();
        }
    }

    /**
     * 呼叫 API 後將結果渲染為表格並塞入指定容器。
     * @param {string} endpoint API 路徑或絕對網址。
     * @param {string} containerSelector 目標容器的查詢選擇器。
     * @param {{className?: string, excludeColumns?: string[], customColumns?: object, actions?: Array<{className: string, onclick: string, text: string}>}} [options={}] 表格渲染設定。
     * @returns {Promise<void>}
     */
    async loadTable(endpoint, containerSelector, options = {}) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.error(`容器 ${containerSelector} 不存在`);
            return;
        }

        // 顯示載入狀態
        container.innerHTML = '<div class="loading">載入中...</div>';

        try {
            const result = await this.apiCall(endpoint);
            
            if (result.success && Array.isArray(result.data)) {
                const tableHTML = this.generateTable(result.data, options);
                container.innerHTML = `
                    <div class="table-header">
                        <span class="status-success">✅ 載入成功 (${result.data.length} 筆資料)</span>
                        <button class="btn btn-sm" onclick="api.loadTable('${endpoint}', '${containerSelector}', ${JSON.stringify(options).replace(/"/g, '&quot;')})">🔄 重新載入</button>
                    </div>
                    ${tableHTML}
                `;
            } else if (result.success) {
                container.innerHTML = `
                    <div class="response-json">${JSON.stringify(result.data, null, 2)}</div>
                `;
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            container.innerHTML = `
                <div class="status-error">❌ 載入失敗: ${error.message}</div>
                <button class="btn btn-sm" onclick="api.loadTable('${endpoint}', '${containerSelector}', ${JSON.stringify(options).replace(/"/g, '&quot;')})">🔄 重試</button>
            `;
        }
    }
}

// 建立全域實例
window.api = new SnackForestAPI();

// 便利函數
window.loadTable = (endpoint, containerSelector, options = {}) => {
    return window.api.loadTable(endpoint, containerSelector, options);
};

// 匯出模組（如果在模組環境中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnackForestAPI;
}