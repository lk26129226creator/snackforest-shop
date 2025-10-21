# SnackForest Shop - Render 部署指南

## 📋 部署步驟

### 1. 準備資料庫
由於 Render 目前不直接提供 MySQL managed service，您需要選擇以下選項之一：

**選項 A: 使用 PlanetScale（推薦）**
1. 前往 [PlanetScale](https://planetscale.com/)
2. 創建免費帳戶並建立新資料庫
3. 獲取連線字串（格式：mysql://username:password@host/database）

**選項 B: 使用 ClearDB（Heroku 插件，也支援其他平台）**
1. 前往 [ClearDB](https://www.cleardb.com/)
2. 選擇適合的方案並創建 MySQL 實例

**選項 C: 使用 AWS RDS 或其他雲端 MySQL**
1. 在您偏好的雲端平台建立 MySQL 實例
2. 確保允許外部連線

### 2. 在 Render 建立 Web Service

1. **登入 Render**
   - 前往 [render.com](https://render.com)
   - 登入或建立帳戶

2. **建立新服務**
   - 點擊 "New +" → "Web Service"
   - 選擇 "Build and deploy from a Git repository"

3. **連接 Git Repository**
   - 連接您的 GitHub 帳戶
   - 選擇 `snackforest----` repository
   - 選擇 `main` 分支

4. **配置服務設定**
   ```
   Name: snackforest-shop
   Region: 選擇離您最近的區域
   Branch: main
   Root Directory: 留空（使用根目錄）
   Environment: Docker
   Build Command: 留空（Docker 會自動構建）
   Start Command: 留空（使用 Dockerfile 的 CMD）
   ```

5. **設定環境變數**
   在 "Environment Variables" 區域添加：
   ```
   DB_HOST=<您的資料庫主機>
   DB_PORT=3306
   DB_NAME=<您的資料庫名稱>
   DB_USER=<您的資料庫使用者>
   DB_PASSWORD=<您的資料庫密碼>
   ```

6. **選擇方案**
   - Free: 適合測試，有一些限制
   - Starter ($7/月): 生產使用推薦

7. **部署**
   - 點擊 "Create Web Service"
   - Render 會自動開始構建和部署

### 3. 監控部署

1. **查看建構日誌**
   - 在服務頁面可以看到即時的建構過程
   - 確認 Docker 映像建構成功

2. **檢查部署狀態**
   - 部署完成後，服務狀態應顯示為 "Live"
   - 您會獲得一個 `.onrender.com` 的網址

3. **測試應用程式**
   ```
   https://your-app-name.onrender.com/ping
   https://your-app-name.onrender.com/frontend/client/index.html
   ```

## 🔧 環境變數範例

### PlanetScale 範例
```
DB_HOST=aws.connect.psdb.cloud
DB_PORT=3306
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

### ClearDB 範例
```
DB_HOST=us-cdbr-east-06.cleardb.net
DB_PORT=3306
DB_NAME=heroku_database_name
DB_USER=username
DB_PASSWORD=password
```

## 🚨 常見問題

### 建構失敗
- 檢查 Dockerfile 語法
- 確認所有必要檔案都在 Git repository 中

### 應用啟動失敗
- 檢查環境變數是否正確設定
- 檢查資料庫連線是否正常
- 查看 Render 的服務日誌

### 健康檢查失敗
- 確認 `/ping` 端點正常回應
- 檢查伺服器是否在端口 8000 上運行

## 📝 部署後設定

1. **自訂域名**（可選）
   - 在 Render 控制台中設定自訂域名
   - 配置 DNS 記錄

2. **SSL/HTTPS**
   - Render 自動提供 SSL 憑證
   - 無需額外設定

3. **監控與日誌**
   - 使用 Render 內建的監控工具
   - 查看即時日誌和效能指標

## 🎯 快速部署清單

- [ ] 準備資料庫服務（PlanetScale/ClearDB/RDS）
- [ ] 推送代碼到 GitHub
- [ ] 在 Render 建立 Web Service
- [ ] 設定環境變數
- [ ] 等待部署完成
- [ ] 測試 `/ping` 端點
- [ ] 測試前端頁面
- [ ] 設定自訂域名（可選）

## 💰 費用估算

- **免費方案**: $0/月（有限制）
- **Starter 方案**: $7/月（推薦生產使用）
- **資料庫**: 
  - PlanetScale: 免費方案可用
  - ClearDB: 約 $9.99/月起
  - AWS RDS: 依用量計費

總計約 $7-20/月 for 完整生產環境。