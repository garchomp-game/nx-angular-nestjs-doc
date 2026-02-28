---
title: 認証モジュール設計 (AuthModule)
description: Passport.js JWT 認証の NestJS Module + Angular Core Auth 設計（新規作成）
---

## 概要

- **責務**: ユーザー認証（ログイン・登録・トークン更新・ログアウト）、JWT ベースのセッション管理
- **Epic**: 新規（旧 Supabase Auth からの移行）
- **Prisma Models**: `User`（新規追加）, `Profile`

> [!IMPORTANT]
> 旧 OpsHub は Supabase Auth (GoTrue) を利用していたが、新アーキテクチャでは **Passport.js + JWT Strategy** に移行する。
> `auth.users` テーブルは Prisma の `User` モデルとして管理し、パスワードハッシュは `bcrypt` で処理する。

---

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   ├── jwt-refresh.strategy.ts
│   └── local.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── local-auth.guard.ts
├── decorators/
│   ├── current-user.decorator.ts
│   └── public.decorator.ts
├── dto/
│   ├── login.dto.ts
│   ├── register.dto.ts
│   └── refresh-token.dto.ts
├── types/
│   └── auth.types.ts
└── tests/
    ├── auth.controller.spec.ts
    └── auth.service.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `POST` | `/api/auth/login` | ログイン（email + password → JWT 発行） | なし（`@Public()`） |
| `POST` | `/api/auth/register` | ユーザー登録 | なし（`@Public()`） |
| `POST` | `/api/auth/refresh` | アクセストークン更新（refresh token 使用） | なし（`@Public()`） |
| `POST` | `/api/auth/logout` | ログアウト（refresh token 無効化） | 認証済み |
| `GET` | `/api/auth/me` | 現在のユーザー情報取得 | 認証済み |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `validateUser` | `email, password` | `User \| null` | email/password 検証（bcrypt） |
| `login` | `user: User` | `TokenPair` | JWT アクセストークン + リフレッシュトークン発行 |
| `register` | `dto: RegisterDto` | `User` | ユーザー作成 + Profile 自動作成 + トークン発行 |
| `refreshTokens` | `userId, refreshToken` | `TokenPair` | リフレッシュトークンで新しいトークンペア発行 |
| `logout` | `userId` | `void` | リフレッシュトークン無効化 |
| `getProfile` | `userId` | `AuthUser` | 現在のユーザー情報（ロール含む） |

### Passport Strategy

#### JwtStrategy

```typescript
// strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: { select: { tenantId: true, role: true } },
        profile: { select: { displayName: true, avatarUrl: true } },
      },
    });

    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? user.email,
      tenantIds: [...new Set(user.userRoles.map((r) => r.tenantId))],
      roles: user.userRoles,
    };
  }
}
```

#### LocalStrategy

```typescript
// strategies/local.strategy.ts
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
```

### Token ペア

```typescript
// types/auth.types.ts
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface JwtPayload {
  sub: string;       // user ID
  email: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  tenantIds: string[];
  roles: { tenantId: string; role: string }[];
}
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `JWT_SECRET` | JWT 署名シークレット | — (必須) |
| `JWT_EXPIRES_IN` | アクセストークン有効期限 | `15m` |
| `JWT_REFRESH_SECRET` | リフレッシュトークン署名シークレット | — (必須) |
| `JWT_REFRESH_EXPIRES_IN` | リフレッシュトークン有効期限 | `7d` |

### DTO 定義

```typescript
// login.dto.ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// register.dto.ts
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'パスワードは大文字・小文字・数字を各1文字以上含む必要があります',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;
}

// refresh-token.dto.ts
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

### @Public() デコレータ

```typescript
// decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### @CurrentUser() デコレータ

```typescript
// decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### Global Guard 設定

```typescript
// auth.module.ts
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    // Global Guard: 全エンドポイントに JWT 認証を適用
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## Angular 構成

### ファイル構成

```
apps/web/src/app/core/auth/
├── auth.service.ts
├── auth.interceptor.ts
├── auth.guard.ts
├── login/
│   ├── login.component.ts
│   └── login.component.html
├── register/
│   ├── register.component.ts
│   └── register.component.html
└── types/
    └── auth.types.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `LoginComponent` | Smart | ログインフォーム（email + password） |
| `RegisterComponent` | Smart | ユーザー登録フォーム |

### AuthService (Angular)

```typescript
// auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<AuthUser | null>(null);
  private accessToken = signal<string | null>(null);

  // 公開 Signal
  isAuthenticated = computed(() => !!this.currentUser());
  user = this.currentUser.asReadonly();

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  login(email: string, password: string): Observable<TokenPair> { ... }
  register(dto: RegisterDto): Observable<TokenPair> { ... }
  logout(): void { ... }
  refreshToken(): Observable<TokenPair> { ... }
  getAccessToken(): string | null { ... }

  private loadFromStorage(): void { ... }
  private storeTokens(tokens: TokenPair): void { ... }
  private clearTokens(): void { ... }
}
```

### AuthInterceptor

```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // トークン更新を試行、失敗時はログアウト
        return authService.refreshToken().pipe(
          switchMap(() => next(req)),
          catchError(() => {
            authService.logout();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
```

### authGuard (CanActivateFn)

```typescript
// auth.guard.ts
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
```

### ルーティング

```typescript
// app.routes.ts（抜粋）
export const APP_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // 認証が必要なルート
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes') },
      // ...
    ],
  },
];
```

---

## Supabase Auth からの移行マッピング

| 旧 (Supabase Auth) | 新 (Passport.js + JWT) |
|---|---|
| `supabase.auth.signInWithPassword()` | `POST /api/auth/login` |
| `supabase.auth.signUp()` | `POST /api/auth/register` |
| `supabase.auth.refreshSession()` | `POST /api/auth/refresh` |
| `supabase.auth.signOut()` | `POST /api/auth/logout` |
| `supabase.auth.getUser()` | `GET /api/auth/me` |
| `auth.users` テーブル | Prisma `User` モデル |
| GoTrue JWT | Passport.js JWT |
| Supabase Auth Middleware | NestJS `JwtAuthGuard` (Global) |
| `requireAuth()` (lib/auth.ts) | `@CurrentUser()` デコレータ |
| `requireRole()` | `@Roles()` デコレータ + `RolesGuard` |
| `hasRole()` | Angular `AuthService.user()` Signal で判定 |

---

## 依存関係

- **NestJS 内**: `PrismaModule`（DB アクセス）、`@nestjs/passport`、`@nestjs/jwt`
- **共有ライブラリ**: `libs/shared/types`（`AuthUser`, `TokenPair` 型）
- **外部依存**: `passport`, `passport-jwt`, `passport-local`, `bcrypt`
- **Angular**: `@angular/common/http`（`HttpInterceptorFn`）、Angular Signals
