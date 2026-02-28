# TI-6: 管理モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
テナント設定 + ユーザー管理（招待/ロール変更/無効化）+ 監査ログ閲覧を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/admin/`)
| ファイル | 内容 |
|---|---|
| `admin.module.ts` | AdminModule |
| `tenants.controller.ts` | GET/PATCH テナント設定 |
| `tenants.service.ts` | テナント CRUD |
| `users.controller.ts` | GET/POST(invite)/PATCH(role,status) |
| `users.service.ts` | 招待, ロール変更, ステータス変更 |
| `audit-logs.controller.ts` | GET (一覧, フィルタ) |
| `audit-logs.service.ts` | findAll (ページネーション) |
| `dto/` | InviteUserDto, ChangeRoleDto, QueryAuditLogDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/admin/`)
| ファイル | 内容 |
|---|---|
| `admin.routes.ts` | ADMIN_ROUTES (tenant, users, audit-logs) |
| `tenant-settings.component.ts` | テナント情報編集 |
| `user-management.component.ts` | ユーザー一覧 + 招待モーダル |
| `invite-dialog.component.ts` | ユーザー招待ダイアログ (MatDialog) |
| `audit-log-viewer.component.ts` | 監査ログ一覧 (フィルタ + ページネーション) |
| `admin.service.ts` | HttpClient + Signal |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **ロール制限**: 全 API に `@Roles('tenant_admin')` 必須
2. **ロール変更**: 自分自身のロールは変更不可
3. **監査ログ**: AuditLog テーブルは READ ONLY（Service で update/delete しない）
4. **ページネーション**: QueryAuditLogDto に page/limit + dateFrom/dateTo フィルタ
5. **エラーコード**: ERR-ADM-001 以降

## 参照ドキュメント
- `detail/modules/admin.md` — 全体
- `spec/apis.md` §API-A01〜A02
- `spec/screens.md` §SCR-A01〜A03
- `detail/db.md` — Tenant, UserRole, Profile, AuditLog モデル
