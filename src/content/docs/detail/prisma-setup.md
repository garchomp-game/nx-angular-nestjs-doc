---
title: Prisma セットアップ (libs/prisma-db)
description: PrismaService、Middleware、マイグレーション、テスト設定の詳細仕様
---

## ディレクトリ構成

```
libs/prisma-db/
├── prisma/
│   ├── schema.prisma            # DB スキーマ定義（detail/db.md の内容）
│   ├── migrations/              # Prisma Migrate 出力
│   └── seed.ts                  # 開発用シードデータ
├── src/
│   ├── index.ts                 # barrel export
│   └── lib/
│       ├── prisma.service.ts    # NestJS 統合 PrismaClient
│       ├── prisma.module.ts     # Global Module
│       ├── middleware/
│       │   ├── tenant.middleware.ts     # テナント分離
│       │   └── audit-log.middleware.ts  # 監査ログ保護
│       └── prisma.service.spec.ts
└── project.json
```

---

## PrismaService

NestJS ライフサイクルと統合した PrismaClient ラッパー。

> [!IMPORTANT] Prisma v6 互換
> Prisma v5+ で `$use()` (Middleware API) は非推奨、v6.19 で削除済み。
> 代わりに `$extends()` を使用してテナント分離・監査ログ保護を実現。
> Service からは `this.prisma.user.findMany()` のように標準パターンで利用可能（Proxy パターン）。

```typescript
// libs/prisma-db/src/lib/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { applyTenantFilter } from './middleware/tenant.middleware';
import { enforceAuditLogAppendOnly } from './middleware/audit-log.middleware';

/** $extends で Middleware 相当のロジックを登録した拡張クライアントを作成 */
function createExtendedPrismaClient() {
  const base = new PrismaClient({ /* log config */ });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          enforceAuditLogAppendOnly(model, operation);
          const filteredArgs = applyTenantFilter(model, operation, args);
          return query(filteredArgs);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _client: ExtendedPrismaClient;

  constructor() {
    this._client = createExtendedPrismaClient();
    // Proxy で _client のプロパティを this に委譲
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target || typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }
        return (target._client as any)[prop];
      },
    });
  }

  async onModuleInit() { await this._client.$connect(); }
  async onModuleDestroy() { await this._client.$disconnect(); }
  async healthCheck(): Promise<boolean> {
    try { await this._client.$queryRaw`SELECT 1`; return true; }
    catch { return false; }
  }
}

// Declaration merging で型補完を有効化
export interface PrismaService extends ExtendedPrismaClient {}
```

## PrismaModule

```typescript
// libs/prisma-db/src/lib/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // 全モジュールで DI 不要
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

各モジュールでは `PrismaModule` を imports に追加せず、直接 `PrismaService` を inject 可能:

```typescript
// 任意のモジュール Service
@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ this.prisma.workflow.findMany() ← .db アクセサ不要
  findAll(tenantId: string) {
    return this.prisma.workflow.findMany({ where: { tenantId } });
  }
}
```

---

## TenantMiddleware

[Guard/Middleware設計](../guard-design/) で定義した仕様の実装。

> [!NOTE] Prisma v6 対応
> `Prisma.Middleware` / `$use()` は v6.19 で削除済み。
> 代わりに純粋関数 `applyTenantFilter()` を `$extends` 内で使用。

```typescript
// libs/prisma-db/src/lib/middleware/tenant.middleware.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  skipTenantCheck?: boolean;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

const TENANT_MODELS: string[] = [
  'Project', 'ProjectMember', 'Task', 'Workflow',
  'Timesheet', 'Expense', 'Notification', 'AuditLog',
  'Invoice', 'InvoiceItem', 'Document', 'WorkflowAttachment',
  'UserRole',
];

/**
 * $extends query 内で呼び出すテナント分離ロジック。
 * READ/UPDATE/DELETE → where に tenantId 追加
 * CREATE → data に tenantId 付与
 */
