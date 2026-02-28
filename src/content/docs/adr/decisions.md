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
- Prisma Middleware でテナント分離を実現し、RLS と同等のセキュリティ
- アプリ層での制御により **テスト容易性が向上**（Guard の単体テスト可能）
- SQLite 開発環境でも動作（RLS は PostgreSQL のみ）

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

- **DB**: Docker Compose で PostgreSQL 起動 or SQLite (開発用)
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
