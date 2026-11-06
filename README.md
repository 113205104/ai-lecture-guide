# 免費線上講義

使用 GitHub Free 的公開儲存庫、GitHub Pages 與平台提供的 github.io 網址，以及 Firebase Spark 免費方案的 Authentication 與 Firestore。維持 Spark、不連結帳單帳戶，不需要付費主機、付費網域或付費資料庫。

Firebase 專案 `ai-lecture-guide` 已建立、Web 應用程式已註冊、Google 登入已啟用，Firestore Standard 位於台灣 `asia-east1`。寫入規則已發布。網站發布與登入儲存驗證仍待完成。

## 使用方式與權限

訪客直接閱讀講義。講者在手機、平板、電腦點「講者登入」，使用指定 Google 帳號登入，點設定後沿用目前的視覺化編輯介面，按「完成」存入雲端。其他裝置重新開啟頁面即可讀取最新內容。

只有經 Google 登入、電子郵件已驗證且符合規則內指定電子郵件的帳號能建立或修改這份講義。其他 Google 帳號即使登入或直接呼叫資料庫 API，也不會取得寫入權限。前端設定不能改變資料庫授權。`ownerUid` 可額外指定已登入使用者的 UID，以收緊前端驗證；後端規則始終會檢查指定 Google 帳號。

同時用兩台裝置編輯時，以版本號攔截較舊版本的儲存，不默默覆蓋。網路失敗或免費配額用盡時保留目前編輯畫面並顯示儲存失敗；離開前可匯出備份，不宣稱已同步。

## 檔案

- `guide.json`：講義內容與樣式。
- `template.html`：保留現有互動及版型的網站範本。
- `build.cjs`：將內容套入範本並產生 `dist/index.html`。
- `editor-source.js`：保留原有文字、卡片與樣式編輯介面。
- `cloud.mjs`：登入、讀取雲端、帶版本檢查的雲端儲存。
- `firebase-config.json`：Firebase Web 公開設定及講者電子郵件；不得放入密碼、管理員金鑰或服務帳戶金鑰。
- `firestore.rules`：只允許指定的、經 Google 驗證的講者帳號寫入。
- `.github/workflows/pages.yml`：main 分支更新後，自動產生並發布網站。

## 一次性雲端設定

1. 在 Firebase Console 建立 Spark 免費專案，不加入帳單帳戶，不升級 Blaze；不使用 App Hosting、Cloud Functions、Cloud Storage 或簡訊登入。
2. 在 Authentication 啟用 Google 登入。登入直接透過 Google 處理，網站不收取或儲存 Google 密碼。
3. 建立 Firestore Standard 資料庫，使用正式版的拒絕存取預設規則。
4. 用 `firestore.rules` 的規則替換資料庫規則，確認指定講者的電子郵件後再發布規則。不要使用允許所有人寫入的測試規則。
5. 註冊 Firebase Web 應用程式，將公開的 apiKey、authDomain、projectId、appId 及相同的 ownerEmail 填入 `firebase-config.json`。將網站網域加入 Authentication 的授權網域。Web apiKey 不是管理員密鑰；權限以資料庫規則為準。
6. 網站上線後，用講者帳號登入，按一次編輯與完成，即可把講義寫入雲端；以另一台裝置確認。

## 第一次發布網站

1. 將本資料夾作為獨立的 GitHub 公開儲存庫根目錄上傳。
2. 儲存庫 Settings → Pages → Source 選擇 GitHub Actions。
3. 執行「發布講義」工作流程，等待部署完成並取得網站網址。

## 上線前必驗

- 未登入時可以讀取講義，不能新增、修改或刪除資料。
- 使用不同 UID 登入，嘗試直接呼叫資料庫 API 寫入，應遭規則拒絕。
- 用講者 UID 在兩台裝置登入，第一台儲存，第二台重開能讀取；若第二台保留舊版本編輯，儲存應被攔截。
- 手機實測編輯、完成、登出、網路失敗與匯出備份。

## 本機預覽

執行 `node build.cjs`，以本機 HTTP 伺服器預覽 `dist`；雲端功能不支援直接以 file:// 開啟。

## 內容來源

這份資料來自「本機編輯版-無分隔線.html」內已寫入的內容。僅存在瀏覽器 localStorage 的較新修改不會自動納入；需要從原本編輯的瀏覽器另外匯出。

GitHub Pages 的免費公開儲存庫會公開上傳的原始檔與歷史版本，只有具有儲存庫寫入權限的帳號能發布修改。
