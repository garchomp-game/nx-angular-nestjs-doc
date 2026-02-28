# TI-10: 運用基盤モジュール (Health)

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
ヘルスチェック API を実装する。最小チケット。

## 実装対象

### NestJS (`apps/api/src/modules/health/`)
| ファイル | 内容 |
|---|---|
| `health.module.ts` | HealthModule (TerminusModule 登録) |
| `health.controller.ts` | GET /health (@Public) |
| `health.service.ts` | DB 接続確認 + メモリ使用量 |
| `health.controller.spec.ts` | Controller テスト |

### 重要な実装ポイント
1. **@Public()**: 認証不要 (ロードバランサーからのヘルスチェック用)
2. **@nestjs/terminus**: `HealthCheckService` + カスタム DB チェック
3. **PrismaService.healthCheck()**: `SELECT 1` で DB 接続確認
4. **レスポンス**: `{ status: 'ok', info: { db: { status: 'up' }, memory: { ... } } }`

## 参照ドキュメント
- `detail/modules/operations.md` — 全体
