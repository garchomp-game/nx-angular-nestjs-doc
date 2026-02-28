---
title: ダッシュボードモジュール設計
description: KPI 集計表示、未読通知一覧、クイックアクションを担うモジュールの詳細設計
---

## 概要
- **責務**: KPI 集計表示、未読通知一覧、クイックアクション
- **Epic**: ダッシュボード
- **Prisma Models**: 直接操作なし（他モジュール Service を集約）

> [!NOTE] 集約パターン
> ダッシュボードモジュールは自身では Prisma Model を直接操作せず、
> `WorkflowService`, `ProjectService`, `TimesheetService`, `NotificationService` 等を inject して集約する。

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/dashboard/
├── dashboard.controller.ts
├── dashboard.service.ts
├── dashboard.module.ts
└── dashboard.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/dashboard` | ダッシュボード統合データ取得 | `member` 以上 |
| `GET` | `/api/dashboard/kpi` | KPI カード用データ取得 | `member` 以上 |
| `GET` | `/api/dashboard/project-progress` | プロジェクト進捗一覧 | `pm`, `tenant_admin` |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getDashboardData(tenantId, userId, roles)` | テナントID, ユーザーID, ロール一覧 | `DashboardData` | ロールに応じたKPI一括取得（Promise.all 並行） |
| `getKpi(tenantId, userId, roles)` | テナントID, ユーザーID, ロール一覧 | `KpiData` | KPI カード用データ |
| `getProjectProgress(tenantId)` | テナントID | `ProjectProgress[]` | PJ進捗一覧（タスク完了率） |

### DashboardData 型定義

```typescript
interface DashboardData {
  kpi: KpiData;
  recentNotifications: Notification[];
  quickActions: QuickAction[];
}

interface KpiData {
  pendingApprovals: number;     // 承認待ち件数（approver/admin のみ）
  myWorkflows: number;          // 自分の申請件数
  myTasks: number;              // 自分のタスク件数（member/pm のみ）
  weeklyHours: number;          // 今週の合計工数（member/pm のみ）
}

interface ProjectProgress {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

interface QuickAction {
  label: string;
  icon: string;
  routerLink: string;
  roles: string[];              // 表示対象ロール
}
```

### ロール別 KPI 表示分岐

| KPI | member | pm | approver | accounting | tenant_admin |
|---|---|---|---|---|---|
| 承認待ち件数 | — | — | ✓ | — | ✓ |
| 自分の申請件数 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 自分のタスク件数 | ✓ | ✓ | — | — | ✓ |
| 今週の工数 | ✓ | ✓ | — | — | ✓ |
| PJ進捗 | — | ✓ | — | — | ✓ |

### 並行データ取得パターン

```typescript
// dashboard.service.ts — Promise.all で並行取得
async getDashboardData(tenantId: string, userId: string, roles: string[]): Promise<DashboardData> {
  const isApprover = roles.some(r => ['approver', 'tenant_admin'].includes(r));
  const isMemberOrPm = roles.some(r => ['member', 'pm', 'tenant_admin'].includes(r));

  const [pendingApprovals, myWorkflows, myTasks, weeklyHours, notifications] = await Promise.all([
    isApprover ? this.workflowService.countPending(tenantId) : 0,
    this.workflowService.countByUser(tenantId, userId),
    isMemberOrPm ? this.taskService.countByAssignee(tenantId, userId) : 0,
    isMemberOrPm ? this.timesheetService.getWeeklyTotal(tenantId, userId) : 0,
    this.notificationService.findAll(tenantId, userId, { limit: 5, unreadOnly: true }),
  ]);

  return {
    kpi: { pendingApprovals, myWorkflows, myTasks, weeklyHours },
    recentNotifications: notifications.data,
    quickActions: this.getQuickActions(roles),
  };
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/dashboard/
├── dashboard.component.ts
├── dashboard.component.html
├── dashboard.component.css
├── kpi-card.component.ts
├── kpi-card.component.html
├── dashboard.service.ts
└── dashboard.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `DashboardComponent` | Smart / ページ | ダッシュボード全体レイアウト（KPI + 通知 + クイックアクション） |
| `KpiCardComponent` | Presentational | KPI カード（アイコン + 数値 + ラベル） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getDashboard()` | `GET` | `/api/dashboard` | ダッシュボード統合データ取得 |
| `getKpi()` | `GET` | `/api/dashboard/kpi` | KPI カード用データ取得 |
| `getProjectProgress()` | `GET` | `/api/dashboard/project-progress` | PJ進捗一覧取得 |

## 依存関係
- **NestJS内**: `WorkflowModule`（承認待ち件数、自分の申請件数）、`ProjectModule` + `TaskService`（タスク件数、PJ進捗）、`TimesheetModule`（週次工数）、`NotificationModule`（未読通知）
- **共有ライブラリ**: `libs/shared/types`（`Role` enum、KPI用型定義）
