---
title: Angular Core 基盤 (core/)
description: AuthService, Interceptors, Guards, AppShell, ルーティング設計の詳細仕様
---

本ドキュメントは `apps/web/src/app/core/` 配下の横断的関心事を定義する。
各 Feature module はこの基盤の上で動作する。

---

## ディレクトリ構成

```
apps/web/src/app/
├── core/                            # 横断的関心事 (singleton)
│   ├── auth/
│   │   ├── auth.service.ts         # AuthState Signal, login/logout/refresh
│   │   ├── auth.guard.ts           # CanActivateFn
│   │   ├── role.guard.ts           # ロールベースルートガード
│   │   └── types/
│   │       └── auth.types.ts       # Angular 固有の Auth 型
│   ├── interceptors/
│   │   ├── auth.interceptor.ts     # JWT Bearer 自動付与 + トークンリフレッシュ
│   │   └── error.interceptor.ts    # 共通エラーハンドリング
│   └── services/
│       └── tenant.service.ts       # X-Tenant-Id ヘッダー管理
├── shared/                          # App 共有コンポーネント
│   ├── components/
│   │   ├── app-shell.component.ts  # サイドバー + ヘッダー + <router-outlet>
│   │   ├── confirm-dialog.component.ts  # 汎用確認ダイアログ
│   │   └── loading-spinner.component.ts
│   └── pipes/
│       ├── highlight.pipe.ts       # 検索キーワードハイライト
│       └── relative-time.pipe.ts   # 相対時刻表示 (「5分前」等)
├── features/                        # Feature modules (lazy loaded)
│   ├── dashboard/
│   ├── workflows/
│   ├── projects/
│   ├── timesheets/
│   ├── expenses/
│   ├── invoices/
│   ├── search/
│   ├── notifications/
│   └── admin/
├── app.component.ts
├── app.config.ts
└── app.routes.ts
```

---

## AuthService

認証状態の管理とトークン操作を担う Signal ベースのサービス。

```typescript
// core/auth/auth.service.ts
import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  CurrentUser, Role, ApiResponse,
} from '@shared/types';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // ─── State ───
  private _currentUser = signal<CurrentUser | null>(null);
  private _accessToken = signal<string | null>(null);
  private _loading = signal(false);

  // ─── Public Signals (readonly) ───
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly loading = this._loading.asReadonly();

  /** ロール判定 Signal（テンプレートで @if (canApprove()) {} 形式で使用） */
  hasRole(...roles: (Role | string)[]): boolean {
    const user = this._currentUser();
    if (!user) return false;
    return user.roles.some((r) => roles.includes(r.role));
  }

  /** よく使うロール判定 computed */
  readonly isAdmin = computed(() => this.hasRole(Role.TENANT_ADMIN, Role.IT_ADMIN));
  readonly isPm = computed(() => this.hasRole(Role.PM));
  readonly canApprove = computed(() => this.hasRole(Role.APPROVER, Role.TENANT_ADMIN));

  constructor() {
    this.loadFromStorage();
  }

  // ─── Auth Operations ───

  login(email: string, password: string): Observable<ApiResponse<TokenPair>> {
    this._loading.set(true);
    return this.http
      .post<ApiResponse<TokenPair>>('/api/auth/login', { email, password })
      .pipe(
        tap((res) => {
          if (res.success) {
            this.storeTokens(res.data);
            this.fetchProfile();
          }
        }),
        catchError((err) => {
          this._loading.set(false);
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    this.http.post('/api/auth/logout', {}).subscribe({ error: () => {} });
    this.clearState();
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<ApiResponse<TokenPair>> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.clearState();
      return throwError(() => new Error('No refresh token'));
    }
    return this.http
      .post<ApiResponse<TokenPair>>('/api/auth/refresh', { refreshToken })
      .pipe(
        tap((res) => {
          if (res.success) this.storeTokens(res.data);
        }),
      );
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  // ─── Private ───

  private fetchProfile(): void {
    this.http.get<ApiResponse<CurrentUser>>('/api/auth/me').subscribe({
      next: (res) => {
        if (res.success) this._currentUser.set(res.data);
        this._loading.set(false);
      },
      error: () => this._loading.set(false),
    });
  }

  private storeTokens(tokens: TokenPair): void {
    this._accessToken.set(tokens.accessToken);
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('accessToken');
    if (token) {
      this._accessToken.set(token);
      this.fetchProfile();
    }
  }

  private clearState(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
```

---

## Interceptors

### AuthInterceptor

