---
title: 非機能要件（NFR）
description: セキュリティ・性能・可用性・運用・監査の要件（Nx + Angular + NestJS 版）
---

## 目的 / In-Out / Related
- **目的**: 機能以外の品質要件を明記し、設計・テストの基準とする
- **対象範囲（In）**: セキュリティ、性能、可用性、運用、監査
- **対象範囲（Out）**: SLA保証値の合意（運用フェーズ）
- **Related**: [REQカタログ](../req-catalog/) / [テスト戦略](../../testing/strategy/)

---

## NFR-01 セキュリティ

| # | 要件 | 基準 |
|---|---|---|
| NFR-01a | 認証 | JWT (Passport.js)。アクセストークン有効期限 15分、リフレッシュトークン 7日 |
| NFR-01b | 認可 | RBAC (NestJS Guards + `@Roles()` decorator)。全エンドポイントに認可チェック |
| NFR-01c | テナント分離 | Prisma Middleware による `tenant_id` 自動フィルタ。テナント間データアクセスは不可能 |
| NFR-01d | パスワード | 8文字以上、英数字混在。bcrypt ハッシュ化 |
| NFR-01e | 通信 | HTTPS必須。開発環境含めTLS |
| NFR-01f | CSRF/XSS | Angular 組み込み XSS 対策 + CSP ヘッダー。NestJS `helmet` middleware |
| NFR-01g | SQLインジェクション | Prisma のパラメータ化クエリで防止 |

## NFR-02 性能

| # | 要件 | 基準 |
|---|---|---|
| NFR-02a | API応答時間 | 95パーセンタイルで 200ms以下（主要 CRUD エンドポイント） |
| NFR-02b | ページ描画 | FCP 1.5秒以下（Angular SSR or CSR） |
| NFR-02c | 同時接続 | テナントあたり 100ユーザー同時アクセスに耐える |
| NFR-02d | データ量 | テナントあたり 10万レコード/テーブルまでの性能を保証 |
| NFR-02e | 検索 | 全文検索は 1秒以内（Prisma Full-Text Search or pg_trgm） |

## NFR-03 可用性

| # | 要件 | 基準 |
|---|---|---|
| NFR-03a | 稼働率 | 99.5%以上（月間ダウンタイム 3.6時間以内） |
| NFR-03b | バックアップ | PostgreSQL日次バックアップ。7日分保持 |
| NFR-03c | リカバリ | RPO: 24時間、RTO: 4時間 |

## NFR-04 運用・保守

| # | 要件 | 基準 |
|---|---|---|
| NFR-04a | ログ | NestJS Logger + Winston。JSON構造化。error/warn/info レベル |
| NFR-04b | 監視 | ヘルスチェックエンドポイント `GET /api/health` (NestJS `@nestjs/terminus`) |
| NFR-04c | マイグレーション | Prisma Migrate。ロールバック可能な設計 |
| NFR-04d | デプロイ | Docker + Nx build targets。ゼロダウンタイムデプロイ |

## NFR-05 監査

| # | 要件 | 基準 |
|---|---|---|
| NFR-05a | 監査ログ | 主要操作（CRUD + 承認/差戻し）を記録（NestJS Interceptor） |
| NFR-05b | 監査ログ内容 | who（user_id）/ when（timestamp）/ what（action + resource）/ before / after |
| NFR-05c | 保持期間 | 最低1年。法的要件に応じて延長 |
| NFR-05d | 改ざん防止 | 監査ログテーブルは INSERT ONLY（Prisma Middleware で UPDATE/DELETE 禁止） |

## NFR-06 ユーザビリティ

| # | 要件 | 基準 |
|---|---|---|
| NFR-06a | レスポンシブ | PC（1280px以上）を主軸。タブレット対応。スマホは閲覧のみ |
| NFR-06b | ブラウザ | Chrome/Edge/Safari 最新2バージョン |
| NFR-06c | アクセシビリティ | WCAG 2.1 AA 準拠を目標（Angular Material は AA 準拠） |
| NFR-06d | 言語 | 日本語のみ（Angular i18n は将来対応） |

---

## 前バージョンとの差分

| NFR | 旧 (Next.js + Supabase) | 新 (Nx + Angular + NestJS) |
|---|---|---|
| NFR-01a | Supabase Auth (GoTrue) | JWT + Passport.js |
| NFR-01b | RLS + アプリ層チェック | NestJS Guards + Prisma Middleware |
| NFR-01c | tenant_id + RLS | tenant_id + Prisma Middleware |
| NFR-04a | console.log → logger.ts | NestJS Logger + Winston |
| NFR-04b | Next.js Route Handler | @nestjs/terminus |
| NFR-04c | Supabase Migrations | Prisma Migrate |
