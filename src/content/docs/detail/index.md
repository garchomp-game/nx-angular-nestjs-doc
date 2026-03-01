---
title: 詳細設計
description: DB、モジュール、共有基盤の詳細設計ドキュメント一覧
---

## Wave 0: 共有基盤

各モジュール開発の前に先行実装が必要な基盤コンポーネント。

| ドキュメント | 内容 |
|---|---|
| [共有型カタログ](../shared-types/) | `libs/shared/types` — enum, interface, constants, utils |
| [Prisma セットアップ](../prisma-setup/) | `libs/prisma-db` — PrismaService, $extends, seed |
| [NestJS 共通基盤](../common-infrastructure/) | `common/` — Guards, Interceptors, Decorators, Filters, nestjs-pino, Swagger, ThrottlerGuard |
| [Angular Core 基盤](../angular-core/) | `core/` — AuthService, PrimeNG 設定, app.routes.ts, AppShell |

## データ設計

| ドキュメント | 内容 |
|---|---|
| [DB設計 (Prisma)](../db/) | 15 Prisma models + ER図 |
| [Guard/Middleware設計](../guard-design/) | CRUD 権限マトリクス + Middleware コード例 |
| [状態遷移/シーケンス](../sequences/) | 5 状態遷移図 + 7 シーケンス図 |

## モジュール設計

| ドキュメント | 内容 |
|---|---|
| [モジュール全体設計](../modules/) | Nx 構成 + パターン変換 |
| [ワークフロー](../modules/workflow/) | DD-MOD-001 |
| [プロジェクト](../modules/project/) | DD-MOD-002 |
| [工数](../modules/timesheet/) | DD-MOD-003 |
| [経費](../modules/expense/) | DD-MOD-004 |
| [通知](../modules/notification/) | DD-MOD-005 |
| [ダッシュボード](../modules/dashboard/) | DD-MOD-006 |
| [管理](../modules/admin/) | DD-MOD-007 |
| [請求書](../modules/invoice/) | DD-MOD-008 |
| [ドキュメント](../modules/document/) | DD-MOD-009 |
| [検索](../modules/search/) | DD-MOD-010 |
| [運用基盤](../modules/operations/) | DD-MOD-011 |
| [認証 (Auth)](../modules/auth/) | DD-MOD-012 (新規) |
