# MyFcu — 逢甲多帳號打卡 web app

幫你管理多個 FCU 帳號 + 批次打卡。打開網頁 → 新增帳號 → 點頭像 → 打卡，沒有註冊登入步驟。

## 功能

- 開即用，無 WebApp 帳號系統。資料存伺服器 SQLite，FCU 密碼以 AES-256-GCM 加密（金鑰由 `AUTH_SECRET` 衍生）
- 多帳號頭像 grid，多選 + 4 種打卡模式
- **課堂打卡（QR 掃描）：完全自動化**。掃一次 QR → 為選中的 N 個帳號同時送打卡
- 助學服務刷卡 / 活動簽到 / 計畫助理簽到：半自動（複製密碼到剪貼簿 + 開啟 FCU 登入頁）

## 為什麼三種「認證碼模式」沒做到全自動

FCU 的 .aspx WebForms 流程有 session-bound 的 ViewState/EventValidation 三件套，跨網域瀏覽器無法讀回應、無法接續 PostBack。而且部分提交需要校內 wifi IP，後端代理也走不通。

## 安全模型

⚠️ **這個 app 沒有任何身份驗證**。任何人打開網址都能看到、用、刪除所有 FCU 帳號。網址要保密。

- FCU 密碼在 DB 內以 AES-256-GCM 密文存放
- 加密金鑰 = `SHA-256(AUTH_SECRET)` — `AUTH_SECRET` 只在伺服器 `.env.local`
- 單獨偷 DB 沒有 `AUTH_SECRET` 解不開
- 但只要拿到伺服器整套（DB + .env）就能解所有密碼

## 技術棧

- Next.js 16 + React 19（App Router、Turbopack）
- TypeScript、Tailwind CSS v4
- Drizzle ORM + libsql / SQLite
- AES-256-GCM（Node 內建 crypto）
- `html5-qrcode`

## 開發

```bash
bun install
bun run db:migrate
bun run dev
```

`.env.local`：

```
DATABASE_URL=file:./dev.db
AUTH_SECRET=<openssl rand -base64 32>
```

⚠️ **`AUTH_SECRET` 換掉等於整個 DB 解不開**。生產環境千萬不要動。

## 部署

- Production：`https://myfcu.looptw.com`
- Server：`looptw.com:/www/wwwroot/myfcu.looptw.com`
- PM2：`myfcu-web`（port 3013）

## 致謝 / Reference

- [poyu39/FcuQrApp](https://github.com/poyu39/FcuQrApp) — 提供了 `ClassClockinQR.aspx` 端點的逆向參考
- [mikucat0309/Open-FCU](https://github.com/mikucat0309/Open-FCU) — FCU 整合的 reference
