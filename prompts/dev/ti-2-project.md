# TI-2: プロジェクト + タスクモジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
プロジェクトの CRUD + メンバー管理 + タスク管理（カンバンボード含む）を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/projects/`)
| ファイル | 内容 |
|---|---|
| `projects.module.ts` | ProjectsModule |
| `projects.controller.ts` | GET/POST/PATCH/DELETE + members |
| `projects.service.ts` | CRUD + メンバー追加/削除 |
| `tasks.controller.ts` | GET/POST/PATCH/DELETE + status change |
| `tasks.service.ts` | タスク CRUD + ステータス変更 |
| `dto/` | CreateProjectDto, CreateTaskDto, AddMemberDto, QueryProjectDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/projects/`)
| ファイル | 内容 |
|---|---|
| `projects.routes.ts` | PROJECT_ROUTES (list, detail, new, kanban) |
| `project-list.component.ts` | 一覧 (mat-table, ステータスフィルタ) |
| `project-detail.component.ts` | 詳細 (タブ: タスク/メンバー/ドキュメント) |
| `project-form.component.ts` | 新規/編集フォーム |
| `kanban-board.component.ts` | CDK Drag&Drop でタスクステータス変更 |
| `project.service.ts` | HttpClient + Signal |
| `task.service.ts` | HttpClient + Signal |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **カンバン**: Angular CDK `DragDrop` を使用。ドロップ時に `TASK_TRANSITIONS` でバリデーション
2. **メンバー管理**: PM + Tenant Admin のみ追加/削除可能
3. **プロジェクトコード**: UK制約。Prisma P2002 → ConflictException (ERR-PJ-001)
4. **タブ統合**: project-detail で mat-tab-group を使い、タスク/メンバー/ドキュメントを表示

## 参照ドキュメント
- `detail/modules/project.md` — 全体
- `spec/apis.md` §API-C01〜C02
- `spec/screens.md` §SCR-C01〜C02
- `detail/db.md` — Project, ProjectMember, Task モデル
- `testing/module-test-patterns.md`
