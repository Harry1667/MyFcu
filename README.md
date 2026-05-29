# MyFcu — 逢甲多帳號打卡 web app

幫你管理多個 FCU 帳號 + 批次打卡。Phase 1 聚焦在打卡，沒做校務系統整合。

## 功能

- 註冊 WebApp 帳號 + 加密儲存多個 FCU 帳密（AES-256-GCM + Argon2id KDF）
- **課堂打卡（QR 掃描）：完全自動化**。掃一次 QR → 為選中的 N 個帳號同時送打卡
- 助學服務刷卡 / 活動簽到 / 計畫助理簽到：半自動（複製密碼到剪貼簿 + 開啟 FCU 登入頁）

## 為什麼三種「認證碼模式」沒做到全自動

FCU 的 .aspx WebForms 流程有 session-bound 的 ViewState/EventValidation 三件套，跨網域瀏覽器無法讀回應、無法接續 PostBack。而且部分提交需要校內 wifi IP，後端代理也走不通。詳細設計權衡寫在 `01-dev/3-TechStack.md`（仓庫外）。

## 技術棧

- Next.js 16 + React 19（App Router、Turbopack）
- TypeScript、Tailwind CSS v4
- Drizzle ORM + libsql/SQLite（dev）→ PostgreSQL（production，預定）
- Auth.js v5 Credentials Provider + JWT session（master key 放在加密 JWT cookie 內）
- `@node-rs/argon2` 做 Argon2id（密碼 hash + master key 衍生）
- `html5-qrcode` 做相機掃碼
- AES-256-GCM 加密 FCU 密碼

## 安全模型

- WebApp 密碼 → Argon2id hash 存 DB（password_hash）
- WebApp 密碼 + per-user salt → Argon2id → 32-byte master_key
- master_key + AES-256-GCM 加密每組 FCU 密碼
- DB 單獨被偷 → 密文無解
- master_key 存在 Auth.js 加密 JWT cookie 內（用 `AUTH_SECRET` 加密），server 重啟不會失效
- **忘記 WebApp 密碼 → FCU 帳密永久救不回**（不提供密碼重設）

## 開發

```bash
bun install
bun run db:migrate
bun run dev
```

需要的 `.env.local`：

```
DATABASE_URL=file:./dev.db
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000
```

## 致謝 / Reference

- [poyu39/FcuQrApp](https://github.com/poyu39/FcuQrApp) — 提供了 `ClassClockinQR.aspx` 端點的逆向參考
- [mikucat0309/Open-FCU](https://github.com/mikucat0309/Open-FCU) — FCU 整合的優秀 reference
