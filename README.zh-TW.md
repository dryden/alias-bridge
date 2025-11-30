# Alias Bridge（電子郵件別名橋接擴充功能）

Alias Bridge 是一款為隱私而生的 Chrome 擴充功能，用來在瀏覽器中快速產生、填入並管理電子郵件別名，特別針對 Addy.io（原 AnonAddy）服務設計。它讓你在註冊網站帳號時，不必暴露真實信箱，就能方便地使用一次性或別名信箱。

> **注意**：本專案目前以 Addy.io 為主要後端服務，並搭配 Polar.sh 用於付費授權驗證。

---

## 功能特色

- **即時產生別名**
  - 直接從擴充功能彈出視窗產生別名。
  - 支援多種格式：UUID、隨機字串、依網站網域、客製化規則（Pro）。

- **自動偵測與一鍵填入**
  - 在網頁上的 `email` 輸入框旁自動插入 Alias Bridge 小圖示。
  - 點擊圖示即可產生並填入別名，同時自動複製到剪貼簿。
  - 也支援從彈出視窗選擇「Copy & Fill」。

- **隱私優先**
  - Addy.io API Token 儲存在瀏覽器本機（Chrome extension storage / localStorage），不會上傳到自家伺服器。
  - 內容指令碼只會讀取目前分頁的網址與 email 欄位，不會讀取你的信件內容或密碼。

- **智慧情境建議**
  - 依目前網站網域產生具語意的別名，例如：  
    `netflix@your-username.anonaddy.com` 或 `google@your-custom-domain.com`。

- **Pro 功能（授權啟用）**
  - 進階「網域型」與「自訂規則」別名格式。
  - 可設定前綴／後綴，支援日期、時間、隨機字串、UUID、自訂文字等組合。
  - 授權金鑰透過 Polar.sh API 驗證。

---

## 專案結構

根目錄下的主要資料夾：

- `extension/`：Chrome 擴充功能前端程式碼（React + Vite）。

- `README.md`：原始英文簡介。
- `PRIVACY-POLICY.md`：英文隱私權條款。
- `TERMS-OF-USE.md`：英文使用條款。

---

## 安裝與建置

### 1. 取得原始碼或發佈檔

```bash
git clone https://github.com/your-name/alias-bridge.git
cd alias-bridge
```

或下載專案 ZIP 解壓縮。

### 2. 建置 Chrome 擴充功能

```bash
cd extension
npm install
npm run build
```

Vite 會在 `extension/dist` 產生可載入的打包結果。

### 3. 在 Chrome 載入擴充功能

1. 開啟 Chrome，進入 `chrome://extensions`.
2. 開啟右上角 **開發人員模式**。
3. 點選 **載入未封裝項目（Load unpacked）**。
4. 選取 `extension/dist` 資料夾。

載入成功後，應該可以在工具列看到 Alias Bridge 的圖示。

---

## 使用說明

### 1. 初始設定：連結 Addy.io

1. 點擊瀏覽器工具列中的 Alias Bridge 圖示。
2. 進入 **Settings / 設定**（齒輪圖示）。
3. 在「Addy.io Configuration」區塊輸入你的 **Addy.io API Token**。
4. 按下「Verify」驗證，成功後會顯示帳號名稱與可用網域。

設定完成後，擴充功能會：

- 從 Addy.io 讀取你的帳號資訊與可用網域（含自訂網域與 username 子網域）。
- 將 Token 與帳號快取資訊儲存在本機的 `chrome.storage.local`。

### 2. 在彈出視窗中產生別名

1. 在任一網站上點擊 Alias Bridge 圖示。
2. 選擇：
   - 別名格式：`UUID` / `Random` / `Domain` / `Custom`（Pro）。
   - 預設網域或子網域（例如 `yourname.anonaddy.com` 或自訂網域）。
3. 點選「Copy & Fill」：
   - 別名會複製到剪貼簿。
   - 若有對應的 email 欄位，則會嘗試自動填入。

### 3. 在網頁欄位內一鍵產生

內容指令碼 `content.ts` 會：

- 偵測頁面上所有 `input[type="email"]` 欄位。
- 在欄位旁邊插入一個 Alias Bridge 小圖示（使用 `icon-16.png`）。
- 當你點擊圖示時：
  - 從 `chrome.storage.local` 讀取 Addy.io 帳號與預設格式、規則與網域。
  - 呼叫 `generateAlias`（`src/lib/aliasGenerator.ts`）產生別名。
  - 將別名填入該欄位並觸發相關事件（`input` / `change`）。
  - 同時將別名複製到剪貼簿並短暫顯示按鈕顏色變化作為回饋。

