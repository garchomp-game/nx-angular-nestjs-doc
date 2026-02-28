---
title: 運用基盤モジュール設計 (HealthModule + LoggerModule)
description: ヘルスチェック・構造化ロギングの NestJS Module 設計（API のみ）
---

## 概要

- **責務**: ヘルスチェックエンドポイント、構造化ロギング基盤
- **Epic**: NFR-04a（構造化ログ）、NFR-04b（ヘルスチェック）
- **Prisma Models**: なし（横断的基盤モジュール）
- **Angular Feature**: なし（API のみ）

> [!NOTE]
> 運用基盤は 2 つの NestJS Module に分離する:
> - `HealthModule`: `@nestjs/terminus` によるヘルスチェック
> - `LoggerModule`: NestJS 組込み Logger + Winston による構造化ロギング

---

## HealthModule

### ファイル構成

```
apps/api/src/modules/health/
├── health.module.ts
├── health.controller.ts
├── indicators/
│   └── prisma-health.indicator.ts
└── tests/
    └── health.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/health` | ヘルスチェック（DB 死活確認） | なし（認証不要） |

### ヘルスチェック実装

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
    ]);
  }
}

// indicators/prisma-health.indicator.ts
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false),
      );
    }
  }
}
```

### レスポンス形式

**正常時 (200)**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "details": {
    "database": { "status": "up" }
  }
}
```

**異常時 (503)**:
```json
{
  "status": "error",
  "error": {
    "database": { "status": "down" }
  },
  "details": {
    "database": { "status": "down" }
  }
}
```

---

## LoggerModule

### ファイル構成

```
apps/api/src/modules/logger/
├── logger.module.ts
├── logger.service.ts
├── logger.middleware.ts
└── tests/
    └── logger.service.spec.ts
```

### LoggerService

NestJS 組込みの `LoggerService` を拡張し、Winston で JSON 形式の構造化ログを出力する。

| メソッド | 引数 | 説明 |
|---|---|---|
| `error` | `message, context?, error?` | エラーログ出力 |
| `warn` | `message, context?` | 警告ログ出力 |
| `info` | `message, context?` | 情報ログ出力 |
| `debug` | `message, context?` | デバッグログ出力 |

### 構造化ログ形式

```json
{
  "timestamp": "2026-02-25T14:00:00.000Z",
  "level": "info",
  "message": "Request processed",
  "context": {
    "method": "POST",
    "url": "/api/invoices",
    "statusCode": 201,
    "duration": 45
  }
}
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `LOG_LEVEL` | ログフィルタレベル（`error`, `warn`, `info`, `debug`） | `info` |
| `LOG_FORMAT` | ログ出力形式（`json`, `pretty`） | `json`（本番）/ `pretty`（開発） |

### リクエストロギング Middleware

```typescript
// logger.middleware.ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      this.logger.info('Request processed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: Date.now() - start,
      });
    });
    next();
  }
}
```

### Winston 設定

```typescript
// logger.service.ts
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? format.combine(format.colorize(), format.simple())
        : format.json(),
    }),
  ],
});
```

---

## 依存関係

- **HealthModule**: `@nestjs/terminus`（ヘルスチェックフレームワーク）、`PrismaModule`（DB 死活確認）
- **LoggerModule**: `winston`（構造化ログ出力）、NestJS 組込み `Logger`
- **特記**: 両モジュールとも Angular Feature は不要（API のみ）
