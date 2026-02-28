---
title: TI-4 経費モジュール実装ウォークスルー
description: 経費の申請/一覧/集計 + ワークフロー連携の実装記録
---

## 概要

TI-4 として経費モジュール（NestJS + Angular）を実装した。経費の CRUD、ワークフロー連動、カテゴリ別/PJ別/月別集計を提供する。

## 作成ファイル一覧

### Shared Types

| ファイル | 内容 |
|---|---|
| `libs/shared/types/src/lib/constants/expense-categories.ts` | `EXPENSE_CATEGORIES` (6種) + `EXPENSE_CATEGORY_COLORS` |
| `libs/shared/types/src/index.ts` | re-export 追加 |

### NestJS Backend (`apps/api/src/modules/expenses/`)

| ファイル | 内容 |
|---|---|
| `dto/create-expense.dto.ts` | category(6種), amount(1〜10M), projectId, approverId, status |
| `dto/expense-query.dto.ts` | category, status, pagination |
| `dto/expense-summary-query.dto.ts` | dateFrom/dateTo, category, projectId, approvedOnly |
| `expenses.service.ts` | findAll, findOne, create (WF連動), getSummaryByCategory/Project/Month, getStats |
| `expenses.controller.ts` | 7 エンドポイント (CRUD 3 + Summary 4) |
| `expenses.module.ts` | Module 定義 |
| `expenses.service.spec.ts` | 8 テスト |
| `expenses.controller.spec.ts` | 7 テスト |

### Angular Frontend (`apps/web/src/app/features/expenses/`)

| ファイル | 内容 |
|---|---|
| `expense.service.ts` | Signal ベース状態管理, CRUD + Summary API |
| `expenses.routes.ts` | 3ルート: `/` 一覧, `/new` 新規, `/summary` 集計 |
| `expense-list.component.ts` | mat-table, カテゴリ/ステータス フィルタ, pagination, カテゴリ色 chip |
| `expense-form.component.ts` | ReactiveForm, 日付/カテゴリ/金額/PJ/承認者, 下書き+送信 |
| `expense-summary.component.ts` | 4統計カード + 3タブ (カテゴリ/PJ/月別), forkJoin 並行取得 |
| `expense.service.spec.ts` | 4 テスト |
| `expense-list.component.spec.ts` | 4 テスト |

### その他変更

| ファイル | 変更 |
|---|---|
| `apps/api/src/app/app.module.ts` | `ExpensesModule` 追加 |
| `apps/web/src/app/app.routes.ts` | expenses ルートを placeholder → `loadChildren` |

---

## エンドポイント一覧

| Method | Path | 説明 | ロール |
|---|---|---|---|
| `GET` | `/api/expenses` | 経費一覧 | 全ロール |
| `GET` | `/api/expenses/:id` | 経費詳細 | member 以上 |
| `POST` | `/api/expenses` | 経費作成 | 全ロール |
| `GET` | `/api/expenses/summary/by-category` | カテゴリ別集計 | pm, accounting, tenant_admin |
| `GET` | `/api/expenses/summary/by-project` | PJ別集計 | pm, accounting, tenant_admin |
| `GET` | `/api/expenses/summary/by-month` | 月別集計 | pm, accounting, tenant_admin |
| `GET` | `/api/expenses/summary/stats` | 統計 (合計/件数/平均/最大) | pm, accounting, tenant_admin |

---

## 実装ポイント

### 1. ワークフロー連携

`create()` で `status=submitted` または `draft` の場合、`Workflow` レコードも同時作成する。
トランザクション内で以下を実行:

1. `tenant.workflowSeq` を increment して WF 番号を採番
2. `workflow.create()` — type=expense, status は dto.status に準拠
3. `expense.create()` — workflowId を紐付け

```typescript
return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { workflowSeq: { increment: 1 } },
    });
    const workflowNumber = `WF-${String(tenant.workflowSeq).padStart(4, '0')}`;
    const workflow = await tx.workflow.create({ data: { ... } });
    const expense = await tx.expense.create({ data: { workflowId: workflow.id, ... } });
    return expense;
});
```

### 2. 集計パターン

- **カテゴリ別**: `prisma.expense.groupBy({ by: ['category'] })` + パーセンテージ算出
- **PJ別**: `groupBy` + 別クエリで `project.findMany` してプロジェクト名解決
- **月別**: `findMany` → JavaScript で月別グルーピング（Prisma の groupBy が Date 関数非対応のため）
- **統計**: `prisma.expense.aggregate()` で _sum, _count, _avg, _max

### 3. エラーコード

| コード | 条件 |
|---|---|
| `ERR-EXP-001` | 経費が見つからない |
| `ERR-VAL-004` | プロジェクト不存在 |
| `ERR-VAL-005` | 承認者不存在 or 承認権限なし |
| `ERR-VAL-010` | 日付範囲不正 (dateFrom > dateTo) |

### 4. Angular Signal パターン

```typescript
// Signal ベースの状態管理
private _expenses = signal<Expense[]>([]);
private _isLoading = signal(false);
private _error = signal<string | null>(null);

readonly expenses = this._expenses.asReadonly();
readonly isLoading = this._isLoading.asReadonly();
```

### 5. 集計ダッシュボード

`forkJoin` で 4 API を並行取得:

```typescript
forkJoin({
    stats: this.expenseService.getStats(query),
    byCategory: this.expenseService.getSummaryByCategory(query),
    byProject: this.expenseService.getSummaryByProject(query),
    byMonth: this.expenseService.getSummaryByMonth(query),
}).subscribe(/* ... */);
```

---

## 検証結果

| 項目 | 結果 |
|---|---|
| NestJS expenses テスト | ✅ 全 PASS (15テスト) |
| API ビルド (`nx build api`) | ✅ 成功 |
| Web ビルド (`nx build web`) | ⚠️ 既存の `projects/` DatePipe エラー (expenses 無関係) |
