# 測試規範與指南

## 測試框架與執行模式

本專案使用：

- Vitest 作為測試 runner
- Supertest 直接對 Express app 發 request

測試不是平行執行。`vitest.config.js` 明確設定：

- `fileParallelism: false`
- 固定檔案順序

固定順序如下：

1. `tests/auth.test.js`
2. `tests/products.test.js`
3. `tests/cart.test.js`
4. `tests/orders.test.js`
5. `tests/adminProducts.test.js`
6. `tests/adminOrders.test.js`

這個順序很重要，因為測試使用同一份 SQLite 檔案與同一個 app 啟動流程，資料會持續累積，不是每個 test file 都獨立 database reset。

## 測試檔案表

| 檔案 | 覆蓋範圍 | 依賴 |
| --- | --- | --- |
| `tests/setup.js` | 共用 helper 與 `app` | 所有測試 |
| `tests/auth.test.js` | 註冊、登入、profile | 依賴 seed admin |
| `tests/products.test.js` | 商品列表、分頁、詳情 | 依賴 seed products |
| `tests/cart.test.js` | 訪客與會員購物車 | 依賴商品資料 |
| `tests/orders.test.js` | 建立訂單、訂單列表、詳情 | 依賴購物車與商品資料 |
| `tests/adminProducts.test.js` | 後台商品 CRUD | 依賴 seed admin |
| `tests/adminOrders.test.js` | 後台訂單列表、篩選、詳情、權限 | 依賴 seed admin、動態建立訂單 |

## 測試初始化與資料來源

### app 初始化

`tests/setup.js` 直接 `require('../app')`。這會連帶執行：

1. `app.js`
2. `src/database.js`
3. schema 建立
4. seed admin / products

因此測試啟動不需要額外 migration 或 seed 指令。

### 管理員測試資料

管理員帳號固定來自 seed：

- email: `admin@hexschool.com`
- password: `12345678`

### 測試環境 bcrypt

`src/database.js` 會在 `NODE_ENV === 'test'` 時以 salt rounds `1` 建立管理員密碼 hash，減少測試時間。

## 輔助函式說明

### `getAdminToken()`

位置：`tests/setup.js`

用途：

- 透過 `/api/auth/login` 登入 seed admin
- 回傳 `res.body.data.token`

適用：

- 後台商品
- 後台訂單

### `registerUser(overrides = {})`

位置：`tests/setup.js`

用途：

- 動態生成唯一 email
- 呼叫 `/api/auth/register`
- 回傳 `{ token, user }`

可覆寫：

- `email`
- `password`
- `name`

重要性：

- 這個 helper 讓大多數測試避免互相撞 email
- 若你手動寫固定 email，重跑測試可能因 duplicate email 失敗

## 現有測試覆蓋內容

### `auth.test.js`

覆蓋：

- 註冊成功
- 重複 email 註冊失敗
- admin 登入成功
- 錯誤密碼登入失敗
- 有效 token 取得 profile
- 無 token 取得 profile 失敗

### `products.test.js`

覆蓋：

- 商品列表
- 分頁參數
- 商品詳情
- 不存在商品 `404`

### `cart.test.js`

覆蓋：

- 訪客模式加入購物車
- 訪客模式查看購物車
- 訪客模式修改數量
- 訪客模式移除商品
- 會員模式加入購物車
- 加入不存在商品失敗

未覆蓋但重要：

- Bearer token 無效時不 fallback session
- 累加加入同商品的數量邏輯
- 庫存不足錯誤

### `orders.test.js`

覆蓋：

- 建立訂單成功
- 空購物車建單失敗
- 未授權建單失敗
- 訂單列表
- 訂單詳情
- 建立 ECPay AIO 付款表單欄位
- 模擬 `QueryTradeInfo` 後將訂單更新為已付款
- 不存在訂單 `404`

未覆蓋但重要：

- 庫存不足時建單失敗
- 非本人訂單存取失敗
- callback route 的 CheckMacValue 驗證與更新流程

### `adminProducts.test.js`

覆蓋：

- 後台列表
- 新增商品
- 更新商品
- 刪除商品
- 一般會員被拒絕
- 未帶 token 被拒絕

未覆蓋但重要：

- 刪除 pending 訂單中的商品應回 `409`
- 更新空白名稱或錯誤價格 / 庫存的驗證

### `adminOrders.test.js`

覆蓋：

- 後台訂單列表
- 狀態篩選
- 後台訂單詳情
- 一般會員不可存取

未覆蓋但重要：

- 未帶 token 被拒絕
- 非法 `status` 值被忽略的行為

## 執行順序與依賴關係

### 為什麼順序固定

測試使用真實 SQLite 檔案與同一組 seed，不做 isolate。固定順序可以降低互相污染造成的不確定性。例如：

- `products.test.js` 先抓商品 ID
- `cart.test.js` 與 `orders.test.js` 都依賴商品存在
- `adminOrders.test.js` 會自行建立一張訂單，依賴前面路由功能可用

### 撰寫新測試時的依賴判斷

新增 test file 前，先判斷它是否：

- 需要 admin token
- 需要現成商品
- 需要預先建立購物車或訂單
- 會改動共享資料，例如刪商品、扣庫存

若會大幅改動共享資料，建議：

- 在 `beforeAll` 建立自己需要的資料
- 不要依賴其他 test file 的副作用
- 必要時把新檔案放到序列末端，減少對既有檔案干擾

## 撰寫新測試的步驟

1. 在 `tests/` 新增 `<feature>.test.js`
2. 引入需要的 helper：

```js
const { app, request, getAdminToken, registerUser } = require('./setup');
```

3. 在 `beforeAll` 建立測試資料
4. 使用 Supertest 對 `app` 直接發 request
5. 驗證：
   - `status`
   - `body.data`
   - `body.error`
   - `body.message`
6. 若要固定執行順序，更新 `vitest.config.js` 的 `sequence.files`

## 新測試範例

### 範例：測試付款成功

```js
const { app, request, registerUser } = require('./setup');

describe('Order Payment API', () => {
  let token;
  let orderId;

  beforeAll(async () => {
    const user = await registerUser();
    token = user.token;

    const productRes = await request(app).get('/api/products');
    const productId = productRes.body.data.products[0].id;

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientName: '付款測試',
        recipientEmail: 'pay@example.com',
        recipientAddress: '台北市測試路 1 號',
      });

    orderId = orderRes.body.data.id;
  });

  it('should mark order as paid', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'success' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.error).toBeNull();
  });
});
```

## 常見陷阱

- 不要使用固定 email 註冊測試使用者，重跑會撞唯一鍵。
- 共享 SQLite 檔案代表某些操作有順序依賴，特別是刪商品、扣庫存。
- 若你新增會改 schema 的功能，舊的 `database.sqlite` 可能讓測試在本地行為與 CI 不一致。
- `apiFetch` 是前端工具，測試不會走它；API 行為要用 Supertest 直接驗證。
- 會員購物車與訪客購物車是兩套 owner，不要在測試中混用 token 與 sessionId 後期待看到同一份資料。

## 建議補強的測試清單

- 購物車累加同商品數量
- Bearer token 無效時購物車直接 `401`
- 建單時庫存不足
- `POST /api/orders/:id/payment/ecpay/verify` 在 `TradeStatus=10200095` 時應標記為付款失敗
- admin 刪除 pending 訂單商品回 `409`
- 非本人查詢訂單應 `404`
