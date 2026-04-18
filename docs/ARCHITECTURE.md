# 架構說明

## 系統概觀

本專案是單體式 Node.js Web 應用。`app.js` 建立 Express app，整合同一套 API 與 EJS 頁面；`server.js` 僅處理啟動與 `JWT_SECRET` 檢查。資料庫是本機 SQLite 檔案 `database.sqlite`，初始化流程在載入 `src/database.js` 時即自動執行，因此「require database module」本身就是 schema 建立與 seed 入口。

系統層次雖然清楚，但沒有嚴格切 service / repository / controller 分層，而是採下列方式：

- `src/routes/*.js` 直接寫請求驗證、查詢、交易與回應格式。
- `src/middleware/*.js` 放共用驗證與錯誤處理。
- `public/js/` 提供前台與後台 Vue 頁面腳本。
- `views/` 負責 HTML 骨架與頁面容器。

這個設計的重要含義是：若要改 API 行為，優先閱讀 route 檔案；不要假設有隱藏的 service 層或 model 層。

## 啟動流程

### 應用啟動順序

1. `server.js` 載入 `app.js`。
2. `app.js` 先 `require('dotenv').config()`。
3. `app.js` 載入 `./src/database`。
4. `src/database.js` 建立 SQLite 連線、開啟 `WAL` 與 foreign keys、建立 tables、執行 seed。
5. `app.js` 建立 Express app，設定 EJS view engine 與 `views/` 目錄。
6. 註冊靜態目錄 `public/`。
7. 註冊全域 middleware：`cors`、`express.json`、`express.urlencoded`、`sessionMiddleware`。
8. 掛載 API 路由與頁面路由。
9. 註冊 API/頁面的 404 處理器。
10. 註冊 `errorHandler`。
11. 回到 `server.js`，若為直接執行且未設定 `JWT_SECRET`，程序退出。
12. `app.listen(PORT)` 啟動 HTTP 服務。

### 啟動相關檔案

| 檔案 | 角色 |
| --- | --- |
| `server.js` | 檢查 `JWT_SECRET`、啟動 HTTP server、匯出 app 供測試使用 |
| `app.js` | 組裝 Express、middleware、routes、404 與 error handler |
| `src/database.js` | 初始化 SQLite schema、seed 管理員與商品 |

## 目錄結構

### 根目錄

| 路徑 | 用途 |
| --- | --- |
| `app.js` | Express application 組裝點 |
| `server.js` | 啟動入口 |
| `package.json` | scripts、依賴與專案 metadata |
| `package-lock.json` | npm 鎖定檔 |
| `.env.example` | 環境變數範本 |
| `generate-openapi.js` | 產生 `openapi.json` |
| `swagger-config.js` | OpenAPI 基礎設定與 securitySchemes |
| `vitest.config.js` | Vitest 順序與 timeout 設定 |
| `AGENTS.md` | 開發代理與文件入口 |

### `src/`

| 路徑 | 用途 |
| --- | --- |
| `src/database.js` | DB 連線、schema、seed |
| `src/middleware/sessionMiddleware.js` | 讀取 `x-session-id` 並掛到 `req.sessionId` |
| `src/middleware/authMiddleware.js` | Bearer JWT 驗證與 `req.user` 注入 |
| `src/middleware/adminMiddleware.js` | 驗證 `req.user.role === 'admin'` |
| `src/middleware/errorHandler.js` | 將未捕捉錯誤轉為統一 API JSON |
| `src/routes/authRoutes.js` | 註冊、登入、會員 profile API |
| `src/routes/productRoutes.js` | 前台商品列表與詳情 API |
| `src/routes/cartRoutes.js` | 雙模式購物車 API |
| `src/routes/orderRoutes.js` | 會員訂單建立、查詢、綠界付款與主動驗證 |
| `src/services/ecpay.js` | ECPay CheckMacValue、AIO 付款欄位與 QueryTradeInfo 查詢 |
| `src/routes/adminProductRoutes.js` | 後台商品 CRUD API |
| `src/routes/adminOrderRoutes.js` | 後台訂單列表與詳情 API |
| `src/routes/pageRoutes.js` | 前台與後台頁面路由 |

### `public/`

