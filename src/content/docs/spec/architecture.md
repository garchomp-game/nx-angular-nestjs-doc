---
title: アーキテクチャ概要
description: OpsHub のシステム全体構成と技術方針（Nx + Angular + NestJS 版）
---

## 目的 / In-Out / Related
- **目的**: システムの全体像と技術選定の根拠を示す
- **対象範囲（In）**: レイヤー構成、データフロー、技術スタック、デプロイ構成
- **対象範囲（Out）**: 各コンポーネントの実装詳細（→ Dev Guide）
- **Related**: [NFR](../../requirements/nfr/) / [Nx ワークスペース](../../architecture/nx-workspace/)

---

## システム構成図

```mermaid
graph TB
    subgraph Client["ブラウザ"]
        UI["Angular 19 App<br/>(Standalone Components + Signals)"]
    end

    subgraph NxMonorepo["Nx Monorepo"]
        subgraph AngularApp["apps/web (Angular 19)"]
            COMP["Components<br/>(Feature Modules)"]
            GUARD_F["Route Guards<br/>(認可)"]
            SVC["Angular Services<br/>(HttpClient)"]
        end
        subgraph NestApp["apps/api (NestJS 10)"]
            CTRL["Controllers<br/>(REST API)"]
            GUARD["Guards<br/>(JWT + RBAC)"]
            SERVICE["Services<br/>(Business Logic)"]
            INTER["Interceptors<br/>(Audit Log)"]
        end
        subgraph SharedLibs["libs/"]
            TYPES["shared/types<br/>(DTO, Enum, Interface)"]
            PRISMA_LIB["prisma-db<br/>(PrismaService)"]
        end
    end

    subgraph Database["Database"]
        DEV_DB["SQLite<br/>(開発)"]
        PROD_DB["PostgreSQL<br/>(本番)"]
    end

    UI --> COMP
    COMP --> SVC
    SVC -->|HTTP/REST| CTRL
    CTRL --> GUARD
    GUARD --> SERVICE
    SERVICE --> INTER
    SERVICE --> PRISMA_LIB
    PRISMA_LIB --> DEV_DB
    PRISMA_LIB -.->|本番| PROD_DB
    CTRL --> TYPES
    SVC --> TYPES

    style UI fill:#dd3333,color:#fff
    style CTRL fill:#e0234e,color:#fff
    style PRISMA_LIB fill:#2d3748,color:#fff
    style DEV_DB fill:#003b57,color:#fff
```

## レイヤー構成

| レイヤー | 技術 | 責務 |
|---|---|---|
| **プレゼンテーション** | Angular 19 (Standalone Components, Angular Material) | UI表示、フォーム、ルーティング |
| **API** | NestJS 10 (Controllers, Decorators) | RESTエンドポイント、バリデーション |
| **認証/認可** | Passport.js (JWT) + NestJS Guards | トークン管理、ロールベースアクセス制御 |
| **ビジネスロジック** | NestJS Services | ドメインロジック、状態遷移、通知作成 |
| **横断的関心事** | NestJS Interceptors, Middleware | 監査ログ、構造化ロギング、テナントフィルタ |
| **データアクセス** | Prisma V6 (PrismaService) | 型安全なクエリ、リレーション、トランザクション |
| **永続化** | SQLite (dev) / PostgreSQL (prod) | データ保管、Index、制約 |
| **ファイル** | NestJS FileModule (multer) | アップロードファイル管理 |

## データフロー

### 読み取り

```mermaid
sequenceDiagram
    participant Browser as ブラウザ (Angular)
    participant API as NestJS Controller
    participant Guard as JwtAuthGuard + RolesGuard
    participant Service as NestJS Service
    participant Prisma as PrismaService
    participant DB as SQLite/PostgreSQL

    Browser->>API: GET /api/projects
    API->>Guard: 認証・認可チェック
    Guard-->>API: user + roles
    API->>Service: findAll(tenantId, filters)
    Service->>Prisma: prisma.project.findMany()
    Prisma->>DB: SELECT (tenant_id フィルタ自動付与)
    DB-->>Prisma: rows
    Prisma-->>Service: Project[]
    Service-->>API: ProjectResponseDto[]
    API-->>Browser: 200 OK + JSON
```

### 書き込み

```mermaid
sequenceDiagram
    participant Browser as ブラウザ (Angular)
    participant API as NestJS Controller
    participant Guard as Guards
    participant Pipe as ValidationPipe
    participant Service as NestJS Service
    participant Prisma as PrismaService
    participant AuditInt as AuditInterceptor

    Browser->>API: POST /api/projects
    API->>Guard: 認証 + ロールチェック
    Guard-->>API: OK
    API->>Pipe: DTO バリデーション
    Pipe-->>API: CreateProjectDto (validated)
    API->>Service: create(dto)
    Service->>Prisma: prisma.project.create()
    Prisma-->>Service: Project
    Service-->>API: Project
    API->>AuditInt: 監査ログ記録
    API-->>Browser: 201 Created + JSON
```

## 技術方針

### Nx Monorepo ファースト
- **原則**: apps/ と libs/ を明確に分離。共有コードは libs/ に配置
- **理由**: モジュール境界の強制 + affected テストで CI 高速化
- **Related**: [Nx ワークスペース設計](../../architecture/nx-workspace/)

### Angular Signal ベースの状態管理
- **原則**: コンポーネント状態は Signal で管理。RxJS は HTTP 通信のみ
- **理由**: Zone.js 不要で軽量、変更検知の最適化
- **例外**: リアルタイム更新（WebSocket）は Observable

### NestJS DI 中心の設計
- **原則**: 全ビジネスロジックは Service に配置。Controller は薄く保つ
- **理由**: テスタビリティ確保（TestingModule でモック注入容易）

### Prisma Schema First
- **原則**: DB設計は `schema.prisma` が Single Source of Truth
- **理由**: 型生成 + マイグレーション + シード を一元管理
