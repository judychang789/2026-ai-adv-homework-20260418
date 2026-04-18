# ECPay 串接計畫

## 文件定位

本文件用於整理 Flower Life 專案目前已完成的 ECPay 串接實作，作為後續維護、文件同步與測試補強的依據。內容以現況為準，只描述目前專案內已存在的設計與流程，不延伸未實作功能。

## 目標

### 主要目標

- 為會員訂單提供可用的綠界 ECPay AIO 付款流程。
- 讓使用者可從訂單詳情頁導向綠界付款頁完成付款。
- 在本機開發環境無法穩定接收綠界 Server Notify 的前提下，仍可正確確認付款結果。
- 將付款結果同步回訂單資料，讓訂單狀態、交易編號與付款資訊可被後台與前台查閱。

### 範圍界定

- 僅支援會員訂單付款，不包含訪客訂單付款。
- 串接模式為 ECPay AIO `AioCheckOut/V5`。
- 付款結果確認以主動查詢 `QueryTradeInfo/V5` 為主，callback 為輔。
- 不含退款、取消授權、電子發票、物流、定期定額、信用卡綁定等延伸功能。

## 架構決策

### 1. 採用 AIO 導轉式付款

選擇 AIO 而非站內付或自建金流頁，原因如下：

- 專案目前為 EJS + Vue 3 的輕量混合架構，AIO 整合成本最低。
- 前端只需向後端取得表單欄位，再透過隱藏表單 POST 到綠界。
- 付款敏感流程集中在綠界頁面，降低前端處理複雜度。

### 2. CheckMacValue 與 ECPay 細節集中於 service 層

`src/services/ecpay.js` 負責：

- 環境切換與基礎網址選擇
- `CheckMacValue` 產生與驗證
- `MerchantTradeNo` 生成
- AIO 表單欄位組裝
- `QueryTradeInfo` 主動查詢

這樣的拆分讓 route 層只保留訂單權限、資料查詢與狀態更新邏輯，避免 ECPay 細節散落於多個路由。

### 3. 付款結果採「主動查詢為主、callback 為輔」

此為本次串接最重要的架構決策：

- 保留 `/api/orders/payment/ecpay/callback` 接收綠界 Server Notify。
- 但本機開發與一般示範環境不依賴 callback 作為最終付款確認來源。
- 使用者自綠界返回訂單頁後，由前端主動呼叫 `/api/orders/:id/payment/ecpay/verify`。
- 後端再向綠界 `QueryTradeInfo/V5` 查詢真實交易狀態並驗證回應 `CheckMacValue`。

這個做法可降低開發環境無公開網址、callback 不穩定或未送達時的整體風險。

### 4. 訂單狀態與付款欄位解耦

訂單仍沿用既有 `status` 欄位，但額外保存付款相關資料：

- `merchant_trade_no`
- `ecpay_trade_no`
- `payment_type`
- `payment_date`
- `payment_checked_at`

這讓專案可以同時追蹤：

- 目前訂單狀態
- 對外送往 ECPay 的交易編號
- 綠界實際回傳的交易資訊
- 最近一次查詢時間

### 5. 失敗交易允許重新建立付款單

若訂單：

- 尚未建立 `merchant_trade_no`，或
- 目前狀態為 `failed`

則 checkout API 會重新產生新的 `merchant_trade_no`，並重置既有付款欄位。此設計可避免重複使用已失敗的交易編號，符合 ECPay 交易號需具唯一性的要求。

## API 設計

所有 API 都維持專案既有回應格式：

```json
{
  "data": {},
  "error": null,
  "message": "..."
}
```

### 1. `POST /api/orders/payment/ecpay/callback`

#### 目的

接收綠界伺服器端通知。

#### 存取方式

- 不需會員 JWT
- 由綠界伺服器以表單 POST 呼叫

#### 核心處理

- 驗證必要欄位 `MerchantTradeNo` 與 `CheckMacValue`
- 驗證 callback `CheckMacValue`
- 依 `merchant_trade_no` 找到對應訂單
- 若 `RtnCode = 1`，將訂單視為付款成功並寫入付款資料
- 成功時回傳純文字 `1|OK`