export function applyTenantFilter(
  model: string, operation: string, args: any,
): any {
  if (!TENANT_MODELS.includes(model)) return args;

  const ctx = tenantStore.getStore();
  if (ctx?.skipTenantCheck) return args;

  const tenantId = ctx?.tenantId;
  if (!tenantId) {
    throw new Error(
      `TenantMiddleware: tenantId is missing for model "${model}". ` +
      'Ensure TenantInterceptor or @SkipTenantCheck() is applied.',
    );
  }

  // READ / UPDATE / DELETE
  const readWriteOps = [
    'findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow',
    'count', 'aggregate', 'groupBy',
    'update', 'updateMany', 'delete', 'deleteMany',
  ];
  if (readWriteOps.includes(operation)) {
    args = args ?? {};
    args.where = { ...args.where, tenantId };
  }

  // CREATE
  if (operation === 'create') {
    args = args ?? {};
    args.data = { ...args.data, tenantId };
  }
  if (operation === 'createMany') {
    args = args ?? {};
    args.data = (args.data as any[]).map((item) => ({ ...item, tenantId }));
  }

  return args;
}
```

### NestJS Interceptor との連携

Controller 層で `AsyncLocalStorage` にコンテキストを設定:

```typescript
// apps/api/src/common/interceptors/tenant.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStore } from '@prisma-db';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;                    // JwtAuthGuard が設定
    const tenantId = request.headers['x-tenant-id'] ?? user?.tenantId;

    if (!tenantId) {
      throw new Error('X-Tenant-Id header or user.tenantId is required');
    }

    return new Observable((subscriber) => {
      tenantStore.run({ tenantId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
```

---

## AuditLogMiddleware

```typescript
// libs/prisma-db/src/lib/middleware/audit-log.middleware.ts

const FORBIDDEN_OPERATIONS = ['update', 'updateMany', 'delete', 'deleteMany'];

/**
 * $extends query 内で呼び出す AuditLog 保護ロジック。
 * AuditLog に対する UPDATE / DELETE を禁止する。
 */
export function enforceAuditLogAppendOnly(
  model: string, operation: string,
): void {
  if (model !== 'AuditLog') return;

  if (FORBIDDEN_OPERATIONS.includes(operation)) {
    throw new Error(
      'AuditLog is append-only. UPDATE and DELETE operations are forbidden.',
    );
  }
}
```

---

## schema.prisma 設定

```prisma
// libs/prisma-db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// モデル定義は detail/db.md を参照
```


## シードデータ

```typescript
// libs/prisma-db/prisma/seed.ts
import { PrismaClient, Role, ProjectStatus, TaskStatus, WorkflowStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. テナント
  const tenant = await prisma.tenant.create({
    data: { name: 'Demo Corp', slug: 'demo-corp' },
  });

  // 2. ユーザー (6ロール分)
  const password = await bcrypt.hash('Password123', 10);
  const users = await Promise.all(
    [
      { email: 'admin@demo.com',      displayName: '管理者',   role: Role.tenant_admin },
      { email: 'pm@demo.com',         displayName: 'PM太郎',   role: Role.pm },
      { email: 'member@demo.com',     displayName: 'メンバー花子', role: Role.member },
      { email: 'approver@demo.com',   displayName: '承認者次郎', role: Role.approver },
      { email: 'accounting@demo.com', displayName: '経理三郎', role: Role.accounting },
      { email: 'itadmin@demo.com',    displayName: 'IT管理者', role: Role.it_admin },
    ].map(async (u) => {
      const user = await prisma.user.create({
        data: { email: u.email, password },
      });
      await prisma.profile.create({
        data: { id: user.id, displayName: u.displayName },
      });
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: tenant.id, role: u.role },
      });
      return { ...user, role: u.role };
    }),
  );

  // 3. プロジェクト
  const pm = users.find((u) => u.role === Role.pm)!;
  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'ECサイトリニューアル',
      description: '既存ECサイトの全面リニューアルプロジェクト',
      status: ProjectStatus.active,
      pmId: pm.id,
      createdBy: pm.id,
    },
  });

  console.log(`Seeded: ${users.length} users, 1 tenant, 1 project`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Nx ライブラリ設定

```json
// libs/prisma-db/project.json
{
  "name": "prisma-db",
  "sourceRoot": "libs/prisma-db/src",
  "projectType": "library",
  "tags": ["scope:api", "type:data-access"],
  "targets": {
    "prisma-generate": {
      "command": "prisma generate --schema=libs/prisma-db/prisma/schema.prisma"
    },
    "prisma-migrate": {
      "command": "prisma migrate dev --schema=libs/prisma-db/prisma/schema.prisma"
    },
    "prisma-seed": {
      "command": "ts-node libs/prisma-db/prisma/seed.ts"
    }
  }
}
```

---

## マイグレーション構成

開発環境では Docker Compose で PostgreSQL 16 を起動し、Prisma Migrate でスキーマ管理を行います。

```bash
# マイグレーション実行
npx prisma migrate dev --schema=libs/prisma-db/prisma/schema.prisma

# シードデータ投入
npx prisma db seed
```
