---
title: "TI-10: 運用基盤 (Health) ウォークスルー"
description: ヘルスチェック API モジュールの実装結果
---

## Summary

`GET /health` エンドポイントを `@nestjs/terminus` + カスタム `PrismaHealthIndicator` で実装。認証不要（`@Public()`）で DB 死活確認を行う。

## Changes

| ファイル | 内容 |
|---|---|
| `modules/health/indicators/prisma-health.indicator.ts` | `HealthIndicator` 拡張、`$queryRaw\`SELECT 1\`` で DB チェック |
| `modules/health/health.controller.ts` | `GET /health`、`@Public()` + `@HealthCheck()` |
| `modules/health/health.module.ts` | `TerminusModule` 登録、Controller + Indicator 提供 |
| `modules/health/tests/health.controller.spec.ts` | Controller ユニットテスト (モック) |
| `app/app.module.ts` | `HealthModule` を imports に追加 |

## Verification

| 項目 | 結果 |
|---|---|
| `npx nx test api --testPathPattern="modules/health"` | ✅ 21 suites / 175 tests passed |
| health.controller.spec.ts | ✅ 2 tests passed |