| 路徑 | 用途 |
| --- | --- |
| `public/css/input.css` | Tailwind v4 入口與主題色設定 |
| `public/stylesheets/style.css` | 舊樣式檔，現行 layout 未引用 |
| `public/js/auth.js` | token/user/session 的 localStorage 管理 |
| `public/js/api.js` | `fetch` 包裝，統一 headers 與 401 重導 |
| `public/js/header-init.js` | 頁首登入狀態與購物車 badge 初始化 |
| `public/js/notification.js` | Toast 訊息顯示 |
| `public/js/pages/index.js` | 首頁商品列表與加入購物車 |
| `public/js/pages/product-detail.js` | 商品詳情與數量控制 |
| `public/js/pages/cart.js` | 購物車列表、改量、刪除、前往結帳 |
| `public/js/pages/login.js` | 登入 / 註冊切頁與送單 |
| `public/js/pages/checkout.js` | 會員結帳表單與送單 |
| `public/js/pages/orders.js` | 會員訂單列表 |
| `public/js/pages/order-detail.js` | 訂單詳情、綠界付款導向與主動驗證 |
| `public/js/pages/admin-products.js` | 後台商品 CRUD UI |
| `public/js/pages/admin-orders.js` | 後台訂單列表、狀態篩選、詳情 modal |

### `views/`

| 路徑 | 用途 |
| --- | --- |
| `views/layouts/front.ejs` | 前台共用 layout，載入 Vue、Auth、api、header-init |
| `views/layouts/admin.ejs` | 後台共用 layout，載入 admin header/sidebar 與管理驗證 |
| `views/partials/head.ejs` | `<head>` 與字體 / CSS 載入 |
| `views/partials/header.ejs` | 前台 header 與 badge / auth 容器 |
| `views/partials/footer.ejs` | footer |
| `views/partials/notification.ejs` | toast 容器 |
| `views/partials/admin-header.ejs` | 後台 top bar |
| `views/partials/admin-sidebar.ejs` | 後台側欄 |
| `views/pages/index.ejs` | 首頁 |
| `views/pages/product-detail.ejs` | 商品詳情頁 |
| `views/pages/cart.ejs` | 購物車頁 |
| `views/pages/login.ejs` | 登入 / 註冊頁 |
| `views/pages/checkout.ejs` | 結帳頁 |
| `views/pages/orders.ejs` | 會員訂單列表頁 |
| `views/pages/order-detail.ejs` | 訂單詳情與付款頁 |
| `views/pages/404.ejs` | 頁面版 404 |
| `views/pages/admin/products.ejs` | 後台商品頁 |
| `views/pages/admin/orders.ejs` | 後台訂單頁 |

### `tests/`

| 路徑 | 用途 |
| --- | --- |
| `tests/setup.js` | 測試共用 app/request/helper |
| `tests/auth.test.js` | Auth API 測試 |
| `tests/products.test.js` | 前台商品 API 測試 |
| `tests/cart.test.js` | 購物車雙模式測試 |
| `tests/orders.test.js` | 訂單流程測試 |
| `tests/adminProducts.test.js` | 後台商品 API 測試 |
| `tests/adminOrders.test.js` | 後台訂單 API 測試 |

## 路由總覽

### API 路由

| Prefix / Path | 檔案 | 認證 | 說明 |
| --- | --- | --- | --- |
| `/api/auth/register` | `src/routes/authRoutes.js` | 無 | 註冊新會員並回傳 JWT |
| `/api/auth/login` | `src/routes/authRoutes.js` | 無 | 會員或管理員登入 |
| `/api/auth/profile` | `src/routes/authRoutes.js` | JWT | 查詢目前登入會員資料 |
| `/api/products` | `src/routes/productRoutes.js` | 無 | 前台商品列表 |
| `/api/products/:id` | `src/routes/productRoutes.js` | 無 | 前台商品詳情 |
| `/api/cart` | `src/routes/cartRoutes.js` | JWT 或 `X-Session-Id` | 查詢 / 新增購物車項目 |
| `/api/cart/:itemId` | `src/routes/cartRoutes.js` | JWT 或 `X-Session-Id` | 更新或刪除購物車項目 |
| `/api/orders` | `src/routes/orderRoutes.js` | JWT | 建立訂單與查詢會員訂單 |
| `/api/orders/:id` | `src/routes/orderRoutes.js` | JWT | 會員訂單詳情 |
| `/api/orders/payment/ecpay/callback` | `src/routes/orderRoutes.js` | 無 | ECPay Server Notify callback（本機不依賴） |
| `/api/orders/:id/payment/ecpay/checkout` | `src/routes/orderRoutes.js` | JWT | 產生 AIO 付款表單欄位 |
| `/api/orders/:id/payment/ecpay/verify` | `src/routes/orderRoutes.js` | JWT | 主動向綠界查詢付款狀態 |
| `/api/admin/products` | `src/routes/adminProductRoutes.js` | JWT + admin | 後台商品列表 / 新增 |
| `/api/admin/products/:id` | `src/routes/adminProductRoutes.js` | JWT + admin | 後台商品修改 / 刪除 |
| `/api/admin/orders` | `src/routes/adminOrderRoutes.js` | JWT + admin | 後台訂單列表與狀態篩選 |
| `/api/admin/orders/:id` | `src/routes/adminOrderRoutes.js` | JWT + admin | 後台訂單詳情 |