JWT Bearer トークンの自動付与と 401 時のトークンリフレッシュ。

```typescript
// core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  // トークンがあれば Bearer ヘッダーを付与
  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 → トークンリフレッシュを試行
      if (error.status === 401 && !req.url.includes('/auth/')) {
        return auth.refreshToken().pipe(
          switchMap((res) => {
            if (res.success) {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.data.accessToken}` },
              });
              return next(retryReq);
            }
            auth.logout();
            return throwError(() => error);
          }),
          catchError(() => {
            auth.logout();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
```

### ErrorInterceptor

HTTP エラーの統一ハンドリング。PrimeNG の `MessageService` (ToastService 経由) でエラー通知を表示。

```typescript
// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 は AuthInterceptor が処理するのでスキップ
      if (error.status === 401) return throwError(() => error);

      const message = error.error?.error?.message
        ?? error.error?.message
        ?? 'サーバーエラーが発生しました';

      messageService.add({
        severity: error.status >= 500 ? 'error' : 'warn',
        summary: 'エラー',
        detail: message,
        life: 5000,
      });

      return throwError(() => error);
    }),
  );
};
```

---

## Route Guards

### authGuard (CanActivateFn)

未認証ユーザーをログイン画面にリダイレクト。

```typescript
// core/auth/auth.guard.ts
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  router.navigate(['/login']);
  return false;
};
```

### roleGuard (CanActivateFn)

特定ロールのみアクセス許可。`Route.data.roles` からロール一覧を取得。

```typescript
// core/auth/role.guard.ts
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRoles = route.data['roles'] as string[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (auth.hasRole(...requiredRoles)) return true;

  router.navigate(['/dashboard']);
  return false;
};
```

**ルーティングでの使用例**:
```typescript
{
  path: 'admin',
  canActivate: [authGuard, roleGuard],
  data: { roles: ['tenant_admin', 'it_admin'] },
  loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
}
```

---

## TenantService

アクティブテナントの管理。`X-Tenant-Id` ヘッダーを AuthInterceptor 経由で自動付与。

```typescript
// core/services/tenant.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private auth = inject(AuthService);

  /** アクティブテナント ID (Signal) */
  private _activeTenantId = signal<string | null>(null);

  readonly activeTenantId = this._activeTenantId.asReadonly();

  /** テナント名（将来的にキャッシュ） */
  readonly tenantIds = computed(() => this.auth.currentUser()?.tenantIds ?? []);

  /** テナント切替 */
  switchTenant(tenantId: string): void {
    if (!this.tenantIds().includes(tenantId)) {
      throw new Error(`User is not a member of tenant: ${tenantId}`);
    }
    this._activeTenantId.set(tenantId);
    localStorage.setItem('activeTenantId', tenantId);
  }

  /** 初期化時に復元 */
  initialize(): void {
    const stored = localStorage.getItem('activeTenantId');
    const userTenantIds = this.tenantIds();
    if (stored && userTenantIds.includes(stored)) {
      this._activeTenantId.set(stored);
    } else if (userTenantIds.length > 0) {
      this._activeTenantId.set(userTenantIds[0]);
    }
  }
}
```

---

## app.config.ts

Angular アプリケーションの設定。PrimeNG の Aura テーマと各種グローバルサービスを登録。

```typescript
// apps/web/src/app/app.config.ts
import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
    provideHttpClient, withInterceptors, withFetch,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import ja from '@angular/common/locales/ja';

