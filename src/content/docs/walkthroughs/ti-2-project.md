---
title: "TI-2: プロジェクト + タスクモジュール ウォークスルー"
description: プロジェクト CRUD、メンバー管理、タスク管理（カンバンボード）の実装ウォークスルー
---

## 概要

NestJS バックエンド + Angular フロントエンドでプロジェクト CRUD、メンバー管理、タスク管理（カンバンボード）を実装した。
参照した仕様: API-C01 (Project CRUD)、API-C02 (Task CRUD)、SCR-C01 (Project List/Detail)、SCR-C02 (Task Board)

---

## ディレクトリ構成

```
apps/api/src/modules/projects/
├── dto/
│   ├── create-project.dto.ts
│   ├── update-project.dto.ts
│   ├── query-project.dto.ts
│   ├── add-member.dto.ts
│   ├── create-task.dto.ts
│   └── update-task.dto.ts
├── projects.module.ts
├── projects.controller.ts
├── projects.service.ts
├── projects.controller.spec.ts
├── projects.service.spec.ts
├── tasks.controller.ts
├── tasks.service.ts
├── tasks.controller.spec.ts
└── tasks.service.spec.ts

apps/web/src/app/features/projects/
├── projects.routes.ts
├── project.service.ts
├── task.service.ts
├── project-list.component.ts
├── project-detail.component.ts
├── project-form.component.ts
├── kanban-board.component.ts
├── project.service.spec.ts
├── task.service.spec.ts
├── project-list.component.spec.ts
└── kanban-board.component.spec.ts
```

---

## NestJS API エンドポイント

### ProjectsController (`/api/projects`)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/projects` | all | 一覧取得 (`PaginatedResult`) |
| `GET` | `/projects/:id` | all | 詳細取得（メンバー・タスク統計含む） |
| `POST` | `/projects` | pm, tenant_admin | 新規作成 |
| `PATCH` | `/projects/:id` | pm, tenant_admin | 更新 |
| `POST` | `/projects/:id/members` | pm, tenant_admin | メンバー追加 |
| `DELETE` | `/projects/:id/members/:userId` | pm, tenant_admin | メンバー削除 |

### TasksController

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/projects/:projectId/tasks` | all | プロジェクト内タスク一覧 |
| `POST` | `/projects/:projectId/tasks` | all | タスク作成 |
| `PUT` | `/tasks/:id` | all | タスク更新 |
| `PATCH` | `/tasks/:id/status` | all | ステータス変更 |
| `DELETE` | `/tasks/:id` | pm | タスク削除 |

---

## 主要なビジネスロジック

### ProjectsService

- **`create`**: PM をメンバーとして自動追加。Prisma P2002 → `ConflictException` (ERR-PJ-001)
- **`update`**: `PROJECT_TRANSITIONS` でステータス遷移バリデーション
- **`addMember`**: 重複チェック P2002 → `ConflictException` (ERR-PJ-005)
- **`removeMember`**: PM 削除禁止 → `ForbiddenException` (ERR-PJ-006)
- **`findAll`**: ステータスフィルタ + テキスト検索 + ページネーション

### TasksService

- **`create`**: 担当者がプロジェクトメンバーか確認 (ERR-PJ-011)
- **`changeStatus`**: `TASK_TRANSITIONS` による遷移バリデーション (ERR-PJ-012)
  - `todo → in_progress` ✅
  - `in_progress → done` ✅
  - `todo → done` ❌ (直接完了不可)
  - `done → todo` ❌ (巻き戻し不可)
- **`remove`**: タイムシート紐付きチェック → `ConflictException` (ERR-PJ-014)

---

## Angular コンポーネント

### ProjectListComponent

- `mat-table` + `matSort` + `mat-paginator` で一覧表示
- `mat-select` でステータスフィルタ、`matInput` でテキスト検索
- PM / Tenant Admin のみ「新規作成」ボタン表示
- `data-testid` 属性付与（テスト規約準拠）

### ProjectDetailComponent

- `mat-tab-group` で概要 / メンバー タブ
- 概要タブ: PM、説明、期間、タスク統計（TODO/IN_PROGRESS/DONE カウント）
- メンバータブ: メンバー一覧 + PM バッジ + 削除ボタン（PM以外、権限者のみ）
- カンバンボードへのリンクボタン

### ProjectFormComponent

- `ReactiveFormsModule` で新規/編集フォーム
- `MatDatepicker` で開始日/終了日選択
- ActivatedRoute の `id` パラメータで新規/編集を自動判定

### KanbanBoardComponent

- Angular CDK `DragDropModule` で 3カラム構成 (未着手 / 進行中 / 完了)
- ドロップ時に `canTransition(TASK_TRANSITIONS, from, to)` で遷移可否チェック
- 不正遷移時は `MatSnackBar` でエラー表示 + ドロップ無効化
- API 失敗時はリロードで復元

---

## 共有型の追加

`libs/shared/types/src/lib/constants/status-labels.ts` に以下を追加:

```typescript
// プロジェクトステータス
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: '計画中', active: '進行中', completed: '完了', cancelled: '中止',
};
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = { ... };

// タスクステータス
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    todo: '未着手', in_progress: '進行中', done: '完了',
};
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = { ... };
```

---

## ルーティング変更

`app.routes.ts` の `projects` パスを Placeholder → `loadChildren` に変更:

```diff
-loadComponent: () => import('./features/placeholder.component')
+loadChildren: () => import('./features/projects/projects.routes').then(m => m.PROJECT_ROUTES)
```

---

## テストカバレッジ

### NestJS (4 spec files)

| File | Tests |
|---|---|
| `projects.service.spec.ts` | findAll (フィルタ/ページネーション), findOne, create (P2002), update (遷移), addMember (P2002), removeMember (PM保護) |
| `projects.controller.spec.ts` | 全6エンドポイントの Service 委譲テスト |
| `tasks.service.spec.ts` | findByProject, create (担当者チェック), changeStatus (4パターン), remove (タイムシート保護) |
| `tasks.controller.spec.ts` | 全5エンドポイントの Service 委譲テスト |

### Angular (4 spec files)

| File | Tests |
|---|---|
| `project.service.spec.ts` | loadAll, getById, create, update, addMember, removeMember の HTTP テスト |
| `task.service.spec.ts` | loadByProject, create, update, changeStatus, remove の HTTP テスト |
| `project-list.component.spec.ts` | render, loadAll 呼出, ボタン表示, ローディング, empty state |
| `kanban-board.component.spec.ts` | 3カラム render, カード表示, loadByProject 呼出, ステータス分類 |

---

## 検証コマンド

```bash
# NestJS テスト
npx nx test api --testPathPattern='modules/projects'

# Angular テスト
npx nx test web --testPathPattern='features/projects'

# ビルド確認
npx nx build api
npx nx build web
```
