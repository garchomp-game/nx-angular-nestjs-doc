---
title: Prisma V6 + SQLite
description: Prisma V6 のセットアップ・マイグレーション・型安全クエリ・N+1 対策
---

## 概要

**Prisma V6** を ORM として採用し、開発環境では **SQLite** を使用します。

```mermaid
graph LR
    SCHEMA["schema.prisma"] -->|prisma generate| CLIENT["Prisma Client<br/>(型安全)"]
    SCHEMA -->|prisma migrate| DB[(SQLite / PostgreSQL)]
    CLIENT --> SERVICE["NestJS Service"]
    SERVICE --> API["REST API"]

    style SCHEMA fill:#2d3748,color:#fff
    style CLIENT fill:#3178c6,color:#fff
    style DB fill:#336791,color:#fff
```

## セットアップ

### Nx ライブラリとしての配置

```bash
# Prisma ライブラリ生成
nx g @nx/js:library prisma-db --directory=libs/prisma-db --unitTestRunner=vitest

# Prisma CLI インストール
pnpm add -D prisma@6
pnpm add @prisma/client@6

# Prisma 初期化
cd libs/prisma-db
npx prisma init --datasource-provider sqlite
```

### スキーマ定義

```prisma
// libs/prisma-db/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─── ユーザー管理 ───
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(MEMBER)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectMembers ProjectMember[]
  expenses       Expense[]
  auditLogs      AuditLog[]

  @@index([email])
  @@index([role])
}

enum Role {
  ADMIN
  MANAGER
  MEMBER
  APPROVER
  ACCOUNTING
}

// ─── プロジェクト管理 ───
model Project {
  id          String        @id @default(uuid())
  name        String
  code        String        @unique
  description String?
  status      ProjectStatus @default(ACTIVE)
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  members  ProjectMember[]
  tasks    Task[]
  expenses Expense[]

  @@index([code])
  @@index([status])
}

model ProjectMember {
  id        String      @id @default(uuid())
  userId    String
  projectId String
  role      MemberRole  @default(MEMBER)
  joinedAt  DateTime    @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  COMPLETED
}

enum MemberRole {
  OWNER
  MANAGER
  MEMBER
}

// ─── タスク管理 ───
model Task {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Int        @default(0)
  projectId   String
  assigneeId  String?
  dueDate     DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([status])
  @@index([assigneeId])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

// ─── 経費管理 ───
model Expense {
  id          String        @id @default(uuid())
  title       String
  amount      Float
  currency    String        @default("JPY")
  category    String
  status      ExpenseStatus @default(DRAFT)
  receiptUrl  String?
  userId      String
  projectId   String?
  approvedBy  String?
  approvedAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user    User     @relation(fields: [userId], references: [id])
  project Project? @relation(fields: [projectId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([projectId])
}

enum ExpenseStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

// ─── 監査ログ ───
model AuditLog {
  id        String   @id @default(uuid())
  action    String
  entity    String
  entityId  String
  userId    String
  metadata  String?  // JSON string (SQLite doesn't support JSON type)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

### 環境変数

```bash
# .env (開発用)
DATABASE_URL="file:./dev.db"

# .env.test (テスト用)
DATABASE_URL="file:./test.db"

# .env.production (本番用 - PostgreSQL)
# DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

## マイグレーション

### コマンド一覧

```bash
# マイグレーション作成
npx prisma migrate dev --name init_schema

# マイグレーション適用 (CI/CD)
npx prisma migrate deploy

# マイグレーションリセット (開発)
npx prisma migrate reset

# 型生成のみ
npx prisma generate

# DB の状態確認
npx prisma migrate status
```

### Nx ターゲットとして登録

```json
// libs/prisma-db/project.json
{
  "targets": {
    "prisma-generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx prisma generate",
        "cwd": "libs/prisma-db"
      }
    },
    "prisma-migrate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx prisma migrate dev --name {args.name}",
        "cwd": "libs/prisma-db"
      }
    },
    "prisma-studio": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx prisma studio",
        "cwd": "libs/prisma-db"
      }
    },
    "prisma-seed": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx tsx prisma/seed.ts",
        "cwd": "libs/prisma-db"
      }
    }
  }
}
```

## NestJS PrismaService

