# TI-11: ダッシュボードモジュール (Wave 2)

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
全モジュールの KPI データを集約表示する。**Wave 1 完了後に開始。**

## 実装対象

### NestJS (`apps/api/src/modules/dashboard/`)
| ファイル | 内容 |
|---|---|
| `dashboard.module.ts` | DashboardModule (imports: 全モジュール) |
| `dashboard.controller.ts` | GET /dashboard |
| `dashboard.service.ts` | Promise.all で全 Service からデータ集約 |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/dashboard/`)
| ファイル | 内容 |
|---|---|
| `dashboard.routes.ts` | DASHBOARD_ROUTES |
| `dashboard.component.ts` | ロール別 KPI カード + 通知 + クイックアクション |
| `kpi-card.component.ts` | 汎用 KPI カード (タイトル, 値, アイコン, カラー) |
| `dashboard.service.ts` | HttpClient |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **ロール別表示**: AuthService.hasRole() で KPI カードを動的に切替
2. **並行取得**: `Promise.all([getWorkflowStats, getProjectStats, ...])` で高速化
3. **inject 対象**: WorkflowsService, ProjectsService, TimesheetsService, ExpensesService, NotificationsService, InvoicesService
4. **クイックアクション**: ロールに応じたショートカットボタン

## 参照ドキュメント
- `detail/modules/dashboard.md` — 全体
- `spec/screens.md` §SCR-I01
