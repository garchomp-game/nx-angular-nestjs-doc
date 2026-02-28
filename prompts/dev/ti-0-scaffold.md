# TI-0: Nx ワークスペース + 共有基盤 + Auth + AppShell

## 目的

OpsHub の Nx monorepo を新規作成し、全モジュール開発の前提となる共有基盤を構築する。

## 前提

- Node.js 20+
- npm (パッケージマネージャー)
- PostgreSQL 15+ (Docker or ローカル)

---

## ステップ 1: Nx ワークスペース初期化

```bash
npx -y create-nx-workspace@latest opshub --preset=apps --nxCloud=skip --pm=npm
cd opshub
```

## ステップ 2: Angular アプリ生成

```bash
npx nx g @nx/angular:app web --directory=apps/web --style=scss --routing=true --standalone=true --ssr=false
npm install @angular/material @angular/cdk
```

## ステップ 3: NestJS アプリ生成

```bash
npx nx g @nx/nest:app api --directory=apps/api
npm install @nestjs/passport passport passport-jwt @nestjs/jwt class-validator class-transformer bcrypt @nestjs/terminus
npm install -D @types/passport-jwt @types/bcrypt
```

## ステップ 4: 共有ライブラリ生成

```bash
npx nx g @nx/js:lib shared/types --directory=libs/shared/types --unitTestRunner=vitest --bundler=tsc
npx nx g @nx/js:lib shared/util  --directory=libs/shared/util  --unitTestRunner=vitest --bundler=tsc
npx nx g @nx/js:lib prisma-db    --directory=libs/prisma-db     --unitTestRunner=vitest --bundler=tsc
```

tsconfig.base.json の paths を設定:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/types": ["libs/shared/types/src/index.ts"],
      "@shared/util":  ["libs/shared/util/src/index.ts"],
      "@prisma-db":    ["libs/prisma-db/src/index.ts"]
    }
  }
}
```

## ステップ 5: Prisma セットアップ

```bash
npm install prisma @prisma/client
npx prisma init --schema=libs/prisma-db/prisma/schema.prisma
```

**参照**: `detail/prisma-setup.md` と `detail/db.md` に従い以下を実装:

1. `libs/prisma-db/prisma/schema.prisma` — 全 15 モデルを定義
2. `libs/prisma-db/src/lib/prisma.service.ts` — PrismaService
3. `libs/prisma-db/src/lib/prisma.module.ts` — @Global PrismaModule
4. `libs/prisma-db/src/lib/middleware/tenant.middleware.ts` — AsyncLocalStorage テナント分離
5. `libs/prisma-db/src/lib/middleware/audit-log.middleware.ts` — append-only 保護
6. `libs/prisma-db/prisma/seed.ts` — 6ロール分のシードデータ
7. `libs/prisma-db/src/index.ts` — barrel export

## ステップ 6: 共有型・定数・ユーティリティ

**参照**: `detail/shared-types.md` の全内容をそのまま実装:

**libs/shared/types/src/lib/**
- `enums/` — Role, UserStatus, WorkflowStatus, WorkflowType, ProjectStatus, TaskStatus, InvoiceStatus
- `interfaces/` — CurrentUser, ApiResponse, PaginatedResult
- `constants/` — role-labels, status-labels, transitions, invoice-constants, allowed-mime-types

**libs/shared/util/src/lib/**
- csv.util.ts, string.util.ts, file.util.ts, notification-link.util.ts

## ステップ 7: NestJS 共通基盤 (common/)

**参照**: `detail/common-infrastructure.md` の全内容を実装:

**apps/api/src/common/**
- `decorators/` — @Roles, @CurrentUser, @SkipTenantCheck, @Public
- `guards/` — JwtAuthGuard, RolesGuard
- `interceptors/` — TenantInterceptor, AuditInterceptor, ResponseInterceptor, LoggingInterceptor
- `filters/` — HttpExceptionFilter
- `main.ts` — GlobalPrefix, CORS, ValidationPipe, Global filters/interceptors

## ステップ 8: Auth Module

**参照**: `detail/modules/auth.md`

**NestJS (apps/api/src/modules/auth/)**
- `auth.module.ts` — JwtModule, PassportModule 登録
- `auth.controller.ts` — POST /login, /register, /refresh, /logout, GET /me
- `auth.service.ts` — login, register, validateUser, refreshToken
- `strategies/jwt.strategy.ts` — JwtStrategy (Passport)
- `dto/` — LoginDto, RegisterDto, RefreshTokenDto

**Angular (apps/web/src/app/core/auth/)**
- `auth.service.ts` — Signal ベース (detail/angular-core.md 参照)
- `auth.guard.ts` — CanActivateFn
- `role.guard.ts` — CanActivateFn with data.roles
- `login/login.component.ts` — Angular Material ログインフォーム

**テスト**
- `auth.service.spec.ts` (NestJS) — login 成功/失敗, register, token refresh
- `auth.controller.spec.ts` — 全エンドポイント
- `auth.service.spec.ts` (Angular) — login, logout, token management
- `login.component.spec.ts` — フォーム表示, バリデーション

## ステップ 9: Angular AppShell + ルーティング

**参照**: `detail/angular-core.md`

- `app.config.ts` — provideRouter, provideHttpClient, withInterceptors
- `app.routes.ts` — lazy loaded routes (全 Feature module 用)
- `core/interceptors/auth.interceptor.ts` — JWT 自動付与 + リフレッシュ
- `core/interceptors/error.interceptor.ts` — MatSnackBar エラー表示
- `core/services/tenant.service.ts` — X-Tenant-Id 管理
- `shared/components/app-shell.component.ts` — サイドバー + ヘッダー + router-outlet
- `shared/components/confirm-dialog.component.ts` — 汎用確認ダイアログ
- `shared/pipes/relative-time.pipe.ts`, `highlight.pipe.ts`

## ステップ 10: AppModule + 動作確認

**NestJS AppModule** (`detail/common-infrastructure.md` §AppModule 参照):
- imports: ConfigModule, PrismaModule, AuthModule
- providers: APP_GUARD (JwtAuthGuard, RolesGuard)

```bash
# DB マイグレーション + シード
npx prisma migrate dev --schema=libs/prisma-db/prisma/schema.prisma
npx ts-node libs/prisma-db/prisma/seed.ts

