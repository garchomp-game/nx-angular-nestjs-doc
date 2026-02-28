# T2-5: Module 個別設計 Batch A (MOD-001~006)

## タスク概要
以下の6モジュールについて、NestJS Module + Angular Feature の個別設計ドキュメントを作成する。

## 対象モジュール

| # | モジュール | NestJS Module | Angular Feature |
|---|---|---|---|
| MOD-001 | ワークフロー | `WorkflowModule` | `features/workflows/` |
| MOD-002 | プロジェクト+タスク | `ProjectModule` | `features/projects/` |
| MOD-003 | 工数 | `TimesheetModule` | `features/timesheets/` |
| MOD-004 | 経費 | `ExpenseModule` | `features/expenses/` |
| MOD-005 | 通知 | `NotificationModule` | `shared/notification-bell/` |
| MOD-006 | ダッシュボード | `DashboardModule` | `features/dashboard/` |

## 入力ファイル（参照元）
- **モジュール設計**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/modules/index.md`（DD-MOD-001 ~ DD-MOD-006 セクション）
- **移行済み全体設計**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules.md`（T2-4 の成果物。まだ存在しない場合は元ドキュメントから直接移行）
- **DB設計**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/db/index.md`

## 出力ファイル
各モジュールごとに **1ファイル** 作成:
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/workflow.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/project.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/timesheet.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/expense.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/notification.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/dashboard.md`

## 各ファイルの構成テンプレート

```markdown
---
title: {モジュール名}モジュール設計
description: {概要}
---

## 概要
- **責務**: {元 DD-MOD-XXX の責務を NestJS 文脈に}
- **Epic**: {対応する Epic}
- **Prisma Models**: {使用する model}

## NestJS 構成

### ファイル構成
apps/api/src/modules/{name}/
├── {name}.controller.ts
├── {name}.service.ts
├── {name}.module.ts
├── dto/
│   ├── create-{name}.dto.ts
│   └── update-{name}.dto.ts
└── {name}.controller.spec.ts

### Controller エンドポイント
| Method | Path | 説明 | 必要ロール |
|---|---|---|---|

### Service メソッド
| メソッド | 引数 | 戻り値 | 説明 |

### DTO 定義
(class-validator デコレータ付き)

## Angular 構成

### ファイル構成
apps/web/src/app/features/{name}/
├── {name}-list.component.ts
├── {name}-detail.component.ts
├── {name}.service.ts
└── {name}.routes.ts

### Component 一覧
| Component | 種別 | 概要 |

### Service メソッド (HttpClient)
| メソッド | HTTP | Path | 概要 |

## 依存関係
- **NestJS内**: {他モジュール依存}
- **共有ライブラリ**: {libs/shared/* 依存}
```

## 注意事項
- 元の DD-MOD の「公開I/F」を NestJS Controller エンドポイント + Service メソッドに変換
- 元の「データ境界」を Prisma Model 名に変換
- ワークフローモジュールの WF 採番ロジック(`next_workflow_number`)は Service メソッドに
- ダッシュボードモジュールは他モジュールの Service を inject して集約する形
