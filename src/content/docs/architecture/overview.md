---
title: アーキテクチャ概要
description: Nx + Angular + NestJS の全体アーキテクチャ設計
---

## システム全体像

本プロジェクトは **Nx モノレポ** の上に、Angular フロントエンドと NestJS バックエンドを配置するフルスタック構成です。

```mermaid
graph TB
    subgraph "Nx Monorepo"
        subgraph "apps/"
            FE["Angular 19<br/>フロントエンド"]
            BE["NestJS 10<br/>バックエンド"]
        end
        subgraph "libs/"
            SHARED["shared/types<br/>共有型定義"]
            PRISMA["prisma-db<br/>Prisma Client"]
            UI["shared/ui<br/>共通UIコンポーネント"]
            UTIL["shared/util<br/>ユーティリティ"]
        end
    end

    FE -->|HTTP/REST| BE
    FE --> SHARED
    FE --> UI
    FE --> UTIL
    BE --> SHARED
    BE --> PRISMA
    BE --> UTIL
    PRISMA -->|Prisma V6| DB[(SQLite / PostgreSQL)]

    style FE fill:#dd3333,color:#fff
    style BE fill:#e0234e,color:#fff
    style SHARED fill:#3178c6,color:#fff
    style PRISMA fill:#2d3748,color:#fff
    style DB fill:#336791,color:#fff
```

## レイヤードアーキテクチャ

### フロントエンド (Angular 19)

```mermaid
graph LR
    subgraph "Angular Application"
        COMP["Standalone<br/>Components"] --> SVC["Services<br/>(Injectable)"]
        SVC --> HTTP["HttpClient<br/>(Interceptors)"]
        COMP --> STORE["Signal Store<br/>(State Management)"]
        GUARD["Route Guards"] --> SVC
    end
    HTTP -->|REST API| API["NestJS Backend"]
```

| レイヤー | 責務 | 主要技術 |
|---|---|---|
| **Component** | UI 表示・ユーザーインタラクション | Standalone Components, Angular Material 19 |
| **Service** | ビジネスロジック・API通信 | Injectable, HttpClient |
| **State** | アプリケーション状態管理 | Angular Signals / NgRx SignalStore |
| **Guard** | ルートアクセス制御 | Route Guards (functional) |
| **Interceptor** | HTTP 共通処理 | HttpInterceptorFn (functional) |

### バックエンド (NestJS 10)

```mermaid
graph LR
    subgraph "NestJS Application"
        CTRL["Controllers"] --> SVC2["Services"]
        SVC2 --> REPO["Repositories<br/>(Prisma)"]
        PIPE["Validation<br/>Pipes"] --> CTRL
        GUARD2["Auth<br/>Guards"] --> CTRL
        FILTER["Exception<br/>Filters"] --> CTRL
    end
    REPO -->|Prisma Client| DB2[(Database)]
```

| レイヤー | 責務 | 主要技術 |
|---|---|---|
| **Controller** | HTTP リクエスト受付・レスポンス整形 | @Controller, @Get/@Post 等 |
| **Service** | ビジネスロジック | @Injectable |
| **Repository** | データアクセス | Prisma Client V6 |
| **Pipe** | バリデーション・変換 | class-validator, class-transformer |
| **Guard** | 認証・認可 | @UseGuards, JWT |
| **Filter** | 例外ハンドリング | @Catch, ExceptionFilter |
| **Interceptor** | ログ・キャッシュ・変換 | @UseInterceptors |

## 通信設計

### API 設計方針

```
[Angular HttpClient]
        |
        | HTTP/REST (JSON)
        |
[NestJS Controller]
        |
        | class-validator (DTO validation)
        |
[NestJS Service]
        |
        | Prisma Client (type-safe queries)
        |
[SQLite / PostgreSQL]
```

**API 契約の保証方法:**

1. **共有 DTO ライブラリ** (`libs/shared/types`)
   - フロントエンド・バックエンドで同一の TypeScript 型を使用
   - Prisma が生成する型とマッピング
2. **class-validator** による入力バリデーション
   - リクエスト DTO に `@IsString()`, `@IsEmail()` 等のデコレータ
   - NestJS の `ValidationPipe` で自動検証
3. **Zod** によるランタイムバリデーション (フロントエンド側)
   - API レスポンスを Zod スキーマで検証
   - 型推論と実行時チェックの両立

## 環境構成

| 環境 | DB | 用途 |
|---|---|---|
| **開発 (dev)** | SQLite | ローカル開発・高速起動 |
| **テスト (test)** | SQLite (in-memory) | CI/CD・テスト実行 |
| **ステージング** | PostgreSQL | 本番と同等の検証 |
| **本番 (prod)** | PostgreSQL | 商用運用 |

> **なぜ開発に SQLite を使うのか？**
> - セットアップゼロ（サーバー不要）
> - Prisma V6 が SQLite を完全サポート
> - テスト時は in-memory で高速実行
> - 本番は PostgreSQL にスイッチするだけ（Prisma のスキーマ 1 箇所変更）
