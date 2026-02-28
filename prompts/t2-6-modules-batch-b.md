# T2-6: Module 個別設計 Batch B (MOD-007~012)

## タスク概要
以下の6モジュール（うち1件は新規 AuthModule）について、NestJS Module + Angular Feature の個別設計ドキュメントを作成する。

## 対象モジュール

| # | モジュール | NestJS Module | Angular Feature |
|---|---|---|---|
| MOD-007 | 管理 | `AdminModule` | `features/admin/` |
| MOD-008 | 請求書 | `InvoiceModule` | `features/invoices/` |
| MOD-009 | ドキュメント | `DocumentModule` | `features/projects/documents/` |
| MOD-010 | 全文検索 | `SearchModule` | `features/search/` |
| MOD-011 | 運用基盤 | `HealthModule` + `LoggerModule` | — (API のみ) |
| MOD-012 | 認証 (新規) | `AuthModule` | `core/auth/` |

## 入力ファイル（参照元）
- **モジュール設計**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/modules/index.md`（DD-MOD-007 ~ DD-MOD-011 セクション）
- **DB設計**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/db/index.md`
- **補足（知識ベース）**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/logs/knowledge.md`

## 出力ファイル
各モジュールごとに **1ファイル** 作成:
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/admin.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/invoice.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/document.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/search.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/operations.md`
- `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules/auth.md`

## 各ファイルの構成
T2-5 と同じテンプレートに従う。

## モジュール固有の注意事項

### MOD-007 管理 (AdminModule)
- サブモジュール構成: `TenantsController`, `UsersController`, `AuditLogsController`
- ユーザー招待: メール送信 Service との連携
- 監査ログビューア: ページネーション + フィルタ API

### MOD-008 請求書 (InvoiceModule)
- ヘッダー/明細 2テーブル構成: `Invoice` + `InvoiceItem`
- 請求書採番: `InvoiceService.generateNumber()` (旧 `next_invoice_number()` RPC)
- ステータス遷移ルール: `INVOICE_STATUS_TRANSITIONS` 定数
- 明細更新: 全削除→再INSERT パターン (`Prisma $transaction`)

### MOD-009 ドキュメント (DocumentModule)
- ファイルアップロード: NestJS `@UseInterceptors(FileInterceptor)` + multer
- MIME タイプ制限: `ALLOWED_MIME_TYPES` で検証
- ストレージ: ローカルファイル (開発) / S3 互換 (本番) 切替
- テナント分離パス: `uploads/{tenantId}/{projectId}/{uuid}_{filename}`

### MOD-010 全文検索 (SearchModule)
- 4テーブル横断検索: `Promise.all` で並列
- Prisma 全文検索 or LIKE: DB プロバイダで分岐（SQLite は LIKE、PostgreSQL は Full-Text Search）
- 検索結果の統一型: `SearchResult`

### MOD-011 運用基盤 (HealthModule + LoggerModule)
- ヘルスチェック: `@nestjs/terminus` の `HealthCheckService`
- ロガー: NestJS 組込み Logger + Winston
- API のみ（Angular Feature 不要）

### MOD-012 認証 (AuthModule) — **新規作成**
- 旧 OpsHub: Supabase Auth (GoTrue) → 新: Passport.js (JWT Strategy)
- NestJS 構成:
  - `AuthController`: login, register, refresh, logout
  - `AuthService`: validateUser, generateTokens
  - `JwtStrategy`: JWT payload からユーザー情報を解決
  - `LocalStrategy`: email/password 認証
- Angular 構成:
  - `AuthService`: login, logout, refreshToken, isAuthenticated (Signal)
  - `AuthInterceptor`: 全リクエストに Bearer token 付与
  - `authGuard`: CanActivateFn
