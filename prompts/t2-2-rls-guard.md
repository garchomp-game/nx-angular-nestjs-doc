# T2-2: RLS → Guard + Middleware 設計移行

## タスク概要
OpsHub の RLS（Row Level Security）設計ドキュメントを NestJS Guards + Prisma Middleware パターンに移行する。

## 入力ファイル（参照元）
- **元ドキュメント**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/rls/index.md`
- **補足参照**: 
  - `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/spec/authz/index.md`（認可仕様）
  - `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/spec/authz.md`（移行済み認可仕様、参照のみ）
  - `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/requirements/roles.md`（移行済みロール定義、参照のみ）

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/guard-design.md`

## 移行ルール

### RLS → NestJS マッピング
| RLS パターン | NestJS 相当 |
|---|---|
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Prisma Middleware (tenant_id filter) |
| `CREATE POLICY ... FOR SELECT` | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles()` |
| `WHERE tenant_id IN (SELECT ...)` | `TenantMiddleware` が自動付与 |
| `WHERE created_by = auth.uid()` | Service 層で `userId` フィルタ |
| `WITH CHECK (...)` | `class-validator` DTO + Service バリデーション |
| `INSERT ONLY (audit_logs)` | `AuditLogMiddleware` で UPDATE/DELETE を拒否 |
| `service_role bypass` | Admin API は `@SkipTenantCheck()` デコレータ |

### 構成
1. **概要**: 3層認可モデルの復習（spec/authz.md からの参照）
2. **TenantMiddleware 設計**
   - リクエストヘッダーから `X-Tenant-Id` を取得
   - Prisma `$use()` で全クエリに `tenant_id` フィルタを自動付与
   - `@SkipTenantCheck()` で例外指定可能
3. **テーブル別ポリシー → Guard マッピング表**
   - 全15テーブル × CRUD 操作のロール要件
4. **データスコープフィルタ**
   - Member: `created_by = userId`
   - PM: `project_members` JOIN
   - Accounting: テナント全体
5. **監査ログ保護**
   - INSERT ONLY パターンの Prisma Middleware
6. **コード例**: 代表的な Guard + Middleware 実装

## frontmatter
```yaml
---
title: Guard / Middleware 設計
description: RLS に代わる NestJS Guards と Prisma Middleware によるデータ保護設計
---
```

## 注意事項
- `spec/authz.md` には認可の概要が記載済み。このドキュメントはその詳細設計版
- テーブルごとの CRUD 権限マトリクスを表形式で明記する
- Prisma `$use()` ミドルウェアのコードスニペットを含める
