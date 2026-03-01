---
title: "NA-04〜06: 認証・認可の中長期改善"
description: "admin 子ルート roleGuard 分離、visibilitychange トークンチェック、BroadcastChannel 複数タブ logout 同期の変更内容と検証結果"
---

## 変更サマリー

admin 子ルートに個別 roleGuard を設定し `it_admin` のアクセス範囲を制限。タブ復帰時のトークン自動更新と、複数タブ間のログアウト同期を `AuthService` に追加。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/app/features/admin/admin.routes.ts` | MODIFY: 子ルート毎に `roleGuard` + `data.roles` 追加、`loadComponent` lazy import 化 |
| `apps/web/src/app/core/auth/auth.service.ts` | MODIFY: `visibilitychange` リスナー追加、`BroadcastChannel` ログアウト同期追加 |
| `apps/web/src/app/core/auth/auth.service.spec.ts` | MODIFY: NA-05/NA-06 テスト 6件追加 |

## 主な変更の詳細

### NA-04: admin 子ルートの個別 roleGuard 分離

親ルート `/admin` は `['tenant_admin', 'it_admin']` で共通ガードされているが、API 側 `admin/users` は `tenant_admin` のみ許可。フロントの子ルートにも個別 roleGuard を設定し、API と一致させた。

```typescript
// admin.routes.ts
export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'tenant', pathMatch: 'full' },
  {
    path: 'tenant',
    data: { roles: ['tenant_admin'], title: 'テナント管理' },
    canActivate: [roleGuard],
    loadComponent: () =>
      import('./tenant/tenant-settings.component').then((m) => m.TenantSettingsComponent),
  },
  {
    path: 'users',
    data: { roles: ['tenant_admin'], title: 'ユーザー管理' },
    canActivate: [roleGuard],
    loadComponent: () =>
      import('./users/user-list.component').then((m) => m.UserListComponent),
  },
  {
    path: 'audit-logs',
    data: { roles: ['tenant_admin', 'it_admin'], title: '監査ログ' },
    canActivate: [roleGuard],
    loadComponent: () =>
      import('./audit-logs/audit-log-viewer.component').then((m) => m.AuditLogViewerComponent),
  },
];
```

| ルート | 許可ロール |
|--------|-----------|
| `/admin/tenant` | `tenant_admin` |
| `/admin/users` | `tenant_admin` |
| `/admin/audit-logs` | `tenant_admin`, `it_admin` |

### NA-05: visibilitychange トークンチェック

constructor 内に `visibilitychange` リスナーを追加。タブが `visible` に復帰し `isAuthenticated()` が true のとき `refreshToken()` を実行、失敗時は `logout()` を呼ぶ。

```typescript
// auth.service.ts — constructor 内
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && this.isAuthenticated()) {
      this.refreshToken().subscribe({
        error: () => this.logout(),
      });
    }
  });
}
```

- `typeof document !== 'undefined'` で SSR 環境を安全にスキップ

### NA-06: BroadcastChannel 複数タブ logout 同期

`BroadcastChannel('opshub_auth')` を `try/catch` で生成し、非対応ブラウザ（Safari < 15.4）でもエラーを出さない。`logout()` 呼び出し時に `postMessage('logout')` で他タブに通知し、受信側は `clearState()` + `/login` リダイレクトを実行。

```typescript
// auth.service.ts — constructor 内
try {
  this._logoutChannel = new BroadcastChannel('opshub_auth');
  this._logoutChannel.onmessage = (event) => {
    if (event.data === 'logout') {
      this.clearState();
      this.router.navigate(['/login']);
    }
  };
} catch {
  this.logger.warn('BroadcastChannel not supported');
}

// logout() 内
this._logoutChannel?.postMessage('logout');
```

## テスト結果

```
 ✓  web  apps/web/src/app/core/auth/auth.service.spec.ts (19 tests)
 ...
 Test Files  28 passed (28)
      Tests  200 passed (200)
   Duration  15.36s
```

| テストスイート | テスト数 | 結果 |
|---------------|---------|------|
| AuthService (既存) | 8 | ✅ PASS |
| AuthService initialization with token (既存) | 3 | ✅ PASS |
| AuthService visibilitychange (NA-05 新規) | 3 | ✅ PASS |
| AuthService BroadcastChannel (NA-06 新規) | 2 | ✅ PASS |
| 他全テストファイル | 184 | ✅ PASS |
