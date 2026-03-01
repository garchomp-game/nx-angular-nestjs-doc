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
| `POST` | `/api/workflows/:id/attachments` | 添付ファイルアップロード | `member` 以上 |
| `GET` | `/api/workflows/:id/attachments` | 添付ファイル一覧取得 | `member` 以上 |
| `DELETE` | `/api/workflows/:id/attachments/:attachmentId` | 添付ファイル削除 | アップロード者 / `tenant_admin` |
| `GET` | `/api/workflows/:id/attachments/:attachmentId/download` | 添付ファイルダウンロード | `member` 以上 |

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
| `uploadAttachment(tenantId, id, file, userId)` | テナントID, WF ID, ファイル, ユーザーID | `WorkflowAttachment` | 添付ファイル保存 + DB レコード作成 |
| `getAttachments(tenantId, id)` | テナントID, WF ID | `WorkflowAttachment[]` | 添付ファイル一覧取得 |
| `deleteAttachment(tenantId, id, attachmentId, userId)` | テナントID, WF ID, 添付ID, ユーザーID | `void` | 添付ファイル削除（ファイル + DB） |
| `getAttachmentFile(tenantId, id, attachmentId)` | テナントID, WF ID, 添付ID | `WorkflowAttachment` | ダウンロード用ファイル情報取得 |

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
| `uploadAttachment(id, file)` | `POST` | `/api/workflows/:id/attachments` | 添付ファイルアップロード |
| `getAttachments(id)` | `GET` | `/api/workflows/:id/attachments` | 添付ファイル一覧取得 |
| `deleteAttachment(id, attachmentId)` | `DELETE` | `/api/workflows/:id/attachments/:attachmentId` | 添付ファイル削除 |
| `downloadAttachment(id, attachmentId)` | `GET` | `/api/workflows/:id/attachments/:attachmentId/download` | ダウンロード |

## 添付ファイル機能

### multer 設定

```typescript
// workflows.controller.ts
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'workflow-attachments');

@UseInterceptors(FileInterceptor('file', {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException({
        code: 'ERR-WF-ATT-001',
        message: `許可されていないファイル形式です: ${file.mimetype}`,
      }), false);
    }
  },
}))
```

### 許可 MIME タイプ

`ALLOWED_MIME_TYPES` および `MAX_FILE_SIZE_BYTES` は `libs/shared/types/constants/allowed-mime-types.ts` で定義。

### Angular UI（PrimeNG FileUpload）

`WorkflowDetailComponent` 内に添付ファイルセクションを追加:

| PrimeNG | 用途 |
|---|---|
| `FileUpload` | ファイルアップロード UI |
| `Button` | ダウンロード/削除ボタン |
| `Table` | 添付ファイル一覧表示 |
| `ConfirmDialog` | 削除確認 |

### エラーコード

| HTTP | コード | 条件 |
|---|---|---|
| 400 | `ERR-WF-ATT-001` | 許可されていないファイル形式 |
| 400 | `ERR-WF-ATT-002` | ファイル未指定 |

---

## 依存関係
- **NestJS内**: `NotificationModule`（承認/差戻し/提出時の通知作成）、`AuditLogService`（変更操作の監査ログ記録）、`@nestjs/platform-express`（multer）
- **共有ライブラリ**: `libs/shared/types`（`WorkflowStatus`, `WorkflowType` enum）、`libs/shared/constants`（`WORKFLOW_TRANSITIONS`、`ALLOWED_MIME_TYPES`、`MAX_FILE_SIZE_BYTES`）
- **Angular UI**: PrimeNG（`FileUpload`, `Table`, `Button`, `ConfirmDialog`）
