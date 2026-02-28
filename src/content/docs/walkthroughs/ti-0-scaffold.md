---
title: "TI-0: Nx ワークスペース + 共有基盤 ウォークスルー"
description: Nx monorepo スキャフォルド + Auth + AppShell の実装ウォークスルー
---

# TI-0: Nx Workspace + Shared Foundation — Walkthrough

## Summary

Created a complete Nx monorepo at `opshub/` with Angular + NestJS apps, 3 shared libraries, Prisma schema, NestJS infrastructure, Auth module, and Angular AppShell.

## Changes in This Update

### 1. TenantMiddleware / PrismaService Fix

Prisma v6.19.2 removed `$use` and `Prisma.Middleware`. Rewrote using **`$extends` query component**:

```diff
- this.$use(tenantMiddleware());
- this.$use(auditLogMiddleware());
+ base.$extends({
+   query: { $allModels: { $allOperations({ model, operation, args, query }) {
+     enforceAuditLogAppendOnly(model, operation);
+     const filteredArgs = applyTenantFilter(model, operation, args);
+     return query(filteredArgs);
+   }}}
+ });
```

- [tenant.middleware.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/libs/prisma-db/src/lib/middleware/tenant.middleware.ts) — `applyTenantFilter()` function (71 lines). Auto-injects `tenantId` into WHERE/CREATE for 13 tenant-scoped models.
- [audit-log.middleware.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/libs/prisma-db/src/lib/middleware/audit-log.middleware.ts) — `enforceAuditLogAppendOnly()` throws on UPDATE/DELETE for AuditLog.
- [prisma.service.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/libs/prisma-db/src/lib/prisma.service.ts) — Uses `createExtendedPrismaClient()` with `$extends`. Extended client exposed via `db` getter.
- All services updated: `this.prisma.db.xxx` instead of `this.prisma.xxx`.

### 2. Test Files Created

| File | Framework | Tests |
|---|---|---|
| [auth.service.spec.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/apps/api/src/modules/auth/auth.service.spec.ts) | Jest (NestJS) | 10 |
| [auth.controller.spec.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/apps/api/src/modules/auth/auth.controller.spec.ts) | Jest (NestJS) | 6 |
| [auth.service.spec.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/apps/web/src/app/core/auth/auth.service.spec.ts) | Vitest (Angular) | 5 |
| [login.component.spec.ts](file:///home/garchomp-game/workspace/starlight-test/opshub/apps/web/src/app/core/auth/login/login.component.spec.ts) | Vitest (Angular) | 8 |

## Verification

| Target | Command | Result |
|---|---|---|
| NestJS Build | `npx nx build api` | ✅ webpack compiled successfully |
| Angular Build | `npx nx build web` | ✅ compiled successfully |
| NestJS Tests | `npx nx test api` | ✅ 2 suites, 16 passed |
| Angular Tests | `npx nx test web` | ✅ 2 suites, 13 passed |
