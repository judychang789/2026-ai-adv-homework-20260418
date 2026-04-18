# 開發規範

## 開發原則

本專案偏向教學與 demo 取向，開發規則不是追求抽象層最多，而是讓流程容易追。新增功能時，優先維持現有風格：

- 請求驗證、SQL 查詢與回應格式寫在 route 附近。
- 沒有明確重用價值前，不要提早抽 service / helper。
- 所有 API 維持 `{ data, error, message }` 回應結構。
- 與權限、購物車 owner、庫存扣減有關的規則要寫清楚，不要藏在模糊 helper 中。

## 命名規則對照表

| 對象 | 現行規則 | 範例 |
| --- | --- | --- |
| Route 檔名 | camelCase + `Routes.js` | `authRoutes.js`, `adminProductRoutes.js` |
| Middleware 檔名 | camelCase + `Middleware.js` 或描述性名稱 | `authMiddleware.js`, `errorHandler.js` |
| 前端頁面腳本 | kebab-case | `product-detail.js`, `admin-orders.js` |
| EJS page 檔名 | kebab-case | `order-detail.ejs`, `admin/products.ejs` |
| DB 欄位 | snake_case | `password_hash`, `recipient_email`, `order_no` |
| API request body | camelCase | `recipientName`, `productId` |
| API response 欄位 | 以 DB 欄位或既有格式為主，常見 snake_case | `product_id`, `total_amount`, `created_at` |
| localStorage key | 大寫常數 + 字串值 | `TOKEN_KEY`, `flower_token` |
| Vue setup 內 state | 簡短語意化 camelCase | `loading`, `statusFilter`, `confirmVisible` |
| 錯誤碼 | 全大寫底線分隔 | `VALIDATION_ERROR`, `STOCK_INSUFFICIENT` |

最重要的對照是：HTTP request body 偏 camelCase，但資料庫與不少 response 欄位偏 snake_case。新增欄位時要有意識地決定兩端命名，而不是直接混用。

## 模組系統

### 後端

- 使用 CommonJS
- 透過 `require(...)` / `module.exports`
- Express route 檔案直接輸出 `router`
- `src/database.js` 直接輸出已初始化的 `db`

### 前端

- 不使用 bundler
- 所有前端腳本以傳統 `<script>` 載入
- `Auth`、`apiFetch`、`Notification` 都是全域物件 / 函式
- Vue 使用 CDN 版，頁面腳本透過 `const { createApp, ref, ... } = Vue;` 取用 API

這代表：

- 後端不能直接使用 ESM `import`
- 前端不能用 npm 套件匯入或單檔元件
- 若新增共用前端工具，應放在 `public/js/*.js` 並由 layout 載入

## 環境變數

| 變數 | 用途 | 必要性 | 預設值 / 現況 |
| --- | --- | --- | --- |
| `JWT_SECRET` | JWT 簽章與驗證 | 必填，`server.js` 啟動會檢查 | 無預設；`.env.example` 提供範例值 |
| `PORT` | HTTP 監聽埠號 | 選填 | `3001` |
| `FRONTEND_URL` | CORS `origin` 設定 | 選填 | `http://localhost:3001`（程式中的 fallback） |
| `BASE_URL` | 預期站點網址 | 目前未使用 | `.env.example` 中為 `http://localhost:3001` |
| `ADMIN_EMAIL` | 管理員 seed 帳號 | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 管理員 seed 密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 預留金流設定 | 目前未使用 | `.env.example` 範例值 |
| `ECPAY_HASH_KEY` | 預留金流設定 | 目前未使用 | `.env.example` 範例值 |
| `ECPAY_HASH_IV` | 預留金流設定 | 目前未使用 | `.env.example` 範例值 |
| `ECPAY_ENV` | 預留金流環境 | 目前未使用 | `staging` |
| `NODE_ENV` | 控制 seed admin 密碼 hash 成本 | 選填 | 非 test 時視為一般環境 |

注意：

- `FRONTEND_URL` 只影響 CORS，對同源 EJS 頁面本身沒有影響。
- `BASE_URL` 目前只是範本中的預留欄位，新增依賴它的功能前要先確認用途。
- 若要實作真正第三方金流，不應直接沿用 `.env.example` 就假設已完成；要先補 route、callback、測試與文件。

## 新增 API 的步驟

1. 決定 API 屬於哪個 route 檔案。
   - Auth：`authRoutes.js`
   - 前台商品：`productRoutes.js`
   - 購物車：`cartRoutes.js`
   - 訂單：`orderRoutes.js`
   - 後台商品 / 訂單：`admin*Routes.js`
2. 先定義路徑與認證邊界。
   - 會員 API：加 `authMiddleware`
   - 後台 API：加 `authMiddleware, adminMiddleware`
   - 訪客/會員共用購物車：沿用 `dualAuth()`
3. 撰寫 request 驗證。
   - 檢查必填欄位
   - 檢查整數、Email 等格式
4. 撰寫 SQL。
   - 查詢與交易邏輯盡量保留在 route 內
   - 若一次操作涉及多步資料變更，優先用 `db.transaction(...)`
5. 回傳統一格式。
6. 補 `@openapi` 註解。
7. 補測試。
8. 更新文件：
   - `docs/FEATURES.md`
   - `docs/ARCHITECTURE.md`（若影響路由或資料流）
   - `docs/CHANGELOG.md`

### API 實作範例骨架

