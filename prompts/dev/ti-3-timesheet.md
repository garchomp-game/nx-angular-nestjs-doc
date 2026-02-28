# TI-3: 工数モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
週次の工数入力グリッド + CSVエクスポート + レポート画面を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/timesheets/`)
| ファイル | 内容 |
|---|---|
| `timesheets.module.ts` | TimesheetsModule |
| `timesheets.controller.ts` | GET/POST/PATCH + bulk + CSV export |
| `timesheets.service.ts` | CRUD + 一括登録 + CSV生成 |
| `dto/` | CreateTimesheetDto, BulkTimesheetDto, QueryTimesheetDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/timesheets/`)
| ファイル | 内容 |
|---|---|
| `timesheets.routes.ts` | TIMESHEET_ROUTES |
| `timesheet-weekly.component.ts` | 週次グリッド (月〜日 × プロジェクト) |
| `timesheet-report.component.ts` | レポート (期間集計 + CSVダウンロード) |
| `timesheet.service.ts` | HttpClient + Signal |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **時間バリデーション**: 0.25刻み、1日24h以下 (ERR-PJ-020)
2. **一括登録**: bulk API で週単位の複数エントリを一度に保存
3. **CSVエクスポート**: `escapeCsvField()` (`@shared/util`) を使用
4. **週次グリッド**: mat-table で動的カラム生成、inline 編集
5. **監査ログ**: 日常入力は記録しない。CSVエクスポートのみ記録 (spec/audit-logging.md)

## 参照ドキュメント
- `detail/modules/timesheet.md` — 全体
- `spec/apis.md` §API-C03
- `spec/screens.md` §SCR-C03
- `detail/db.md` — Timesheet モデル
