# 功能清單與完成狀態

## 功能狀態總覽

| 模組 | 狀態 | 說明 |
| --- | --- | --- |
| 前台商品瀏覽 | 已完成 | 商品列表、分頁、詳情頁 |
| 會員註冊 / 登入 / 個人資料 | 已完成 | JWT 登入、profile 查詢 |
| 訪客 / 會員雙模式購物車 | 已完成 | JWT 與 `X-Session-Id` 雙模式 |
| 會員結帳與訂單建立 | 已完成 | 從會員購物車建立訂單並扣庫存 |
| 綠界付款與主動驗證 | 已完成 | 建立 AIO 付款單、回跳後主動查詢交易狀態 |
| 後台商品管理 | 已完成 | 列表、新增、編輯、刪除 |
| 後台訂單管理 | 已完成 | 列表、狀態篩選、詳情查看 |
| 訪客購物車登入後合併 | 未完成 | 無自動 merge 流程 |
| 付款失敗回補庫存 | 未完成 | 目前沒有補庫存機制 |

## 前台商品瀏覽

### 行為描述

首頁會呼叫 `/api/products?page=1&limit=9` 取得商品列表，卡片點擊後導向商品詳情頁 `/products/:id`，詳情頁再呼叫 `/api/products/:id` 讀取完整資料。商品列表與後台列表共用同一張 `products` 表，但前台只提供查詢，不做額外篩選，例如不會隱藏低庫存或已建立訂單的商品。

### API

#### `GET /api/products`

- 查詢參數：
  - `page`：選填，預設 `1`，最小值強制為 `1`
  - `limit`：選填，預設 `10`；程式會將值限制在 `1..100`
- 排序：
  - `ORDER BY created_at DESC`
- 回傳：
  - `data.products`
  - `data.pagination.total`
  - `data.pagination.page`
  - `data.pagination.limit`
  - `data.pagination.totalPages`

#### `GET /api/products/:id`

- path 參數：
  - `id`：商品 UUID
- 成功回傳完整商品列
- 若不存在回 `404 NOT_FOUND`

### 錯誤情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `404` | `NOT_FOUND` | 商品 ID 不存在 |

## 會員註冊、登入與個人資料

### 行為描述

註冊與登入成功時都會直接簽發 JWT，有效期 7 天。前端把 token 與 user 物件存入 localStorage，之後所有 API 請求都會自動帶上 Bearer token。個人資料查詢透過 `/api/auth/profile` 驗證目前 token 對應的使用者是否仍存在，若資料庫已刪除該使用者，會回 `401` 要求重新登入。

### `POST /api/auth/register`

- 必填 body：
  - `email`
  - `password`
  - `name`
- 驗證規則：
  - `email` 必須符合基本 email regex
  - `password.length >= 6`
  - `email` 必須未註冊
- 業務邏輯：
  - 以 `bcrypt.hashSync(password, 10)` 建立 `password_hash`
  - 建立 `role = 'user'`
  - 重新查詢剛建立的 user
  - 發 JWT，payload 含 `userId`, `email`, `role`
- 成功回傳：
  - `data.user`
  - `data.token`

### `POST /api/auth/login`

- 必填 body：
  - `email`
  - `password`
- 業務邏輯：
  - 以 email 查 `users`
  - `bcrypt.compareSync` 驗證密碼
  - 發 JWT

### `GET /api/auth/profile`

- Header：
  - `Authorization: Bearer <token>`
- 業務邏輯：
  - `authMiddleware` 驗 JWT
  - 查詢使用者公開欄位 `id, email, name, role, created_at`

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | register/login 缺少必填欄位 |
| `400` | `VALIDATION_ERROR` | register 的 email 格式不正確 |
| `400` | `VALIDATION_ERROR` | register 的 password 少於 6 字 |
| `401` | `UNAUTHORIZED` | login 的 email 或 password 錯誤 |
| `401` | `UNAUTHORIZED` | profile 缺少 Bearer token |
| `401` | `UNAUTHORIZED` | token 無效或過期 |
| `401` | `UNAUTHORIZED` | token 對應使用者不存在 |
| `404` | `NOT_FOUND` | profile 查詢時使用者不存在 |
| `409` | `CONFLICT` | register 的 email 已被註冊 |