若你尚未在設定頁輸入 Addy.io Token，內容指令碼不會啟用自動插入功能。

### 4. Pro 授權與進階規則

設定頁中的「License」區塊支援輸入 Pro 授權金鑰：

- 輸入授權金鑰後按下「Verify」。
- 擴充功能會透過 `verifyLicense`（`src/services/license.ts`）呼叫 Polar.sh API（或你的 backend）進行驗證。
- 驗證通過後：
  - `isPro` 會儲存在 `chrome.storage.local`。
  - 解鎖進階格式：`Domain` 與 `Custom`。
  - 可以設定前綴與後綴規則（日期、時間、隨機、UUID、自訂文字等）。

> 開發模式中，程式碼內含有 `TEST_PRO` 測試用金鑰，用於本機開發模擬 Pro 狀態，請勿在正式環境使用。

---

## 架構與主要程式碼

- `extension/src/lib/aliasGenerator.ts`
  - 核心別名產生邏輯。
  - 支援多種別名類型與客製化規則。

- `extension/src/lib/domain.ts`
  - 解析目前網址的網域名稱，將 `https://www.example.com` 轉成 `example` 之類的 slug。

- `extension/src/services/addy.ts`
  - 與 Addy.io API 溝通：
    - 驗證 Token。
    - 取得帳號資訊、追加帳號（usernames）、自訂網域。
    - 根據主帳號與追加帳號組合出各種 `username.domain` 型式。

- `extension/src/services/license.ts`
  - 與 Polar.sh 的授權 API 溝通。
  - 使用 `chrome.storage.local` 或 `localStorage` 建立本機唯一安裝 ID。
  - 回傳授權是否有效與方案名稱（例如 `pro`）。

- `extension/src/content.ts`
  - 內容指令碼，在所有網站上運行。
  - 偵測 email 欄位並注入按鈕，負責與別名產生邏輯串接。

- `extension/src/SettingsPage.tsx`
  - 設定頁 UI（React），包含：
    - Addy.io Token 設定與驗證。
    - 預設網域、預設格式選擇。
    - 自訂規則（Pro）。
    - 授權金鑰輸入與驗證。



---



## 隱私與安全

簡要重點（完整內容請見 `PRIVACY-POLICY.md`）：

- Addy.io API Token、授權金鑰與相關設定儲存在你的瀏覽器本機。
- 擴充功能只會讀取目前頁面網址與 email 輸入欄位，用於產生別名。
- 透過 Cloudflare / Polar.sh 的請求僅限於：
  - 授權金鑰驗證。
  - 伺服器端正常的記錄與錯誤追蹤。
- 我們不會用你的資料做廣告追蹤或販售。

仍請留意：

- 你與 Addy.io、Polar.sh、Cloudflare、瀏覽器廠商之間各自有獨立的條款與隱私政策。
- 若你自行修改或部署本專案，請自行確認符合所在司法管轄區的法規。

---

## 開發與貢獻

### 開發模式啟動（擴充功能）

```bash
cd extension
npm install
npm run dev
```

開發模式會啟動 Vite dev server，方便在瀏覽器中熱重載預覽彈出視窗與設定頁 UI。內容指令碼及打包為完整擴充功能時仍建議透過 `npm run build` 並以「載入未封裝項目」測試。

### 程式風格

- 使用 TypeScript + React。
- UI 元件採用 Radix UI + Tailwind 類似的 utility class 風格。
- 儘量保持邏輯模組化（lib / services / components 分層）。

歡迎依照你自己的需求 Fork、調整並建立 Pull Request。

---

## 授權條款

專案授權條款請參考根目錄的 `LICENSE` / `README.md`，目前原始專案為 MIT License。若你基於此專案進一步商業化或提供給其他使用者，請務必確認：

- 是否需要補充你自己的服務條款與隱私權聲明。
- 是否符合 Addy.io、Polar.sh、Cloudflare 等第三方服務的使用規範。

---

## 聯絡方式

若你對本專案有任何建議、問題或想回報錯誤，可以：

- 在 GitHub 專案中建立 Issue 或 Pull Request。
- 或透過你在條款中提供的聯絡信箱與我們聯繫（請參考 `PRIVACY-POLICY.md` / `TERMS-OF-USE.md` 中所填寫的聯絡資訊）。

