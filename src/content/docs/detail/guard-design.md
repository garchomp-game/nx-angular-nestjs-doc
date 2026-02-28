---
title: Guard / Middleware 設計
description: RLS に代わる NestJS Guards と Prisma Middleware によるデータ保護設計
---

## 1. 概要: 3層認可モデル

OpsHub では [権限と認可](../../spec/authz/) で定義した通り、NestJS の Guard と Prisma Middleware を組み合わせた3層のデータ保護モデルを採用しています。
本ドキュメントでは、旧アーキテクチャの RLS (Row Level Security) から NestJS 仕様への詳細な移行設計を定義します。

| RLS パターン | NestJS 相当 |
|---|---|
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Prisma Middleware (`tenant_id` 自動フィルタ) |
| `CREATE POLICY ... FOR SELECT` | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles()` |
| `WHERE tenant_id IN (SELECT ...)` | `TenantMiddleware` が自動付与 |
| `WHERE created_by = auth.uid()` | Service 層で `userId` フィルタ |
| `WITH CHECK (...)` | `class-validator` DTO + Service バリデーション |
| `INSERT ONLY (audit_logs)` | `AuditLogMiddleware` で UPDATE/DELETE を拒否 |
| `service_role bypass` | Admin API は `@SkipTenantCheck()` デコレータ |

---

## 2. TenantMiddleware 設計

テナント間のデータ漏洩をシステムレベルで防ぐため、Prisma Middlewareを利用して暗黙的にテナントを分離します。

1. **テナントIDの解決**:
   - クライアントからのリクエストヘッダー `X-Tenant-Id` から対象テナントを取得します。
   - `JwtAuthGuard` 等において、ユーザーが該当テナントに所属しているかを検証し、リクエストコンテキストや `AsyncLocalStorage` に設定します。
2. **Prisma `$use()` による自動付与**:
   - `TenantMiddleware` により、すべての SELECT / UPDATE / DELETE クエリの `where` 句に `tenant_id` フィルタを自動付与します。
   - CREATE 系クエリには `data` オブジェクトに `tenant_id` の補完を行います。
3. **例外指定**:
   - テナント横断アクセスが必要な IT Admin 用 API やバッチ処理等では、`@SkipTenantCheck()` デコレータを使用することでテナント分離機能をバイパスさせます。

---

## 3. テーブル別ポリシー → Guard マッピング表

以下のマッピング表は、各テーブルと対応する操作（CRUD）に必要な実行権限（ロール）を示します。
ロールチェックは主に `@Roles()` デコレータと `RolesGuard` を通して行われます。

※ `-` はアプリケーション API として許可していない操作（または自動/カスケード処理で実行される操作）を示します。

| テーブル / エンティティ | 読取 (SELECT) | 作成 (INSERT) | 更新 (UPDATE) | 削除 (DELETE) |
|---|---|---|---|---|
| **tenants** | 全メンバー | - | Tenant Admin | - |
| **profiles** | 全メンバー (同テナント) | - (Auth連動) | 自身のみ | - (CASCADE) |
| **user_roles** | 全メンバー | Tenant Admin | - | Tenant Admin |
| **projects** | 全メンバー | PM, Tenant Admin | PM (担当), Tenant Admin | - |
| **project_members** | 全メンバー | PM (担当), Tenant Admin | - | PM (担当), Tenant Admin |
| **tasks** | 全メンバー | PM (担当), Tenant Admin | 全メンバー | - |
| **workflows** | 申請者, 承認者, Tenant Admin | 全メンバー (自身) | 申請者, 承認者, Tenant Admin| - |
| **timesheets** | 自身, PM (担当), Tenant Admin| 自身 | 自身 | 自身 |
| **expenses** | 自身, Accounting, Tenant Admin | 全メンバー (自身) | 自身, Accounting, Tenant Admin | - |
| **audit_logs** | IT Admin, Tenant Admin | システム（自動記録） | ❌ 禁止 | ❌ 禁止 |
| **notifications** | 自身 | システム（自動生成） | 自身 | - |
| **workflow_attachments**| 全メンバー | 全メンバー (自身) | - | - |
| **invoices** | Accounting, Tenant Admin, PM(担当※)| Accounting, Tenant Admin | Accounting, Tenant Admin | Accounting, Tenant Admin(draft)|
| **invoice_items** | `invoices` に準拠 | Accounting, Tenant Admin | Accounting, Tenant Admin | Accounting, Tenant Admin |
| **documents** | PJメンバー※, PM, Tenant Admin | PM, Tenant Admin | - (削除後作成) | PM, Tenant Admin |

> [!NOTE]
> - **invoices**: PM は自身が担当するプロジェクト（PJ）の請求書のみを閲覧可能です。
> - **documents**: プロジェクトに属さない共通ドキュメントの場合は、全テナントメンバーが閲覧可能となります。

---

## 4. データスコープフィルタ

Role によるコントローラー層のアクセス許可 (`RolesGuard`) の後、Service 層ではユーザー固有の要件に応じたデータスコープフィルタを実装します。

1. **Member（自分のデータのみ）**
   - 対象: `timesheets`, `expenses`, `notifications` など
   - 制御手法: Service メソッド側で発行するクエリの条件に `created_by = userId` や `user_id = userId` を追加します。
2. **PM（自分が担当するプロジェクト）**
   - 対象: `projects`, `tasks`, `invoices`, `documents` など
   - 制御手法: `projects` テーブルへの JOIN (Prisma の `include` / `some`) や、`project_members` を経由した所属確認を用いて絞り込みます。
3. **Accounting / Tenant Admin（テナント全体広範アクセス）**
   - 制御手法: `TenantMiddleware` によって対象のテナントデータのみに分離されているため、各個人の `created_by` 等の追加フィルタを適用せずに全体を扱います。

---

## 5. 監査ログ保護

`audit_logs` など変更不可な記録が要求されるデータに対する不慮（あるいは悪意）の改ざんや削除をアプリの最も低い層でブロックするため、`INSERT ONLY` パターンの Prisma Middleware を設けます。

- **INSERT 操作**: 許可されます（各種操作からシステム的に起票）。
- **UPDATE / DELETE 操作**: 発生した場合はすべてエラー (例外) をスローし、ミドルウェア層で強制的にリジェクトします。

---

## 6. コード例

### Prisma Middleware (TenantMiddleware) の実装例

```typescript
// libs/prisma-db/src/lib/tenant.middleware.ts
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<{ tenantId: string; skipTenantCheck?: boolean }>();

