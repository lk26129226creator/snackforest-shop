/**
 * SnackForest API 管理工具類
 * 提供統一的 API 呼叫介面和資料載入功能
 */
class SnackForestAPI {
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
     * 通用 API 呼叫方法
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
     * 帶快取的資料載入
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
     * 系統健康檢查
     */
    async checkHealth() {
        return await this.apiCall('/ping');
    }

    /**
     * 商品相關 API
     */
    async getProducts() {
        return await this.loadWithCache('/api/products');
    }

    async getProduct(id) {
        return await this.apiCall(`/api/products/${id}`);
    }

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

    async deleteProduct(id) {
        const result = await this.apiCall(`/api/products/${id}`, 'DELETE');
        
        if (result.success) {
            this.clearCache('/api/products');
        }
        
        return result;
    }

    /**
     * 分類相關 API
     */
    async getCategories() {
        return await this.loadWithCache('/api/categories');
    }

    async addCategory(name) {
        const result = await this.apiCall('/api/categories', 'POST', {
            categoryname: name
        });
        
        if (result.success) {
            this.clearCache('/api/categories');
        }
        
        return result;
    }

    async deleteCategory(id) {
        const result = await this.apiCall(`/api/categories/${id}`, 'DELETE');
        
        if (result.success) {
            this.clearCache('/api/categories');
        }
        
        return result;
    }

    /**
     * 訂單相關 API
     */
    async getOrders() {
        return await this.apiCall('/api/order');
    }

    async createOrder(orderData) {
        return await this.apiCall('/api/order', 'POST', {
            items: orderData.items,
            total: orderData.total,
            customerId: orderData.customerId
        });
    }

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
     * 綜合資料載入
     */
    async getSnackforestData() {
        return await this.apiCall('/api/snackforest');
    }

    async getDbDebug() {
        return await this.apiCall('/api/debug/db');
    }

    /**
     * 便利方法：載入所有基本資料
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
     * 表格生成器
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
     * 清除快取
     */
    clearCache(endpoint = null) {
        if (endpoint) {
            this.cache.delete(endpoint);
        } else {
            this.cache.clear();
        }
    }

    /**
     * 批次載入資料並渲染到指定容器
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