# T2-8: API仕様 一括移行

## タスク概要
OpsHub の API仕様（Server Actions ベース, API-A01 ~ API-H01, 16ファイル）を NestJS REST Controller ベースの API 仕様に移行する。全 API を1つの統合ドキュメントとして作成する。

## 入力ファイル（参照元）
- **元ドキュメント群**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/spec/apis/`
  - API-A01~A02 (テナント/ユーザー管理)
  - API-B01~B03 (ワークフロー)
  - API-C01~C03 (プロジェクト/タスク/工数)
  - API-D01~D02 (経費)
  - API-E01 (通知)
  - API-F01 (ドキュメント)
  - API-G01 (全文検索)
  - API-H01 (請求)
- **補足参照**:
  - `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/spec/errors/index.md`（エラーコード）
  - `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/spec/audit-logging/index.md`（監査ログ方針）
  - `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/spec/authz.md`（移行済み認可仕様）

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/spec/apis.md`

## 移行ルール

### API呼出方式の変換
| 旧 (Server Actions) | 新 (REST API) |
|---|---|
| `export async function createProject(input)` | `POST /api/projects` |
| `export async function getProjects()` | `GET /api/projects` |
| `export async function updateProject(id, input)` | `PUT /api/projects/:id` |
| `export async function deleteProject(id)` | `DELETE /api/projects/:id` |
| `export async function approveWorkflow(id)` | `POST /api/workflows/:id/approve` |
| `export async function getExpenseSummary(filters)` | `GET /api/expenses/summary?category=...&month=...` |
| `withAuth()` ラッパー | `@UseGuards(JwtAuthGuard, RolesGuard)` |
| `requireRole(tenantId, roles)` | `@Roles('pm', 'tenant_admin')` |
| `ActionResult<T>` レスポンス | HTTP Status + JSON Body |

### レスポンス形式変換
```typescript
// 旧: ActionResult<T>
{ success: true, data: T }
{ success: false, error: { code: 'ERR-XXX', message: '...' } }

// 新: HTTP Status + NestJS Response
// 成功: 200/201 + JSON Body
// エラー: 400/401/403/404/409/500 + { statusCode, message, error }
```

### 各APIの構成
```markdown
### API-XXX: {API名}

**NestJS Controller**: `{Name}Controller`  
**Module**: `{Name}Module`

#### エンドポイント一覧
| Method | Path | 説明 | ロール | レスポンス |
|---|---|---|---|---|

#### リクエスト DTO
```typescript
class CreateXxxDto {
  @IsNotEmpty()
  @IsString()
  name: string;
  // ...
}
```

#### レスポンス例
```json
{
  "id": "uuid",
  "name": "...",
  "createdAt": "2026-..."
}
```

#### エラーコード
| HTTP | コード | 条件 |
|---|---|---|

#### 監査ログ
| 操作 | action | resourceType |
```

## frontmatter
```yaml
---
title: API仕様
description: 全 REST API の NestJS Controller 設計（エンドポイント・DTO・レスポンス・エラーコード）
---
```

## 注意事項
- 元の Server Action 関数名から RESTful エンドポイントパスを推定
- `class-validator` デコレータ付きの DTO 定義を含める
- エラーコード体系は元のものを維持（ERR-AUTH-xxx, ERR-WF-xxx 等）
- 監査ログ記録対象の操作を明記
- ページネーション: `GET` エンドポイントには `?page=1&limit=20` クエリパラムを標準装備
- フィルタ: ステータス、日付範囲、検索キーワード等のクエリパラム
