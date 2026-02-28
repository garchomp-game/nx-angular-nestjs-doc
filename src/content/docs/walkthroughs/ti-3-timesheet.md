---
title: TI-3 工数モジュール実装ウォークスルー
description: 工数モジュール（Timesheets）の実装内容・ファイル構成・テスト結果のまとめ
---

## 概要

TI-3 チケットとして、NestJS バックエンド + Angular フロントエンドの工数（Timesheets）モジュールを新規実装した。

---

## ファイル構成

### NestJS Backend

```
apps/api/src/modules/timesheets/
├── timesheets.module.ts          # Module 定義
├── timesheets.controller.ts      # 8 エンドポイント
├── timesheets.service.ts         # CRUD + バルク Upsert + 集計 + CSV
├── dto/
│   ├── create-timesheet.dto.ts   # 単件作成 DTO
│   ├── bulk-timesheet.dto.ts     # 一括登録 DTO (ValidateNested)
│   └── query-timesheet.dto.ts    # クエリ DTO (daily/weekly/summary/export)
├── timesheets.service.spec.ts    # Service テスト (10 cases)
└── timesheets.controller.spec.ts # Controller テスト (8 cases)
```

### Angular Frontend

```
apps/web/src/app/features/timesheets/
├── timesheet.service.ts                 # Signal ベース HttpClient Service
├── timesheet-weekly.component.ts        # 週次グリッド (mat-table, inline 編集)
├── timesheet-report.component.ts        # レポート (PJ別/メンバー別 + CSV出力)
├── timesheets.routes.ts                 # Feature ルート定義
├── timesheet.service.spec.ts            # Service テスト (6 cases)
└── timesheet-weekly.component.spec.ts   # Component テスト (8 cases)
```

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `apps/api/src/app/app.module.ts` | `TimesheetsModule` を imports に追加 |
| `apps/web/src/app/app.routes.ts` | `/timesheets` を `loadChildren` に差し替え |

---

## API エンドポイント一覧

| Method | Path | 説明 | ロール |
|---|---|---|---|
| `GET` | `/api/timesheets/daily` | 日次工数取得 | 全ロール (自分), pm/tenant_admin (他者) |
| `GET` | `/api/timesheets/weekly` | 週次工数取得 | 同上 |
| `POST` | `/api/timesheets` | 工数1件登録 | 全ロール (自分のみ) |
| `PUT` | `/api/timesheets/bulk` | 一括登録/更新/削除 | 全ロール (自分のみ) |
| `DELETE` | `/api/timesheets/:id` | 工数削除 | 全ロール (自分のみ) |
| `GET` | `/api/timesheets/summary/by-project` | PJ別集計 | pm, accounting, tenant_admin |
| `GET` | `/api/timesheets/summary/by-member` | メンバー別集計 | pm, accounting, tenant_admin |
| `GET` | `/api/timesheets/export` | CSV エクスポート | 全ロール (範囲制限) |

---

## 実装ポイント

### バリデーション

| ルール | エラーコード | 実装 |
|---|---|---|
| 0.25 時間刻み | ERR-PJ-020 | `hours % 0.25 !== 0` で検証 |
| 1日 24h 上限 | ERR-PJ-024 | `aggregate` で当日合計を算出し検証 |
| UNIQUE 制約違反 | ERR-PJ-025 | Prisma P2002 エラーを catch |

### バルク Upsert

- `$transaction` で一括処理
- 各エントリの所有権チェック （他ユーザーの工数更新/削除は `ForbiddenException`）
- `deletedIds` で削除対象を指定可能

### CSV エクスポート

- `escapeCsvField()` (`@shared/util`) を使用
- `StreamableFile` で `text/csv` レスポンス返却
- ヘッダ: プロジェクト名, メンバー名, 日付, 工数(h), タスク名, 備考

### 週次グリッド (Angular)

- `mat-table` で動的カラム生成 (月〜日 + 合計)
- inline 編集: `input[type=number]`、0.25 刻みに自動丸め
- 週切替: 前週/次週ボタン + 「今週」ボタン
- `data-testid` 属性で UI テスト対応

### レポート画面 (Angular)

- `mat-tab-group` で PJ別/メンバー別ビュー切替
- 期間フィルタ (`mat-datepicker`) + CSV ダウンロードボタン

---

## テスト結果

| テストスイート | 結果 |
|---|---|
| `timesheets.service.spec.ts` | ✅ PASS (10 cases) |
| `timesheets.controller.spec.ts` | ✅ PASS (8 cases) |
| `timesheet.service.spec.ts` (Angular) | ✅ 作成済み (6 cases) |
| `timesheet-weekly.component.spec.ts` | ✅ 作成済み (8 cases) |

### テスト実行コマンド

```bash
# NestJS テスト (timesheets のみ)
cd /home/garchomp-game/workspace/starlight-test/opshub
npx nx test api --testPathPattern='modules/timesheets'
```
