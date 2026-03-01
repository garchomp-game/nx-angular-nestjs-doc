---
title: NestJS 共通基盤 (common/)
description: Guards, Interceptors, Decorators, Pipes, Filters の共通実装仕様
---

本ドキュメントは `apps/api/src/common/` 配下の横断的関心事を定義する。
各モジュール開発時に `@UseGuards()`, `@UseInterceptors()` で参照される。

---

## ディレクトリ構成

```
apps/api/src/common/
├── decorators/
│   ├── roles.decorator.ts           # @Roles()
│   ├── current-user.decorator.ts    # @CurrentUser()
│   ├── skip-tenant-check.decorator.ts  # @SkipTenantCheck()
│   └── public.decorator.ts          # @Public()
├── guards/
│   ├── jwt-auth.guard.ts            # JWT 認証ガード
│   └── roles.guard.ts               # ロールベースアクセス制御
├── interceptors/
│   ├── tenant.interceptor.ts        # テナントコンテキスト設定
│   ├── audit.interceptor.ts         # 自動監査ログ
│   ├── response.interceptor.ts      # ApiResponse<T> ラップ
│   └── logging.interceptor.ts       # リクエストログ
├── filters/
│   └── http-exception.filter.ts     # 例外 → ApiResponse 変換
├── pipes/
│   └── validation.pipe.ts           # Global ValidationPipe
└── middleware/
    └── tenant.middleware.ts          # X-Tenant-Id ヘッダー検証 (NestJS Middleware)
```

---

## Decorators

### @Roles()

コントローラーまたはハンドラーに必要ロールを定義。

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**使用例**:
```typescript
@Post()
@Roles('pm', 'tenant_admin')
create(@Body() dto: CreateProjectDto) { ... }
```

### @CurrentUser()

`req.user` から `CurrentUser` オブジェクトを抽出。

```typescript
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser as ICurrentUser } from '@shared/types';

export const CurrentUser = createParamDecorator(
  (data: keyof ICurrentUser | undefined, ctx: ExecutionContext): ICurrentUser | any => {
    const user = ctx.switchToHttp().getRequest().user as ICurrentUser;
    return data ? user[data] : user;
  },
);
```

**使用例**:
```typescript
@Get()
findAll(@CurrentUser() user: CurrentUser) { ... }

@Get()
findAll(@CurrentUser('tenantId') tenantId: string) { ... }
```

### @SkipTenantCheck()

テナント横断アクセスが必要な API に使用。IT Admin 用 API やバッチ処理向け。

```typescript
// common/decorators/skip-tenant-check.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenantCheck';
export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_KEY, true);
```

### @Public()

JWT 認証を不要にするエンドポイント用（ログイン、ヘルスチェック等）。

