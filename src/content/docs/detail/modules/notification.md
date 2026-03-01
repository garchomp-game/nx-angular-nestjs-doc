---
title: 通知モジュール設計
description: 通知の表示・既読管理・一括既読・削除を担うモジュールの詳細設計（通知一覧ページ含む）
---

## 概要
- **責務**: 通知の表示・既読管理・一括既読・削除・他モジュールからの通知作成受付
- **Epic**: 通知機能
- **Prisma Models**: `Notification`

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/notification/
├── notification.controller.ts
├── notification.service.ts
├── notification.module.ts
├── dto/
│   └── notification-query.dto.ts
└── notification.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/notifications` | 通知一覧取得（ページネーション対応） | `member` 以上（本人データのみ） |
| `GET` | `/api/notifications/unread-count` | 未読件数取得 | `member` 以上（本人データのみ） |
| `PATCH` | `/api/notifications/:id/read` | 個別既読化 | `member` 以上（本人データのみ） |
| `PATCH` | `/api/notifications/read-all` | 一括既読化 | `member` 以上（本人データのみ） |
| `DELETE` | `/api/notifications/:id` | 個別通知削除 | `member` 以上（本人データのみ） |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll(tenantId, userId, query)` | テナントID, ユーザーID, ページネーション | `{ data: Notification[], total: number }` | 通知一覧取得（新着順、is_read フィルタ可） |
| `getUnreadCount(tenantId, userId)` | テナントID, ユーザーID | `number` | 未読通知件数 |
| `markAsRead(tenantId, userId, id)` | テナントID, ユーザーID, 通知ID | `Notification` | 個別既読化 |
| `markAllAsRead(tenantId, userId)` | テナントID, ユーザーID | `{ count: number }` | 一括既読化（updateMany） |
| `remove(tenantId, userId, id)` | テナントID, ユーザーID, 通知ID | `void` | 個別通知削除（本人のみ） |
| `create(input)` | 通知作成パラメータ | `Notification` | 通知レコード作成（他モジュールから呼出） |
| `getNotificationLink(resourceType, resourceId)` | リソース種別, リソースID | `string \| null` | リソースからリンク先 URL を生成 |

> [!NOTE] 通知作成の呼出元
> `NotificationService.create()` は他モジュールの Service から直接 inject して呼び出す。
> 旧 `createNotification()` ヘルパーに相当。

### 通知リンク生成ルール

| `resourceType` | 生成されるリンク |
|---|---|
| `workflow` | `/workflows/{resourceId}` |
| `project` | `/projects/{resourceId}` |
| `task` | `/projects`（PJ 配下のため一覧へ） |
| `expense` | `/expenses` |
| その他 / null | `null` |

### DTO 定義

```typescript
// notification-query.dto.ts
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## Angular 構成

### ファイル構成

```
apps/web/src/app/
├── shared/notification-bell/
│   ├── notification-bell.component.ts
│   ├── notification-bell.component.html
│   ├── notification-bell.component.css
│   ├── notification.service.ts
│   └── notification.model.ts
└── features/notifications/
    ├── notification-list.component.ts
    └── notifications.routes.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `NotificationBellComponent` | Presentational / 共有 | ヘッダー通知ベル（バッジ + ドロップダウン一覧 + 既読/一括既読） |
| `NotificationListComponent` | Smart / ページ | 通知一覧ページ（フィルタ・ページネーション・既読/削除操作） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getAll(query?)` | `GET` | `/api/notifications` | 通知一覧取得 |
| `getUnreadCount()` | `GET` | `/api/notifications/unread-count` | 未読件数取得 |
| `markAsRead(id)` | `PATCH` | `/api/notifications/:id/read` | 個別既読化 |
| `markAllAsRead()` | `PATCH` | `/api/notifications/read-all` | 一括既読化 |
| `delete(id)` | `DELETE` | `/api/notifications/:id` | 個別通知削除 |
| `loadNotificationsPage(page, limit, unreadOnly?)` | `GET` | `/api/notifications` | ページネーション付き一覧取得 |
| `markAsReadAndUpdate(id)` | — | — | 既読化 + Signal 更新 |
| `markAllAsReadAndUpdate()` | — | — | 一括既読 + Signal 更新 |
| `deleteAndUpdate(id)` | — | — | 削除 + Signal 更新 |

### ポーリング戦略

```typescript
// notification.service.ts — 未読件数の定期取得
private pollInterval = 30_000; // 30秒ごと

startPolling(): Observable<number> {
  return timer(0, this.pollInterval).pipe(
    switchMap(() => this.getUnreadCount()),
    shareReplay(1)
  );
}
```

## 通知一覧ページ (`/notifications`)

`NotificationListComponent` はサイドメニューよりアクセスする専用ページの通知一覧。

### 使用 PrimeNG コンポーネント

| PrimeNG | 用途 |
|---|---|
| `Tag` | 未読バッジ表示 |
| `Paginator` | ページネーション |
| `ToggleButton` | 未読フィルター切り替え |
| `Button` | 既読/削除アクション |
| `ConfirmDialog` | 削除確認ダイアログ |
| `Toast` | 操作結果メッセージ |
| `ProgressSpinner` | ローディング表示 |

### ルーティング

```typescript
// notifications.routes.ts
export const NOTIFICATION_ROUTES: Routes = [
  { path: '', component: NotificationListComponent },
];
```

---

## 依存関係
- **NestJS内**: なし（他モジュールから inject される側）
- **共有ライブラリ**: `libs/shared/types`（通知タイプ定数）、`libs/shared/util`（`getNotificationLink()`）
- **被依存**: `WorkflowModule`, `ProjectModule` 等から `NotificationService.create()` を呼び出し
- **Angular UI**: PrimeNG（`Tag`, `Paginator`, `ToggleButton`, `Button`, `ConfirmDialog`, `Toast`）
