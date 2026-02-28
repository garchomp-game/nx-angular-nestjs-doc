---
title: "TI-9: 検索モジュール ウォークスルー"
description: ワークフロー/プロジェクト/タスク/経費の横断検索 API + UI 実装
---

## Summary

4テーブル（Workflow, Project, Task, Expense）横断検索の NestJS API + Angular UI を実装した。
`Promise.all` による並列検索、ILIKE エスケープ、ロール別経費フィルタ、Signal ベースの Angular UI を含む。

## Changes

### NestJS Backend (`apps/api/src/modules/search/`)

| ファイル | 内容 |
|---|---|
| `dto/search-query.dto.ts` | クエリ DTO（q, category, page, limit + バリデーション） |
| `types/search-result.ts` | `SearchResult` / `SearchResponse` 統一型 |
| `search.service.ts` | 4テーブル並列検索 (`Promise.all`)、`escapeLikePattern()`、ロール別経費フィルタ |
| `search.controller.ts` | `GET /search` エンドポイント |
| `search.module.ts` | SearchModule 定義 |
| `tests/search.controller.spec.ts` | Controller テスト（4テスト） |

### Angular Frontend

| ファイル | 内容 |
|---|---|
| `features/search/services/search.service.ts` | HttpClient + Signal 状態管理 |
| `features/search/search-results/search-results.component.ts` | カテゴリタブ + キーワードハイライト + 結果カード |
| `features/search/search.routes.ts` | `SEARCH_ROUTES` 定義 |
| `shared/components/header-search-bar/header-search-bar.component.ts` | ツールバー内検索バー |
| `features/search/services/search.service.spec.ts` | Service テスト |
| `features/search/search-results/search-results.component.spec.ts` | Component テスト |

### 既存ファイル変更

| ファイル | 変更内容 |
|---|---|
| `app/app.module.ts` | `SearchModule` を imports に追加 |
| `app.routes.ts` | search ルートを placeholder → `SEARCH_ROUTES` に変更 |
| `app-shell.component.ts` | `HeaderSearchBarComponent` をツールバーに追加 |

## Verification

| テスト | 結果 |
|---|---|
| NestJS `search.controller.spec.ts` | ✅ PASS (4 tests) |
| Angular TypeScript compilation | ✅ Clean (no search errors) |
| 既存テスト影響 | なし（pre-existing failures は invoices/timesheets/workflows の別問題） |
