---
title: デバッグツール
description: Angular / NestJS / Prisma のデバッグツールと設定
---

## 概要

大規模開発で事前にバグを検知・修正するためには、**効率的なデバッグ環境**が不可欠です。
本章では、Angular / NestJS / Prisma それぞれのデバッグツールと VS Code 統合設定を解説します。

## Angular DevTools

### インストール

[Angular DevTools](https://angular.dev/tools/devtools) は Chrome / Edge の拡張機能として利用可能です。

**主な機能:**

| 機能 | 説明 |
|---|---|
| **コンポーネントツリー** | コンポーネント階層の可視化・プロパティ検査 |
| **プロファイラ** | Change Detection サイクルの計測 |
| **インジェクタツリー** | DI 階層の可視化 |
| **ルーターツリー** | ルート構成の確認 |
| **Signal デバッグ** | Signal の値・依存関係の追跡 (Angular 19) |

### 開発モードの確認

Angular 19 の開発モードでは自動的に DevTools が有効になります。プロダクションビルドでは無効化されます。

```typescript
// app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // DevTools は開発モードで自動有効化
  ],
};
```

## NestJS デバッグモード

### Node.js Inspector

NestJS は Node.js の `--inspect` フラグでデバッグ可能です。

```json
// apps/api/project.json
{
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "api:build",
        "inspect": "inspect",
        "port": 9229
      }
    }
  }
}
```

### NestJS Logger

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  async findAll(): Promise<Project[]> {
    this.logger.log('Fetching all projects');
    this.logger.debug('Query parameters: ...'); // DEBUG レベル
    this.logger.warn('Deprecated method called'); // WARNING
    try {
      return await this.prisma.project.findMany();
    } catch (error) {
      this.logger.error('Failed to fetch projects', error.stack);
      throw error;
    }
  }
}
```

**ログレベル設定:**

```typescript
// main.ts
const app = await NestFactory.create(AppModule, {
  logger: process.env.NODE_ENV === 'production'
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'],
});
```

## Prisma デバッグ

### Prisma Studio

ブラウザベースの DB ビューアで、データの閲覧・編集が可能です。

```bash
nx run prisma-db:prisma-studio
# → http://localhost:5555 で起動
```

### クエリログ

```typescript
// libs/prisma-db/src/lib/prisma.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // クエリログをNestJS Loggerに統合
    // @ts-expect-error Prisma event typing
    this.$on('query', (event) => {
      this.logger.debug(`Query: ${event.query}`);
      this.logger.debug(`Params: ${event.params}`);
      this.logger.debug(`Duration: ${event.duration}ms`);
    });
  }
}
```

### スロークエリ検知

```typescript
// 開発環境でスロークエリを警告
const SLOW_QUERY_THRESHOLD = 100; // ms

// @ts-expect-error Prisma event typing
this.$on('query', (event) => {
  if (event.duration > SLOW_QUERY_THRESHOLD) {
    this.logger.warn(
      `🐢 Slow query detected (${event.duration}ms): ${event.query}`
    );
  }
});
```

## VS Code デバッグ設定

### launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS API",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/apps/api/**/*.js"],
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Angular (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/web/src",
      "sourceMapPathOverrides": {
        "webpack:/*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug Vitest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "--reporter=verbose", "${file}"],
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ],
  "compounds": [
    {
      "name": "Debug Full Stack",
      "configurations": ["Debug NestJS API", "Debug Angular (Chrome)"]
    }
  ]
}
```

### 推奨 VS Code 拡張機能

```json
// .vscode/extensions.json
{
  "recommendations": [
    "angular.ng-template",
    "nrwl.angular-console",
    "prisma.prisma",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "vitest.explorer",
    "ms-playwright.playwright",
    "eamodio.gitlens",
    "usernamehw.errorlens"
  ]
}
```

### settings.json

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "always",
    "source.organizeImports": "always"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "eslint.useFlatConfig": true
}
```

## Source Map 設定

### Angular (開発ビルド)

```json
// apps/web/project.json
{
  "targets": {
    "build": {
      "options": {
        "sourceMap": true
      },
      "configurations": {
        "production": {
          "sourceMap": false
        }
      }
    }
  }
}
```

### NestJS (tsconfig)

```json
// apps/api/tsconfig.app.json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSources": true
  }
}
```

## デバッグチェックリスト

| チェック項目 | ツール | 自動化 |
|---|---|---|
| コンポーネント状態の確認 | Angular DevTools | ❌ 手動 |
| API リクエスト/レスポンス | NestJS Logger + DevTools Network | ✅ ログ自動 |
| DB クエリの確認 | Prisma Studio / クエリログ | ✅ ログ自動 |
| スロークエリ検知 | Prisma イベントリスナー | ✅ 自動警告 |
| ブレークポイントデバッグ | VS Code Debugger | ❌ 手動 |
| テスト失敗のデバッグ | Vitest UI / VS Code Vitest | ✅ 半自動 |
