---
title: ADR (意思決定記録)
description: Nx + Angular + NestJS アーキテクチャにおける主要な意思決定とその根拠
---

> 旧 OpsHub (Next.js + Supabase) の ADR-0001〜0006 を新アーキテクチャに移行・統合。
> ADR-0005 (Supabase CLI) は廃止。

---

## ADR-0001: RBAC 実装方式の選定

| 項目 | 内容 |
|---|---|
| ステータス | **Superseded**（旧: RLS → 新: NestJS Guards + Prisma Middleware） |
| 日付 | 2026-02-22（原案）→ 2026-02-25（改定） |

### コンテキスト
OpsHub は6ロール（Member, Approver, PM, Accounting, IT Admin, Tenant Admin）を持つマルチテナント業務アプリ。
旧アーキテクチャでは PostgreSQL RLS で DB 層での強制的なアクセス制御を実現していた。

### 決定: NestJS Guards + Prisma Middleware

| レイヤー | 旧 (Supabase) | 新 (NestJS) |
|---|---|---|
| 認証 | GoTrue JWT | Passport.js JWT Strategy |
| 認可 (API) | Middleware + Server Component | `@Roles()` + `RolesGuard` |
| データ分離 | RLS Policy | `TenantMiddleware` (Prisma) |
| ロール管理 | `user_roles` テーブル + RLS | `UserRole` モデル + `JwtStrategy.validate()` |

### 理由
- NestJS の Decorator + Guard パターンが **公式のベストプラクティス**
- Prisma `$extends` でテナント分離を実現し、RLS と同等のセキュリティ
- アプリ層での制御により **テスト容易性が向上**（Guard の単体テスト可能）

### 参照
- [Guard/Middleware設計](../detail/guard-design/)
- [NestJS 共通基盤](../detail/common-infrastructure/)

---

## ADR-0002: 監査ログ方式

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted → Updated** |
| 日付 | 2026-02-23（原案）→ 2026-02-25（改定） |

### 決定: AuditInterceptor (NestJS) + Prisma Middleware (append-only)

| 項目 | 旧 (Supabase) | 新 (NestJS) |
|---|---|---|
| 記録方式 | Server Action 内で明示的に INSERT | `AuditInterceptor` で CUD 操作を自動記録 |
| 改ざん防止 | RLS (INSERT ONLY) | `AuditLogMiddleware` (Prisma) で UPDATE/DELETE を禁止 |
| DB トリガ併用 | 重要テーブルのみトリガ | なし（Interceptor で統一） |

### 理由
- NestJS Interceptor で **全 CUD 操作を自動キャプチャ** → 記録漏れリスクを排除
- DB トリガは NestJS アーキテクチャでは不要（アプリ層で完結）
- Prisma Middleware で append-only を保証

