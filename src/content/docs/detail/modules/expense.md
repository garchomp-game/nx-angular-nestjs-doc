---
title: 経費モジュール設計
description: 経費の登録・一覧表示・集計・ワークフロー連携を担うモジュールの詳細設計
---

## 概要
- **責務**: 経費の登録・一覧表示・集計・ワークフロー連携
- **Epic**: 経費管理
- **Prisma Models**: `Expense`

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/expense/
├── expense.controller.ts
├── expense.service.ts
├── expense.module.ts
├── dto/
│   ├── create-expense.dto.ts
│   └── expense-query.dto.ts
├── summary.controller.ts
├── summary.service.ts
└── expense.controller.spec.ts
```

### Controller エンドポイント

#### ExpenseController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/expenses` | 経費一覧取得（フィルタ対応） | `member` 以上 |
| `GET` | `/api/expenses/:id` | 経費詳細取得 | `member` 以上（本人 or PM/Admin） |
| `POST` | `/api/expenses` | 経費新規登録 | `member` 以上 |

#### SummaryController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/expenses/summary/by-category` | カテゴリ別経費集計 | `pm`, `accounting`, `tenant_admin` |
| `GET` | `/api/expenses/summary/by-project` | プロジェクト別経費集計 | `pm`, `accounting`, `tenant_admin` |
| `GET` | `/api/expenses/summary/by-month` | 月別経費集計 | `pm`, `accounting`, `tenant_admin` |
| `GET` | `/api/expenses/summary/stats` | 経費統計（合計・平均等） | `pm`, `accounting`, `tenant_admin` |

### Service メソッド

#### ExpenseService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll(tenantId, userId, query)` | テナントID, ユーザーID, フィルタ | `Expense[]` | 経費一覧（ロールに応じたフィルタ適用） |
| `findOne(tenantId, id)` | テナントID, 経費ID | `Expense` | 経費詳細取得（Workflow, Project を JOIN） |
| `create(tenantId, userId, dto)` | テナントID, ユーザーID, DTO | `Expense` | 経費登録 + 監査ログ |

#### SummaryService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getByCategory(tenantId, query)` | テナントID, 期間フィルタ | `CategorySummary[]` | カテゴリ別集計 |
| `getByProject(tenantId, query)` | テナントID, 期間フィルタ | `ProjectSummary[]` | PJ別集計 |
| `getByMonth(tenantId, query)` | テナントID, 期間フィルタ | `MonthlySummary[]` | 月別集計 |
| `getStats(tenantId, query)` | テナントID, 期間フィルタ | `ExpenseStats` | 統計情報（合計金額・件数・平均等） |

### DTO 定義

```typescript
// create-expense.dto.ts
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// expense-query.dto.ts
export class ExpenseQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/expenses/
├── expense-list.component.ts
├── expense-list.component.html
├── expense-new.component.ts
├── expense-new.component.html
├── expense-summary.component.ts
├── expense-summary.component.html
├── expense.service.ts
└── expense.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `ExpenseListComponent` | Smart / ページ | 経費一覧（カテゴリ・期間フィルタ対応） |
| `ExpenseNewComponent` | Smart / ページ | 経費新規登録フォーム（WF連携・PJ選択） |
| `ExpenseSummaryComponent` | Smart / ページ | 集計ダッシュボード（カテゴリ/PJ/月別チャート） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getAll(query?)` | `GET` | `/api/expenses` | 経費一覧取得 |
| `getById(id)` | `GET` | `/api/expenses/:id` | 経費詳細取得 |
| `create(dto)` | `POST` | `/api/expenses` | 経費登録 |
| `getSummaryByCategory(query)` | `GET` | `/api/expenses/summary/by-category` | カテゴリ別集計 |
| `getSummaryByProject(query)` | `GET` | `/api/expenses/summary/by-project` | PJ別集計 |
| `getSummaryByMonth(query)` | `GET` | `/api/expenses/summary/by-month` | 月別集計 |
| `getStats(query)` | `GET` | `/api/expenses/summary/stats` | 経費統計 |

## 依存関係
- **NestJS内**: `WorkflowModule`（WF連携時の参照）、`AuditLogService`（変更操作の監査ログ記録）
- **共有ライブラリ**: `libs/shared/types`（経費カテゴリ型）
