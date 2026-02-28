---
title: 共有型カタログ (libs/shared)
description: フロントエンド・バックエンドで共有する型定義、enum、定数、ユーティリティの一覧
---

本ドキュメントは `libs/shared/` 配下の全エクスポートを定義する。Angular (apps/web) と NestJS (apps/api) の両方から参照され、**API 契約の単一ソース・オブ・トゥルース**として機能する。

---

## ディレクトリ構成

```
libs/shared/
├── types/                          # 型・enum・定数
│   └── src/
│       ├── index.ts               # barrel export
│       └── lib/
│           ├── enums/
│           │   ├── role.enum.ts
│           │   ├── user-status.enum.ts
│           │   ├── workflow-status.enum.ts
│           │   ├── workflow-type.enum.ts
│           │   ├── project-status.enum.ts
│           │   ├── task-status.enum.ts
│           │   └── invoice-status.enum.ts
│           ├── interfaces/
│           │   ├── current-user.interface.ts
│           │   ├── pagination.interface.ts
│           │   └── api-response.interface.ts
│           ├── dto/
│           │   └── api-response.dto.ts
│           └── constants/
│               ├── role-labels.ts
│               ├── status-labels.ts
│               ├── transitions.ts
│               ├── invoice-constants.ts
│               └── allowed-mime-types.ts
├── util/                           # ユーティリティ関数
│   └── src/
│       ├── index.ts
│       └── lib/
│           ├── csv.util.ts
│           ├── string.util.ts
│           ├── file.util.ts
│           └── notification-link.util.ts
└── ui/                             # 共有 Angular コンポーネント (将来)
    └── src/
        └── index.ts
```

---

## Enum 定義

### Role

```typescript
// libs/shared/types/src/lib/enums/role.enum.ts
export enum Role {
  MEMBER = 'member',
  APPROVER = 'approver',
  PM = 'pm',
  ACCOUNTING = 'accounting',
  IT_ADMIN = 'it_admin',
  TENANT_ADMIN = 'tenant_admin',
}
```

### UserStatus

```typescript
// libs/shared/types/src/lib/enums/user-status.enum.ts
export enum UserStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
```

### WorkflowStatus / WorkflowType

```typescript
// libs/shared/types/src/lib/enums/workflow-status.enum.ts
export enum WorkflowStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

// libs/shared/types/src/lib/enums/workflow-type.enum.ts
export enum WorkflowType {
  EXPENSE = 'expense',
  LEAVE = 'leave',
  PURCHASE = 'purchase',
  OTHER = 'other',
}
```

### ProjectStatus / TaskStatus

```typescript
// libs/shared/types/src/lib/enums/project-status.enum.ts
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// libs/shared/types/src/lib/enums/task-status.enum.ts
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}
```

### InvoiceStatus

```typescript
// libs/shared/types/src/lib/enums/invoice-status.enum.ts
export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}
```

---

## Interface 定義

### CurrentUser

JWT の `validate()` が返す共通ユーザー型。Controller の `@CurrentUser()` で取得可能。

```typescript
// libs/shared/types/src/lib/interfaces/current-user.interface.ts
import { Role } from '../enums/role.enum';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;             // アクティブテナント（X-Tenant-Id ヘッダーで決定）
  tenantIds: string[];          // 所属テナント一覧
  roles: TenantRole[];          // テナント×ロール組
}

export interface TenantRole {
  tenantId: string;
  role: Role;
}
```

### ApiResponse\<T\>

全 REST API の統一レスポンス型。NestJS の `ResponseInterceptor` が自動ラップ。

```typescript
// libs/shared/types/src/lib/interfaces/api-response.interface.ts
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export interface ApiError {
  code: string;           // ERR-AUTH-001, ERR-VAL-002 等
  message: string;        // 人間可読メッセージ
  fields?: Record<string, string>;  // フィールド別エラー (バリデーション用)
}
```

### PaginatedResult\<T\>

ページネーション対応のレスポンス型。

```typescript
// libs/shared/types/src/lib/interfaces/pagination.interface.ts
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;          // 全件数
  page: number;           // 現在ページ (1-indexed)
  limit: number;          // 1ページあたり件数
  totalPages: number;     // 全ページ数
}

export interface PaginationQuery {
  page?: number;          // default: 1
  limit?: number;         // default: 20, max: 100
}
```

---

## 定数定義

### ロールラベル

```typescript
// libs/shared/types/src/lib/constants/role-labels.ts
import { Role } from '../enums/role.enum';

export const ROLE_LABELS: Record<Role, string> = {
  [Role.MEMBER]: 'メンバー',
  [Role.APPROVER]: '承認者',
  [Role.PM]: 'プロジェクトマネージャー',
  [Role.ACCOUNTING]: '経理',
  [Role.IT_ADMIN]: 'IT管理者',
  [Role.TENANT_ADMIN]: 'テナント管理者',
};
```

### ステータスラベル・カラー

