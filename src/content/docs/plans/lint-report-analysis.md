---
title: Web Lint レポート分析
description: eslint-plugin-security 導入後の Web アプリ lint 結果の詳細分析
---

## 概要

`pnpm nx lint web` の実行結果: **276 problems (31 errors, 245 warnings)**、対象ファイル **35 ファイル**。

> [!IMPORTANT]
> **31 errors は全て既存の Angular テンプレート / TypeScript ルール違反**であり、今回追加した `eslint-plugin-security` 由来のものは 0 件。Security 検出は全て `warn` レベル (51 件)。

---

## ルール別サマリ

| ルール | レベル | 件数 | 分類 |
|--------|--------|------|------|
| `@typescript-eslint/no-explicit-any` | warn | **105** | 型安全 |
| `security/detect-object-injection` | warn | **42** | 🔒 セキュリティ |
| `@typescript-eslint/no-unused-vars` | warn | 19 | コード品質 |
| `@angular-eslint/template/label-has-associated-control` | **error** | 14 | a11y |
| `@typescript-eslint/no-non-null-assertion` | warn | 14 | 型安全 |
| `@angular-eslint/template/click-events-have-key-events` | **error** | 8 | a11y |
| `@angular-eslint/template/interactive-supports-focus` | **error** | 8 | a11y |
| `security/detect-non-literal-regexp` | warn | **2** | 🔒 セキュリティ |
| `@typescript-eslint/no-empty-function` | **error** | 3 | コード品質 |
| `@typescript-eslint/no-inferrable-types` | **error** | 2 | 型安全 |
| `security/detect-object-injection` (Function Call) | warn | **1** | 🔒 セキュリティ |
| `security/detect-object-injection` (Variable Assigned) | warn | **1** | 🔒 セキュリティ |

---

## カテゴリ別詳細解説

### 🔒 セキュリティ警告 (46 件 — 全て warn)

`eslint-plugin-security` が検出したパターン。**全て意図的な利用であり false positive**だが、コードレビュー時の安全性確認ポイントとして機能する。

#### `security/detect-object-injection` (42 件)

**検出内容**: 変数をキーにしたオブジェクトアクセス `obj[variable]` を検知。攻撃者が `variable` を制御できる場合、`__proto__` や `constructor` へのアクセスによるプロトタイプ汚染が発生しうる。

**主な発生箇所**:

| ファイル | 件数 | パターン |
|---------|------|---------|
| `auth.service.spec.ts` | 12 | テストの mock storage アクセス |
| `timesheet-weekly.component.ts` | 12 | 曜日キーでのグリッドデータアクセス |
| `workflow-detail.component.ts` | 5 | ステータスラベルのマッピング |
| `invoice-detail/list.component.ts` | 4 | ステータスラベルのマッピング |
| `kanban-board.component.ts` | 2 | カラムデータアクセス |
| その他 7 ファイル | 7 | 同様のパターン |

**リスク評価**: ⬇️ **低** — キーは全てアプリ内部の定数 (enum 値、曜日名等) であり、外部入力が混入する経路はない。

**推奨対応**: `Map<Key, Value>` への置き換え、または安全であることを確認した上で `// eslint-disable-next-line security/detect-object-injection` で抑制。

#### `security/detect-non-literal-regexp` (2 件)

| ファイル | 行 | コード例 |
|---------|-----|---------|
| `highlight.pipe.ts` | 11 | `new RegExp(query, 'gi')` |
| `search-results.component.ts` | 224 | `new RegExp(query, 'gi')` |

**検出理由**: ユーザー入力 (`query`) を直接 `RegExp` コンストラクタに渡すと、[ReDoS (Regular Expression Denial of Service)](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) 攻撃の対象になりうる。

**リスク評価**: ⚠️ **中** — 検索クエリはユーザー入力由来。ただしフロントエンドのみで使用（サーバー側には影響なし）。

**推奨対応**: 入力をエスケープする関数を追加:
```typescript
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
new RegExp(escapeRegExp(query), 'gi');
```

#### `security/detect-object-injection` — Function Call / Variable Assigned (2 件)

| ファイル | 行 | サブタイプ |
|---------|-----|----------|
| `search-results.component.ts` | 195 | Function Call |
| `timesheet-weekly.component.ts` | 288 | Variable Assigned |

**リスク評価**: ⬇️ **低** — 上記と同様、内部定数によるアクセス。

