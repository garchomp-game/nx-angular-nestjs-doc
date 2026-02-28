---
title: 工数モジュール設計
description: 工数の週次入力・更新、レポート集計、CSV エクスポートを担うモジュールの詳細設計
---

## 概要
- **責務**: 工数の週次入力・更新、レポート集計、CSV エクスポート
- **Epic**: 工数管理
- **Prisma Models**: `Timesheet`

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/timesheet/
├── timesheet.controller.ts
├── timesheet.service.ts
├── timesheet.module.ts
├── dto/
│   ├── upsert-timesheet.dto.ts
│   └── timesheet-query.dto.ts
├── report.controller.ts
├── report.service.ts
└── timesheet.controller.spec.ts
```

### Controller エンドポイント

#### TimesheetController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/timesheets` | 週次工数取得（week パラメータ指定） | `member` 以上（本人データ） |
| `PUT` | `/api/timesheets` | 工数の一括登録・更新（Upsert） | `member` 以上（本人データ） |

#### ReportController

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/timesheets/reports/project-summary` | プロジェクト別工数集計 | `pm`, `tenant_admin` |
| `GET` | `/api/timesheets/reports/user-summary` | ユーザー別工数集計 | `pm`, `tenant_admin` |
| `GET` | `/api/timesheets/export` | 工数 CSV エクスポート | `pm`, `tenant_admin` |

### Service メソッド

#### TimesheetService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getWeeklyTimesheet(tenantId, userId, weekStart)` | テナントID, ユーザーID, 週開始日 | `Timesheet[]` | 指定週の工数レコード取得（Project, Task を JOIN） |
| `upsertTimesheet(tenantId, userId, entries)` | テナントID, ユーザーID, エントリ配列 | `Timesheet[]` | 工数の一括 Upsert（UNIQUE制約: userId+projectId+taskId+workDate） |

#### ReportService

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getProjectSummary(tenantId, query)` | テナントID, 期間フィルタ | `ProjectSummary[]` | プロジェクト別の工数合計 |
| `getUserSummary(tenantId, query)` | テナントID, 期間フィルタ | `UserSummary[]` | ユーザー別の工数合計 |
| `exportCsv(tenantId, query)` | テナントID, 期間フィルタ | `Buffer` | CSV ファイル生成（`escapeCsvField()` 使用） |

> [!NOTE] CSV エクスポート
> 旧 API Route `api/timesheets/export/route.ts` は `ReportController.exportCsv()` に移行。
> レスポンスヘッダに `Content-Type: text/csv` を設定し、`StreamableFile` で返却する。

### DTO 定義

```typescript
// upsert-timesheet.dto.ts
import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TimesheetEntryDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsDateString()
  workDate: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  hours: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertTimesheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetEntryDto)
  entries: TimesheetEntryDto[];
}

// timesheet-query.dto.ts
export class TimesheetQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/timesheets/
├── timesheet-weekly.component.ts
├── timesheet-weekly.component.html
├── timesheet-report.component.ts
├── timesheet-report.component.html
├── timesheet.service.ts
└── timesheet.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `TimesheetWeeklyComponent` | Smart / ページ | 週次入力グリッド（プロジェクト × 曜日のマトリクス） |
| `TimesheetReportComponent` | Smart / ページ | 工数レポート（期間・PJフィルタ、チャート表示） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getWeekly(weekStart)` | `GET` | `/api/timesheets?week={weekStart}` | 週次工数取得 |
| `upsert(entries)` | `PUT` | `/api/timesheets` | 工数一括登録・更新 |
| `getProjectSummary(query)` | `GET` | `/api/timesheets/reports/project-summary` | PJ別集計 |
| `getUserSummary(query)` | `GET` | `/api/timesheets/reports/user-summary` | ユーザー別集計 |
| `exportCsv(query)` | `GET` | `/api/timesheets/export` | CSV ダウンロード（Blob） |

## 依存関係
- **NestJS内**: `ProjectModule`（プロジェクト名の解決、メンバー確認）
- **共有ライブラリ**: `libs/shared/utils`（`escapeCsvField()` ヘルパー）
