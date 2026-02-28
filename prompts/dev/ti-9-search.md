# TI-9: 検索モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
ワークフロー/プロジェクト/タスク/経費を横断検索する API + UI を実装する。

> ⚠️ 他モジュールの Prisma Model を横断読取するため、TI-1, TI-2, TI-4 と同時 or 後に開始推奨

## 実装対象

### NestJS (`apps/api/src/modules/search/`)
| ファイル | 内容 |
|---|---|
| `search.module.ts` | SearchModule |
| `search.controller.ts` | GET /search?q=keyword |
| `search.service.ts` | 4テーブル並行検索 + 結果マージ |
| `dto/` | SearchQueryDto, SearchResultDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/search/`)
| ファイル | 内容 |
|---|---|
| `search.routes.ts` | SEARCH_ROUTES |
| `search-results.component.ts` | 検索結果一覧 (タブ: 全体/申請/プロジェクト/タスク/経費) |
| `header-search.component.ts` | ヘッダー内検索バー (AppShell に配置) |
| `search.service.ts` | HttpClient + debounce |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **並行検索**: `Promise.all([searchWorkflows, searchProjects, searchTasks, searchExpenses])`
2. **ILIKE + エスケープ**: `escapeLikePattern()` (`@shared/util`) で SQL injection 防止
3. **Highlight**: `HighlightPipe` (`shared/pipes/`) でキーワードをハイライト
4. **debounce**: ヘッダー検索は `debounceTime(300)` で API 呼び出しを制御
5. **テナント分離**: TenantMiddleware が自動適用（追加コード不要）

## 参照ドキュメント
- `detail/modules/search.md` — 全体
- `spec/apis.md` §API-G01
- `spec/screens.md` §SCR-G02
- `detail/db.md` — Workflow, Project, Task, Expense 検索カラム