## 雙模式購物車

### 行為描述

購物車模組是本專案最特殊的機制。它允許兩種 owner：

- 會員模式：`cart_items.user_id = req.user.userId`
- 訪客模式：`cart_items.session_id = req.sessionId`

所有購物車 API 都先執行 `dualAuth()`：

1. 若有 Bearer token，先驗 token。
2. token 有效時走會員模式。
3. token 無效時直接 `401`，不退回 session。
4. 沒有 Bearer token 但有 `X-Session-Id` 時走訪客模式。
5. 兩者都沒有時 `401`。

這個設計的影響是：前端若 localStorage 中殘留失效 token，即使 `X-Session-Id` 存在，也會拿不到購物車，直到 token 被清掉。

### `GET /api/cart`

- Header：
  - `Authorization` 或 `X-Session-Id`
- 回傳：
  - `items[]`
  - `total`
- `total` 計算方式：
  - `sum(item.product.price * item.quantity)`
- 查詢只回傳商品 `name, price, stock, image_url`，不含 description

### `POST /api/cart`

- 必填 body：
  - `productId`
- 選填 body：
  - `quantity`，預設 `1`
- 驗證規則：
  - `quantity` 必須為正整數
  - 商品必須存在
  - 最終數量不能超過商品目前 `stock`
- 業務邏輯：
  - 先查 owner 名下是否已有同商品項目
  - 若已有：採累加模式 `existing.quantity + qty`
  - 若沒有：建立新 `cart_items`

這裡的關鍵不是覆蓋數量，而是累加。這會影響任何前端「加入購物車」按鈕的設計：連點同商品不會產生兩筆，而是同一筆數量增加。

### `PATCH /api/cart/:itemId`

- 必填 body：
  - `quantity`
- 驗證規則：
  - 正整數
  - 該 item 必須屬於目前 owner
  - 新數量不得超過庫存
- 行為：
  - 直接覆蓋 quantity

### `DELETE /api/cart/:itemId`

- 刪除目前 owner 名下的指定購物車項目
- 若 item 不屬於目前 owner，也視同不存在回 `404`

### 非標準機制與限制

- 訪客購物車與會員購物車互不合併。
- `cart_items` 沒有 unique index 防止同 owner + 同 product 重複；目前靠 route 先查再插入來維持唯一性。
- 前端 badge 顯示的是項目數近似值，不是總件數。

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `productId` 缺失 |
| `400` | `VALIDATION_ERROR` | `quantity` 非正整數 |
| `400` | `STOCK_INSUFFICIENT` | 新增或修改後的數量超過商品庫存 |
| `401` | `UNAUTHORIZED` | 沒有 Bearer token 且沒有 `X-Session-Id` |
| `401` | `UNAUTHORIZED` | Bearer token 無效或過期 |
| `401` | `UNAUTHORIZED` | Bearer token 對應使用者不存在 |
| `404` | `NOT_FOUND` | 商品不存在 |
| `404` | `NOT_FOUND` | 購物車項目不存在或不屬於目前 owner |

## 會員結帳與訂單建立

### 行為描述

只有登入會員可以建立訂單。前端從購物車頁點「前往結帳」時，如果尚未登入，會被導向 `/login?redirect=/checkout`。真正建立訂單的 API `POST /api/orders` 完全不理會訪客 `session_id` 購物車，只會讀取 `user_id` 對應的購物車項目。

### `POST /api/orders`

- Header：
  - `Authorization: Bearer <token>`
- 必填 body：
  - `recipientName`
  - `recipientEmail`
  - `recipientAddress`
