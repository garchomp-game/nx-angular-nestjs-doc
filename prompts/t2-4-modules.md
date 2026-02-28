# T2-4: モジュール全体設計移行

## タスク概要
OpsHub のモジュール設計ドキュメント（576行、11モジュール）を Nx + Angular + NestJS アーキテクチャに移行する。Next.js App Router の SC/CC パターンを Angular Component + NestJS Module 構成に変換する。

## 入力ファイル（参照元）
- **元ドキュメント**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/modules/index.md`
- **補足参照**:
  - `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/architecture/nx-workspace.md`（Nx 構成）
  - `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/requirements/req-catalog.md`（Epic→Module マッピング）

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/modules.md`

## 移行ルール

### ディレクトリ構成変換
```
旧 (Next.js App Router):
src/app/(authenticated)/workflows/
├── page.tsx (SC)
├── _actions.ts (Server Actions)
└── _components/WorkflowDetailClient.tsx (CC)

新 (Nx Monorepo):
apps/api/src/modules/workflows/
├── workflows.controller.ts
├── workflows.service.ts
├── workflows.module.ts
├── dto/
│   ├── create-workflow.dto.ts
│   └── update-workflow.dto.ts
└── workflows.controller.spec.ts

apps/web/src/app/features/workflows/
├── workflow-list.component.ts
├── workflow-detail.component.ts
├── workflow-form.component.ts
├── workflow.service.ts (HttpClient)
└── workflows.routes.ts
```

### パターン変換
| 旧パターン | 新パターン |
|---|---|
| `page.tsx` (Server Component) | Angular Component (Signals) |
| `_actions.ts` (Server Actions) | NestJS Controller + Service |
| `_components/XxxClient.tsx` (Client) | Angular Feature Component |
| `withAuth()` ラッパー | `@UseGuards(JwtAuthGuard, RolesGuard)` |
| `requireRole()` | `@Roles('pm', 'tenant_admin')` |
| `hasRole()` (UI分岐) | Angular `authService.hasRole()` → Signal |
| `ActionResult<T>` | NestJS 統一レスポンス `ApiResponse<T>` |
| `writeAuditLog()` | `AuditInterceptor` (自動) |
| `createNotification()` | `NotificationService.create()` |
| `revalidatePath()` | Angular HttpClient → Signal 更新 |
| `supabase.from().select()` | `PrismaService.xxx.findMany()` |
| React `cache()` | NestJS `@nestjs/cache-manager` |

### 構成
1. **Nx Monorepo ディレクトリ構成** (apps/web, apps/api, libs/)
2. **レイヤー別責務** (Controller / Service / Prisma の3層)
3. **依存ルール** (Mermaid graph)
4. **共通ユーティリティの NestJS 移行版**
   - `withAuth()` → Guard
   - `writeAuditLog()` → Interceptor
   - `requireAuth()/requireRole()` → Guard + Decorator
   - `hasRole()` → Angular Service
   - `createNotification()` → NestJS Service
   - `getCurrentUser()` → JwtStrategy `validate()`
5. **共通定数の配置** (`libs/shared/types/`)
6. **11 モジュール一覧** (概要のみ、詳細は個別ドキュメント)
7. **Angular Component 分離パターン** (Smart/Presentational)

## frontmatter
```yaml
---
title: モジュール設計
description: Nx + Angular + NestJS でのモジュール分割と責務（11モジュール）
---
```

## 注意事項
- 元ドキュメントの DD-MOD-001 ~ DD-MOD-011 の構成を維持
- 各モジュールの概要・責務・公開I/F・依存・データ境界を NestJS 構成に変換
- 新規 AuthModule (DD-MOD-012) を追加
