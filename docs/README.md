# SnackForest - GitHub Pages 部署說明

## 🌟 線上展示
訪問：[https://lk26129226creator.github.io/snackforest----/](https://lk26129226creator.github.io/snackforest----/)

## 📁 檔案結構
```
docs/                    # GitHub Pages 專用資料夾
├── index.html          # 主頁面
├── cart.html           # 購物車頁面
├── style.css           # 樣式表
├── main.js             # 主要功能腳本
└── demo-data.js        # 模擬商品資料
```

## 🚀 部署步驟

### 1. 推送到 GitHub
```bash
git add docs/
git commit -m "新增 GitHub Pages 版本"
git push origin main
```

### 2. 啟用 GitHub Pages
1. 到 GitHub 專案頁面
2. 點擊 **Settings**
3. 滾動到 **Pages** 部分
4. 在 **Source** 選擇 **Deploy from a branch**
5. 選擇分支：**main**
6. 選擇資料夾：**/docs**
7. 點擊 **Save**

### 3. 訪問網站
等待 1-2 分鐘後，您的網站將在以下網址可用：
```
https://lk26129226creator.github.io/snackforest----/
```

## ✨ 功能特色

### 🛍️ 商品展示
- 響應式商品網格
- 類別篩選功能
- 商品搜尋功能
- 美觀的商品卡片設計

### 🛒 購物車功能
- 加入/移除商品
- 數量調整
- 購物車徽章顯示
- 本地儲存購物車狀態

### 🎨 使用者介面
- 現代化響應式設計
- Bootstrap 5 UI 框架
- 自訂 CSS 樣式
- 流暢的動畫效果

## 🔧 技術實現

### 前端技術
- **HTML5** - 語義化標記
- **CSS3** - 現代化樣式，CSS Grid & Flexbox
- **JavaScript (ES6+)** - 原生 JavaScript，無框架依賴
- **Bootstrap 5** - 響應式 UI 框架
- **Local Storage** - 購物車狀態持久化

### 資料模擬
由於 GitHub Pages 僅支援靜態網站，我們使用 `demo-data.js` 模擬後端 API：
- 模擬商品資料
- 模擬類別資料
- 模擬 API 呼叫延遲

## 📱 響應式支援
- **桌面** (≥992px) - 多欄商品網格
- **平板** (768px-991px) - 適中商品網格
- **手機** (≤767px) - 單欄佈局

## 🔗 與完整版本的差異

| 功能 | GitHub Pages 版本 | 完整版本 |
|------|-------------------|----------|
| 商品展示 | ✅ 靜態模擬資料 | ✅ 動態資料庫 |
| 購物車 | ✅ 前端功能 | ✅ 完整功能 |
| 用戶登入 | ❌ 僅展示 | ✅ 完整驗證 |
| 訂單處理 | ❌ 僅展示 | ✅ 資料庫存儲 |
| 商品管理 | ❌ 無後台 | ✅ 完整後台 |
| 圖片上傳 | ❌ 靜態圖片 | ✅ 動態上傳 |

## 🛠️ 本地開發

如果要在本地預覽 GitHub Pages 版本：

```bash
# 使用 Python 啟動簡單伺服器
cd docs
python -m http.server 8080

# 或使用 Node.js
npx serve .

# 然後訪問 http://localhost:8080
```

## 📝 注意事項

1. **僅限展示用途** - 這是前端展示版本，無法進行真實的電商交易
2. **資料不持久** - 除了購物車外，其他資料重新載入後會重置
3. **無後端整合** - 無法連接真實的資料庫或後端服務

## 🚀 完整版本部署

要部署包含後端的完整版本，建議使用：
- **Heroku** - 免費方案適合小型專案
- **Railway** - 現代化部署平台
- **DigitalOcean App Platform** - 簡單易用
- **AWS** / **Google Cloud** - 企業級部署

## 📞 聯絡資訊

如需協助或有任何問題，請聯絡開發者。