- 驗證規則：
  - 三欄位都必填
  - `recipientEmail` 需符合 email regex
  - 購物車不可為空
  - 每個購物車項目的數量不得超過目前庫存

### 交易流程

建立訂單時會執行單一 SQLite transaction：

1. 建立 `orders`
2. 逐筆建立 `order_items`
3. 逐筆扣減 `products.stock`
4. 刪除該會員所有 `cart_items`

### `order_no` 生成

- 格式：`ORD-YYYYMMDD-XXXXX`
- 日期來自 `new Date().toISOString().slice(0, 10)`，因此是 UTC 日期字串，不一定等於使用者時區日期
- 尾碼取 `uuidv4().slice(0, 5).toUpperCase()`

### 金額邏輯

- `total_amount` 只計算商品價格乘數量
- 不包含前端頁面展示的運費 `150`
- 因此前端顯示的結帳總額可能高於後端訂單儲存值

### `GET /api/orders`

- 回目前登入會員的訂單摘要列表
- 排序：`created_at DESC`

### `GET /api/orders/:id`

- 只允許查自己的訂單
- 回傳：
  - 訂單基本資料
  - `items` 全欄位

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | 收件欄位缺失 |
| `400` | `VALIDATION_ERROR` | Email 格式不正確 |
| `400` | `CART_EMPTY` | 會員購物車為空 |
| `400` | `STOCK_INSUFFICIENT` | 至少一項購物車商品庫存不足 |
| `401` | `UNAUTHORIZED` | 未登入或 token 無效 |
| `404` | `NOT_FOUND` | 查詢不存在或不屬於自己的訂單 |

## 綠界付款與主動驗證

### 行為描述

訂單詳情頁若狀態為 `pending`，會提供：

- `前往綠界付款`
- `重新確認付款狀態`

前者會先向後端取回 AIO 表單欄位，前端再提交表單到綠界。後者則會在本地端主動呼叫綠界 `QueryTradeInfo` 驗證交易狀態。這是本專案對「本機環境收不到 Server Notify」的核心解法。

### `POST /api/orders/:id/payment/ecpay/checkout`

- Header：
  - `Authorization: Bearer <token>`
- 回傳內容：
  - `action`：AIO 付款 URL
  - `method`：固定 `POST`
  - `merchant_trade_no`
  - `fields`：需提交到綠界的表單欄位
- 前置條件：
  - 訂單必須存在且屬於目前會員
  - 訂單不可已付款
- 業務邏輯：
  - 若訂單尚未建立付款單，或上一次狀態為 `failed`，會重新產生新的 `merchant_trade_no`
  - 組裝 `MerchantTradeDate`, `TradeDesc`, `ItemName`, `ReturnURL`, `ClientBackURL`
  - 以 SHA256 產生 CheckMacValue

### `POST /api/orders/:id/payment/ecpay/verify`

- Header：
  - `Authorization: Bearer <token>`
- 前置條件：
  - 訂單必須存在且屬於目前會員
  - 訂單必須已有 `merchant_trade_no`
- 業務邏輯：
  - 後端呼叫 `https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5`
  - 驗證回應 `CheckMacValue`
  - `TradeStatus === '1'` 時將訂單標記為 `paid`
  - `TradeStatus === '10200095'` 時將訂單標記為 `failed`
  - 其他狀態維持原值，但更新 `payment_checked_at`

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `400` | `INVALID_STATUS` | 訂單已付款，不能再次建立付款單 |
| `400` | `PAYMENT_NOT_INITIALIZED` | 尚未建立綠界付款單就查詢付款狀態 |
| `401` | `UNAUTHORIZED` | 未登入或 token 無效 |
| `404` | `NOT_FOUND` | 訂單不存在或不屬於本人 |
| `502` | `PAYMENT_QUERY_FAILED` | 綠界查詢失敗、回應缺少或驗證失敗 |

## 後台商品管理

### 行為描述

