---
title: "TI-11: ダッシュボード ウォークスルー"
description: 全モジュール KPI 集約ダッシュボードの実装
---

## Summary

Wave 1 完了後のダッシュボードモジュールを実装した。NestJS バックエンドで全モジュールのデータを `Promise.all` で並行集約し、Angular フロントエンドでロール別 KPI カード・未読通知・クイックアクションを表示する。

## Changes

### NestJS Backend (`apps/api/src/modules/dashboard/`)

| ファイル | 内容 |
|---|---|
| `dashboard.service.ts` | PrismaService 直接利用で KPI データ集約。`getDashboardData` / `getKpi` / `getProjectProgress` / `getQuickActions`。Promise.all で並行取得。ロール別分岐あり。 |
| `dashboard.controller.ts` | `GET /dashboard`, `GET /dashboard/kpi`, `GET /dashboard/project-progress` (PM/Admin のみ) |
| `dashboard.module.ts` | Controller + Service 登録 |
| `dashboard.service.spec.ts` | 7 テスト: ロール別 KPI、プロジェクト進捗率、クイックアクション |
| `dashboard.controller.spec.ts` | 3 テスト: 各エンドポイントの Service 委譲確認 |

### Angular Frontend (`apps/web/src/app/features/dashboard/`)

| ファイル | 内容 |
|---|---|
| `dashboard.service.ts` | HttpClient + Signal ベース状態管理 |
| `kpi-card.component.ts` | 汎用 KPI カード (mat-card + mat-icon、Signal inputs) |
| `dashboard.component.ts` | ロール別 KPI カード表示、プロジェクト進捗 (PM のみ)、通知一覧、クイックアクション |
| `dashboard.routes.ts` | `DASHBOARD_ROUTES` 定義 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `apps/api/src/app/app.module.ts` | `DashboardModule` を imports に追加 |
| `apps/web/src/app/app.routes.ts` | `loadComponent` → `loadChildren` (DASHBOARD_ROUTES) |

## Verification

| テスト | 結果 |
|---|---|
| `npx nx test api -- --testPathPattern=modules/dashboard` | ✅ 10/10 PASS (Service 7 + Controller 3) |
| 既存テストへの影響 | なし (189 passed, 4 pre-existing failures in invoices/documents) |
