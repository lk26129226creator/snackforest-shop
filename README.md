簡短 README - SnackForest 專案

概覽
-------
此專案包含一個以純 Java (com.sun.net.httpserver) 實作的後端，以及簡單靜態前端 (frontend 資料夾)。

重要位置
- backend/: Java server 與 DAO、model 等程式
- frontend/client/: 客戶端頁面（index.html、cart.html、client.js、cart.js）
- frontend/admin/: 管理端頁面（index.html、admin.js）

前端與後端 API
- GET /api/snackforest
  - 回傳 products、categories、orders 合併的 JSON 陣列，物件中會有 type 屬性指示來源（product/category/order）
- POST /api/order
  - 接受 JSON: { items: [{id, name, price, quantity}, ...], total, customerId? }
  - 回傳 JSON: { orderId: <number> }
- /api/products
  - POST: 新增商品 (JSON { ProductName, Price, CategoriesID }) -> 回傳 { id }
  - PUT: 更新商品 (JSON { id, ProductName, Price, Quantity }) 或 /api/products?id=ID
  - DELETE: 刪除商品，支援 /api/products/{id} 或 /api/products?id=ID
- /api/categories
  - POST: 新增分類 (JSON { categoryname }) -> 回傳 { id }
  - DELETE: 刪除分類，支援 /api/categories/{id} 或 /api/categories?id=ID

如何在 Windows 本機執行 (簡短)
1. 確認已安裝 Java（建議 Java 11+）與 MySQL
2. 在 backend 資料夾下編譯並執行 server：

# 在 PowerShell 範例 (請在 workspace/backend 路徑執行)
# compile (假設已在 backend/bin 有 .class 或用 javac 編譯 src)：
# 如果有 build 流程就用那個，這裡以直接執行 jar/class 為例
java -cp .;bin;lib/* Server

3. 開啟瀏覽器：
- 客戶端：frontend/client/index.html
- 購物車：frontend/client/cart.html
- 管理端：frontend/admin/index.html

快速測試
- 開啟管理端：新增分類，再新增商品（選擇剛新增的分類），商品應出現在客戶端列表
- 客戶端：加入購物車 -> 前往購物車 -> 結帳 -> 檢查後端資料表 orders 與 order_details 是否新增

常見問題
- CORS：Server 已設定 Access-Control-Allow-Origin: * 在回傳 JSON 的 header，但若以 file:// 開啟前端仍有跨域問題，建議用簡單靜態伺服器（例如 VSCode Live Server）或將前端放在本地簡易 HTTP server

如果要我：
- 可以幫你把 `backend` 打包為可執行 jar，或建立一個啟動腳本
- 可以補上更完整的測試腳本或單元測試
- 可以改進後端以回傳更詳細的錯誤 JSON

已完成：新增 admin CRUD 與 client 改進、加入 /api/order

