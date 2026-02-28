# TI-4: 経費モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
経費の申請/承認 + カテゴリ別サマリー + ワークフロー連携を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/expenses/`)
| ファイル | 内容 |
|---|---|
| `expenses.module.ts` | ExpensesModule |
| `expenses.controller.ts` | GET/POST/PATCH/DELETE |
| `expense-summary.controller.ts` | GET (カテゴリ別集計) |
| `expenses.service.ts` | CRUD + 集計 |
| `dto/` | CreateExpenseDto, QueryExpenseDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/expenses/`)
| ファイル | 内容 |
|---|---|
| `expenses.routes.ts` | EXPENSE_ROUTES |
| `expense-list.component.ts` | 一覧 (mat-table, カテゴリフィルタ) |
| `expense-form.component.ts` | 新規/編集フォーム (レシート添付) |
| `expense-summary.component.ts` | カテゴリ別円グラフ |
| `expense.service.ts` | HttpClient + Signal |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **ワークフロー連携**: 経費承認時は WorkflowService を呼ぶ（interface 参照）
2. **レシート添付**: multer でファイル受信, ALLOWED_MIME_TYPES でバリデーション
3. **集計**: category + month でグループ化、Promise.all で並行取得
4. **エラーコード**: ERR-EXP-001 以降

## 参照ドキュメント
- `detail/modules/expense.md` — 全体
- `spec/apis.md` §API-D01〜D02
- `spec/screens.md` §SCR-D01
- `detail/db.md` — Expense モデル
