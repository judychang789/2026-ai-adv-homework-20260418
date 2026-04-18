# AGENTS.md

## 專案概述
Flower Life 電商示範專案，使用 Node.js、Express、SQLite、EJS、Vue 3 與 Tailwind CSS 建構。後端同時提供 REST API 與 EJS 頁面，前端頁面則以 Vue 3 直接掛載在 EJS 模板上。資料層採 `better-sqlite3` 直接在 route 中執行 SQL，購物車支援會員 JWT 與訪客 `X-Session-Id` 兩種識別模式。

## 常用指令
- `npm install`
- `npm run start`
- `npm run dev:server`
- `npm run dev:css`
- `npm run css:build`
- `npm run openapi`
- `npm run test`

## 關鍵規則
- API 回應格式統一為 `{ data, error, message }`，錯誤情境也必須維持相同結構。
- 後台 API 必須先經過 `authMiddleware`，再經過 `adminMiddleware` 驗證管理員角色。
- 購物車是雙模式機制：登入會員走 JWT `Authorization: Bearer <token>`，訪客走 `X-Session-Id`。
- 訂單建立時會在 SQLite transaction 內同時建立訂單、寫入明細、扣減庫存、清空會員購物車。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`，並同步更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。

## 詳細文件
- `./docs/README.md` — 項目介紹、快速開始、技術棧、文件索引
- `./docs/ARCHITECTURE.md` — 架構、目錄結構、資料流、路由、資料庫與啟動流程
- `./docs/DEVELOPMENT.md` — 開發規範、命名規則、模組系統、環境變數、計畫歸檔流程
- `./docs/FEATURES.md` — 功能列表、完成狀態、行為描述、錯誤情境與非標準機制
- `./docs/TESTING.md` — 測試規範、測試檔案、執行順序、輔助函式與撰寫方式
- `./docs/CHANGELOG.md` — 文件建立與後續更新日誌
