---
title: "NA-01: 認証エンドポイントのレート制限見直し"
description: "変更内容と検証結果"
---

## 変更サマリー

グローバルスロットル (`short: 1s/3req`) が認証エンドポイントにも適用されており E2E テストで 429 エラーが発生していた問題を修正。`AuthController` にクラスレベル `@SkipThrottle()` を追加し、`login` / `forgot-password` に名前付き個別スロットルを設定した。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/modules/auth/auth.controller.ts` | MODIFY: `@SkipThrottle()` クラスレベル追加 + 個別 `@Throttle()` 更新 |
| `apps/api/src/modules/auth/auth.controller.spec.ts` | MODIFY: `ThrottlerGuard` モック追加 + デコレータ検証テスト追加 |

## 主な変更の詳細

### auth.controller.ts

```diff
-import { Throttle } from '@nestjs/throttler';
+import { SkipThrottle, Throttle } from '@nestjs/throttler';

 @ApiTags('auth')
 @Controller('auth')
+@SkipThrottle()
 export class AuthController {

     @Public()
-    @Throttle({ short: { limit: 5, ttl: 60000 } })  // 1分に5回まで
+    @Throttle({ login: { ttl: 60_000, limit: 10 } })  // 1分あたり10回
     @Post('login')
     async login(...) { ... }

     @Public()
-    @Throttle({ short: { limit: 3, ttl: 60000 } })  // 1分に3回まで
+    @Throttle({ forgot: { ttl: 60_000, limit: 3 } })  // 1分あたり3回
     @Post('forgot-password')
     async forgotPassword(...) { ... }
```

- **`@SkipThrottle()`**: グローバル `short/medium/long` から全ルートを除外
- **名前付きスロットル**: `login` (10回/分)、`forgot` (3回/分) はグローバル定義と独立
- **`/me`, `/refresh`, `/logout`, `/register`, `/reset-password`**: レート制限なし（内部トークン更新・公開エンドポイント）

### auth.controller.spec.ts

```typescript
// ThrottlerGuard モック追加
{
    provide: ThrottlerGuard,
    useValue: { canActivate: jest.fn().mockReturnValue(true) },
}

// デコレータ検証テスト
describe('throttle decorators', () => {
    it('should have @SkipThrottle() at class level', () => {
        const metadata = Reflect.getMetadata('THROTTLER:SKIPdefault', AuthController);
        expect(metadata).toBe(true);
    });
});
```

## テスト結果

### ユニットテスト

```
pnpm nx test api

Test Suites: 32 passed, 32 total
Tests:       270 passed, 270 total
Time:        3.781 s
```

### E2E テスト（THROTTLE_SKIP なし）

```
pnpm playwright test --project=ui-smoke

  ✓  1 [setup] › e2e/auth.setup.ts:7:6 › authenticate (1.3s)
  ✓  2 [ui-smoke] › メールとパスワードでログインできること (1.9s)
  ✓  3 [ui-smoke] › 不正な資格情報ではログインできないこと (1.1s)
  ...
  ✓ 28 [ui-smoke] › 新規申請フォームが表示されること (1.0s)

  28 passed (20.2s)
```