### 頁面路由

| Path | 檔案 | 認證 | 說明 |
| --- | --- | --- | --- |
| `/` | `src/routes/pageRoutes.js` | 無 | 首頁 |
| `/products/:id` | `src/routes/pageRoutes.js` | 無 | 商品詳情頁 |
| `/cart` | `src/routes/pageRoutes.js` | 無 | 購物車頁 |
| `/checkout` | `src/routes/pageRoutes.js` | 前端檢查登入 | 結帳頁 |
| `/login` | `src/routes/pageRoutes.js` | 無 | 登入 / 註冊頁 |
| `/orders` | `src/routes/pageRoutes.js` | 前端檢查登入 | 我的訂單頁 |
| `/orders/:id` | `src/routes/pageRoutes.js` | 前端檢查登入 | 訂單詳情頁 |
| `/admin/products` | `src/routes/pageRoutes.js` | 前端檢查 admin | 後台商品管理頁 |
| `/admin/orders` | `src/routes/pageRoutes.js` | 前端檢查 admin | 後台訂單管理頁 |

注意：頁面路由本身不在 server 端做登入守衛，而是前端腳本用 `Auth.requireAuth()` 或 `Auth.requireAdmin()` 進行重導。API 端才是真正安全邊界。

## 資料流

### 前台商品瀏覽

1. 使用者進入 `/`。
2. `views/layouts/front.ejs` 載入共用腳本與 `public/js/pages/index.js`。
3. 前端呼叫 `/api/products?page=1&limit=9`。
4. 後端從 `products` 查詢分頁資料並回應。
5. 使用者點商品卡片時，前端導到 `/products/:id`，再呼叫 `/api/products/:id` 取得詳情。

### 購物車雙模式

1. 前端每次呼叫 `apiFetch` 都會透過 `Auth.getAuthHeaders()` 自動附帶：
   - 若已登入：`Authorization: Bearer <token>`
   - 無論登入與否：`X-Session-Id: <uuid>`
2. `sessionMiddleware` 先把 header 中的 `x-session-id` 放到 `req.sessionId`。
3. `cartRoutes` 內的 `dualAuth()` 先檢查 Bearer token。
4. 若 Bearer token 有效，使用 `req.user.userId` 作為購物車 owner。
5. 若 Bearer token 不存在但有 `req.sessionId`，使用 `session_id` 作為 owner。
6. 若 Bearer token 存在但無效，直接回 `401`，不會 fallback 到 session。

### 建立訂單

1. 前端 `/checkout` 頁先查 `/api/cart` 取得會員購物車。
2. 使用者填寫收件資訊後送出 `/api/orders`。
3. `orderRoutes` 驗證 JWT、檢查必填欄位與 Email 格式。
4. 從 `cart_items` + `products` 查詢該會員目前購物車。
5. 驗證購物車非空與所有商品庫存足夠。
6. 在 SQLite transaction 中：
   - 建立 `orders`
   - 建立 `order_items`
   - 對每個商品執行 `UPDATE products SET stock = stock - ?`
   - 清除該會員的 `cart_items`
7. 回傳新訂單摘要。

### 綠界付款與主動驗證