### 参照
- [監査ログ方針](../spec/audit-logging/)
- [AuditInterceptor](../detail/common-infrastructure/#auditinterceptor)

---

## ADR-0003: マルチテナント分離戦略

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted → Updated**（実装手段のみ変更） |
| 日付 | 2026-02-22（原案）→ 2026-02-25（改定） |

### 決定: `tenant_id` カラム + Prisma Middleware + AsyncLocalStorage

基本方針は旧 ADR と同じ（`tenant_id` カラムによる論理分離）。実装手段のみ変更:

| 項目 | 旧 | 新 |
|---|---|---|
| 分離の強制 | RLS Policy | `TenantMiddleware` (Prisma) |
| テナント特定 | `auth.uid()` → user_roles JOIN | `X-Tenant-Id` ヘッダー + `TenantInterceptor` → AsyncLocalStorage |
| Index 規約 | 同じ（`tenant_id` をリーディングカラム） | 同じ |

### 設計規約（不変）
1. 全業務テーブルに `tenantId String @map("tenant_id")` を付与
2. Index は `@@index([tenantId, ...])` を先頭に
3. 例外: `Tenant`, `User` テーブル

### 参照
- [Prisma セットアップ — TenantMiddleware](../detail/prisma-setup/#tenantmiddleware)

---

## ADR-0004: profiles テーブルによるユーザー表示名

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted → Updated** |
| 日付 | 2026-02-24（原案）→ 2026-02-25（改定） |

### 決定: `Profile` モデル（Prisma）+ User 登録時の自動作成

| 項目 | 旧 | 新 |
|---|---|---|
| テーブル | `public.profiles` + auth トリガー同期 | `Profile` Prisma モデル |
| 同期方法 | DB トリガー（`handle_new_user()`） | `AuthService.register()` で Profile を同時作成 |
| 参照方法 | Supabase `select("*, profiles(display_name)")` | Prisma `include: { profile: true }` |

### 理由
- Prisma のリレーション (`include`) で JOIN が自然に記述可能
- DB トリガー不要 → SQLite 開発環境でも動作
- アプリ層で Profile 作成を制御 → テスト容易

### 参照
- [DB設計 — Profile モデル](../detail/db/)

---

## ADR-0005: ローカル開発環境（廃止）

| 項目 | 内容 |
|---|---|
| ステータス | **Deprecated** |
| 日付 | 2026-02-24 |

旧 ADR-0005 (Supabase CLI vs Docker Compose) は **新アーキテクチャでは不要**。
Supabase は使用しないため、ローカル開発環境は以下で構成:

- **DB**: Docker Compose で PostgreSQL 16 起動
- **API**: `nx serve api` (NestJS)
- **Web**: `nx serve web` (Angular)
- **Prisma**: `npx prisma migrate dev` + `npx prisma db seed`

---

## ADR-0006: 検索方式の選定

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted**（変更なし） |
| 日付 | 2026-02-25 |

### 決定: pg_trgm + GIN インデックス（変更なし）

検索方式自体は変更なし。実装レイヤーが Server Action → NestJS Service に移行:

| 項目 | 旧 | 新 |
|---|---|---|
| 検索実行 | Supabase Client + `.ilike()` | `SearchService` + Prisma `$queryRaw` |
| テナント分離 | RLS | `TenantMiddleware` が自動付与 |
| API | Server Action | `GET /api/search?q=keyword` |

### 参照
- [検索モジュール設計](../detail/modules/search/)

---

## ADR-0007: テストフレームワーク選定（新規）

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted** |
| 日付 | 2026-02-26 |

### コンテキスト
Nx + Angular + NestJS 構成でのテストフレームワークを選定する必要がある。

### 決定: Vitest (Unit/Integration) + Playwright (E2E)

| 用途 | ツール | 理由 |
|---|---|---|
| Unit テスト | Vitest | Vite エコシステムとの統合、Jest 互換 API、高速 |
| Angular テスト | Vitest + `@analogjs/vitest-angular` | Zone.js セットアップ統合 |
| E2E テスト | Playwright | マルチブラウザ対応、Angular 公式推奨 |
| API テスト | Vitest + `@nestjs/testing` | NestJS 公式の `Test.createTestingModule` |

### テスト戦略
- **各モジュール開発時に NestJS Service テスト + Angular Component テスト を必ず作成**
- カバレッジ目標: Service 80%+, Controller 70%+
- E2E は主要フロー（ログイン → CRUD → ログアウト）をカバー

### 参照
- [テスト戦略](../testing/strategy/)
- [モジュールテストパターン](../testing/module-test-patterns/)

---

## ADR-0008: UI ライブラリの PrimeNG 21 移行（新規）

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted** |
| 日付 | 2026-02-28 |

### コンテキスト
Phase 1 では Angular Material を UI ライブラリとして導入予定だったが、業務アプリケーションに必要なリッチなテーブル・フォーム・ダイアログコンポーネントの充実度を考慮し、PrimeNG に変更した。

### 決定: PrimeNG 21 (Aura テーマ) + PrimeIcons

| 比較軸 | Angular Material | PrimeNG |
|---|---|---|
| テーブル | 基本的な CDK Table | ソート・フィルター・ページネーション内蔵 |
| フォーム | 基本コンポーネント | DatePicker, InputNumber, Select 等豊富 |
| テーマ | Material Design 固定 | Aura・Lara・Nora 等選択可能 |
| バンドルサイズ | 大きい | Tree-shakable で軽量 |
| アイコン | Material Icons | PrimeIcons (`pi pi-xxx`) |

### 理由
- エンタープライズ向けの機能が充実（Table のソート/フィルタ/ページネーション、ダイアログ、トースト等）
- Aura テーマによるモダンなデザイン
- Tree-shakable アーキテクチャでバンドルサイズ削減（DaisyUI 1.26MB → PrimeNG 1.02MB）
- PrimeIcons でアイコンライブラリも統一

### 参照
- [Angular Core 基盤 — app.config.ts](../detail/angular-core/)

---

## ADR-0009: API レート制限 (@nestjs/throttler)（新規）

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted** |
| 日付 | 2026-02-28 |

### コンテキスト
DDoS やブルートフォース攻撃から API を保護する必要がある。特に認証エンドポイント（ログイン、パスワードリセット）は攻撃対象になりやすい。

### 決定: @nestjs/throttler で Global Guard 登録 + 3段構成

| 名前 | TTL | 制限 |
|---|---|---|
| `short` | 1秒 | 3リクエスト |
| `medium` | 10秒 | 20リクエスト |
| `long` | 1分 | 100リクエスト |

### 認証エンドポイントの追加制限
- `POST /api/auth/login` — 1分あたり5回
- `POST /api/auth/forgot-password` — 1分あたり3回

### 除外
- `GET /api/health` — `@SkipThrottle()` + `@Public()` でレート制限対象外

### 理由
- NestJS 公式のレート制限パッケージでメンテナンス安心
- `APP_GUARD` として登録することで全エンドポイントに自動適用
- `@Throttle()` でエンドポイントごとのカスタマイズが可能

### 参照
- [Guard/Middleware 設計 — ThrottlerGuard](../detail/guard-design/)
- [NestJS 共通基盤 — AppModule](../detail/common-infrastructure/)

---

## ADR-0010: E2E テスト認証パターン — authenticatedPage fixture

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted** |
| 日付 | 2026-03-01 |

### コンテキスト

Playwright E2E テストでの認証管理が不安定だった。`storageState` は `cookies` + `localStorage` のみサポートし、Angular の `sessionStorage` ベース認証（`opshub_access_token`, `opshub_refresh_token`）を直接扱えない。

当初は `restoreSession()` ヘルパーで `__ss__` プレフィックス付き localStorage → sessionStorage への手動変換を行っていたが、Angular の `AuthService.loadFromStorage()` が `Promise.resolve().then()` で遅延実行されるため、タイミング競合が約 20% で発生。さらに fallback の loginViaUI が `ThrottlerException: 429` で失敗するという 2 段階障害チェーンが発生していた。

### 決定: `addInitScript` + カスタム fixture

```typescript
// e2e/fixtures.ts
export const test = base.extend<{ authenticatedPage: Page }>({
    authenticatedPage: async ({ page }, use) => {
        await page.addInitScript(RESTORE_SESSION_SCRIPT);
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-sidebar"]', { timeout: 15_000 });
        await use(page);
    },
});
```

### 比較した代替案

| 方式 | 採否 | 理由 |
|------|------|------|
| `page.evaluate` + `page.reload` | ❌ | reload 後の `networkidle` が Angular 初期化完了を保証しない |
| `APP_INITIALIZER` のみ | △ | アプリ側は対応済みだが、テスト側の `sessionStorage` 注入タイミングも制御する必要あり |
| `addInitScript` + fixture | ✅ | 全ナビゲーションで自動復元。reload にも対応 |
| API ベースログイン | △ | 高速だが `fetchProfile` の非同期完了を待つ仕組みが別途必要 |

### 補助的変更

- テスト環境で `THROTTLE_SKIP=true` — レート制限無効化
- `APP_INITIALIZER` に `AuthService.whenReady()` — Angular ブート完了保証
- `fetchProfile` に `timeout(10_000)` — HTTP ハング防止

### 成果

- **28/28 PASS × 3 回連続、retries: 0、29.9 秒**（改善前: 3.2 分、6 flaky）
- Workers 1 → 2（`fullyParallel: true`）

### 参照
- [Phase 7-8 作業ログ](../plans/phase-7-8-log/)

---

## ADR-0011: BullMQ / Redis レジリエンス設計

| 項目 | 内容 |
|---|---|
| ステータス | **Accepted** |
| 日付 | 2026-03-01 |

### コンテキスト

Redis 未起動時 API サーバーが `ECONNREFUSED` エラーを大量出力し、`POST /api/auth/forgot-password` がレスポンスを返さずハングしていた（キュー追加のブロッキング）。

### 決定: Graceful Degradation + Redis Health Indicator

1. **BullMQ connection**: `maxRetriesPerRequest: 3`, `enableReadyCheck: false`, `retryStrategy` で上限付きバックオフ
2. **forgotPassword**: キュー追加を `try/catch` でラップ。失敗時はログ記録しユーザーにはサイレント成功（セキュリティ: email 存在漏洩防止）
3. **HealthCheck**: `RedisHealthIndicator` を `/api/health` に追加。Redis `PING` の応答で `up`/`down` を報告
4. **Docker Compose**: Redis に `healthcheck` 追加

### 理由
- Redis はメール送信用のキューであり、コアビジネスロジック（認証、CRUD）には影響しない
- Graceful degradation により、Redis ダウン時もアプリの主要機能は継続
- Health endpoint で Redis 状態を監視可能に

### 参照
- [Phase 7-8 作業ログ](../plans/phase-7-8-log/)
