# UX/CSS Audit — frontend/client

檢查時間：2025-11-24
分支：`feat/uiux-upgrade-client`

## 目標
- 整體提升 `frontend/client` 的 UI/UX 質感（桌面 + 行動）
- 抽出 design tokens（色票、間距、字級、圓角、陰影）以便一致性管理
- 元件化常用樣式（按鈕、卡片、表單、導航）以減少重複
- 刪除未使用/重複規則，合併可共用的樣式檔

## 初步統計
- CSS 檔案：
  - `client.css` — 2023 行
  - `client.mobile.css` — 1022 行
  - `shared.css` — 193 行

- 主要可優化目標（由人工檢視與簡易搜尋得出）：
  - 常見選擇器分散定義：`.btn`, `.card`, `.client-main`, `.home-hero`, `.client-nav-cart-panel`, `.client-support-panel`, `.benefit`, `.product-grid`, `.category-grid`
  - 許多短宣告（display / position / border / background / padding）在不同檔案重複出現，可抽取共用基礎類別或元件。

## 發現（摘要）
- 頂端導覽列使用了 `.navbar .btn` 全域覆寫，導致下拉面板（購物車、客服）內的按鈕在白色背景上顯示不易讀（已做臨時修正）。
- `.client-main` 曾以 card 形式包住所有內容（白色背景、圓角、陰影），後來使用者要求移除，我已把原始卡片樣式清理並轉為 full-bleed 佈局。
- 商品頁 / cart / member 等頁面 HTML 皆存在 `frontend/client` 目錄，且已成功還原（若需再還原其它檔案可告知）。

## 建議的重構步驟（優先順序）
1. **建立 design tokens**（顏色、間距、圓角、陰影、字級）並統一放在 `frontend/client/css/_tokens.css` 或放在 `client.css` 頂端。
2. **按鈕系統重構**：建立 `.btn-primary`, `.btn-ghost`, `.btn-link` 等標準元件，取代分散的 `.btn` 覆寫。
3. **卡片、表單、列表元件化**：整理 `.card`, `.member-card`, `.summary-card` 的差異並合併共用屬性。
4. **導航與側欄**：把頂端 nav 與側欄的共用樣式抽成模組，確保行動版與桌面版行為一致。
5. **清理重複 CSS**：移除 `client.mobile.css` 與 `client.css` 中可合併的規則（優先以 media query + token 實現差異化），減少重複。
6. **無障礙與行動優化**：按鈕大小、點擊目標、對比度、focus 樣式、可讀性提升。
7. **逐步測試與截圖**：每個大型改動分成小 commit 並在本地測試。

## 第一個實作任務（我已開始）
- 建立 `frontend/client/css/_tokens.css`（將放主要色票、陰影、圓角與間距變數）
- 接下來會把 `client.css` 引入 tokens 並逐步把硬編碼替換為變數。

## 注意事項
- 我會把所有改動放在分支 `feat/uiux-upgrade-client`，不會直接改變 `main`；完成後會推上遠端並提供 PR 建議。
- 若你想保留目前某些字體或色票（或有設計偏好），請告知；否則我會以現有主要色票為基準微調以提升質感。


---

請回覆「繼續」我就會依照計畫開始建立 tokens，並把第一波按鈕樣式重構成可重用元件（小型、原子化的 commit）。
