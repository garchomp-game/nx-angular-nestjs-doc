---
title: 画面一覧
description: OpsHub の全画面とURL・ロール・対応REQのマッピング（Angular 版）
---

## 目的 / In-Out / Related
- **目的**: システムの全画面を一覧化し、設計の網羅性を確保する
- **対象範囲（In）**: 画面名・URL・対象ロール・対応REQ
- **対象範囲（Out）**: 画面の詳細仕様（→ SPEC-SCR）
- **Related**: [REQカタログ](../req-catalog/) / [ロール定義](../roles/)

---

## 共通画面

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 01 | ログイン | `/login` | 全員 | — | Must |
| 02 | ダッシュボード | `/dashboard` | 全員 | REQ-G03 | Must |

## Epic A: テナント/組織/権限

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 03 | テナント管理 | `/admin/tenants` | IT Admin | REQ-A01 | Must |
| 04 | ユーザー管理 | `/admin/users` | Tenant Admin | REQ-A02 | Must |
| 05 | 監査ログビューア | `/admin/audit-logs` | IT Admin, Tenant Admin | REQ-A03 | Must |

## Epic B: ワークフロー

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 06 | 申請一覧 | `/workflows` | 全員 | REQ-B03 | Must |
| 07 | 申請作成 | `/workflows/new` | Member, PM, Accounting | REQ-B01 | Must |
| 08 | 申請詳細/承認 | `/workflows/:id` | 全員（権限で制御） | REQ-B02 | Must |

## Epic C: 案件/タスク/工数

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 09 | プロジェクト一覧 | `/projects` | 全員 | REQ-C01 | Must |
| 10 | プロジェクト詳細 | `/projects/:id` | Member, PM | REQ-C01 | Must |
| 11 | タスク管理 | `/projects/:id/tasks` | Member, PM | REQ-C02 | Must |
| 12 | 工数入力 | `/timesheets` | Member, PM | REQ-C03 | Must |
| 13 | 工数集計 | `/timesheets/reports` | PM | REQ-C03 | Must |

## Epic D: 経費

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 14 | 経費一覧/申請 | `/expenses` | Member, Accounting | REQ-D01 | Should |
| 15 | 経費集計 | `/expenses/summary` | Accounting | REQ-D02 | Should |

## Epic E: 請求

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 16 | 請求一覧 | `/invoices` | Accounting, PM | REQ-E01 | Should |
| 17 | 請求書詳細/編集 | `/invoices/:id` | Accounting | REQ-E01 | Should |

## Epic F: ドキュメント

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 18 | ドキュメント一覧 | `/projects/:id/documents` | Member, PM | REQ-F01 | Could |

## Epic G: 通知/検索/レポート

| # | 画面名 | Angular Route | 対象ロール | REQ | 優先度 |
|---|---|---|---|---|---|
| 19 | 検索結果 | `/search` | 全員 | REQ-G02 | Could |

> **通知**: ヘッダー内の `NotificationBellComponent` として実装。独立画面なし。

---

## Angular ルーティング構成

```typescript
// apps/web/src/app/app.routes.ts
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      {
        path: 'workflows',
        loadChildren: () => import('./features/workflows/workflows.routes'),
      },
      {
        path: 'projects',
        loadChildren: () => import('./features/projects/projects.routes'),
      },
      {
        path: 'timesheets',
        loadChildren: () => import('./features/timesheets/timesheets.routes'),
      },
      {
        path: 'expenses',
        loadChildren: () => import('./features/expenses/expenses.routes'),
        canActivate: [rolesGuard(['member', 'accounting', 'tenant_admin'])],
      },
      {
        path: 'invoices',
        loadChildren: () => import('./features/invoices/invoices.routes'),
        canActivate: [rolesGuard(['accounting', 'pm', 'tenant_admin'])],
      },
      {
        path: 'search',
        component: SearchResultsComponent,
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes'),
        canActivate: [rolesGuard(['tenant_admin', 'it_admin'])],
      },
    ],
  },
];
```

## 画面設計の対象

Must画面（13画面）を優先的に詳細化する。Should/Could 画面は概要レベル。
