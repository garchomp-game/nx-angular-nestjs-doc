# TI-5: 通知モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
アプリ内通知の表示・既読化 + NotificationBell コンポーネント + 他モジュールからの通知作成 API を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/notifications/`)
| ファイル | 内容 |
|---|---|
| `notifications.module.ts` | NotificationsModule (exports: NotificationsService) |
| `notifications.controller.ts` | GET (一覧), PATCH (既読), POST (全既読) |
| `notifications.service.ts` | create, findAll, markAsRead, markAllAsRead, getUnreadCount |
| `dto/` | QueryNotificationDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/shared/notification-bell/`)
| ファイル | 内容 |
|---|---|
| `notification-bell.component.ts` | ヘッダー内ベルアイコン + バッジ + ドロップダウン |
| `notification.service.ts` | HttpClient + Signal + ポーリング (30秒間隔) |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **exports**: `NotificationsService` を exports に含める → 他モジュールが inject 可能
2. **通知リンク**: `getNotificationLink()` (`@shared/util`) でリソースタイプからURLを生成
3. **ポーリング**: `interval(30000)` で未読数を定期取得
4. **既読化**: 通知クリック時に markAsRead + router.navigate(link)
5. **他モジュールからの呼び出し**: `NotificationsService.create(tenantId, { userId, title, resourceType, resourceId })`

## 参照ドキュメント
- `detail/modules/notification.md` — 全体
- `spec/apis.md` §API-E01
- `detail/db.md` — Notification モデル