#### 角色定位

- 提供正式環境可用的被動通知入口
- 但目前不作為本專案付款成功的唯一依據

### 2. `POST /api/orders/:id/payment/ecpay/checkout`

#### 目的

為指定會員訂單建立 AIO 付款表單欄位。

#### 驗證條件

- 必須通過 JWT 驗證
- 訂單必須存在且屬於目前會員
- 訂單不可為 `paid`

#### 核心處理

- 讀取訂單與明細
- 依條件決定是否重建 `merchant_trade_no`
- 將訂單付款欄位重置為待確認狀態
- 呼叫 `buildAioCheckoutParams()` 組出 ECPay AIO 所需欄位
- 回傳：
  - `action`
  - `method`
  - `merchant_trade_no`
  - `fields`

#### 表單欄位設計

目前包含：

- `MerchantID`
- `MerchantTradeNo`
- `MerchantTradeDate`
- `PaymentType=aio`
- `TotalAmount`
- `TradeDesc`
- `ItemName`
- `ReturnURL`
- `ClientBackURL`
- `ChoosePayment=ALL`
- `NeedExtraPaidInfo=Y`
- `EncryptType=1`
- `CheckMacValue`

#### 錯誤情境

- `404 NOT_FOUND`：訂單不存在或不屬於目前會員
- `400 INVALID_STATUS`：訂單已付款，不能再次建立付款單

### 3. `POST /api/orders/:id/payment/ecpay/verify`

#### 目的

由前端在綠界回跳後，主動查詢交易最新結果。

#### 驗證條件

- 必須通過 JWT 驗證
- 訂單必須存在且屬於目前會員
- 訂單必須已有 `merchant_trade_no`

#### 核心處理

- 使用訂單上的 `merchant_trade_no` 呼叫 `QueryTradeInfo/V5`
- 驗證綠界查詢回應中的 `CheckMacValue`
- 將交易結果同步回訂單欄位
- 回傳訂單最新狀態與付款摘要

#### 狀態映射

- `TradeStatus = '1'`：訂單狀態更新為 `paid`
- `TradeStatus = '10200095'`：訂單狀態更新為 `failed`
- 其他狀態：保留原狀態，但更新 `payment_checked_at`

#### 錯誤情境

- `404 NOT_FOUND`：訂單不存在或不屬於目前會員
- `400 PAYMENT_NOT_INITIALIZED`：尚未建立付款單
- `502 PAYMENT_QUERY_FAILED`：綠界查詢失敗、缺少必要欄位或 `CheckMacValue` 驗證失敗

## 資料庫變更

### `orders` 表新增欄位

目前透過 `src/database.js` 的 `ensureOrdersColumns()` 補齊下列欄位：

| 欄位 | 型別 | 用途 |
| --- | --- | --- |
| `merchant_trade_no` | `TEXT` | 本系統送往 ECPay 的交易編號 |
| `ecpay_trade_no` | `TEXT` | 綠界實際交易編號 |
| `payment_type` | `TEXT` | 綠界回傳的付款方式 |
| `payment_date` | `TEXT` | 綠界回傳的付款時間 |
| `payment_checked_at` | `TEXT` | 最近一次付款查詢或同步時間 |

### 索引

- 建立唯一索引 `idx_orders_merchant_trade_no`
- 目的為避免同一 `merchant_trade_no` 對應多張訂單

### 資料流影響

#### 建立訂單時

- 訂單初始狀態為 `pending`
- 尚未有任何 ECPay 交易欄位資料

#### 建立付款單時

- 寫入或重建 `merchant_trade_no`
- 清空 `ecpay_trade_no`
- 清空 `payment_type`
- 清空 `payment_date`
- 更新 `payment_checked_at`
- 將狀態設為 `pending`

#### 驗證付款結果時

- 寫入 `ecpay_trade_no`
- 寫入 `payment_type`
- 寫入 `payment_date`
- 更新 `payment_checked_at`
- 依查詢結果將狀態更新為 `paid` 或 `failed`

