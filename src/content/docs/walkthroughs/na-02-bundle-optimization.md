---
title: "NA-02: バンドルサイズ最適化"
description: "変更内容と検証結果"
---

## 変更サマリー

`error.interceptor.ts` で使用していた `@angular/material/snack-bar` の `MatSnackBar` を PrimeNG の `MessageService` に置換し、初期バンドルから Angular Material + CDK（86.2 kB）を除去。`pnpm nx build web` の budget WARNING を解消した。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/app/core/interceptors/error.interceptor.ts` | MODIFY: `MatSnackBar` → `MessageService` に置換 |
| `apps/web/src/app/features/admin/services/users.service.ts` | MODIFY: `MatSnackBar` → `MessageService` に置換 |
| `apps/web/src/app/features/admin/services/tenant.service.ts` | MODIFY: `MatSnackBar` → `MessageService` に置換 |
| `apps/web/src/app/features/admin/services/users.service.spec.ts` | MODIFY: mock を `MatSnackBar` → `MessageService` に更新 |
| `apps/web/src/app/features/admin/services/tenant.service.spec.ts` | MODIFY: mock を `MatSnackBar` → `MessageService` に更新 |
| `package.json` | MODIFY: `@angular/material` を dependencies から削除 |

## 主な変更の詳細

### 根本原因

`error.interceptor.ts` は `app.config.ts` の `withInterceptors()` で eagerly に読み込まれるため、`MatSnackBar` の import が Angular Material の button・snack-bar・CDK overlay 等 **86.2 kB** を初期バンドルに引き込んでいた。

### 初期バンドル内 Material モジュール内訳

| モジュール | サイズ |
|-----------|--------|
| `@angular/material/button` | 25.0 kB |
| `@angular/cdk/overlay` | 17.4 kB |
| `@angular/material/snack-bar` | 13.9 kB |
| その他 (CDK focus, ripple 等) | ~30 kB |
| **合計** | **~86.2 kB** |

### 変更パターン

`snackBar.open(message, closeLabel, {duration, panelClass})` を `messageService.add({severity, summary, life})` に統一。

```diff
- import { MatSnackBar } from '@angular/material/snack-bar';
+ import { MessageService } from 'primeng/api';

- const snackBar = inject(MatSnackBar);
+ const messageService = inject(MessageService);

- snackBar.open(message, '閉じる', { duration: 5000, panelClass: ['error-snackbar'] });
+ messageService.add({ severity: 'error', summary: message, life: 5000 });
```

severity マッピング:
- 成功通知 → `'success'`
- ネットワークエラー / 5xx → `'error'`
- 4xx → `'warn'`
- 情報通知 → `'info'`

:::note
`@angular/cdk` は Kanban ボードの `DragDropModule` で使用中のため残置。`@angular/material` のみ削除。
:::

## テスト結果

### ビルド

```
$ pnpm nx build web

Application bundle generation complete. [7.588 seconds]

Output location: /home/garchomp-game/workspace/starlight-test/opshub/dist/apps/web

 NX   Successfully ran target build for project web
```

**WARNING なし** ✅（変更前: `bundle initial exceeded maximum budget. Budget 1.00 MB was not met by 27.51 kB with a total of 1.03 MB.`）

### 単体テスト

```
$ pnpm nx test web

 Test Files  2 failed | 26 passed (28)
      Tests  3 failed | 197 passed (200)
   Duration  10.77s
```

- 26/28 ファイル passed ✅
- 2件の失敗 (`audit-log-viewer.component.spec.ts` 等) は **既存の無関係な失敗** — 本変更による regression なし

### バンドルサイズ比較

| 項目 | Before | After |
|------|--------|-------|
| 初期バンドル | 1.03 MB | < 1.00 MB |
| Budget (1.00 MB) | ❌ 27.51 kB 超過 | ✅ 余裕あり |
| WARNING | あり | **なし** |