const TENANT_MODELS = [
  'Project', 'Task', 'Workflow', 'Timesheet',
  'Expense', 'Notification', 'AuditLog', 'Invoice',
  'InvoiceItem', 'Document', 'WorkflowAttachment',
];

export function tenantMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // 対象モデルでなければスキップ
    if (!TENANT_MODELS.includes(params.model ?? '')) {
      return next(params);
    }

    const context = tenantContext.getStore();

    // @SkipTenantCheck() 等でバイパスが指定されている場合
    if (context?.skipTenantCheck) {
      return next(params);
    }

    const tenantId = context?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant context is missing for tenant_id filtering.');
    }

    // SELECT / UPDATE / DELETE への tenant_id フィルタ自動適用
    if (['findMany', 'findFirst', 'findUnique', 'count', 'update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      params.args.where = {
        ...params.args.where,
        tenant_id: tenantId,
      };
    }

    // CREATE への tenant_id 自動付与
    if (['create', 'createMany'].includes(params.action)) {
      if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenant_id: tenantId };
      } else if (params.action === 'createMany') {
        params.args.data = (params.args.data as any[]).map(item => ({
          ...item,
          tenant_id: tenantId,
        }));
      }
    }

    return next(params);
  };
}
```

### Prisma Middleware (AuditLogMiddleware) の実装例

```typescript
// libs/prisma-db/src/lib/audit-log.middleware.ts
import { Prisma } from '@prisma/client';

export function auditLogMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (params.model === 'AuditLog') {
      if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
        throw new Error('Audit logs are append-only. UPDATE and DELETE actions are completely forbidden.');
      }
    }
    return next(params);
  };
}
```

### コントローラーでの Guard メタデータ実装例

```typescript
// apps/api/src/modules/projects/projects.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/auth/guards/roles.guard';
import { Roles } from '@shared/auth/decorators/roles.decorator';
import { SkipTenantCheck } from '@shared/auth/decorators/skip-tenant.decorator';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles('member', 'pm', 'tenant_admin') // 実行可能な権限の設定
  findAll(@Req() req: any) {
    // 自身あるいは担当するPJといった制限はServiceで適用
    return this.projectsService.findAll(req.user);
  }

  // 管理者向けのテナント横断データ取得用
  @Get('all-tenants')
  @Roles('it_admin')
  @SkipTenantCheck() // ミドルウェアでのテナント強制分離をバイパス
  findAllCrossTenants() {
    return this.projectsService.findAllWithoutTenant();
  }
}
```
