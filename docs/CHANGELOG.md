# 變更日誌

## 2026-04-18

### Documentation

- 新建 `docs/README.md`，整理專案介紹、快速開始、技術棧與文件索引。
- 新建 `docs/ARCHITECTURE.md`，記錄系統架構、目錄用途、啟動流程、路由、認證與資料庫 schema。
- 新建 `docs/DEVELOPMENT.md`，記錄命名規則、模組系統、環境變數、JSDoc 規範與計畫歸檔流程。
- 新建 `docs/FEATURES.md`，逐一整理功能行為、參數、錯誤碼與已完成 / 未完成狀態。
- 新建 `docs/TESTING.md`，整理測試檔案、執行順序、輔助函式、撰寫方式與常見陷阱。
- 重寫根目錄 `AGENTS.md`，讓專案規則與文件入口一致。

### Payment

- 串接綠界 ECPay AIO 付款流程。
- 新增本地端主動查詢 `QueryTradeInfo` 的付款確認機制，取代本機環境無法接收 Server Notify 的限制。
- 訂單新增 ECPay 交易欄位保存 `merchant_trade_no`、`ecpay_trade_no`、`payment_type`、`payment_date` 與查詢時間。
- 訂單詳情頁改為「前往綠界付款 / 重新確認付款狀態」流程。
- 測試新增 ECPay checkout 與付款查詢驗證路徑。

### Notes

- 現況確認前端顯示運費，但後端訂單金額未包含運費。
