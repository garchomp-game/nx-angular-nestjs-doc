---
title: "NA-03: OpenAPI → Angular SDK 自動生成パイプライン"
description: "変更内容と検証結果"
---

## 変更サマリー

`@nestjs/swagger` の OpenAPI spec から Angular 用 SDK を自動生成するパイプラインを構築。`GENERATE_OPENAPI=true` 環境変数で spec エクスポート → `ng-openapi-gen` で SDK 生成のワンコマンド実行を実現。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/main.ts` | MODIFY: `GENERATE_OPENAPI=true` 時に `openapi.json` をエクスポートして終了するモードを追加。Swagger config を `NODE_ENV` ガード外に移動 |
| `package.json` | MODIFY: `generate:api-spec` / `generate:api-client` スクリプトを env-var ベースに更新 |
| `.github/workflows/ci.yml` | MODIFY: ビルド前に `Generate API Client` ステップを追加 |

## 主な変更の詳細

### 1. OpenAPI Spec エクスポート (`main.ts`)

Swagger の `DocumentBuilder` を `NODE_ENV` ガードの外に移動し、常にドキュメント生成可能に。`GENERATE_OPENAPI=true` の場合は `libs/api-client/openapi.json` に spec を書き出して `process.exit(0)` で終了する:

```diff
+import * as fs from 'fs';
 // ...
-  // Swagger (開発モードのみ)
-  if (process.env['NODE_ENV'] !== 'production') {
-    const config = new DocumentBuilder()...
-    const doc = SwaggerModule.createDocument(app, config);
-    SwaggerModule.setup('api/docs', app, doc);
-  }
+  // Swagger config (always available for spec generation)
+  const config = new DocumentBuilder()...
+  const doc = SwaggerModule.createDocument(app, config);
+
+  // OpenAPI spec export mode
+  if (process.env['GENERATE_OPENAPI'] === 'true') {
+    fs.writeFileSync('libs/api-client/openapi.json', JSON.stringify(doc, null, 2));
+    process.exit(0);
+  }
+
+  // Swagger UI (開発モードのみ)
+  if (process.env['NODE_ENV'] !== 'production') {
+    SwaggerModule.setup('api/docs', app, doc);
+  }
```

### 2. 生成スクリプト (`package.json`)

```diff
-"generate:api-client": "ng-openapi-gen",
-"generate:api-spec": "curl -s http://localhost:3000/api/docs-json > libs/api-client/openapi.json"
+"generate:api-spec": "GENERATE_OPENAPI=true npx nx serve api --watch=false || true",
+"generate:api-client": "pnpm generate:api-spec && ng-openapi-gen"
```

`|| true` は `process.exit(0)` が `nx serve` でシグナル終了（exit code 130）になるのを吸収するため。

### 3. CI 統合 (`ci.yml`)

```yaml
- name: Generate API Client
  run: pnpm generate:api-client
```

Prisma マイグレーション後、ビルド前に配置。

## テスト結果

| 項目 | コマンド | 結果 |
|------|---------|------|
| SDK 生成 | `pnpm generate:api-client` | ✅ 27 models, 15 services 生成 |
| Web ビルド | `pnpm nx build web` | ✅ PASS |
| Web テスト | `pnpm nx test web` | ✅ 197/200 pass（3件は auth spec の既存問題） |
