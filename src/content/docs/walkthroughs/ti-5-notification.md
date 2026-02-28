---
title: "TI-5: 通知モジュール ウォークスルー"
description: 通知モジュール（NestJS + Angular）の実装内容・テスト結果・設計ポイントのまとめ
---

## 概要

TI-5 では、アプリ内通知の表示・既読管理・他モジュールからの通知作成 API を実装した。

---

## 作成ファイル一覧

### NestJS Backend

```
apps/api/src/modules/notifications/
├── notification.module.ts            # Module (exports: NotificationService)
├── notification.controller.ts        # 4 endpoints
├── notification.service.ts           # create / findAll / getUnreadCount / markAsRead / markAllAsRead
├── dto/
│   └── notification-query.dto.ts     # unreadOnly, page, limit
├── notification.service.spec.ts      # Jest 12 test cases
└── notification.controller.spec.ts   # Jest 4 test cases
```

**変更ファイル**: `apps/api/src/app/app.module.ts` — `NotificationsModule` を imports に追加

### Angular Frontend

```
apps/web/src/app/shared/notification-bell/
├── notification-bell.component.ts    # Standalone Component (mat-menu dropdown)
├── notification-bell.component.html  # テンプレート (badge + dropdown + 既読/一括既読)
├── notification-bell.component.css   # スタイル
├── notification.service.ts           # Signal + HttpClient + 30秒ポーリング
├── notification.model.ts             # Notification / NotificationListResponse 型
├── notification.service.spec.ts      # Vitest HTTP テスト
└── notification-bell.component.spec.ts # Vitest Component テスト
```

---

## API エンドポイント

| Method | Path | 説明 | HTTP Status |
|---|---|---|---|
| `GET` | `/api/notifications` | 通知一覧取得（ページネーション対応） | 200 |
| `GET` | `/api/notifications/unread-count` | 未読件数取得 | 200 |
| `PATCH` | `/api/notifications/:id/read` | 個別既読化 | 204 |
| `PATCH` | `/api/notifications/read-all` | 一括既読化 | 204 |

全エンドポイントは `@CurrentUser()` で本人データのみアクセス。`@Roles()` 指定なし（全ロール許可）。

---

## 設計ポイント

### 1. exports による cross-module injection

```typescript
// notification.module.ts
@Module({
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService], // ← 他モジュールから inject 可能
})
export class NotificationsModule {}
```

他モジュール（Workflow, Project 等）が `NotificationsModule` を imports し、`NotificationService.create()` を呼び出して通知を作成する。

### 2. Non-fatal エラー設計

```typescript
async create(input: CreateNotificationInput): Promise<void> {
    try {
        await this.prisma.notification.create({ data: { ... } });
    } catch (error) {
        this.logger.error('Failed to create notification', error);
        // エラーをスローしない → 本体処理を阻害しない
    }
}
```

### 3. Signal ベースの Angular Service

```typescript
// notification.service.ts
private _unreadCount = signal(0);
readonly unreadCount = this._unreadCount.asReadonly();

startPolling(): void {
    this.pollSubscription = timer(0, 30_000).pipe(
        switchMap(() => this.getUnreadCount()),
    ).subscribe((res) => this._unreadCount.set(res.count));
}
```

### 4. 通知リンク生成

`@shared/util` の `getNotificationLink()` を利用:

| resourceType | リンク |
|---|---|
| `workflow` | `/workflows/{resourceId}` |
| `project` | `/projects/{resourceId}` |
| `task` | `/projects` |
| `expense` | `/expenses` |

---

## テスト結果

### NestJS (Jest)

| ファイル | テスト数 | 結果 |
|---|---|---|
| `notification.service.spec.ts` | 12 | ✅ PASS |
| `notification.controller.spec.ts` | 4 | ✅ PASS |

カバー範囲:
- 正常系: `findAll` (フィルタ/ページネーション), `getUnreadCount`, `markAsRead`, `markAllAsRead`, `create`, `getNotificationLink`
- 異常系: 存在しない通知 → `NotFoundException`, 他人の通知 → `NotFoundException`, 作成失敗 → non-fatal

### Angular (Vitest)

- `notification.service.spec.ts`: 全 HTTP メソッドのリクエスト/レスポンステスト
- `notification-bell.component.spec.ts`: コンポーネント作成、ポーリング開始、UI 操作テスト

> [!NOTE]
> Angular テスト実行（`nx test web`）は workflows モジュールの既存ビルドエラー（missing components）により全体実行不可。通知ファイル自体の TypeScript コンパイルは問題なし。
