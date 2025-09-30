Testing 指南 - SnackForest

預備條件
- Windows + PowerShell
- 已安裝 Java (11+)
- 已安裝並啟動 MySQL，且 backend/src/DBConnect.java 中的連線字串指向正確的資料庫

1) 在 backend 啟動 server (PowerShell 範例)
cd "c:\java專案\snackforest商店專案\backend"
# 執行 server（依你的編譯狀態調整 classpath）
java -cp .;bin;lib/* Server

2) 用 curl 測試 API (PowerShell)
# 取得所有資源
curl http://localhost:8000/api/snackforest

# 建立分類
curl -X POST http://localhost:8000/api/categories -H "Content-Type: application/json" -d '{"categoryname":"新分類"}'

# 建立商品 (假設 CategoriesID=1)
curl -X POST http://localhost:8000/api/products -H "Content-Type: application/json" -d '{"ProductName":"測試商品","Price":100,"CategoriesID":1}'

# DELETE 商品
curl -X DELETE http://localhost:8000/api/products/123

# POST 訂單
curl -X POST http://localhost:8000/api/order -H "Content-Type: application/json" -d '{"items":[{"id":1,"name":"測試商品","price":100,"quantity":2}],"total":200}'

3) 前端驗證
- 用 VSCode Live Server 或直接開啟 `frontend/client/index.html` 與 `frontend/admin/index.html`（若有 CORS 問題請使用 Live Server）

若需要，我可以把一個小的 PowerShell 腳本放在 repo，用來啟動 server 與驗證 API。