1. 使用者進入 `/orders/:id`。
2. 前端呼叫 `/api/orders/:id` 取得詳情。
3. 若狀態為 `pending`，畫面顯示「前往綠界付款」與「重新確認付款狀態」按鈕。
4. 前端呼叫 `POST /api/orders/:id/payment/ecpay/checkout` 取得 AIO 表單欄位。
5. 前端建立隱藏表單並提交到綠界 `AioCheckOut/V5`。
6. 綠界付款完成後，消費者瀏覽器透過 `ClientBackURL` 回到 `/orders/:id?payment=returned`。
7. 前端呼叫 `POST /api/orders/:id/payment/ecpay/verify`。
8. 後端呼叫 `QueryTradeInfo/V5` 主動向綠界查詢交易狀態，驗證 `CheckMacValue` 後再同步更新訂單。

## 統一回應格式

### 成功範例

```json
{
  "data": {
    "products": [],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

### 驗證錯誤範例

```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "email、password、name 為必填欄位"
}
```

### 未授權錯誤範例

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "請先登入"
}
```

### 未處理錯誤處理規則

`errorHandler` 會輸出：

- `statusCode` 取自 `err.status` 或 `err.statusCode`，否則預設 `500`
- `error` 一律回 `"INTERNAL_ERROR"`
- `message`
  - 若 `500`，固定為 `伺服器內部錯誤`
  - 若 `err.isOperational` 為真，使用 `err.message`
  - 否則套用安全訊息表，例如 400/401/403/404/409/422/429

因此如果未來新增會丟出 error 的程式，必須決定是否將錯誤標記為 operational，否則實際訊息會被覆蓋成安全字串。

## 認證與授權機制

### JWT

- 簽章演算法：`HS256`
- Secret：`process.env.JWT_SECRET`
- 有效期：`7d`
- Payload 欄位：
  - `userId`
  - `email`
  - `role`

JWT 發放位置：

- `POST /api/auth/register`
- `POST /api/auth/login`

JWT 驗證位置：

- `src/middleware/authMiddleware.js`
- `src/routes/cartRoutes.js` 內的 `dualAuth()`

### `authMiddleware` 行為

1. 檢查 `Authorization` header 是否存在且以 `Bearer ` 開頭。
2. 用 `jwt.verify(..., { algorithms: ['HS256'] })` 驗證。
3. 再查詢 `users` 表確認使用者仍存在。
4. 將 `{ userId, email, role }` 放到 `req.user`。
5. 任何缺失、驗證失敗或使用者不存在都回 `401`。

### `adminMiddleware` 行為

- 僅接受 `req.user.role === 'admin'`
- 否則回 `403 FORBIDDEN`

### `sessionMiddleware` 行為

- 只做一件事：若 header 存在 `x-session-id`，就掛到 `req.sessionId`
- 不會產生 session、不會驗證 UUID 格式、不會寫 cookie
- 真正的 session 生成在前端 `Auth.getSessionId()`，使用 `crypto.randomUUID()` 存到 localStorage 的 `flower_session_id`

## 資料庫 schema

資料庫檔案位置：專案根目錄 `database.sqlite`

SQLite pragma：

- `journal_mode = WAL`
- `foreign_keys = ON`

### `users`

| 欄位 | 型別 | 約束 / 說明 |
| --- | --- | --- |
| `id` | `TEXT` | Primary Key，UUID |
| `email` | `TEXT` | `UNIQUE NOT NULL` |
| `password_hash` | `TEXT` | `NOT NULL` |
| `name` | `TEXT` | `NOT NULL` |
| `role` | `TEXT` | `NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin'))` |
| `created_at` | `TEXT` | `NOT NULL DEFAULT datetime('now')` |

### `products`

