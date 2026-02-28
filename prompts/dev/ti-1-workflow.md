# TI-1: ワークフローモジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
申請の CRUD + 状態遷移（draft → submitted → approved/rejected/withdrawn）を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/workflows/`)
| ファイル | 内容 |
|---|---|
| `workflows.module.ts` | WorkflowsModule |
| `workflows.controller.ts` | GET/POST/PATCH + approve/reject/withdraw |
| `workflows.service.ts` | CRUD + 状態遷移 + 通知連携 |
| `dto/` | CreateWorkflowDto, UpdateWorkflowDto, QueryWorkflowDto |
| `workflows.controller.spec.ts` | Controller テスト |
| `workflows.service.spec.ts` | Service テスト (状態遷移テスト必須) |

### Angular (`apps/web/src/app/features/workflows/`)
| ファイル | 内容 |
|---|---|
| `workflows.routes.ts` | WORKFLOW_ROUTES |
| `workflow-list.component.ts` | 一覧 (mat-table, ステータスフィルタ) |
| `workflow-detail.component.ts` | 詳細 (承認/差戻し/取下げボタン) |
| `workflow-form.component.ts` | 新規/編集フォーム |
| `workflow-pending.component.ts` | 承認待ち一覧 (Approver/Admin 向け) |
| `workflow.service.ts` | HttpClient + Signal |
| `workflow.service.spec.ts` | HTTP テスト |
| `workflow-list.component.spec.ts` | Component テスト |

### 重要な実装ポイント
1. **状態遷移**: `WORKFLOW_TRANSITIONS` 定数 (`@shared/types`) を使用し `canTransition()` でバリデーション
2. **自己承認禁止**: `createdBy === approverId` の場合は ForbiddenException
3. **通知**: approve/reject 時に `NotificationsService.create()` を呼ぶ（inject）
4. **ファイル添付**: WorkflowAttachment は multer で受信（API-B02 参照）
5. **エラーコード**: ERR-WF-001（不正遷移）, ERR-WF-002（未検出）, ERR-WF-003（権限なし）

## 参照ドキュメント
- `detail/modules/workflow.md` — 全体
- `spec/apis.md` §API-B01〜B03
- `spec/screens.md` §SCR-B01〜B03
- `detail/db.md` — Workflow, WorkflowAttachment モデル
- `detail/guard-design.md` — workflows 行
- `detail/sequences.md` — ワークフロー承認シーケンス
- `testing/module-test-patterns.md`
- `spec/error-handling.md`
