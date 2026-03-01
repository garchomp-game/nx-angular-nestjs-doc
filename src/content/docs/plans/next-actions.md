---
title: ネクストアクション計画
description: Phase 7-8 完了後の短期・中長期ネクストアクション
---

## 概要

Phase 7-8 の 7 チケット完了後に特定された改善項目一覧。

---

## 短期（次スプリント）

### NA-01: 認証エンドポイントのレート制限見直し

| 項目 | 内容 |
|------|------|
| 優先度 | **高** |
| 背景 | TI-E2E-01 で `ThrottlerException: 429` が E2E テスト失敗の直接原因と判明。現在は `THROTTLE_SKIP=true` で回避しているが、本番の認証エンドポイントにも適切な制限が必要 |
| 現状 | Global Guard で `short: 1s/3req`, `medium: 10s/20req`, `long: 1min/100req` |

#### 対応内容

- `AuthController` に `@SkipThrottle()` を適用し、グローバルスロットルから除外
- `POST /api/auth/login` に個別制限を設定: `@Throttle({ login: { ttl: 60_000, limit: 10 } })`
- `POST /api/auth/forgot-password` に個別制限: `@Throttle({ forgot: { ttl: 60_000, limit: 3 } })`
- `GET /api/auth/me`, `POST /api/auth/refresh` はスロットル除外（内部トークン更新のため）

#### 完了条件

- [ ] `AuthController` に適切なレート制限設定
- [ ] E2E テストが `THROTTLE_SKIP` なしでも PASS（`retries: 0`）
- [ ] ユニットテスト追加: レート制限超過時に 429 を返すこと

---

### NA-02: バンドルサイズ最適化

| 項目 | 内容 |
|------|------|
| 優先度 | **中** |
| 背景 | TI-DOC-02 で `WARNING: bundle initial exceeded maximum budget by 27.51 kB` が報告 |

#### 対応内容

- `ng build --stats-json` でバンドル分析
- PrimeNG の未使用コンポーネント import をチェック（tree-shaking 確認）
- 遅延ロード（`loadComponent` / `loadChildren`）が全 feature module に適用されているか確認
- 必要に応じて `budgets` の `maximumWarning` 閾値を見直し

#### 完了条件

- [ ] バンドル分析レポート作成
- [ ] 不必要な import 削除
- [ ] WARNING 解消 or 閾値調整

---

## 中長期

### NA-03: OpenAPI → Angular SDK 自動生成パイプライン

| 項目 | 内容 |
|------|------|
| 優先度 | **中** |
| 背景 | TI-DOC-01 で Swagger/OpenAPI 設定が確認済み。手動の `HttpClient` 呼び出しを型安全な生成コードに置き換えたい |

#### 対応内容

- `@nestjs/swagger` の OpenAPI JSON エクスポート設定（`openapi.json`）
- `openapi-generator-cli` で `typescript-angular` クライアント生成
- `libs/api-client/` に生成コードを配置
- `pnpm generate:api-client` スクリプト追加
- CI で spec 変更時に自動再生成

#### 参照

- [ADR-0009](../adr/decisions/) — レート制限設計
- 別会話「OpenAPI Client Auto-Generation」で初期設計済み

---

### NA-04: admin 子ルートの個別 roleGuard 分離

| 項目 | 内容 |
|------|------|
| 優先度 | **低** |
| 背景 | TI-DOC-01 で `it_admin` がフロント `/admin` にはアクセスできるが、API `admin/users` は `tenant_admin` のみの不整合を発見。意図的に API 側を維持する方針 |

#### 対応内容

- `/admin` の子ルートごとに個別の `data.roles` を設定:
  - `/admin/users` — `['tenant_admin']` のみ
  - `/admin/audit-logs` — `['tenant_admin', 'it_admin']`
  - `/admin/tenant` — `['tenant_admin']`
- `roleGuard` で Toast 通知 → `/dashboard` リダイレクト（TI-DOC-02 で実装済み）を活用

---

### NA-05: visibilitychange でのトークン有効性チェック

| 項目 | 内容 |
|------|------|
| 優先度 | **低** |
| 背景 | TI-E2E-03 で将来対応として記録。ユーザーがタブを非表示にしている間にトークンが失効した場合、タブ復帰時にサイレント logout されない |

#### 対応内容

```typescript
// auth.service.ts に追加
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && this.isAuthenticated()) {
        this.refreshToken().subscribe({
            error: () => this.logout(),
        });
    }
});
```

---

### NA-06: BroadcastChannel での複数タブ logout 同期

| 項目 | 内容 |
|------|------|
| 優先度 | **低** |
| 背景 | TI-E2E-03 で記録。sessionStorage はタブごとのため、一方のタブで logout しても他タブに伝播しない |

#### 対応内容

- `BroadcastChannel` API を使用してタブ間でログアウトイベントを共有
- 受信側は `clearState()` → `/login` にリダイレクト
