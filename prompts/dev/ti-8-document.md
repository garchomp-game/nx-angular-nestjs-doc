# TI-8: ドキュメント管理モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
プロジェクトに紐づくファイルのアップロード/ダウンロード/削除を実装する。

## 実装対象

### NestJS (`apps/api/src/modules/documents/`)
| ファイル | 内容 |
|---|---|
| `documents.module.ts` | DocumentsModule (MulterModule 登録) |
| `documents.controller.ts` | POST(upload), GET(list/download), DELETE |
| `documents.service.ts` | upload, findByProject, download, delete |
| `dto/` | QueryDocumentDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/projects/documents/`)
| ファイル | 内容 |
|---|---|
| `document-list.component.ts` | ファイル一覧 + アップロードボタン + 削除 |
| `document.service.ts` | HttpClient (multipart/form-data) |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **Multer**: `MulterModule.register()` でファイルサイズ上限 + ストレージ設定
2. **MIMEバリデーション**: `ALLOWED_MIME_TYPES` (`@shared/types`) で許可タイプ制限
3. **ファイルサイズ**: `MAX_FILE_SIZE_BYTES` (10MB)
4. **formatFileSize()**: `@shared/util` を使用して画面表示
5. **プロジェクト紐づけ**: Document.projectId による所属管理
6. **ダウンロード**: `res.download()` でファイルをストリーミング返却

## 参照ドキュメント
- `detail/modules/document.md` — 全体
- `spec/apis.md` §API-F01
- `spec/screens.md` §SCR-F01
- `detail/db.md` — Document モデル
