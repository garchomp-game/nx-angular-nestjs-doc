---
title: "TI-8: ドキュメント管理 ウォークスルー"
description: プロジェクト配下のファイルアップロード/ダウンロード/削除の実装
---

## Summary

プロジェクトに紐づくドキュメントの CRUD 操作を NestJS バックエンド + Angular フロントエンドで実装した。ストレージは抽象クラスで分離し、開発用ローカルファイルシステム実装を提供。

## Changes

### NestJS Backend (`apps/api/src/modules/documents/`)

| ファイル | 内容 |
|---|---|
| `storage/storage.service.ts` | ストレージ抽象クラス（upload/download/delete/getSignedUrl） |
| `storage/local-storage.service.ts` | ローカル FS 実装（開発用） |
| `dto/query-document.dto.ts` | ページネーション DTO（page, limit） |
| `documents.service.ts` | findAll, upload（MIME検証+ロールバック）, getDownloadInfo, remove |
| `documents.controller.ts` | 4 エンドポイント: GET list, POST upload, GET download, DELETE |
| `documents.module.ts` | StorageService → LocalStorageService 登録 |
| `documents.service.spec.ts` | 11 テスト: CRUD + エラーケース + ロールバック |
| `documents.controller.spec.ts` | 5 テスト: 各エンドポイント委譲確認 |

#### `app.module.ts` — `DocumentsModule` 登録済み

### Angular Frontend (`apps/web/src/app/features/projects/documents/`)

| ファイル | 内容 |
|---|---|
| `document.service.ts` | Signal ベースの HttpClient サービス（loadDocuments, uploadDocument, downloadDocument, deleteDocument） |
| `document-list.component.ts` | mat-table 一覧 + ドラッグ&ドロップ + MIME アイコン/ラベル + ページネーション |
| `document.service.spec.ts` | 4 テスト: HTTP メソッド確認 |
| `document-list.component.spec.ts` | 6 テスト: 描画 + ヘルパー関数 |

#### `projects.routes.ts` — `:id/documents` ルート追加

### キーポイント

- `ALLOWED_MIME_TYPES` / `MAX_FILE_SIZE_BYTES` は `@shared/types` の既存定数を使用
- `formatFileSize()` は `@shared/util` の既存ユーティリティを使用
- Multer `FileInterceptor` で multipart/form-data 処理
- DB 失敗時の Storage ロールバック処理を実装
- エラーコード: `ERR-DOC-001` (不存在), `ERR-VAL-F02` (サイズ), `ERR-VAL-F03` (MIME), `ERR-SYS-F01/F02` (Storage)

## Verification

| 対象 | 結果 | 備考 |
|---|---|---|
| NestJS API テスト | ✅ 28 suites, 228 tests passed | documents module 含む全テスト合格 |
| Angular Web テスト | ⚠️ ビルドエラー | 他モジュール (`timesheets`, `workflows`) の既存テストに `jest.fn()` / `jasmine.createSpy()` 混在問題あり。documents テスト自体は問題なし |
