---
title: ドキュメントモジュール設計 (DocumentModule)
description: プロジェクト配下のファイル管理（アップロード・ダウンロード・削除）の NestJS Module + Angular Feature 設計
---

## 概要

- **責務**: プロジェクト配下のドキュメントのアップロード・ダウンロード・削除、ストレージ連携
- **Epic**: REQ-F01（ドキュメント管理）
- **Prisma Models**: `Document`

> [!NOTE]
> ファイルアップロードは NestJS の `@UseInterceptors(FileInterceptor)` + multer で処理。
> ストレージはローカルファイル（開発）/ S3 互換（本番）を `StorageService` で抽象化して切替える。

---

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/documents/
├── documents.module.ts
├── documents.controller.ts
├── documents.service.ts
├── storage/
│   ├── storage.service.ts          # 抽象インターフェース
│   ├── local-storage.service.ts    # 開発用ローカルファイル
│   └── s3-storage.service.ts       # 本番用 S3 互換
├── constants/
│   └── mime-types.ts
├── dto/
│   └── upload-document.dto.ts
└── tests/
    └── documents.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/documents` | ドキュメント一覧取得 | `member`, `pm`, `tenant_admin` |
| `POST` | `/api/projects/:projectId/documents` | ドキュメントアップロード（multipart/form-data） | `member`, `pm`, `tenant_admin` |
| `GET` | `/api/projects/:projectId/documents/:id/download` | ドキュメントダウンロード（署名付き URL / ストリーム） | `member`, `pm`, `tenant_admin` |
| `DELETE` | `/api/projects/:projectId/documents/:id` | ドキュメント削除（Storage + DB 両方） | `pm`, `tenant_admin` |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll` | `tenantId, projectId` | `Document[]` | プロジェクト配下のドキュメント一覧 |
| `upload` | `tenantId, projectId, userId, file` | `Document` | ファイルアップロード（MIME 検証 + Storage 保存 + DB INSERT） |
| `getDownloadUrl` | `tenantId, id` | `{ url: string }` | 署名付きダウンロード URL 生成（有効期限 60 秒） |
| `remove` | `tenantId, id` | `void` | Storage ファイル + DB レコード削除 |

### ストレージ抽象化

```typescript
// storage/storage.service.ts
export abstract class StorageService {
  abstract upload(path: string, file: Buffer, contentType: string): Promise<void>;
  abstract download(path: string): Promise<Buffer>;
  abstract getSignedUrl(path: string, expiresIn: number): Promise<string>;
  abstract delete(path: string): Promise<void>;
}
```

### テナント分離パス

ストレージパスはテナント・プロジェクトで分離:

```
uploads/{tenantId}/{projectId}/{uuid}_{filename}
```

### MIME タイプ制限

```typescript
// constants/mime-types.ts
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### DTO 定義

```typescript
// upload-document.dto.ts
export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string; // 省略時はファイル名を使用
}
```

### アップロード処理フロー

```typescript
// documents.controller.ts
@Post()
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new BadRequestException('許可されていないファイル形式です'), false);
    }
    cb(null, true);
  },
}))
async upload(
  @Param('projectId') projectId: string,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UploadDocumentDto,
  @CurrentUser() user: AuthUser,
) {
  return this.documentsService.upload(user.tenantId, projectId, user.id, file);
}
```

### エラー時ロールバック

DB INSERT 失敗時は Storage ファイルを削除するロールバック処理を含む:

```typescript
// documents.service.ts - upload()
async upload(tenantId: string, projectId: string, userId: string, file: Express.Multer.File) {
  const storagePath = `uploads/${tenantId}/${projectId}/${uuid()}_${file.originalname}`;

  // 1. Storage にアップロード
  await this.storage.upload(storagePath, file.buffer, file.mimetype);

  try {
    // 2. DB にレコード作成
    return await this.prisma.document.create({
      data: {
        tenantId, projectId, uploadedBy: userId,
        name: file.originalname,
        filePath: storagePath,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
  } catch (error) {
    // 3. DB 失敗時は Storage を削除（ロールバック）
    await this.storage.delete(storagePath).catch(() => {});
    throw error;
  }
}
```

---

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/projects/documents/
├── document-list/
│   ├── document-list.component.ts
│   └── document-list.component.html
└── services/
    └── documents.service.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `DocumentListComponent` | Smart | ファイル一覧テーブル + アップロードボタン + ドラッグ&ドロップ |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getDocuments(projectId)` | `GET` | `/api/projects/:projectId/documents` | ドキュメント一覧取得 |
| `uploadDocument(projectId, file)` | `POST` | `/api/projects/:projectId/documents` | ファイルアップロード（`FormData`） |
| `getDownloadUrl(projectId, id)` | `GET` | `/api/projects/:projectId/documents/:id/download` | ダウンロード URL 取得 |
| `deleteDocument(projectId, id)` | `DELETE` | `/api/projects/:projectId/documents/:id` | ドキュメント削除 |

### ヘルパー関数

```typescript
// document-list.component.ts 内
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### ルーティング

ドキュメント管理はプロジェクト詳細のサブルートとして配置:

```typescript
// projects.routes.ts 内
{
  path: ':id/documents',
  component: DocumentListComponent,
}
```

---

## 依存関係

- **NestJS 内**: `PrismaModule`（DB アクセス）、`AuditLogModule`（監査ログ記録）、`StorageModule`（ファイルストレージ抽象化）
- **共有ライブラリ**: `libs/shared/constants`（`ALLOWED_MIME_TYPES`）
- **Guard**: `TenantGuard`（テナント分離）、`RolesGuard`（アップロード: `member` 以上、削除: `pm` 以上）
- **外部依存**: `multer`（ファイルアップロード）、`@aws-sdk/client-s3`（本番 S3 互換ストレージ）