## 前端流程

### 頁面入口

- 訂單詳情頁：`/orders/:id`
- 前端實作：`public/js/pages/order-detail.js`

### 使用者流程

1. 使用者進入訂單詳情頁。
2. 前端先呼叫 `GET /api/orders/:id` 取得訂單資料。
3. 若訂單狀態為 `pending`，畫面顯示：
   - `前往綠界付款`
   - `重新確認付款狀態`
4. 使用者點擊「前往綠界付款」後，前端呼叫 `POST /api/orders/:id/payment/ecpay/checkout`。
5. 前端收到 `action` 與 `fields` 後，動態建立隱藏表單並提交到綠界付款頁。
6. 綠界付款完成後，瀏覽器透過 `ClientBackURL` 返回 `/orders/:id?payment=returned`。
7. 頁面重新載入時，前端讀取 `payment=returned`，若訂單尚未是 `paid` 且已有 `merchant_trade_no`，會自動呼叫 `POST /api/orders/:id/payment/ecpay/verify`。
8. 前端依查詢結果顯示：
   - `success`
   - `failed`
   - `pending`
9. 使用者也可手動點擊「重新確認付款狀態」再次觸發 verify API。

### 前端狀態顯示

目前頁面已定義：

- 訂單狀態標籤：`pending`、`paid`、`failed`
- 付款結果訊息：`success`、`failed`、`cancel`、`returned`、`pending`

這使前端可清楚區分：

- 訂單狀態本身
- 使用者從綠界返回後的暫時 UI 提示

## 測試策略

### 現有覆蓋範圍

目前 `tests/orders.test.js` 已覆蓋：

- 建立訂單成功
- 空購物車建單失敗
- 未授權建單失敗
- 訂單列表與詳情
- 建立 ECPay AIO 付款表單欄位
- 模擬 `QueryTradeInfo` 成功後將訂單更新為 `paid`
- 不存在訂單時回傳 `404`

### 測試方法

#### 1. API 整合測試

以 Supertest 驗證：

- 訂單 API 權限控制
- checkout API 是否回傳正確欄位
- verify API 是否正確處理訂單狀態更新

#### 2. 外部服務隔離

`QueryTradeInfo` 不直接打實際綠界，而是透過 mock `global.fetch`：

- 模擬綠界查詢成功
- 模擬合法 `CheckMacValue` 回應
- 驗證本地狀態更新結果

#### 3. 加密驗證

測試使用 `generateCheckMacValue()` 產生模擬回應的簽章，確保測試資料格式與實作一致，避免只測到假資料結構，卻沒測到簽章驗證流程。

### 建議補強項目

依目前文件與測試狀態，後續可補強：

- callback route 的 `CheckMacValue` 驗證與成功回寫流程
- `TradeStatus = '10200095'` 時應將訂單標記為 `failed`
- 查詢他人訂單或對他人訂單操作付款 API 的拒絕行為
- 綠界查詢失敗、缺少 `CheckMacValue`、簽章驗證失敗時的 `502` 路徑
- 已付款訂單再次呼叫 checkout API 的 `INVALID_STATUS`

### 測試原則

- 付款相關測試以 API 層為核心，不重新執行真實金流流程
- 所有外部綠界呼叫皆應可被 mock，避免測試依賴網路與外部環境
- 測試重點放在狀態轉換、資料持久化與錯誤處理一致性

## 交付結論

目前 ECPay 串接已完成以下最小可用閉環：

- 會員可為訂單建立綠界 AIO 付款表單
- 前端可導轉至綠界付款頁
- 使用者回跳後可主動向綠界查詢付款結果
- 後端可驗證 `CheckMacValue` 並同步更新訂單付款資料
- 專案已具備基本自動化測試覆蓋核心成功路徑

本計畫文件後續可作為：

- `docs/FEATURES.md` 的細部設計參考
- 維護人員理解付款流程的入口文件
- 後續補測與正式環境強化 callback 流程的基準