```typescript
// common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## Guards

### JwtAuthGuard

Global Guard として `APP_GUARD` に登録。`@Public()` が付いたハンドラーはスキップ。

```typescript
// common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException('認証が必要です');
    }
    return user;
  }
}
```

### RolesGuard

`@Roles()` で指定されたロールと `CurrentUser.roles` を比較。

```typescript
// common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CurrentUser } from '@shared/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() が未指定 → 全ロール許可
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as CurrentUser;
    if (!user) throw new ForbiddenException('ユーザー情報が取得できません');

    // アクティブテナントでのロールをチェック
    const userRoles = user.roles
      .filter((r) => r.tenantId === user.tenantId)
      .map((r) => r.role);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role as any));
    if (!hasRole) {
      throw new ForbiddenException(
        `この操作には ${requiredRoles.join(' / ')} ロールが必要です`,
      );
    }
    return true;
  }
}
```

---

## Interceptors

### TenantInterceptor

リクエストごとに `AsyncLocalStorage` にテナントコンテキストを設定。
Prisma の TenantMiddleware と連携。

```typescript
// common/interceptors/tenant.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tenantStore } from '@prisma-db';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant-check.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.headers['x-tenant-id'] ?? user?.tenantId;

    return new Observable((subscriber) => {
      tenantStore.run(
        { tenantId, skipTenantCheck: skipTenant ?? false },
        () => next.handle().subscribe(subscriber),
      );
    });
  }
}
```

### AuditInterceptor

CUD (POST/PUT/PATCH/DELETE) 操作の監査ログを自動記録。

```typescript
// common/interceptors/audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '@prisma-db';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    // GET は記録しない
    if (method === 'GET') return next.handle();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          try {
            await this.prisma.auditLog.create({
              data: {
                tenantId:     user.tenantId,
                userId:       user.id,
                action:       this.resolveAction(method, url),
                resourceType: this.extractResourceType(url),
                resourceId:   responseData?.id ?? responseData?.data?.id ?? null,
                afterData:    body,
                metadata: {
                  url,
                  method,
                  duration: Date.now() - startTime,
                  userAgent: request.headers['user-agent'],
                  ip: request.ip,
                },
              },
            });
          } catch (error) {
            this.logger.error('Failed to create audit log', error);
          }
        },
        error: async (error) => {
          try {
            await this.prisma.auditLog.create({
              data: {
                tenantId: user?.tenantId,
                userId:   user?.id,
                action:   `${this.resolveAction(method, url)}.failed`,
                resourceType: this.extractResourceType(url),
                metadata: { url, method, error: error.message },
              },
            });
          } catch {
            // 監査ログ自体の失敗はサイレントに
          }
        },
      }),
    );
  }

  private resolveAction(method: string, url: string): string {
    const resource = this.extractResourceType(url);
    const methodMap: Record<string, string> = {
      POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete',
    };
    const suffix = url.includes('/approve') ? 'approve'
      : url.includes('/reject') ? 'reject'
      : url.includes('/withdraw') ? 'withdraw'
      : url.includes('/submit') ? 'submit'
      : url.includes('/status') ? 'status_change'
      : url.includes('/invite') ? 'invite'
      : url.includes('/role') ? 'role_change'
      : methodMap[method] ?? method.toLowerCase();
    return `${resource}.${suffix}`;
  }

  private extractResourceType(url: string): string {
    const segments = url.replace(/^\/api\//, '').split('/');
    return segments[0] ?? 'unknown';
  }
}
```

### ResponseInterceptor

全レスポンスを `ApiResponse<T>` 形式にラップ。

```typescript
// common/interceptors/response.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
```

### LoggingInterceptor（nestjs-pino で代替済み）

> [!NOTE]
> 現在は `nestjs-pino` (`LoggerModule`) が HTTP リクエストログを自動記録するため、
> 手動の `LoggingInterceptor` は不要です。`main.ts` の Global Interceptors からも削除済み。
>
> ```typescript
> // app.module.ts での設定
> LoggerModule.forRoot({
>   pinoHttp: {
>     autoLogging: true,
>     transport: process.env['NODE_ENV'] !== 'production'
>       ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
>       : undefined,
>     level: process.env['LOG_LEVEL'] ?? 'info',
>   },
> }),
> ```

---

## Filters

### HttpExceptionFilter

例外を統一エラーレスポンスに変換。

```typescript
// common/filters/http-exception.filter.ts
import {
  ArgumentsHost, Catch, ExceptionFilter,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'ERR-SYS-001';
    let fields: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const r = exResponse as any;
        message = r.message ?? exception.message;
        code = r.code ?? this.statusToCode(status);

        // ValidationPipe のエラー配列をフィールドマップに変換
        if (Array.isArray(r.message)) {
          fields = {};
          r.message.forEach((msg: string) => {
            const [field, ...rest] = msg.split(' ');
            fields![field] = rest.join(' ');
          });
          message = 'バリデーションエラー';
        }
      } else {
        message = String(exResponse);
      }
    }

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      error: { code, message, fields },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'ERR-VAL-000',
      401: 'ERR-AUTH-001',
      403: 'ERR-AUTH-002',
      404: 'ERR-SYS-002',
      409: 'ERR-SYS-003',
    };
    return map[status] ?? 'ERR-SYS-001';
  }
}
```

---

## Pipes

### Global ValidationPipe

`main.ts` で登録。class-validator + class-transformer による自動バリデーション。

```typescript
// main.ts での登録
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // DTO に未定義のプロパティを除去
    forbidNonWhitelisted: true, // 未定義プロパティがあればエラー
    transform: true,            // リクエストを DTO クラスに変換
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

