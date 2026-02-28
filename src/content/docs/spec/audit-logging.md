---
title: 監査ログ方針
description: AuditInterceptor による自動記録と Prisma Middleware による改ざん防止の方針
---

## 目的

**「誰が・いつ・何をしたか」** を確実に記録し、NFR-05（監査要件）を満たす。

> 旧 OpsHub: Server Action 内での明示的 INSERT + 重要テーブルの DB トリガ
> **新**: `AuditInterceptor` による自動記録 + `AuditLogMiddleware` による改ざん防止

---

## 記録方式

| 項目 | 方針 |
|---|---|
| 方式 | `AuditInterceptor` (NestJS Global Interceptor) で CUD 操作を自動記録 |
| 記録タイミング | Controller ハンドラーの実行後（`tap` operator） |
| 記録先 | `AuditLog` Prisma モデル (`audit_logs` テーブル) |
| 改ざん防止 | `AuditLogMiddleware` (Prisma) で UPDATE/DELETE を禁止 |

---

## 記録内容

| フィールド | 型 | 内容 | 例 |
|---|---|---|---|
| `id` | UUID | 自動採番 | — |
| `tenantId` | UUID | テナントID | — |
| `userId` | UUID | 操作者 | — |
| `action` | String | 操作種別 | `workflows.create`, `admin.invite` |
| `resourceType` | String | リソース種別 | `workflows`, `projects` |
| `resourceId` | String? | リソースID | UUID or null |
| `beforeData` | Json? | 変更前データ | `{"status": "draft"}` |
| `afterData` | Json? | 変更後データ | `{"status": "submitted"}` |
| `metadata` | Json? | 追加情報 | `{"url": "/api/workflows", "ip": "..."}` |
| `createdAt` | DateTime | タイムスタンプ | — |

---

## action 命名規則

```
{resourceType}.{operation}
```

| 操作 | operation 値 | 例 |
|---|---|---|
| 作成 | `create` | `workflows.create` |
| 更新 | `update` | `projects.update` |
| 削除 | `delete` | `expenses.delete` |
| 状態変更 | 具体的操作名 | `workflows.approve`, `workflows.reject`, `workflows.submit` |
| ロール変更 | `role_change` | `admin.role_change` |
| 招待 | `invite` | `admin.invite` |
| エクスポート | `export` | `timesheets.export` |
| ログイン | `login` | `auth.login` |

---

## 記録対象の操作

### 必ず記録する操作 (Required)

| モジュール | action | 条件 |
|---|---|---|
| **Auth** | `auth.login`, `auth.logout`, `auth.register` | 全件 |
| **Workflow** | `workflows.create`, `.submit`, `.approve`, `.reject`, `.withdraw` | 全状態遷移 |
| **Project** | `projects.create`, `.update`, `.delete` | 全 CUD |
| **Task** | `tasks.create`, `.update`, `.delete` | 全 CUD |
| **Admin** | `admin.invite`, `.role_change`, `.status_change` | 全件 |
| **Invoice** | `invoices.create`, `.update`, `.status_change`, `.delete` | 全 CUD + 状態変更 |

### 記録する操作 (Recommended)

| モジュール | action | 条件 |
|---|---|---|
| **Expense** | `expenses.create` | 作成時のみ |
| **Document** | `documents.upload`, `.delete` | アップロード/削除 |
| **Timesheet** | `timesheets.export` | CSVエクスポート時のみ |

### 記録しない操作

- 全ての GET (参照) リクエスト
- 工数の日常的な登録/更新（量が多いため）
- 通知の既読化
- ヘルスチェック

---

## AuditInterceptor の動作

```typescript
// 判定フロー
POST /api/workflows      → action: "workflows.create"    → ✅ 記録
PATCH /api/workflows/1   → action: "workflows.update"    → ✅ 記録
POST /api/workflows/1/approve → action: "workflows.approve" → ✅ 記録
GET /api/workflows       → GET は自動スキップ              → ❌ 未記録
```

> [!IMPORTANT] 自動記録の仕組み
> `AuditInterceptor` は **Global Interceptor** として登録されており、
> `GET` 以外の全リクエストを自動的に記録する。
> 個別モジュールでの記録コードは**不要**。

---

## 改ざん防止

### Prisma Middleware

```typescript
// AuditLogMiddleware — UPDATE/DELETE を完全禁止
if (params.model === 'AuditLog' && ['update', 'delete', ...].includes(params.action)) {
  throw new Error('AuditLog is append-only.');
}
```

### 保持・参照

| 項目 | 方針 |
|---|---|
| 保持期間 | 最低 1 年 (NFR-05c) |
| 参照権限 | `tenant_admin`, `it_admin` のみ |
| 参照画面 | 管理 → 監査ログビューア (`AuditLogViewerComponent`) |
| フィルタ | 期間、ユーザー、アクション種別、リソース種別 |
| 成功指標 | 操作者の特定が **5 分以内** (NFR-05b) |

---

## モジュール開発者向けガイド

### やること

1. **何もしなくてよい** — `AuditInterceptor` が自動で全 CUD を記録する
2. **カスタム action 名が必要な場合**: URL パスに操作名を含める
   - `POST /api/workflows/:id/approve` → `workflows.approve`
   - `PATCH /api/admin/users/:id/role` → `admin.role_change`

### やらないこと

1. ❌ Service 内で `prisma.auditLog.create()` を直接呼ばない
2. ❌ `AuditLog` を `update()` / `delete()` しない（Middleware が禁止）
3. ❌ GET リクエストの監査ログを手動で記録しない