```js
router.post('/example', authMiddleware, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: 'name 為必填欄位'
    });
  }

  const row = db.prepare('SELECT ...').get();

  return res.status(201).json({
    data: row,
    error: null,
    message: '建立成功'
  });
});
```

## 新增 middleware 的步驟

1. 建立檔案到 `src/middleware/`。
2. 命名遵循 `xxxMiddleware.js` 或表意清楚的 handler 名稱。
3. 明確決定責任：
   - 身分驗證
   - 角色檢查
   - request 預處理
   - error handling
4. 若 middleware 會中斷請求，回傳統一 JSON 結構。
5. 在相關 route 或 `app.js` 掛載。
6. 補測試與文件。

避免把 route 的業務判斷偷偷搬進 middleware，特別是庫存、購物車 owner、訂單狀態等 domain 規則，因為這會讓流程不透明。

## 新增資料庫欄位或資料表的步驟

本專案沒有 migration 工具，schema 直接寫在 `src/database.js` 的 `db.exec(...)` 字串中。因此變更 DB 需注意：

1. 更新 `CREATE TABLE IF NOT EXISTS ...` 結構。
2. 若是既有表新增欄位，僅改 `CREATE TABLE` 不會影響已存在的資料庫檔案。
3. 開發中若需要重新建立 schema，通常要刪除現有 `database.sqlite` 後重啟，或補手動 `ALTER TABLE`。
4. 更新所有受影響 SQL。
5. 更新 seed 資料。
6. 更新測試資料準備與文件。

### 推薦做法

- 開發新 schema 時，同步補一段顯式 `ALTER TABLE` 或記錄手動重建方式。
- 如果 schema 變更會影響測試穩定性，優先驗證 `npm run test`。

## 前端開發規範

### 共用腳本責任

| 檔案 | 責任 |
| --- | --- |
| `public/js/auth.js` | token / user / session 管理與重導守衛 |
| `public/js/api.js` | API 呼叫封裝與 401 處理 |
| `public/js/notification.js` | toast 呈現 |
| `public/js/header-init.js` | header 上登入資訊與購物車 badge 初始化 |

### Vue 頁面慣例

- 每個頁面一個 `createApp({...}).mount('#app')`
- 狀態以 `ref` / `computed` 為主
- API 呼叫通常寫在 `setup()` 內部函式
- 載入資料時使用 `loading` 狀態
- 送出表單時使用 `submitting` 或 `saving`

### 實務注意

- `apiFetch` 遇到 `401` 會清掉 token 與 user，並直接導向 `/login`。
- 因為 `apiFetch` 預設 headers 已含 `Content-Type: application/json`，送 `FormData` 前要先調整實作。
- 前端購物車 badge 是以前端加一的方式更新，不會重新同步總數；若單次加入數量大於 1，badge 仍只加 1。

## JSDoc / OpenAPI 格式

所有 API 文件都直接寫在 route 檔案中，使用 `@openapi` 區塊。新增 API 時應至少補：

- path
- method
- summary
- tags
- requestBody
- parameters
- responses
- security（若需要）

### 範例

```js
/**
 * @openapi
 * /api/example:
 *   post:
 *     summary: 建立範例資源
 *     tags: [Example]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: 建立成功
 */
```

### 撰寫原則

- response schema 至少描述外層 `data`, `error`, `message`
- 若 API 支援 session header，要在 `security` 加入 `sessionId`
- 與實作不同步的 JSDoc 會讓 `openapi.json` 誤導使用者，因此改 route 時必須同步調整

## 常見修改情境

### 新增後台 API

1. 在 `src/routes/admin*.js` 新增 route
2. 確認 `router.use(authMiddleware, adminMiddleware)` 已覆蓋
3. 更新前端 `public/js/pages/admin-*.js` 與對應 EJS（如有）
4. 更新後台測試

### 新增前台頁面

1. 建立 `views/pages/<name>.ejs`
2. 建立 `public/js/pages/<name>.js`
3. 在 `src/routes/pageRoutes.js` 增加 route
4. layout 中透過 `pageScript` 載入對應腳本

### 新增 DB 驅動功能

1. 確認需要新表或只是在現有表加欄位
2. 更新 `src/database.js`
3. 檢查是否要 seed
4. 補 route、前端、測試與文件

## 計畫歸檔流程

1. 計畫檔案命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：`User Story` → `Spec` → `Tasks`
3. 功能完成後：移至 `docs/plans/archive/`
4. 更新 `docs/FEATURES.md` 和 `docs/CHANGELOG.md`

### 建議計畫模板

```markdown
# 2026-04-18-example-feature

## User Story
- 作為...
- 我希望...
- 以便...

## Spec
- 路由：
- 資料表：
- 驗證：
- 錯誤情境：
- 測試：

## Tasks
- [ ] 更新 route
- [ ] 更新前端
- [ ] 補測試
- [ ] 更新文件
```

## 開發時常見陷阱

- 不要假設訪客購物車能直接下單；目前後端完全不支援。
- 不要只改前端運費顯示就以為訂單金額變了；後端 `total_amount` 沒有運費。
- 不要在新增訂單流程外手動扣庫存；現有扣庫存集中在 `POST /api/orders` transaction。
- 不要忽略 401 的前端副作用；`apiFetch` 會直接重導，畫面 state 可能還沒處理完就離開頁面。
- 若新增 schema 只改 `CREATE TABLE IF NOT EXISTS`，已存在的本地 DB 不會自動更新。