---

## main.ts 全体構成

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // nestjs-pino が NestJS 内部のロガーを置き換え
  app.useLogger(app.get(Logger));

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors (順序重要: 上から順に実行)
  // ※ nestjs-pino が HTTP リクエストログを自動記録するため LoggingInterceptor は不要
  app.useGlobalInterceptors(
    app.get(TenantInterceptor),
    app.get(AuditInterceptor),
    new ResponseInterceptor(),
  );

  // Swagger (開発モードのみ)
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OpsHub API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc);
  }

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();
```

---

## AppModule 構成

```typescript
// apps/api/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from '@prisma-db';

// Auth
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Admin
import { AdminModule } from '../modules/admin/admin.module';

// Feature Modules
import { TimesheetsModule } from '../modules/timesheets/timesheets.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { ExpensesModule } from '../modules/expenses/expenses.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { InvoicesModule } from '../modules/invoices/invoices.module';
import { SearchModule } from '../modules/search/search.module';
import { DocumentsModule } from '../modules/documents/documents.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';

// Operations
import { HealthModule } from '../modules/health/health.module';

// Mail
import { MailModule } from '../modules/mail/mail.module';

// Interceptors (for DI)
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1秒
        limit: 3,     // 1秒あたり3リクエスト
      },
      {
        name: 'medium',
        ttl: 10000,   // 10秒
        limit: 20,    // 10秒あたり20リクエスト
      },
      {
        name: 'long',
        ttl: 60000,   // 1分
        limit: 100,   // 1分あたり100リクエスト
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        transport: process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
        level: process.env['LOG_LEVEL'] ?? 'info',
      },
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    HealthModule,
    TimesheetsModule,
    WorkflowsModule,
    NotificationsModule,
    ExpensesModule,
    ProjectsModule,
    InvoicesModule,
    SearchModule,
    DocumentsModule,
    DashboardModule,
    MailModule,
  ],
  providers: [
    // Global Guards (全エンドポイントに適用)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Interceptors registered as providers for DI in main.ts
    TenantInterceptor,
    AuditInterceptor,
  ],
})
export class AppModule { }
```

> [!IMPORTANT] モジュール追加ルール
> 新規モジュールは必ず `AppModule.imports` に追加する。
> Guard / Interceptor は Global 登録済みなので、各モジュールで再登録しない。

---

## 環境変数一覧

| 変数名 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL 接続文字列 |
| `JWT_SECRET` | ✅ | — | JWT 署名シークレット |
| `JWT_EXPIRES_IN` | — | `15m` | アクセストークン有効期限 |
| `JWT_REFRESH_SECRET` | ✅ | — | リフレッシュトークンシークレット |
| `JWT_REFRESH_EXPIRES_IN` | — | `7d` | リフレッシュトークン有効期限 |
| `PORT` | — | `3000` | API ポート |
| `CORS_ORIGIN` | — | `http://localhost:4200` | CORS 許可オリジン |
| `NODE_ENV` | — | `development` | 環境識別 |
| `LOG_LEVEL` | — | `info` | ログレベル (fatal/error/warn/info/debug/trace) |
| `UPLOAD_DIR` | — | `./uploads` | ファイルアップロード先 |
| `MAX_FILE_SIZE` | — | `10485760` | 最大ファイルサイズ (bytes) |
| `MAIL_HOST` | — | `localhost` | SMTP ホスト |
| `MAIL_PORT` | — | `1025` | SMTP ポート |
| `MAIL_FROM` | — | `noreply@opshub.local` | 送信元メールアドレス |
| `FRONTEND_URL` | — | `http://localhost:4200` | パスワードリセットリンク用 |
