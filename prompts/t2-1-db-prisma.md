# T2-1: DB設計 → Prisma Schema 移行

## タスク概要
OpsHub の DB設計ドキュメントを Prisma V6 スキーマ形式に移行し、Starlight ドキュメントとして作成する。

## 入力ファイル（参照元）
- **元ドキュメント**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/db/index.md`
  - 15テーブル (DD-DB-001 ~ DD-DB-015)
  - RPC関数 2件（next_workflow_number, next_invoice_number）
  - トリガー/関数
  - ER図 (Mermaid)

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/db.md`

## 移行ルール

### 型マッピング
| Supabase/PostgreSQL | Prisma |
|---|---|
| `uuid` PK DEFAULT gen_random_uuid() | `String @id @default(uuid())` |
| `text NOT NULL` | `String` |
| `text` nullable | `String?` |
| `timestamptz NOT NULL DEFAULT now()` | `DateTime @default(now())` |
| `numeric(12,2)` | `Decimal @db.Decimal(12,2)` (PostgreSQL) or `Float` (SQLite) |
| `integer NOT NULL DEFAULT 0` | `Int @default(0)` |
| `boolean NOT NULL DEFAULT false` | `Boolean @default(false)` |
| `jsonb DEFAULT '{}'` | `Json @default("{}") ` |
| `bigint` | `BigInt` |
| `date` | `DateTime @db.Date` (PostgreSQL) |
| FK → auth.users(id) | `User` model へのリレーション |

### 構造変換
1. **auth.users → User model**: Supabase の `auth.users` は自前の `User` model に変換
2. **RPC関数 → Service メソッド**: `next_workflow_number()` → `WorkflowService.generateNumber()`
3. **トリガー → Prisma Middleware or Service**: `handle_new_user()` → `AuthService.createProfile()`
4. **UNIQUE制約 → `@@unique`**
5. **CHECK制約 → enum or TS バリデーション**: `CHECK(IN ...)` → `enum` type
6. **Index → `@@index`**

### ER図
- 元の Mermaid ER 図を維持しつつ、Prisma リレーション記法の補足を追加

## frontmatter
```yaml
---
title: DB設計（Prisma Schema）
description: OpsHub の 15 テーブルを Prisma V6 スキーマで定義
---
```

## 期待される構成
1. 共通フィールド規約（id, tenantId, createdAt, updatedAt）
2. Prisma enum 定義（Role, ProjectStatus, TaskStatus, WorkflowStatus, WorkflowType, InvoiceStatus）
3. 各 model 定義（DD-DB-001 ~ DD-DB-015）
   - model 名は PascalCase（`Tenant`, `UserRole`, `Project` 等）
   - フィールド説明をコメントで付与
4. ER図 (Mermaid erDiagram)
5. Service メソッド化された旧RPC関数
6. マイグレーション方針（Prisma Migrate）

## 注意事項
- SQLite と PostgreSQL の両対応を明記（`provider = ["sqlite", "postgresql"]` 切替方式）
- `@@map("table_name")` で既存テーブル名にマッピングする例を示す
- テナント分離は Prisma Middleware で実装する旨を記載（詳細は T2-2 文書を参照）