```typescript
// libs/prisma-db/src/lib/prisma.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [
              { level: 'query', emit: 'event' },
              { level: 'info', emit: 'stdout' },
              { level: 'warn', emit: 'stdout' },
              { level: 'error', emit: 'stdout' },
            ]
          : [
              { level: 'warn', emit: 'stdout' },
              { level: 'error', emit: 'stdout' },
            ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
    this.setupQueryLogging();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  private setupQueryLogging(): void {
    if (process.env['NODE_ENV'] !== 'development') return;

    const SLOW_QUERY_MS = 100;

    // @ts-expect-error Prisma event typing
    this.$on('query', (event: { query: string; params: string; duration: number }) => {
      if (event.duration > SLOW_QUERY_MS) {
        this.logger.warn(
          `🐢 Slow query (${event.duration}ms): ${event.query}`,
        );
      } else {
        this.logger.debug(`Query (${event.duration}ms): ${event.query}`);
      }
    });
  }
}
```

### PrismaModule

```typescript
// libs/prisma-db/src/lib/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## シード設計

```typescript
// libs/prisma-db/prisma/seed.ts
import { PrismaClient, Role, ProjectStatus, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ── ユーザー作成 ──
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '管理者',
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'pm@example.com' },
    update: {},
    create: {
      email: 'pm@example.com',
      name: 'プロジェクトマネージャー',
      role: Role.MANAGER,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      name: 'メンバー',
      role: Role.MEMBER,
    },
  });

  // ── プロジェクト作成 ──
  const project = await prisma.project.upsert({
    where: { code: 'PRJ-001' },
    update: {},
    create: {
      name: 'サンプルプロジェクト',
      code: 'PRJ-001',
      description: '開発テスト用プロジェクト',
      status: ProjectStatus.ACTIVE,
      members: {
        create: [
          { userId: manager.id, role: 'OWNER' },
          { userId: member.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          { title: '要件定義', status: TaskStatus.DONE, priority: 1 },
          { title: '基本設計', status: TaskStatus.IN_PROGRESS, priority: 2 },
          { title: '詳細設計', status: TaskStatus.TODO, priority: 3 },
        ],
      },
    },
  });

  console.log(`✅ Seed complete: ${admin.id}, ${project.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## N+1 問題の検知と対策

### N+1 とは

```typescript
// ❌ N+1 クエリ - projects の数だけ追加クエリが発行される
const projects = await this.prisma.project.findMany();
for (const project of projects) {
  const members = await this.prisma.projectMember.findMany({
    where: { projectId: project.id },
  });
}
```

### 対策: include / select

```typescript
// ✅ 1回のクエリで関連データを取得 (Prisma V6 の JOIN 戦略)
const projects = await this.prisma.project.findMany({
  include: {
    members: {
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    },
    _count: {
      select: { tasks: true },
    },
  },
});
```

### N+1 検知ログ

開発環境でクエリ数を監視する middleware：

```typescript
// libs/prisma-db/src/lib/query-counter.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class QueryCounterMiddleware implements NestMiddleware {
  private readonly logger = new Logger('QueryCounter');

  use(req: Request, _res: Response, next: NextFunction): void {
    const start = Date.now();
    let queryCount = 0;

    // PrismaService のクエリイベントをカウント
    const originalNext = next;
    originalNext();

    // リクエスト完了後にクエリ数を報告
    _res.on('finish', () => {
      const duration = Date.now() - start;
      if (queryCount > 10) {
        this.logger.warn(
          `⚠️ High query count: ${queryCount} queries for ${req.method} ${req.url} (${duration}ms)`,
        );
      }
    });
  }
}
```

## SQLite ↔ PostgreSQL 切替

Prisma V6 では `datasource` の `provider` を変更するだけで DB を切替可能です：

```prisma
// 開発: SQLite
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 本番: PostgreSQL
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 注意点

| 項目 | SQLite | PostgreSQL | 対策 |
|---|---|---|---|
| JSON カラム | ❌ 非サポート | ✅ サポート | String + JSON.parse/stringify |
| Full-Text Search | 基本的 | ✅ tsvector | 本番のみ FTS 有効化 |
| ENUM | ❌ String で代替 | ✅ ネイティブ | Prisma enum で抽象化 |
| 並行書き込み | WAL モード必要 | ✅ 問題なし | 開発では気にしない |
| Array カラム | ❌ 非サポート | ✅ サポート | JSON String で代替 |