# 起動確認
npx nx serve api   # → http://localhost:3000/api
npx nx serve web   # → http://localhost:4200

# テスト
npx nx test api
npx nx test web
```

---

## 完了条件

- [ ] `nx serve api` でNestJS起動、`POST /api/auth/login` でJWT返却
- [ ] `nx serve web` でAngular起動、ログイン画面→Dashboard遷移
- [ ] `nx test api` pass（Auth Service/Controller テスト）
- [ ] `nx test web` pass（AuthService/LoginComponent テスト）
- [ ] Prisma migrate + seed が成功し6ユーザー作成
- [ ] `@shared/types`, `@shared/util`, `@prisma-db` が apps から import 可能
- [ ] JwtAuthGuard が全 API に適用 (@Public 以外)
- [ ] RolesGuard が @Roles() 指定時に動作
- [ ] TenantInterceptor が AsyncLocalStorage にコンテキスト設定
- [ ] AuditInterceptor が CUD 操作を audit_logs に記録

---

## 参照ドキュメント

| # | ファイル | 参照箇所 |
|---|---|---|
| 1 | `detail/shared-types.md` | 全体 |
| 2 | `detail/prisma-setup.md` | 全体 |
| 3 | `detail/common-infrastructure.md` | 全体 |
| 4 | `detail/angular-core.md` | 全体 |
| 5 | `detail/modules/auth.md` | 全体 |
| 6 | `detail/db.md` | 全 Prisma モデル |
| 7 | `detail/guard-design.md` | 権限マトリクス |
| 8 | `spec/error-handling.md` | HttpExceptionFilter, エラーコード |
| 9 | `spec/audit-logging.md` | AuditInterceptor 仕様 |
| 10 | `testing/module-test-patterns.md` | テストテンプレート |
