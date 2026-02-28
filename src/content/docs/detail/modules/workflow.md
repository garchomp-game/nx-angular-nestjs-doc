---
title: ワークフローモジュール設計
description: ワークフロー（申請/承認/差戻し/取下げ）の全操作を担うモジュールの詳細設計
---

## 概要
- **責務**: ワークフロー（申請/承認/差戻し/取下げ）の全操作、WF番号の並行安全な採番
- **Epic**: ワークフロー管理
- **Prisma Models**: `Workflow`, `WorkflowAttachment`

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/workflow/
├── workflow.controller.ts
├── workflow.service.ts
├── workflow.module.ts
├── dto/
│   ├── create-workflow.dto.ts
│   ├── update-workflow.dto.ts
│   ├── submit-workflow.dto.ts
│   └── reject-workflow.dto.ts
└── workflow.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/workflows` | 申請一覧取得（自分の申請 + 承認対象） | `member` 以上 |
| `GET` | `/api/workflows/pending` | 承認待ち一覧取得 | `approver`, `tenant_admin` |
| `GET` | `/api/workflows/:id` | 申請詳細取得 | `member` 以上（本人 or 承認者） |
| `POST` | `/api/workflows` | 新規申請作成（下書き） | `member` 以上 |
| `PATCH` | `/api/workflows/:id` | 申請内容更新（下書き状態のみ） | `member` 以上（本人のみ） |
| `POST` | `/api/workflows/:id/submit` | 申請提出（draft → submitted） | `member` 以上（本人のみ） |
| `POST` | `/api/workflows/:id/approve` | 承認（submitted → approved） | `approver`, `tenant_admin` |
| `POST` | `/api/workflows/:id/reject` | 差戻し（submitted → rejected） | `approver`, `tenant_admin` |
| `POST` | `/api/workflows/:id/withdraw` | 取下げ（submitted → withdrawn） | `member` 以上（本人のみ） |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll(tenantId, userId, query)` | テナントID, ユーザーID, フィルタ条件 | `Workflow[]` | 申請一覧取得（RLS相当のフィルタ適用） |
| `findPending(tenantId, approverId)` | テナントID, 承認者ID | `Workflow[]` | 承認待ち一覧取得 |
| `findOne(tenantId, id)` | テナントID, WF ID | `Workflow` | 申請詳細取得（Profile JOIN） |
| `create(tenantId, userId, dto)` | テナントID, ユーザーID, DTO | `Workflow` | 新規申請作成 |
| `update(tenantId, id, dto)` | テナントID, WF ID, DTO | `Workflow` | 申請内容更新（draft のみ） |
| `submit(tenantId, id, userId)` | テナントID, WF ID, ユーザーID | `Workflow` | 申請提出 + 通知作成 |
| `approve(tenantId, id, approverId)` | テナントID, WF ID, 承認者ID | `Workflow` | 承認処理 + 通知作成 |
| `reject(tenantId, id, approverId, reason)` | テナントID, WF ID, 承認者ID, 理由 | `Workflow` | 差戻し + 通知作成 |
| `withdraw(tenantId, id, userId)` | テナントID, WF ID, ユーザーID | `Workflow` | 取下げ処理 |
| `generateWorkflowNumber(tenantId)` | テナントID | `string` | WF番号の並行安全な採番（`WF-001` 形式） |

> [!NOTE] WF 採番ロジック
> 旧 `next_workflow_number()` RPC は `WorkflowService.generateWorkflowNumber()` に移行。
> Prisma `$transaction` + `tenant.update({ workflowSeq: { increment: 1 } })` でアトミック採番する。

### DTO 定義

```typescript
// create-workflow.dto.ts
import { IsString, IsEnum, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { WorkflowType } from '@prisma/client';

export class CreateWorkflowDto {
  @IsEnum(WorkflowType)
  type: WorkflowType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  approverId?: string;
}

// submit-workflow.dto.ts — ボディ不要（パスパラメータの :id のみ）

// reject-workflow.dto.ts
export class RejectWorkflowDto {
  @IsString()
  rejectionReason: string;
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/workflows/
├── workflow-list.component.ts
├── workflow-list.component.html
├── workflow-new.component.ts
├── workflow-new.component.html
├── workflow-pending.component.ts
├── workflow-pending.component.html
├── workflow-detail.component.ts
├── workflow-detail.component.html
├── workflow.service.ts
└── workflow.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `WorkflowListComponent` | Smart / ページ | 申請一覧（フィルタ・ソート対応） |
| `WorkflowNewComponent` | Smart / ページ | 新規申請フォーム（種別選択 → 入力 → 確認） |
| `WorkflowPendingComponent` | Smart / ページ | 承認待ち一覧（approver/tenant_admin 用） |
| `WorkflowDetailComponent` | Smart / ページ | 申請詳細 + 承認/差戻し/取下げ UI |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getAll(query?)` | `GET` | `/api/workflows` | 申請一覧取得 |
| `getPending()` | `GET` | `/api/workflows/pending` | 承認待ち一覧取得 |
| `getById(id)` | `GET` | `/api/workflows/:id` | 申請詳細取得 |
| `create(dto)` | `POST` | `/api/workflows` | 新規申請作成 |
| `update(id, dto)` | `PATCH` | `/api/workflows/:id` | 申請内容更新 |
| `submit(id)` | `POST` | `/api/workflows/:id/submit` | 申請提出 |
| `approve(id)` | `POST` | `/api/workflows/:id/approve` | 承認 |
| `reject(id, reason)` | `POST` | `/api/workflows/:id/reject` | 差戻し |
| `withdraw(id)` | `POST` | `/api/workflows/:id/withdraw` | 取下げ |

## 依存関係
- **NestJS内**: `NotificationModule`（承認/差戻し/提出時の通知作成）、`AuditLogService`（変更操作の監査ログ記録）
- **共有ライブラリ**: `libs/shared/types`（`WorkflowStatus`, `WorkflowType` enum）、`libs/shared/constants`（`WORKFLOW_TRANSITIONS` 状態遷移ルール）