```typescript
// libs/shared/types/src/lib/constants/status-labels.ts
import { UserStatus }     from '../enums/user-status.enum';
import { WorkflowStatus } from '../enums/workflow-status.enum';

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.INVITED]: '招待中',
  [UserStatus.ACTIVE]: '有効',
  [UserStatus.INACTIVE]: '無効',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  [UserStatus.INVITED]: 'accent',
  [UserStatus.ACTIVE]: 'primary',
  [UserStatus.INACTIVE]: 'warn',
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.DRAFT]: '下書き',
  [WorkflowStatus.SUBMITTED]: '申請中',
  [WorkflowStatus.APPROVED]: '承認済',
  [WorkflowStatus.REJECTED]: '差戻し',
  [WorkflowStatus.WITHDRAWN]: '取下げ',
};

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.DRAFT]: '',
  [WorkflowStatus.SUBMITTED]: 'accent',
  [WorkflowStatus.APPROVED]: 'primary',
  [WorkflowStatus.REJECTED]: 'warn',
  [WorkflowStatus.WITHDRAWN]: '',
};
```

### 状態遷移ルール

```typescript
// libs/shared/types/src/lib/constants/transitions.ts
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { ProjectStatus }  from '../enums/project-status.enum';
import { TaskStatus }     from '../enums/task-status.enum';
import { InvoiceStatus }  from '../enums/invoice-status.enum';

export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WorkflowStatus.DRAFT]: [WorkflowStatus.SUBMITTED],
  [WorkflowStatus.SUBMITTED]: [WorkflowStatus.APPROVED, WorkflowStatus.REJECTED, WorkflowStatus.WITHDRAWN],
  [WorkflowStatus.REJECTED]: [WorkflowStatus.SUBMITTED, WorkflowStatus.WITHDRAWN],
  [WorkflowStatus.APPROVED]: [],
  [WorkflowStatus.WITHDRAWN]: [],
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.PLANNING]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [],
  [ProjectStatus.CANCELLED]: [],
};

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.TODO, TaskStatus.DONE],
  [TaskStatus.DONE]: [TaskStatus.IN_PROGRESS],
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
};

/** 遷移可否チェックヘルパー */
export function canTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
```

### 請求書定数

```typescript
// libs/shared/types/src/lib/constants/invoice-constants.ts
import { InvoiceStatus } from '../enums/invoice-status.enum';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: '下書き',
  [InvoiceStatus.SENT]: '送付済',
  [InvoiceStatus.PAID]: '入金済',
  [InvoiceStatus.CANCELLED]: 'キャンセル',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: '',
  [InvoiceStatus.SENT]: 'accent',
  [InvoiceStatus.PAID]: 'primary',
  [InvoiceStatus.CANCELLED]: 'warn',
};

export const DEFAULT_TAX_RATE = 0.10;  // 10%
```

### 許可MIMEタイプ

```typescript
// libs/shared/types/src/lib/constants/allowed-mime-types.ts
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // .xlsx
  'text/plain',
  'text/csv',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
```

---

## ユーティリティ関数

### CSV エスケープ

```typescript
// libs/shared/util/src/lib/csv.util.ts
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### SQL LIKE エスケープ

```typescript
// libs/shared/util/src/lib/string.util.ts
export function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}
```

### ファイルサイズフォーマット

```typescript
// libs/shared/util/src/lib/file.util.ts
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
```

### 通知リンク生成

```typescript
// libs/shared/util/src/lib/notification-link.util.ts
export function getNotificationLink(
  resourceType: string | null,
  resourceId: string | null,
): string | null {
  if (!resourceType || !resourceId) return null;
  const routes: Record<string, string> = {
    workflow: `/workflows/${resourceId}`,
    project:  `/projects/${resourceId}`,
    task:     `/projects`,
    expense:  `/expenses`,
  };
  return routes[resourceType] ?? null;
}
```

---

## Barrel Export

```typescript
// libs/shared/types/src/index.ts
// Enums
export * from './lib/enums/role.enum';
export * from './lib/enums/user-status.enum';
export * from './lib/enums/workflow-status.enum';
export * from './lib/enums/workflow-type.enum';
export * from './lib/enums/project-status.enum';
export * from './lib/enums/task-status.enum';
export * from './lib/enums/invoice-status.enum';

// Interfaces
export * from './lib/interfaces/current-user.interface';
export * from './lib/interfaces/api-response.interface';
export * from './lib/interfaces/pagination.interface';

// Constants
export * from './lib/constants/role-labels';
export * from './lib/constants/status-labels';
export * from './lib/constants/transitions';
export * from './lib/constants/invoice-constants';
export * from './lib/constants/allowed-mime-types';
```

```typescript
// libs/shared/util/src/index.ts
export * from './lib/csv.util';
export * from './lib/string.util';
export * from './lib/file.util';
export * from './lib/notification-link.util';
```

---

## Nx ライブラリ設定

### project.json

```json
// libs/shared/types/project.json
{
  "name": "shared-types",
  "sourceRoot": "libs/shared/types/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:types"]
}
```

```json
// libs/shared/util/project.json
{
  "name": "shared-util",
  "sourceRoot": "libs/shared/util/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:util"]
}
```

### tsconfig paths

```json
// tsconfig.base.json (抜粋)
{
  "compilerOptions": {
    "paths": {
      "@shared/types": ["libs/shared/types/src/index.ts"],
      "@shared/util":  ["libs/shared/util/src/index.ts"],
      "@prisma-db":    ["libs/prisma-db/src/index.ts"]
    }
  }
}
```

モジュール開発時は以下のように import:

```typescript
import { Role, CurrentUser, ApiResponse } from '@shared/types';
import { escapeCsvField, formatFileSize } from '@shared/util';
```
