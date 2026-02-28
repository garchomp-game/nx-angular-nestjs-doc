---
title: "AI 並列開発レポート — Angular + NestJS で 4 時間 11 モジュール"
description: "AI エージェントによる大規模並列開発の実証実験レポート。技術選定、パフォーマンス、設計考察を含む"
---

## エグゼクティブサマリー

Nx モノレポ上の **Angular 21 + NestJS 11** プロジェクトにおいて、AI エージェント（最大 6 並列）を活用し、**約 4 時間で 11 の業務モジュールを実装**した。最終成果物は **368 テスト全パス、型エラーゼロ**。並列開発による破綻は通知モジュールの重複 1 件のみで、30 分以内に修正完了した。

---

## 1. プロジェクト概要

### 技術スタック

| カテゴリ | 技術 | バージョン |
|---|---|---|
| モノレポ | Nx | 22.x |
| フロントエンド | Angular | 21.x |
| バックエンド | NestJS | 11.x |
| ORM | Prisma | 6.x |
| テスト (API) | Jest + @swc/jest | 30.x |
| テスト (Web) | Vitest | 4.x |
| コンパイラ | SWC | 1.x |
| パッケージ | pnpm | 10.x |
| 言語 | TypeScript | 5.9.x |

### 実装モジュール (TI-1 〜 TI-11)

| # | モジュール | API | Web | テスト数 |
|---|---|---|---|---|
| TI-1 | 工数管理 (Timesheets) | ✅ | ✅ | 含む |
| TI-2 | ワークフロー (Workflows) | ✅ | ✅ | 含む |
| TI-3 | 経費管理 (Expenses) | ✅ | ✅ | 含む |
| TI-4 | プロジェクト/タスク (Projects) | ✅ | ✅ | 含む |
| TI-5 | 通知 (Notifications) | ✅ | ✅ | 含む |
| TI-6 | 管理者 (Admin) | ✅ | ✅ | 含む |
| TI-7 | 請求書 (Invoices) | ✅ | ✅ | 含む |
| TI-8 | ドキュメント (Documents) | ✅ | ✅ | 含む |
| TI-9 | 横断検索 (Search) | ✅ | ✅ | 含む |
| TI-10 | ダッシュボード (Dashboard) | ✅ | ✅ | 含む |
| TI-11 | ヘルスチェック (Health) | ✅ | — | 含む |

---

## 2. パフォーマンス計測

### ビルド・テスト

| 指標 | npm + tsc | pnpm + SWC | 改善率 |
|---|---|---|---|
| API テスト (228 tests) | 23s | **3.5s** | **6.6x** |
| API テスト (2 回目/キャッシュ) | 23s | **0.75s** | **30x** |
| API ビルド | 15s | **10s** | 1.5x |
| Web ビルド | 30s+ | **9s** | 3.3x |
| 型チェック (API) | — | **2.0s** (incremental) | — |

### 開発時間

| 工程 | 所要時間 |
|---|---|
| Nx init → 共通基盤構築 | ~1 時間 |
| Wave 1 (TI-1〜TI-6, 6 並列) | ~1 時間 |
| Wave 2 (TI-7〜TI-11, 5 並列) | ~1 時間 |
| pnpm + SWC 移行 | ~30 分 |
| 品質監査 + 修正 + ドキュメント | ~30 分 |
| **合計** | **~4 時間** |

> 従来のエンプラ開発で同規模の見積もり: **3〜6 ヶ月、5〜10 人チーム**

---

## 3. SWC 導入の技術的背景

### なぜ tsc より速いのか

SWC が高速な理由は「Rust だから」だけではなく、4 つの要因の掛け算:

| 要因 | 概算倍率 | 説明 |
|---|---|---|
| Rust ネイティブ | 2〜3x | AOT コンパイル、GC なし、静的ディスパッチ |
| **型チェック省略** | **3〜5x** | 型アノテーションを「消すだけ」で検証しない |
| メモリレイアウト最適化 | 1.5〜2x | アリーナアロケータ、CPU キャッシュヒット率向上 |
| 並列処理 | コア数比例 | ファイル間依存なしで完全並列化 |

### 型チェックの分離戦略

```
開発時:  IDE (VS Code) がリアルタイム型チェック
ビルド:  SWC がトランスパイル（型は消すだけ）
CLI:     tsc --noEmit で全ファイル走査（手動 or CI）
```

> [!IMPORTANT]
> VS Code は**開いているファイルしか完全にチェックしない**。
> 作業区切りで `pnpm typecheck` を実行して全ファイルの型安全を担保すること。

### SWC 導入時の注意点: Prisma import

SWC は型情報を持たないため、名前空間経由のランタイムアクセスが動作しない:

```typescript
// ❌ SWC で動作しない
import { Prisma } from '@prisma/client';
if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }

// ✅ 正しいパターン
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
if (error instanceof PrismaClientKnownRequestError) { ... }
```

---

## 4. AI 並列開発で得られた知見

### 成功要因: なぜ Angular + NestJS で並列開発が成功したか

#### Module 境界による物理的隔離