後台商品頁 `/admin/products` 由前端 `Auth.requireAdmin()` 做頁面進入控制，實際資料安全仍由 API `authMiddleware + adminMiddleware` 控制。列表採分頁，每頁 10 筆。新增與編輯共用同一個 modal 表單，刪除前有確認對話框。

### `GET /api/admin/products`

- Header：
  - Bearer admin token
- 查詢參數：
  - `page` 預設 `1`
  - `limit` 預設 `10`，限制 `1..100`

### `POST /api/admin/products`

- 必填 body：
  - `name`
  - `price`
  - `stock`
- 選填 body：
  - `description`
  - `image_url`
- 驗證：
  - `name` 不可缺
  - `price` 必須是正整數
  - `stock` 必須是非負整數

### `PUT /api/admin/products/:id`

- 支援部分更新
- 驗證規則：
  - 若有提供 `name`，不可為空白字串
  - 若有提供 `price`，必須是正整數
  - 若有提供 `stock`，必須是非負整數
- `updated_at` 會更新為 `datetime('now')`

### `DELETE /api/admin/products/:id`

- 刪除前會檢查該商品是否出現在任何 `pending` 訂單中
- 若存在未完成訂單，回 `409`
- 若只存在 `paid` 或 `failed` 訂單，允許刪除

這是關鍵行為：系統只保護「未完成交易」的商品，不保護歷史訂單對應商品是否還存在。由於 `order_items` 已有快照欄位，所以歷史明細仍可顯示。

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `name` 缺失或空白 |
| `400` | `VALIDATION_ERROR` | `price` 非正整數 |
| `400` | `VALIDATION_ERROR` | `stock` 非非負整數 |
| `401` | `UNAUTHORIZED` | 未登入 |
| `403` | `FORBIDDEN` | 非 admin |
| `404` | `NOT_FOUND` | 商品不存在 |
| `409` | `CONFLICT` | 商品仍存在 `pending` 訂單中 |

## 後台訂單管理

### 行為描述

後台訂單頁 `/admin/orders` 顯示所有會員訂單，可依狀態篩選 `pending`, `paid`, `failed`。點列表列會打開 modal，前端再呼叫詳情 API 取得訂單、明細與下單使用者名稱 / email。

### `GET /api/admin/orders`

- Header：
  - Bearer admin token
- 查詢參數：
  - `page`：預設 `1`
  - `limit`：預設 `10`，限制 `1..100`
  - `status`：選填；只有 `pending`, `paid`, `failed` 三值會套用條件
- 行為：
  - 若 `status` 值不在白名單內，程式不會報錯，只是忽略篩選

### `GET /api/admin/orders/:id`

- 回傳：
  - 訂單完整欄位
  - `items`
  - `user`：從 `users` 查出的 `name`, `email`
- 若使用者已不存在，`user` 會是 `null`

### 錯誤碼與情境

| HTTP | error | 情境 |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | 未登入 |
| `403` | `FORBIDDEN` | 非 admin |
| `404` | `NOT_FOUND` | 訂單不存在 |

## 頁面層功能補充

### Header 與登入狀態

- `header-init.js` 會在前台頁面初始化：
  - 登入 / 登出按鈕
  - 管理後台連結
  - 我的訂單連結顯示
  - 購物車 badge

### 重新導向機制

- `Auth.requireAuth()`：
  - 未登入就跳 `/login?redirect=<current-path>`
- `Auth.requireAdmin()`：
  - 未登入或非 admin 都跳 `/login`
- `apiFetch()` 遇到 `401`：
  - 清掉 token/user
  - 直接導 `/login`

### 前端顯示與後端資料的不一致點

- 購物車頁與結帳頁會顯示滿 `500` 免運，否則運費 `150`
- 訂單 API 與資料庫沒有運費欄位
- 首頁與商品頁加入購物車後，header badge 只做簡單遞增，不重新同步實際購物車總件數
- 訂單詳情頁的付款成功畫面不是依靠 server callback 即時推送，而是回跳後再次查綠界 API 得出結果
