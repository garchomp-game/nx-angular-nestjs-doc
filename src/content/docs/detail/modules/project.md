---
title: プロジェクト+タスクモジュール設計
description: プロジェクトとタスクの CRUD、メンバー管理、カンバンボードを担うモジュールの詳細設計
---

## 概要
- **責務**: プロジェクトとタスクの CRUD、メンバー管理、カンバンボード
- **Epic**: プロジェクト管理・タスク管理
- **Prisma Models**: `Project`, `ProjectMember`, `Task`

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/project/
├── project.controller.ts
├── project.service.ts
├── project.module.ts
├── dto/
│   ├── create-project.dto.ts
│   ├── update-project.dto.ts
│   ├── assign-member.dto.ts
│   ├── create-task.dto.ts
│   └── update-task.dto.ts
├── task.controller.ts
├── task.service.ts
└── project.controller.spec.ts
```

### Controller エンドポイント

#### ProjectController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/projects` | プロジェクト一覧取得 | `member` 以上 |
| `GET` | `/api/projects/:id` | プロジェクト詳細取得 | `member` 以上（メンバーまたはPM） |
| `POST` | `/api/projects` | プロジェクト新規作成 | `pm`, `tenant_admin` |
| `PATCH` | `/api/projects/:id` | プロジェクト更新 | `pm`（当該PJ）, `tenant_admin` |
| `POST` | `/api/projects/:id/members` | メンバー追加 | `pm`（当該PJ）, `tenant_admin` |
| `DELETE` | `/api/projects/:id/members/:userId` | メンバー削除 | `pm`（当該PJ）, `tenant_admin` |

#### TaskController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/tasks` | タスク一覧取得（カンバン用含む） | `member` 以上（PJメンバー） |
| `POST` | `/api/projects/:projectId/tasks` | タスク新規作成 | `pm`（当該PJ）, `tenant_admin` |
| `PATCH` | `/api/projects/:projectId/tasks/:id` | タスク更新（ステータス変更含む） | `member` 以上（担当者 or PM） |

### Service メソッド

#### ProjectService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll(tenantId, userId)` | テナントID, ユーザーID | `Project[]` | プロジェクト一覧（メンバーの場合は参加PJのみ） |
| `findOne(tenantId, id)` | テナントID, PJ ID | `Project` | 詳細取得（メンバー一覧含む, Profile JOIN） |
| `create(tenantId, userId, dto)` | テナントID, ユーザーID, DTO | `Project` | PJ新規作成 + 監査ログ |
| `update(tenantId, id, dto)` | テナントID, PJ ID, DTO | `Project` | PJ更新 + 監査ログ |
| `assignMember(tenantId, projectId, dto)` | テナントID, PJ ID, DTO | `ProjectMember` | メンバー追加 |
| `removeMember(tenantId, projectId, userId)` | テナントID, PJ ID, ユーザーID | `void` | メンバー削除 |

#### TaskService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findByProject(tenantId, projectId)` | テナントID, PJ ID | `Task[]` | タスク一覧取得（カンバン表示用、Profile JOIN） |
| `create(tenantId, projectId, userId, dto)` | テナントID, PJ ID, ユーザーID, DTO | `Task` | タスク作成 + 監査ログ |
| `update(tenantId, projectId, id, dto)` | テナントID, PJ ID, タスクID, DTO | `Task` | タスク更新 + ステータス遷移バリデーション |

### DTO 定義

```typescript
// create-project.dto.ts
import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsString()
  pmId: string;
}

// assign-member.dto.ts
export class AssignMemberDto {
  @IsString()
  userId: string;
}

// create-task.dto.ts
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// update-task.dto.ts
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/projects/
├── project-list.component.ts
├── project-list.component.html
├── project-new.component.ts
├── project-new.component.html
├── project-detail.component.ts
├── project-detail.component.html
├── task-board.component.ts
├── task-board.component.html
├── project.service.ts
├── task.service.ts
└── project.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `ProjectListComponent` | Smart / ページ | プロジェクト一覧（ステータスフィルタ対応） |
| `ProjectNewComponent` | Smart / ページ | プロジェクト新規作成フォーム |
| `ProjectDetailComponent` | Smart / ページ | PJ詳細 + メンバー管理 + 編集 UI |
| `TaskBoardComponent` | Smart / ページ | カンバンボード（ドラッグ&ドロップでステータス変更） |

### Service メソッド (HttpClient)

#### ProjectService

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getAll()` | `GET` | `/api/projects` | プロジェクト一覧取得 |
| `getById(id)` | `GET` | `/api/projects/:id` | プロジェクト詳細取得 |
| `create(dto)` | `POST` | `/api/projects` | PJ新規作成 |
| `update(id, dto)` | `PATCH` | `/api/projects/:id` | PJ更新 |
| `addMember(projectId, userId)` | `POST` | `/api/projects/:id/members` | メンバー追加 |
| `removeMember(projectId, userId)` | `DELETE` | `/api/projects/:id/members/:userId` | メンバー削除 |

#### TaskService

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getByProject(projectId)` | `GET` | `/api/projects/:projectId/tasks` | タスク一覧取得 |
| `create(projectId, dto)` | `POST` | `/api/projects/:projectId/tasks` | タスク作成 |
| `update(projectId, id, dto)` | `PATCH` | `/api/projects/:projectId/tasks/:id` | タスク更新 |

## 依存関係
- **NestJS内**: `AuditLogService`（変更操作の監査ログ記録）
- **共有ライブラリ**: `libs/shared/types`（`ProjectStatus`, `TaskStatus` enum）、`libs/shared/constants`（`PROJECT_TRANSITIONS`, `TASK_TRANSITIONS` 状態遷移ルール）
