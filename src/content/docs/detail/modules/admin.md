---
title: 管理モジュール設計 (AdminModule)
description: テナント設定・ユーザー管理・監査ログビューアの NestJS Module + Angular Feature 設計
---

## 概要

- **責務**: テナント設定、ユーザー管理（招待・ロール変更・無効化）、監査ログビューア
- **Epic**: TICKET-02（テナント管理）、TICKET-03（ユーザー管理）、TICKET-12（監査ログ）
- **Prisma Models**: `Tenant`, `UserRole`, `Profile`, `AuditLog`

> [!NOTE]
> AdminModule は 3 つのサブ Controller（`TenantsController`, `UsersController`, `AuditLogsController`）で構成される複合モジュール。
> 全エンドポイントに `tenant_admin` ロールを要求する。

---

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/admin/
├── admin.module.ts
├── controllers/
│   ├── tenants.controller.ts
│   ├── users.controller.ts
│   └── audit-logs.controller.ts
├── services/
│   ├── tenants.service.ts
│   ├── users.service.ts
│   └── audit-logs.service.ts
├── dto/
│   ├── update-tenant.dto.ts
│   ├── invite-user.dto.ts
│   ├── update-user-role.dto.ts
│   └── audit-log-filter.dto.ts
└── tests/
    ├── tenants.controller.spec.ts
    ├── users.controller.spec.ts
    └── audit-logs.controller.spec.ts
```

### Controller エンドポイント

#### TenantsController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/admin/tenant` | テナント設定取得 | `tenant_admin` |
| `PATCH` | `/api/admin/tenant` | テナント設定更新 | `tenant_admin` |
| `DELETE` | `/api/admin/tenant` | テナント論理削除 | `tenant_admin` |

#### UsersController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/admin/users` | ユーザー一覧取得 | `tenant_admin` |
| `GET` | `/api/admin/users/:id` | ユーザー詳細取得 | `tenant_admin` |
| `POST` | `/api/admin/users/invite` | ユーザー招待（メール送信） | `tenant_admin` |
| `PATCH` | `/api/admin/users/:id/role` | ロール変更 | `tenant_admin` |
| `PATCH` | `/api/admin/users/:id/status` | ステータス変更（有効/無効化） | `tenant_admin` |

#### AuditLogsController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/admin/audit-logs` | 監査ログ一覧（ページネーション + フィルタ） | `tenant_admin` |

### Service メソッド

#### TenantsService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findOne` | `tenantId: string` | `Tenant` | テナント設定取得 |
| `update` | `tenantId: string, dto: UpdateTenantDto` | `Tenant` | テナント設定更新 + 監査ログ |
| `softDelete` | `tenantId: string` | `void` | 論理削除（`deleted_at` 設定）|

#### UsersService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll` | `tenantId: string` | `UserWithRole[]` | テナント内ユーザー一覧（profiles JOIN） |
| `findOne` | `tenantId: string, userId: string` | `UserDetail` | ユーザー詳細 |
| `invite` | `tenantId: string, dto: InviteUserDto` | `void` | ユーザー招待（メール送信 + UserRole 作成） |
| `updateRole` | `tenantId: string, userId: string, dto: UpdateUserRoleDto` | `UserRole` | ロール変更 + 監査ログ |
| `updateStatus` | `tenantId: string, userId: string, active: boolean` | `void` | 有効/無効化 + 監査ログ |

#### AuditLogsService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll` | `tenantId: string, filter: AuditLogFilterDto` | `PaginatedResult<AuditLog>` | フィルタ + ページネーション |

### DTO 定義

```typescript
// update-tenant.dto.ts
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

// invite-user.dto.ts
export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  displayName?: string;
}

// update-user-role.dto.ts
export class UpdateUserRoleDto {
  @IsEnum(Role)
  role: Role;
}

// audit-log-filter.dto.ts
export class AuditLogFilterDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/admin/
├── admin.routes.ts
├── tenant/
│   ├── tenant-settings.component.ts
│   └── tenant-settings.component.html
├── users/
│   ├── user-list.component.ts
│   ├── user-list.component.html
│   ├── user-detail-panel.component.ts
│   ├── user-detail-panel.component.html
│   ├── invite-modal.component.ts
│   └── invite-modal.component.html
├── audit-logs/
│   ├── audit-log-viewer.component.ts
│   └── audit-log-viewer.component.html
└── services/
    ├── tenant.service.ts
    ├── users.service.ts
    └── audit-logs.service.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `TenantSettingsComponent` | Smart | テナント名・設定の表示・編集・論理削除 |
| `UserListComponent` | Smart | ユーザー一覧テーブル + フィルタ |
| `UserDetailPanelComponent` | Smart | ユーザー詳細表示・ロール変更・ステータス変更 |
| `InviteModalComponent` | Smart | 招待フォーム（メール + ロール選択） |
| `AuditLogViewerComponent` | Smart | 監査ログ一覧 + フィルタ + ページネーション |

### Service メソッド (HttpClient)

#### TenantService

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getTenant()` | `GET` | `/api/admin/tenant` | テナント設定取得 |
| `updateTenant(dto)` | `PATCH` | `/api/admin/tenant` | テナント設定更新 |
| `deleteTenant()` | `DELETE` | `/api/admin/tenant` | テナント論理削除 |

#### UsersService

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getUsers()` | `GET` | `/api/admin/users` | ユーザー一覧取得 |
| `getUser(id)` | `GET` | `/api/admin/users/:id` | ユーザー詳細取得 |
| `inviteUser(dto)` | `POST` | `/api/admin/users/invite` | ユーザー招待 |
| `updateRole(id, dto)` | `PATCH` | `/api/admin/users/:id/role` | ロール変更 |
| `updateStatus(id, active)` | `PATCH` | `/api/admin/users/:id/status` | ステータス変更 |

#### AuditLogsService

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getLogs(filter)` | `GET` | `/api/admin/audit-logs` | 監査ログ取得（フィルタ付き） |

### ルーティング

```typescript
// admin.routes.ts
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    children: [
      { path: 'tenant', component: TenantSettingsComponent },
      { path: 'users', component: UserListComponent },
      { path: 'audit-logs', component: AuditLogViewerComponent },
      { path: '', redirectTo: 'tenant', pathMatch: 'full' },
    ],
  },
];
```

---

## 共通定数利用

| 定数名 | 定義元 | 用途 |
|---|---|---|
| `ROLE_LABELS` | `libs/shared/constants` | ロール表示名（`member` → `"メンバー"` 等） |
| `USER_STATUS_LABELS` | `libs/shared/constants` | ユーザーステータス表示名 |
| `USER_STATUS_COLORS` | `libs/shared/constants` | ステータスごとのカラー名 |

---

## 依存関係

- **NestJS 内**: `PrismaModule`（DB アクセス）、`MailModule`（招待メール送信）、`AuditLogModule`（監査ログ記録）
- **共有ライブラリ**: `libs/shared/constants`（ラベル定数）、`libs/shared/types`（`Role` 列挙型）
- **Guard**: `TenantGuard`（テナント分離）、`RolesGuard`（`@Roles('tenant_admin')` デコレータ）
