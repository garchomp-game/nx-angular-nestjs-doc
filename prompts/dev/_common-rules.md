# 共通ルール — 全モジュール開発チケット共通

> **このファイルは全チケット (TI-1〜TI-12) で先に読むこと。**

## 1. プロジェクト構成

```
ワークスペース: /home/garchomp-game/workspace/starlight-test/opshub/
ドキュメント:   /home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/
パッケージマネージャー: pnpm (npm は使用しない)
```

### コマンド対応表

| 操作 | コマンド |
|---|---|
| 依存追加 | `pnpm add <package>` / `pnpm add -D <package>` |
| インストール | `pnpm install` |
| ビルド (API) | `pnpm nx build api` |
| ビルド (Web) | `pnpm nx build web` |
| テスト (API) | `pnpm nx test api` |
| Prisma 生成 | `pnpm nx prisma generate` または `npx prisma generate --schema=libs/prisma-db/prisma/schema.prisma` |

## 2. 必ず参照するドキュメント（作業前にファイル内容を確認すること）

| 優先度 | ドキュメント | ディスクパス |
|---|---|---|
| **必須** | Prisma セットアップ | `docs/detail/prisma-setup.md` |
| **必須** | エラー方針 | `docs/spec/error-handling.md` |
| **必須** | 監査ログ方針 | `docs/spec/audit-logging.md` |
| **必須** | テストパターン | `docs/testing/module-test-patterns.md` |
| **必須** | 共有型カタログ | `docs/detail/shared-types.md` |
| **必須** | NestJS 共通基盤 | `docs/detail/common-infrastructure.md` |
| **必須** | Angular Core 基盤 | `docs/detail/angular-core.md` |
| 推奨 | DB設計 (スキーマ) | `docs/detail/db.md` |
| 推奨 | Guard/権限設計 | `docs/detail/guard-design.md` |

> 上記のパスは全て `nx-angular-nestjs-doc/src/content/docs/` 配下の相対パス。

## 3. コーディング規約

### Prisma アクセスパターン (重要)

```typescript
// ✅ 正しい: this.prisma.xxx（直接アクセス）
const workflows = await this.prisma.workflow.findMany({ where: { tenantId } });

// ❌ 間違い: this.prisma.db.xxx（古いパターン、使わないこと）
```

PrismaService は Proxy パターンで `$extends` のミドルウェアを統合済み。
Service は `PrismaService` を inject して直接モデルにアクセスする。

### Prisma エラークラスの import (SWC 必須)

SWC コンパイラでは `import { Prisma } from '@prisma/client'` の名前空間経由での
ランタイムクラス参照が動作しない。以下のパターンに従うこと:

```typescript
// ✅ ランタイムで使うクラス（instanceof 等）: 直接 import
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

if (error instanceof PrismaClientKnownRequestError) { ... }

// ✅ 型のみ使う場合: import type
import type { Prisma } from '@prisma/client';
const where: Prisma.ExpenseWhereInput = { ... };

// ❌ NG: 名前空間経由のランタイムアクセス（SWC で動作しない）
import { Prisma } from '@prisma/client';
if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }
```

### テナント分離

`TenantMiddleware` (Prisma `$extends`) が自動で `tenantId` を注入するため、
Service 側で明示的に `tenantId` を WHERE に追加する必要はない。
ただし、Controller で受け取った `tenantId` を Service に渡す設計は維持する。

### エラーコード

エラーは `spec/error-handling.md` のコード体系に従う:
- `ERR-{カテゴリ}-{番号}` 形式
- NestJS の標準例外クラスを使用 (`NotFoundException`, `ConflictException` 等)
- Prisma エラー (`P2002`, `P2025`) は catch して変換

### 監査ログ

`AuditInterceptor` が CUD 操作を自動記録。
モジュール開発者は追加コード不要。

### テスト

- NestJS: Jest + **@swc/jest** (`*.spec.ts`)
- Angular: Vitest (`*.spec.ts`)
- テンプレート: `testing/module-test-patterns.md` に従う
- UI 要素には `data-testid` 属性を付与
- ESM-only パッケージ（uuid 等）は `jest.config.js` の `transformIgnorePatterns` に追加する

### Angular コンポーネント

- Standalone Components (NgModule 不使用)
- Signal ベースの状態管理
- Angular Material コンポーネントを使用
- `@shared/types` から型/定数を import

## 4. 既存コードの参照

実装前に、Auth モジュールの既存コードをパターン参考にすること:
- `apps/api/src/modules/auth/` — NestJS Module の構成例
- `apps/web/src/app/core/auth/` — Angular Service/Component の構成例
- `apps/api/src/modules/auth/auth.service.spec.ts` — テストのモック構成例

## 5. ウォークスルー出力

作業完了後、ウォークスルーを以下に作成すること:

```
ファイル名: docs/walkthroughs/ti-{N}-{モジュール名}.md
絶対パス:  /home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/walkthroughs/
```

### フォーマット

```yaml
---
title: "TI-{N}: {モジュール名} ウォークスルー"
description: {概要}
---
```

### 必須セクション

1. **Summary** — 作成したもの概要
2. **Changes** — 各ファイルの変更内容
3. **Verification** — テスト結果/ビルド結果テーブル