---

### ❌ Error: a11y (アクセシビリティ) — 30 件

Angular テンプレートのアクセシビリティ違反。**ビルドやテストには影響しないが、CI の lint ステップを失敗させている主因**。

#### `@angular-eslint/template/label-has-associated-control` (14 件)

`<label>` タグが `for` 属性やネストされたフォームコントロールを持っていない。

| コンポーネント | 件数 |
|--------------|------|
| `workflow-list.component.ts` | 3 |
| `project-list.component.ts` | 2 |
| `audit-log-viewer.component.ts` | 2 |
| `tenant-settings.component.ts` | 2 |
| `expense-summary.component.ts` | 2 |
| `timesheet-report.component.ts` | 2 |
| `expense-form.component.ts` | 1 |

**修正方法**: `<label>` を PrimeNG の `<p-floatLabel>` に置き換えるか、`for` 属性を追加。

#### `click-events-have-key-events` + `interactive-supports-focus` (16 件、8 ペア)

`(click)` イベントを持つ要素に `(keyup)` / `(keydown)` ハンドラがなく、`tabindex` も設定されていない。

| コンポーネント | 件数 |
|--------------|------|
| `app-shell.component.ts` | 6 |
| `notification-bell.component.ts` | 4 |
| `notification-list.component.ts` | 2 |

**修正方法**: `<div (click)="fn()">` → `<button (click)="fn()">` に変更するか、`tabindex="0" (keydown.enter)="fn()"` を追加。

---

### ⚠️ Warning: 型安全 — 119 件

#### `@typescript-eslint/no-explicit-any` (105 件)

**最多の警告**。API レスポンスの型定義がない箇所で `any` が使用されている。

| モジュール | 件数 | 主な原因 |
|-----------|------|---------|
| `workflows/` | 34 | `workflow.service.ts` のレスポンス型未定義 |
| `projects/` | 23 | `project.service.ts`, `task.service.ts` |
| `invoices/` | 21 | `invoices.service.ts` のレスポンス型 |
| `dashboard/` | 10 | `dashboard.service.ts` の集約 API |
| `admin/` | 8 | `users.service.ts`, `tenant.service.ts` |
| `expenses/` | 6 | `expense-form.component.ts` |
| `notifications/` | 3 | テスト + サービス |

**推奨対応**: OpenAPI SDK (NA-03 で生成済み) の型を import して置き換えるのが最も効率的。

#### `@typescript-eslint/no-non-null-assertion` (14 件)

`!` 演算子の使用。Angular の reactive forms やルートパラメータで発生。

**推奨対応**: Optional chaining (`?.`) やガード節に置き換え。

---

### ⚠️ Warning: コード品質 — 19 件

#### `@typescript-eslint/no-unused-vars` (19 件)

未使用の import や変数。

| 種別 | 件数 | 例 |
|------|------|-----|
| 未使用 import | 14 | `signal`, `computed`, `fakeAsync`, `tick` |
| 未使用変数 | 3 | `entries`, `err`, `mimeType` |
| 未使用定数 | 2 | `USER_STATUS_LABELS`, `PROJECT_STATUS_COLORS` |

**修正方法**: `--fix` で自動削除可能なものもあるが、将来使用予定の import は意図的な場合もある。

---

## 優先度別 修正推奨

### 🔴 High — CI を通すために必要

| 対応 | 件数 | 作業量 |
|------|------|--------|
| a11y エラー修正 (label / click / focus) | 30 | 中（テンプレート修正） |
| `no-empty-function` 修正 | 3 | 小（空関数に `/* noop */` コメント or 実装追加） |
| `no-inferrable-types` 修正 | 2 | 小（型注釈削除、`--fix` で自動） |

### 🟡 Medium — 型安全・品質向上

| 対応 | 件数 | 作業量 |
|------|------|--------|
| `any` → 適切な型に置換 | 105 | 大（OpenAPI SDK の型を活用） |
| 未使用 import/変数の削除 | 19 | 小（`--fix` 対応可能） |
| `!` 演算子の排除 | 14 | 中 |

### 🟢 Low — セキュリティ false positive 対応

| 対応 | 件数 | 作業量 |
|------|------|--------|
| ReDoS 対策 (`escapeRegExp`) | 2 | 小 |
| object injection の確認 + 抑制コメント | 44 | 中 |
