# T2-3: 状態遷移 / シーケンス移行

## タスク概要
OpsHub の状態遷移・シーケンス設計ドキュメントを NestJS Controller → Service → Prisma のレイヤーに対応した Mermaid 図に移行する。

## 入力ファイル（参照元）
- **元ドキュメント**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/sequences/index.md`
- **補足参照**:
  - `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/detail/modules/index.md`（状態遷移定数の定義あり）
  - `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/logs/knowledge.md`（状態遷移パターンの記載あり）

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/detail/sequences.md`

## 移行ルール

### シーケンス図の変換
| 旧 (Next.js + Supabase) | 新 (Nx + Angular + NestJS) |
|---|---|
| ブラウザ → Server Component | Angular Component → Angular Service (HttpClient) |
| Server Component → Supabase Client | — (NestJS 側処理) |
| Client Component → Server Action | Angular Component → NestJS Controller |
| Server Action → supabase.from().insert() | NestJS Controller → Service → PrismaService |
| revalidatePath() | Angular → HttpClient レスポンス → Signal 更新 |
| writeAuditLog() | NestJS AuditInterceptor (自動記録) |
| createNotification() | NestJS NotificationService (Service 内で呼出) |

### 構成

1. **状態遷移図** (Mermaid stateDiagram-v2)
   - ワークフロー: `draft → submitted → approved/rejected → withdrawn`
   - タスク: `todo → in_progress → done`
   - プロジェクト: `planning → active → completed/cancelled`
   - 請求書: `draft → sent → paid/cancelled`
   - ユーザー: `invited → active → inactive`

2. **主要シーケンス図** (Mermaid sequenceDiagram)
   以下のフローを Angular + NestJS レイヤーで再描画:
   - **ワークフロー申請→承認フロー** (最重要)
   - **プロジェクト作成→メンバーアサイン**
   - **工数入力→週次保存**
   - **経費申請→ワークフロー連携**
   - **請求書作成→ステータス遷移**
   - **ファイルアップロード** (multer → DB + Storage)
   - **全文検索** (Angular → NestJS → Prisma fulltext)

3. **状態遷移定数** (TypeScript)
   `libs/shared/types` に配置する定数定義を明記

## frontmatter
```yaml
---
title: 状態遷移 / シーケンス
description: 主要業務フローの状態遷移図とシーケンス図（NestJS + Prisma 版）
---
```

## 注意事項
- 全シーケンス図の participant は `Angular Component`, `Angular Service`, `NestJS Controller`, `NestJS Service`, `PrismaService`, `Database` の6レイヤー
- 監査ログ記録は NestJS Interceptor として自動化されるため、シーケンス図上は Interceptor として表現
- 通知作成は Service レイヤーで同期的に呼び出す（旧: createNotification() 関数呼出）