| 欄位 | 型別 | 約束 / 說明 |
| --- | --- | --- |
| `id` | `TEXT` | Primary Key，UUID |
| `name` | `TEXT` | `NOT NULL` |
| `description` | `TEXT` | 可為 `NULL` |
| `price` | `INTEGER` | `NOT NULL CHECK(price > 0)` |
| `stock` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK(stock >= 0)` |
| `image_url` | `TEXT` | 可為 `NULL` |
| `created_at` | `TEXT` | `NOT NULL DEFAULT datetime('now')` |
| `updated_at` | `TEXT` | `NOT NULL DEFAULT datetime('now')` |

### `cart_items`

| 欄位 | 型別 | 約束 / 說明 |
| --- | --- | --- |
| `id` | `TEXT` | Primary Key，UUID |
| `session_id` | `TEXT` | 訪客購物車 owner，可為 `NULL` |
| `user_id` | `TEXT` | 會員購物車 owner，可為 `NULL`，FK -> `users.id` |
| `product_id` | `TEXT` | `NOT NULL`，FK -> `products.id` |
| `quantity` | `INTEGER` | `NOT NULL DEFAULT 1 CHECK(quantity > 0)` |

注意：schema 沒有 database-level check 確保 `session_id` 與 `user_id` 只能擇一；這個 invariant 完全靠 route 邏輯維持。

### `orders`

| 欄位 | 型別 | 約束 / 說明 |
| --- | --- | --- |
| `id` | `TEXT` | Primary Key，UUID |
| `order_no` | `TEXT` | `UNIQUE NOT NULL`，格式 `ORD-YYYYMMDD-XXXXX` |
| `user_id` | `TEXT` | `NOT NULL`，FK -> `users.id` |
| `recipient_name` | `TEXT` | `NOT NULL` |
| `recipient_email` | `TEXT` | `NOT NULL` |
| `recipient_address` | `TEXT` | `NOT NULL` |
| `total_amount` | `INTEGER` | `NOT NULL`，目前只含商品小計 |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed'))` |
| `created_at` | `TEXT` | `NOT NULL DEFAULT datetime('now')` |

### `order_items`

| 欄位 | 型別 | 約束 / 說明 |
| --- | --- | --- |
| `id` | `TEXT` | Primary Key，UUID |
| `order_id` | `TEXT` | `NOT NULL`，FK -> `orders.id` |
| `product_id` | `TEXT` | `NOT NULL` |
| `product_name` | `TEXT` | 下單當下的商品名稱快照 |
| `product_price` | `INTEGER` | 下單當下的價格快照 |
| `quantity` | `INTEGER` | 下單數量 |

注意：`order_items.product_id` 沒有宣告指向 `products.id` 的 FK 約束。這代表商品即使被刪除，訂單明細仍能保留對應商品識別與快照欄位。

## Seed 機制

### 管理員 seed

- 若 `users` 尚無 `ADMIN_EMAIL` 對應帳號，就建立管理員。
- `NODE_ENV === 'test'` 時 bcrypt salt rounds 為 `1`，否則為 `10`。

### 商品 seed

- 若 `products` 筆數大於 0，不再重複 seed。
- 內建 8 筆花束 / 盆栽 / 訂閱商品，含圖片網址與描述。

## 第三方整合與金流現況

### OpenAPI 生成

- `swagger-config.js` 定義：
  - OpenAPI 版本 `3.0.3`
  - `bearerAuth`
  - `sessionId` header security scheme
- `generate-openapi.js` 以 `swagger-jsdoc` 讀取 `src/routes/*.js` 中的 `@openapi` 註解並寫出 `openapi.json`

### 金流 / 第三方服務

`.env.example` 提供：

- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_ENV`

目前金流整合方式是：

- 採 ECPay AIO Form POST 導向付款頁
- `src/services/ecpay.js` 負責 CheckMacValue、AIO 表單欄位組裝與 `QueryTradeInfo` 主動查詢
- `orders` 表會保存 `merchant_trade_no`, `ecpay_trade_no`, `payment_type`, `payment_date`, `payment_checked_at`
- 仍保留 `ReturnURL` callback route，但本機模式不依賴 callback 作為最終付款確認來源
- 付款最終確認來源是主動查詢 `QueryTradeInfo`

## 架構上的重要限制

- 訂單建立只讀會員購物車 `WHERE ci.user_id = ?`，訪客購物車不能直接轉成訂單。
- 沒有登入後合併訪客購物車到會員購物車的機制。
- 庫存扣減發生在建立訂單時，不是付款成功時。
- 付款失敗後不會回補庫存。
- 前端顯示的運費與免運邏輯沒有寫入後端訂單金額。
- 後台商品刪除只阻擋出現在 `pending` 訂單中的商品；若訂單已 `paid` 或 `failed`，商品可被刪除。
- 本機開發無法直接接收綠界 Server Notify，因此必須以主動查詢綠界 API 驗證付款狀態。