import { providePrimeNG } from 'primeng/config';
import { MessageService, ConfirmationService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';

import { APP_ROUTES } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { GlobalErrorHandler } from './core/services/global-error-handler';

registerLocaleData(ja);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
    MessageService,
    ConfirmationService,
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
```

---

## app.routes.ts

トップレベルルーティング。Feature module は全て lazy-loaded。

```typescript
// apps/web/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const APP_ROUTES: Routes = [
  // ─── Public ───
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./core/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./core/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },

  // ─── Protected ───
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'workflows',
        loadChildren: () =>
          import('./features/workflows/workflows.routes').then((m) => m.WORKFLOW_ROUTES),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./features/projects/projects.routes').then((m) => m.PROJECT_ROUTES),
      },
      {
        path: 'timesheets',
        loadChildren: () =>
          import('./features/timesheets/timesheets.routes').then((m) => m.TIMESHEET_ROUTES),
      },
      {
        path: 'expenses',
        loadChildren: () =>
          import('./features/expenses/expenses.routes').then((m) => m.EXPENSE_ROUTES),
      },
      {
        path: 'invoices',
        canActivate: [roleGuard],
        data: { roles: ['accounting', 'pm', 'tenant_admin'] },
        loadChildren: () =>
          import('./features/invoices/invoices.routes').then((m) => m.INVOICE_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATION_ROUTES),
      },
      {
        path: 'search',
        loadChildren: () =>
          import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['tenant_admin', 'it_admin'] },
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },

  // ─── Fallback ───
  { path: '**', redirectTo: 'dashboard' },
];
```

---

## AppShell Component

PrimeNG Drawer + Menu + `<router-outlet>` のレイアウトシェル。

```typescript
// shared/components/app-shell.component.ts
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    DrawerModule, MenuModule, AvatarModule,
    ButtonModule, ToastModule, ConfirmDialogModule,
    BreadcrumbComponent, NotificationBellComponent,
  ],
  template: `
    <p-toast />
    <p-confirmdialog />

    <p-drawer [visible]="true" [modal]="false" styleClass="app-sidenav">
      <ng-template pTemplate="header">
        <span class="font-bold text-xl">OpsHub</span>
      </ng-template>
      <p-menu [model]="menuItems()" styleClass="w-full border-0" />
    </p-drawer>

    <div class="app-content">
      <header class="app-header">
        <app-breadcrumb />
        <div class="header-actions">
          <app-notification-bell />
          <p-avatar icon="pi pi-user" shape="circle"
                    (click)="userMenuRef.toggle($event)" />
          <p-menu #userMenuRef [model]="userMenuItems" [popup]="true" />
        </div>
      </header>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppShellComponent {
  auth = inject(AuthService);

  userMenuItems = [
    { label: 'ログアウト', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  /** ロールに応じたメニュー項目 (PrimeNG MenuItem 形式) */
  menuItems = computed(() => {
    const items = [
      { path: '/dashboard',   icon: 'pi pi-home',       label: 'ダッシュボード', roles: ['*'] },
      { path: '/workflows',   icon: 'pi pi-file',       label: '申請',          roles: ['*'] },
      { path: '/projects',    icon: 'pi pi-folder',     label: 'プロジェクト',  roles: ['*'] },
      { path: '/timesheets',  icon: 'pi pi-clock',      label: '工数',          roles: ['member', 'pm'] },
      { path: '/expenses',    icon: 'pi pi-wallet',     label: '経費',          roles: ['*'] },
      { path: '/invoices',    icon: 'pi pi-receipt',    label: '請求書',        roles: ['accounting', 'pm', 'tenant_admin'] },
      { path: '/notifications', icon: 'pi pi-bell',     label: '通知',          roles: ['*'] },
      { path: '/search',      icon: 'pi pi-search',     label: '検索',          roles: ['*'] },
      { path: '/admin',       icon: 'pi pi-cog',        label: '管理',          roles: ['tenant_admin', 'it_admin'] },
    ];
    return items
      .filter((item) => item.roles.includes('*') || item.roles.some((r) => this.auth.hasRole(r)))
      .map((item) => ({ label: item.label, icon: item.icon, routerLink: item.path }));
  });
}
```

---

## 共有パイプ

### RelativeTimePipe

通知の日時表示用。

```typescript
// shared/pipes/relative-time.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date): string {
    const now = Date.now();
    const diff = now - new Date(value).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}日前`;
    return new Date(value).toLocaleDateString('ja-JP');
  }
}
```

### HighlightPipe

検索結果のキーワードハイライト。

```typescript
// shared/pipes/highlight.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'highlight', standalone: true })
export class HighlightPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string, keyword: string): SafeHtml {
    if (!keyword || !text) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const highlighted = text.replace(regex, '<mark>$1</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
```

---

## 確認ダイアログ (PrimeNG ConfirmationService)

削除操作等の確認ダイアログは PrimeNG の `ConfirmationService` を使用。`<p-confirmdialog>` は AppShell に配置済み。

```typescript
// 使用例 (任意のコンポーネント)
import { inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

export class ProjectDetailComponent {
  private confirmationService = inject(ConfirmationService);

  deleteProject(id: string): void {
    this.confirmationService.confirm({
      message: 'このプロジェクトを削除しますか？',
      header: '削除確認',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '削除',
      rejectLabel: 'キャンセル',
      accept: () => {
        // 削除処理
      },
    });
  }
}
```

> [!NOTE]
> 旧 `ConfirmDialogComponent` (Angular Material ベース) は削除済み。
> `PrimeNG ConfirmationService` に完全移行しています。