```
エージェント A → WorkflowsModule (自己完結)
エージェント B → ExpensesModule   (自己完結)
エージェント C → InvoicesModule   (自己完結)
                 ↓
           各 Module は互いを知らない
           → 並列で書いても衝突しない
```

NestJS の Module は物理的な防壁として機能し、各エージェントが他のモジュールに手を出す必要がなかった。

#### 参照実装によるパターン統一

Auth モジュールを「参照実装」として先に構築し、全エージェントに同じパターンを出力させた:

- PrismaService DI パターン
- エラーコード体系 (`ERR-{カテゴリ}-{番号}`)
- ページネーション形式 (`{ data, meta: { total, page, totalPages } }`)
- テストのモック構成

結果: **28 テストスイートで全くの同一パターン**。

#### opinionated フレームワークの優位性

```
Angular/NestJS (opinionated):      Next.js/React (unopinionated):
  ↓ 選択肢が1つ                      ↓ 選択肢が多い
  ↓ AI は迷わない                     ↓ AI がエージェントごとに違う判断
  ↓ 並列エージェントが同じ出力         ↓ 統合時にカオス
  → 成功                             → 失敗リスク高
```

### 唯一の問題: 通知サービスの重複

| 原因 | 詳細 |
|---|---|
| 何が起きたか | 2 つの通知サービスが並行生成された |
| なぜ起きたか | TI-4 (Workflows) と TI-5 (Notifications) を同時に投入 |
| 影響 | ワークフロー通知が DB に保存されずログのみ出力 |
| 修正 | スタブ版を削除し本実装に統合（30 分） |
| 教訓 | **依存関係のあるモジュールは順次投入すべき** |

### 推奨: AI 並列開発の投入順序設計

```
Wave 1: 依存されるモジュール（先に確定）
  → Auth, Notifications, 共有型

Wave 2: 独立したモジュール（並列 OK）
  → Timesheets, Expenses, Projects, Admin...

Wave 3: 集約モジュール（他の結果を参照）
  → Dashboard, Search
```

---

## 5. Angular 最新パターン (v17+)

### Single File Component (SFC)

Angular 17 以降、`standalone: true` がデフォルト化し NgModule が事実上不要に:

```typescript
// 旧 (v15以前): 5ファイルで1コンポーネント
// 新 (v17+): 1ファイルで完結
@Component({
  standalone: true,
  template: `<div>...</div>`,
  styles: `...`,
  imports: [MatButtonModule],
})
export class InvoiceDetailComponent { }
```

### Routes ファイル (NgModule の軽量後継)

```typescript
// invoices.routes.ts — NgModule に代わるルート定義
export const INVOICE_ROUTES: Routes = [
  { path: '', component: InvoiceListComponent },
  { path: 'new', component: InvoiceFormComponent },
  { path: ':id', component: InvoiceDetailComponent },
];
```

### インターフェースの Co-location

```
DTO を分離する基準:
  HTTP 境界を越える (Controller) → dto/ フォルダに class で定義
  内部呼び出しのみ (Service間)  → Service ファイル内に interface で定義
```

---

## 6. Next.js + Supabase との比較

同じ OpsHub アプリケーションを Next.js + Supabase と Angular + NestJS の両方で実装した結果の比較:

| 指標 | Next.js + Supabase | Angular + NestJS |
|---|---|---|
| 総コード行数 | 15,497 行 | 13,128 行 (spec 除く) |
| テスト数 | E2E 6 件のみ | **368 テスト (単体)** |
| AI 並列開発 | 未検証 (リスク高) | **11 モジュール成功** |
| テナント分離 | Supabase RLS (DB 層) | Prisma Middleware (App 層) |
| 型共有 | フロント/サーバー境界が曖昧 | `libs/shared/types` で完全共有 |
| テスタビリティ | Server Actions のモック困難 | DI で容易にモック |
| マイクロサービス化 | 非対応 | `@nestjs/microservices` 標準 |

### ワークフロー承認機能の構造比較

```
Next.js 版 (_actions.ts):
  全関数の冒頭に同じ3行（テナント取得 + チェック）
  → 横断的関心事が毎回手動

NestJS 版 (workflows.service.ts):
  テナント分離 → Middleware (自動)
  認証 → Guard (自動)
  監査ログ → Interceptor (自動)
  → ビジネスロジックのみに集中
```

---

## 7. 結論

### AI 大規模開発を成功させる方程式

```
AI の能力 × フレームワークの規約 × 人間の設計判断 = スケーラブルな開発
```

- **AI の能力**: コード生成、パターン認識、並列実行
- **フレームワークの規約**: Module 境界、DI、型安全（Angular + NestJS）
- **人間の設計判断**: 投入順序、参照実装の構築、品質ゲートの設計

> [!IMPORTANT]
> AI 単体では大規模開発はまだ難しい。
> 「AI を活かすアーキテクチャと運用を人間が設計できるか」が成否を分ける。

### 今後の展望

- **マイクロサービス化**: NestJS の `ClientProxy` パターンで段階的に分離可能
- **E2E テスト**: Playwright 導入による UI 自動テスト
- **CI/CD**: `pnpm typecheck + test + lint` を GitHub Actions に統合
- **さらなる並列化**: Module 依存グラフに基づく Wave 設計の体系化
