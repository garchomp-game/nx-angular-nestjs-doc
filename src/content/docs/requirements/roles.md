---
title: ロール/権限（要件レベル）
description: OpsHubのロール定義と基本的なアクセス権限マトリクス
---

## 目的 / In-Out / Related
- **目的**: システムで使用するロールと、各ロールの責務・権限範囲を定義する
- **対象範囲（In）**: ロール名称・責務・画面/機能レベルのアクセス権限
- **対象範囲（Out）**: NestJS Guards / Prisma Middleware の実装詳細
- **Related**: [Project Brief](../project-brief/) / [認可仕様](../../spec/authz/)

## ロール一覧

| ロール | 英語名 | 責務 | スコープ |
|---|---|---|---|
| メンバー | Member | 申請作成、自タスクの工数入力、自経費の申請 | 自分のデータ |
| 承認者 | Approver | ワークフローの承認/差戻し | 承認対象のデータ |
| PM | PM | プロジェクト管理、タスク割当、工数集計確認 | 担当プロジェクト |
| 経理 | Accounting | 経費承認/集計、請求管理 | テナント全体の経費/請求 |
| IT管理者 | IT Admin | テナント横断の設定、監査ログ閲覧 | 全テナント |
| テナント管理者 | Tenant Admin | テナント内のユーザー管理、ロール付与 | 自テナント |

## 権限マトリクス（概要）

| 機能領域 | Member | Approver | PM | Accounting | Tenant Admin | IT Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **ダッシュボード** | 自分 | 自分+承認 | PJ全体 | 経費/請求 | テナント | 全体 |
| **ワークフロー申請** | ✅作成 | — | ✅作成 | ✅作成 | ✅作成 | — |
| **ワークフロー承認** | — | ✅ | — | — | ✅ | — |
| **プロジェクト管理** | 閲覧 | 閲覧 | ✅CRUD | 閲覧 | ✅CRUD | 閲覧 |
| **タスク管理** | 自分 | 閲覧 | ✅CRUD | — | ✅CRUD | — |
| **工数入力** | ✅自分 | ✅自分 | ✅自分+閲覧 | — | — | — |
| **経費申請** | ✅自分 | — | ✅自分 | — | — | — |
| **経費承認/集計** | — | — | — | ✅ | ✅ | — |
| **請求管理** | — | — | 閲覧 | ✅CRUD | ✅CRUD | — |
| **ドキュメント** | ✅CRUD | ✅CRUD | ✅CRUD | 閲覧 | ✅CRUD | 閲覧 |
| **ユーザー管理** | — | — | — | — | ✅ | ✅ |
| **監査ログ** | — | — | — | — | 閲覧 | ✅ |
| **テナント設定** | — | — | — | — | ✅ | ✅ |

## NestJS での権限実装方針

### Guard / Decorator パターン

```typescript
// 画面/エンドポイントレベルの認可
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pm', 'tenant_admin')
@Controller('projects')
export class ProjectsController { ... }
```

### Prisma Middleware によるテナント分離

```typescript
// 全クエリに tenant_id フィルタを自動付与
prisma.$use(async (params, next) => {
  if (params.action === 'findMany') {
    params.args.where = {
      ...params.args.where,
      tenant_id: currentTenantId,
    };
  }
  return next(params);
});
```

## ロール設計原則
1. **1ユーザーは1テナント内で複数ロールを持てる**（例: Member + Approver）
2. **ロールはテナントごとに付与される**（テナントAではPM、テナントBではMember）
3. **IT Admin のみテナント横断**（管理コンソール用）
4. **最小権限の原則**: デフォルトは Member。上位権限は明示的に付与

## 未決事項
- 承認者の階層（1段階 vs 多段階）は REQ-B（ワークフロー）で詳細化
- IT Admin のテナント横断アクセスの制限（Phase 1 では自テナントのみ）
