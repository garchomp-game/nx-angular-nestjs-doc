---
title: "TI-6: 管理モジュール ウォークスルー"
description: 管理モジュール（テナント設定・ユーザー管理・監査ログ）の実装内容・テスト結果・設計ポイントのまとめ
---

## 概要

TI-6 では、テナント管理者向けの管理機能を実装した。テナント設定の編集、ユーザーの招待・ロール変更・無効化、監査ログの閲覧（フィルタ＋ページネーション）を含む。

---

## 作成ファイル一覧

### NestJS Backend

```
apps/api/src/modules/admin/
├── admin.module.ts                          # Module (exports: 3 services)
├── controllers/
│   ├── tenants.controller.ts                # 3 endpoints (GET/PATCH/DELETE)
│   ├── users.controller.ts                  # 5 endpoints (GET×2/POST/PATCH×2)
│   └── audit-logs.controller.ts             # 1 endpoint (GET)
├── services/
│   ├── tenants.service.ts                   # findOne / update / softDelete
│   ├── users.service.ts                     # findAll / findOne / invite / updateRole / updateStatus
│   └── audit-logs.service.ts                # findAll (READ ONLY)
├── dto/
│   ├── update-tenant.dto.ts                 # name?, settings?
│   ├── invite-user.dto.ts                   # email, role, displayName?
│   ├── update-user-role.dto.ts              # role
│   └── audit-log-filter.dto.ts              # action?, resourceType?, userId?, dateFrom?, dateTo?, page, limit
└── tests/
    ├── tenants.service.spec.ts              # Jest 3 test cases
    ├── users.service.spec.ts                # Jest 7 test cases
    ├── audit-logs.service.spec.ts           # Jest 3 test cases
    ├── tenants.controller.spec.ts           # Jest 3 test cases
    ├── users.controller.spec.ts             # Jest 5 test cases
    └── audit-logs.controller.spec.ts        # Jest 1 test case
```

**変更ファイル**: `apps/api/src/app/app.module.ts` — `AdminModule` を imports に追加

### Angular Frontend

```
apps/web/src/app/features/admin/
├── admin.routes.ts                          # /tenant, /users, /audit-logs
├── services/
│   ├── tenant.service.ts                    # Signal + HttpClient
│   ├── users.service.ts                     # Signal + HttpClient
│   ├── audit-logs.service.ts                # Signal + HttpClient + HttpParams
│   ├── tenant.service.spec.ts               # Vitest HTTP テスト
│   ├── users.service.spec.ts                # Vitest HTTP テスト
│   └── audit-logs.service.spec.ts           # Vitest HTTP テスト
├── tenant/
│   ├── tenant-settings.component.ts         # ReactiveForm + mat-card
│   └── tenant-settings.component.spec.ts    # Vitest Component テスト
├── users/
│   ├── user-list.component.ts               # mat-table + mat-dialog
│   ├── invite-modal.component.ts            # MatDialogRef + form validation
│   └── user-list.component.spec.ts          # Vitest Component テスト
└── audit-logs/
    ├── audit-log-viewer.component.ts        # mat-table + mat-paginator + filters
    └── audit-log-viewer.component.spec.ts   # Vitest Component テスト
```

**変更ファイル**: `apps/web/src/app/app.routes.ts` — admin ルートを `loadComponent`（placeholder）→ `loadChildren`（ADMIN_ROUTES）に変更

---

## API エンドポイント

| Method | Path | 説明 | HTTP Status |
|---|---|---|---|
| `GET` | `/api/admin/tenant` | テナント情報取得 | 200 |
| `PATCH` | `/api/admin/tenant` | テナント設定更新 | 200 |
| `DELETE` | `/api/admin/tenant` | テナント論理削除 | 200 |
| `GET` | `/api/admin/users` | ユーザー一覧取得 | 200 |
| `GET` | `/api/admin/users/:id` | ユーザー詳細取得 | 200 |
| `POST` | `/api/admin/users/invite` | ユーザー招待 | 201 |
| `PATCH` | `/api/admin/users/:id/role` | ロール変更 | 200 |
| `PATCH` | `/api/admin/users/:id/status` | ステータス変更 | 200 |
| `GET` | `/api/admin/audit-logs` | 監査ログ取得（ページネーション） | 200 |

全エンドポイントは `@Roles('tenant_admin')` でコントローラレベルで保護。

---

## エラーコード

| コード | HTTP | 説明 |
|---|---|---|
| `ERR-ADM-001` | 404 | テナントが見つかりません |
| `ERR-ADM-002` | 403 | 自分のロールは変更できません |
| `ERR-ADM-003` | 409 | メールアドレスが既に登録済み |
| `ERR-ADM-004` | 404 | ユーザーが見つかりません |

---

## 設計ポイント

### 1. 自己ロール変更の防止

```typescript
// users.service.ts
async updateRole(tenantId, userId, dto, currentUserId) {
    if (userId === currentUserId) {
        throw new ForbiddenException({
            code: 'ERR-ADM-002',
            message: '自分のロールは変更できません',
        });
    }
    // ...
}
```

### 2. ユーザー招待のトランザクション

```typescript
// users.service.ts — 3テーブルにまたがる原子操作
return await this.prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
        user = await tx.user.create({ data: { email } });
        await tx.profile.create({ data: { id: user.id, displayName } });
    }
    await tx.userRole.create({ data: { userId: user.id, tenantId, role } });
});
```

### 3. 監査ログの READ ONLY 設計

`AuditLogsService` には `findAll()` のみ実装。CUD メソッドは一切なく、書き込みは `AuditInterceptor`（共通インフラ）のみが行う。

### 4. Signal ベースの Angular Service

```typescript
// tenant.service.ts
readonly tenant = signal<any>(null);
readonly loading = signal(false);
readonly error = signal<string | null>(null);
```

全3サービスが Signal を使い、コンポーネントからはリアクティブに状態参照。

---

## テスト結果

### NestJS (Jest)

| ファイル | テスト数 | 結果 |
|---|---|---|
| `tenants.service.spec.ts` | 3 | ✅ PASS |
| `users.service.spec.ts` | 7 | ✅ PASS |
| `audit-logs.service.spec.ts` | 3 | ✅ PASS |
| `tenants.controller.spec.ts` | 3 | ✅ PASS |
| `users.controller.spec.ts` | 5 | ✅ PASS |
| `audit-logs.controller.spec.ts` | 1 | ✅ PASS |

カバー範囲:
- 正常系: 全 CRUD 操作、ページネーション、日付フィルタ、アクション/リソースタイプフィルタ
- 異常系: 存在しないテナント/ユーザー → `NotFoundException`, 自己ロール変更 → `ForbiddenException`, 重複招待 → `ConflictException`

### Angular (Vitest)

- `tenant.service.spec.ts`: GET/PATCH/DELETE リクエストテスト
- `users.service.spec.ts`: 全5エンドポイントの HTTP テスト（reload 確認含む）
- `audit-logs.service.spec.ts`: フィルタパラメータ付き GET テスト
- 各コンポーネント spec: 作成テスト、初期ロード確認、UI 要素表示確認

> [!NOTE]
> Angular テスト実行（`nx test web`）は他モジュール（projects/kanban-board 等）の既存ビルドエラーにより全体実行不可。管理モジュールファイル自体の TypeScript コンパイルは問題なし。
