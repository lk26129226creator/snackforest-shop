# SnackForest API 工具說明

## 📁 新增的檔案

### 1. `frontend/api.html`
完整的 API 測試和管理介面，包含：

- **🏥 健康檢查**: 檢查伺服器狀態
- **📦 商品管理**: 新增、修改、刪除、查詢商品
- **🏷️ 分類管理**: 新增、刪除、查詢分類
- **📊 訂單管理**: 查詢訂單、建立測試訂單
- **🔧 系統測試**: Ping 測試、資料庫測試

### 2. `frontend/js/api-manager.js`
可重用的 API 工具類，提供：

- **統一的 API 呼叫介面**
- **自動快取機制**
- **表格生成器**
- **錯誤處理**
- **便利方法**

### 3. `frontend/api-demo.html`
演示如何使用 API 工具類的範例頁面。

## 🚀 使用方法

### 方法 1: 完整管理介面
```
訪問: http://localhost:8000/frontend/api.html
用途: 完整的 API 測試和管理
```

### 方法 2: 在現有頁面中使用
```html
<!-- 引入 API 工具 -->
<script src="js/api-manager.js"></script>

<script>
// 快速載入表格
loadTable('/api/products', '#my-container');

// 使用 API 類
const result = await api.getProducts();
if (result.success) {
    console.log(result.data);
}
</script>
```

### 方法 3: 查看演示
```
訪問: http://localhost:8000/frontend/api-demo.html
用途: 學習如何整合到現有專案
```

## 🎯 主要功能

### ✅ 對您現有專案的輔助:

1. **快速測試 API**
   - 不需要在瀏覽器開發者工具中手動測試
   - 直觀的介面，一鍵測試所有端點

2. **資料管理**
   - 快速查看資料庫內容
   - 方便的新增、修改、刪除操作
   - 表格化顯示，便於閱讀

3. **開發除錯**
   - 清楚的錯誤訊息顯示
   - 即時的伺服器狀態監控
   - JSON 回應格式化顯示

4. **重用性**
   - `api-manager.js` 可以在任何頁面中使用
   - 統一的 API 呼叫方式
   - 內建快取機制提升效能

### 📋 API 端點覆蓋:

- ✅ `/ping` - 健康檢查
- ✅ `/api/products` - 商品 CRUD
- ✅ `/api/categories` - 分類 CRUD  
- ✅ `/api/order` - 訂單查詢和建立
- ✅ `/api/snackforest` - 綜合資料
- ✅ `/api/debug/db` - 資料庫除錯

## 🛠️ 進階用法

### 自訂表格顯示
```javascript
loadTable('/api/products', '#container', {
    excludeColumns: ['created_at'],           // 隱藏欄位
    customColumns: { 'ProductName': '商品名稱' }, // 自訂欄位名稱
    actions: [{                               // 新增操作按鈕
        text: '編輯',
        className: 'btn-primary btn-sm',
        onclick: 'editProduct({id})'
    }]
});
```

### 帶快取的資料載入
```javascript
// 第一次會呼叫 API，之後 5 分鐘內會使用快取
const products = await api.getProducts();

// 強制重新載入
const freshProducts = await api.loadWithCache('/api/products', true);
```

### 批次載入資料
```javascript
const allData = await api.loadAllBasicData();
console.log('商品:', allData.products);
console.log('分類:', allData.categories);
console.log('錯誤:', allData.errors);
```

## 🎉 效益

1. **提高開發效率** - 不需要手動在瀏覽器測試 API
2. **便於除錯** - 清楚的錯誤訊息和狀態顯示
3. **增強專案完整性** - 專業的管理介面
4. **未來擴展性** - 可重用的工具類
5. **使用者友善** - 直觀的操作介面

現在您有了完整的 API 管理工具，可以大大提升開發和測試的效率！