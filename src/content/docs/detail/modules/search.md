---
title: 全文検索モジュール設計 (SearchModule)
description: 複数テーブル横断検索の NestJS Module + Angular Feature 設計
---

## 概要

- **責務**: ワークフロー・プロジェクト・タスク・経費の 4 テーブル横断検索、検索結果の統一型への正規化
- **Epic**: REQ-G02（全文検索）
- **Prisma Models**: `Workflow`, `Project`, `Task`, `Expense`（横断読取のみ）

> [!NOTE]
> 検索は DB プロバイダで分岐する。SQLite は `LIKE` ベース、PostgreSQL は `pg_trgm` + GIN インデックスによる Full-Text Search を利用。
> 4 テーブルの検索は `Promise.all` で並列実行してレイテンシを最小化する。

---

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/search/
├── search.module.ts
├── search.controller.ts
├── search.service.ts
├── dto/
│   └── search-query.dto.ts
├── types/
│   └── search-result.ts
└── tests/
    └── search.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/search` | 横断検索（query, category, page） | 認証済みユーザー全員 |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `searchAll` | `tenantId, userId, roles, query` | `SearchResponse` | 4テーブル並列検索 + 統一型へ正規化 |
| `searchWorkflows` | `tenantId, query, limit` | `SearchResult[]` | ワークフロー検索 |
| `searchProjects` | `tenantId, query, limit` | `SearchResult[]` | プロジェクト検索 |
| `searchTasks` | `tenantId, query, limit` | `SearchResult[]` | タスク検索 |
| `searchExpenses` | `tenantId, userId, roles, query, limit` | `SearchResult[]` | 経費検索（ロール別フィルタ） |

### 統一検索結果型

```typescript
// types/search-result.ts
export interface SearchResult {
  id: string;
  type: 'workflow' | 'project' | 'task' | 'expense';
  title: string;
  description?: string;
  status?: string;
  url: string;
  createdAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  counts: {
    workflows: number;
    projects: number;
    tasks: number;
    expenses: number;
    total: number;
  };
}
```

### 検索ロジック（DB プロバイダ分岐）

```typescript
// search.service.ts
private buildSearchCondition(query: string) {
  const escaped = this.escapeLikePattern(query);

  // SQLite: LIKE ベース
  // PostgreSQL: contains（Prisma Full-Text Search）
  return {
    OR: [
      { title: { contains: escaped, mode: 'insensitive' as const } },
      { description: { contains: escaped, mode: 'insensitive' as const } },
    ],
  };
}

private escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}
```

### 並列検索パターン

```typescript
// search.service.ts - searchAll()
async searchAll(tenantId: string, userId: string, roles: string[], query: SearchQueryDto) {
  const limit = query.category === 'all' ? 10 : 20;

  const [workflows, projects, tasks, expenses] = await Promise.all([
    this.searchWorkflows(tenantId, query.q, limit),
    this.searchProjects(tenantId, query.q, limit),
    this.searchTasks(tenantId, query.q, limit),
    this.searchExpenses(tenantId, userId, roles, query.q, limit),
  ]);

  return {
    results: [...workflows, ...projects, ...tasks, ...expenses],
    counts: {
      workflows: workflows.length,
      projects: projects.length,
      tasks: tasks.length,
      expenses: expenses.length,
      total: workflows.length + projects.length + tasks.length + expenses.length,
    },
  };
}
```

### 経費のロール別フィルタ

```typescript
// search.service.ts - searchExpenses()
async searchExpenses(tenantId: string, userId: string, roles: string[], query: string, limit: number) {
  const where: Prisma.ExpenseWhereInput = {
    tenantId,
    ...this.buildSearchCondition(query),
  };

  // Member/PM: 自分の経費のみ、Accounting/Admin: 全件
  if (!roles.includes('accounting') && !roles.includes('tenant_admin')) {
    where.createdBy = userId;
  }

  const expenses = await this.prisma.expense.findMany({ where, take: limit });
  return expenses.map((e) => this.toSearchResult(e, 'expense'));
}
```

### DTO 定義

```typescript
// search-query.dto.ts
export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;

  @IsOptional()
  @IsIn(['all', 'workflows', 'projects', 'tasks', 'expenses'])
  category?: string = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/search/
├── search.routes.ts
├── search-results/
│   ├── search-results.component.ts
│   └── search-results.component.html
└── services/
    └── search.service.ts

apps/web/src/app/shared/components/
└── header-search-bar/
    ├── header-search-bar.component.ts
    └── header-search-bar.component.html
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `SearchResultsComponent` | Smart | 検索結果一覧 + カテゴリタブ + ページネーション |
| `HeaderSearchBarComponent` | Shared | ヘッダー共通検索バー（Enter で `/search?q=` へ遷移） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `search(query, category?, page?)` | `GET` | `/api/search` | 横断検索実行 |

### ヘルパー関数

```typescript
// search-results.component.ts 内
function highlightText(text: string, query: string): string {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
```

### ルーティング

```typescript
// search.routes.ts
export const SEARCH_ROUTES: Routes = [
  { path: '', component: SearchResultsComponent },
];
```

---

## 依存関係

- **NestJS 内**: `PrismaModule`（DB アクセス、4 テーブル横断読取）
- **共有ライブラリ**: `libs/shared/types`（`SearchResult` 型）
- **Guard**: `TenantGuard`（テナント分離）、`AuthGuard`（認証チェック）
- **特記**: 他モジュールの Service には依存しない（Prisma 直接アクセスで横断検索）
