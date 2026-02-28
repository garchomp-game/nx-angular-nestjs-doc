---
title: 機能要件カタログ（REQ Catalog）
description: Epic単位で要件を管理し、受入条件を付与する
---

## 目的 / In-Out / Related
- **目的**: 機能要件の一覧・優先度・追跡性を確立する
- **対象範囲（In）**: 機能ごとの目的、ステークホルダー、受入条件
- **対象範囲（Out）**: UI/API の仕様細部（→ Spec）、実装方式（→ Detail）
- **Related**: [基本設計](../../spec/) / [ロール定義](../roles/) / [NFR](../nfr/)

---

## Epic A: テナント/組織/権限（Must）

> **NestJS Module**: `AdminModule` = `TenantsController` + `UsersController` + `AuditLogsController`

### REQ-A01 テナント管理
- **目的**: マルチテナント環境を提供し、組織ごとにデータを分離する
- **対象範囲（In）**: テナント作成・設定・メンバー招待
- **対象範囲（Out）**: 課金/プラン管理
- **優先度**: Must
- **ステークホルダー**: Tenant Admin, IT Admin
- **受入条件（Given/When/Then）**:
  - Given: IT Admin がログインしている
  - When: 新規テナントを作成する
  - Then: テナントが作成され、初期 Tenant Admin が設定される
- **NestJS 実装先**: `apps/api/src/modules/admin/tenants/`

### REQ-A02 ユーザー管理
- **目的**: テナント内のユーザーの追加・招待・無効化を行う
- **対象範囲（In）**: ユーザー招待（メール）、ロール付与、アカウント無効化
- **対象範囲（Out）**: SSO/SAML連携
- **優先度**: Must
- **ステークホルダー**: Tenant Admin
- **受入条件（Given/When/Then）**:
  - Given: Tenant Admin がテナントの設定画面を開いている
  - When: メールアドレスを入力してユーザーを招待する
  - Then: 招待メールが送信され、招待されたユーザーがサインアップ後にテナントに参加できる
- **NestJS 実装先**: `apps/api/src/modules/admin/users/`

### REQ-A03 ロール/権限管理
- **目的**: ユーザーにロールを付与し、機能アクセスを制御する
- **対象範囲（In）**: ロール付与/剥奪、権限マトリクスに基づくアクセス制御
- **対象範囲（Out）**: カスタムロール定義（固定ロールのみ）
- **優先度**: Must
- **ステークホルダー**: Tenant Admin, IT Admin
- **受入条件（Given/When/Then）**:
  - Given: Tenant Admin がユーザー詳細画面を開いている
  - When: ユーザーに「Approver」ロールを追加する
  - Then: そのユーザーが即座に承認権限を持ち、ワークフロー承認画面にアクセスできる
- **NestJS 実装先**: `apps/api/src/modules/admin/users/` (ロール操作は UserService に統合)

---

## Epic B: ワークフロー（Must）

> **NestJS Module**: `WorkflowModule` = `WorkflowsController` + `WorkflowsService`

### REQ-B01 申請作成
- **目的**: 各種業務申請（経費・休暇・購入等）を統一フォーマットで作成する
- **対象範囲（In）**: 申請フォーム作成、下書き保存、添付ファイル
- **対象範囲（Out）**: 申請テンプレートのカスタマイズ（将来）
- **優先度**: Must
- **ステークホルダー**: Member, PM, Accounting
- **受入条件（Given/When/Then）**:
  - Given: Member がワークフロー画面を開いている
  - When: 申請種別を選択し、必要事項を入力して送信する
  - Then: 申請が作成され、指定された承認者に通知が送信される

### REQ-B02 承認/差戻し
- **目的**: 承認者が申請を確認し、承認または差戻しする
- **対象範囲（In）**: 承認、差戻し（理由付き）、一括承認
- **対象範囲（Out）**: 多段階承認（将来検討）
- **優先度**: Must
- **ステークホルダー**: Approver, Tenant Admin
- **受入条件（Given/When/Then）**:
  - Given: Approver に未承認の申請が存在する
  - When: 申請を開き「承認」を押す
  - Then: 申請ステータスが「承認済」に変わり、申請者に通知される。監査ログに記録される

### REQ-B03 申請履歴/ステータス追跡
- **目的**: 申請のステータスを申請者・承認者が追跡できる
- **優先度**: Must
- **ステークホルダー**: Member, Approver, PM

---

## Epic C: 案件/タスク/工数（Must）

> **NestJS Module**: `ProjectModule` = `ProjectsController` + `TasksController`  
> **NestJS Module**: `TimesheetModule` = `TimesheetsController`

### REQ-C01 プロジェクト管理
- **目的**: 案件を作成し、基本情報・期間・メンバーを管理する
- **対象範囲（In）**: プロジェクトCRUD、メンバーアサイン、ステータス管理
- **優先度**: Must
- **ステークホルダー**: PM, Tenant Admin
- **受入条件（Given/When/Then）**:
  - Given: PM がプロジェクト一覧画面を開いている
  - When: 新規プロジェクトを作成し、メンバーをアサインする
  - Then: プロジェクトが作成され、アサインされたメンバーがそのプロジェクトのタスク/工数を操作できる

### REQ-C02 タスク管理
- **目的**: プロジェクト配下のタスクを管理し、進捗を追跡する
- **対象範囲（In）**: タスクCRUD、担当者割当、ステータス、期限
- **優先度**: Must
- **ステークホルダー**: PM, Member

### REQ-C03 工数入力/集計
- **目的**: メンバーの作業時間をタスク単位で記録し、集計する
- **対象範囲（In）**: 日次工数入力、週次/月次集計、プロジェクト別集計、CSVエクスポート
- **優先度**: Must
- **ステークホルダー**: Member, PM

---

## Epic D: 経費（Should）

> **NestJS Module**: `ExpenseModule` = `ExpensesController` + `ExpenseSummaryController`

### REQ-D01 経費申請
- **目的**: 業務経費の申請を行う
- **対象範囲（In）**: 経費入力、領収書添付、プロジェクト紐付け
- **優先度**: Should
- **ステークホルダー**: Member, PM

### REQ-D02 経費集計/レポート
- **目的**: 経費をプロジェクト別・科目別・月別に集計する
- **優先度**: Should
- **ステークホルダー**: Accounting, PM

---

## Epic E: 請求（Should）

> **NestJS Module**: `InvoiceModule` = `InvoicesController` + `InvoiceItemsService`

### REQ-E01 請求書管理
- **目的**: 取引先への請求書を作成・管理する
- **対象範囲（In）**: 請求書CRUD、ステータス管理（下書き/送付済/入金済）、PDF出力
- **優先度**: Should
- **ステークホルダー**: Accounting, PM

---

## Epic F: ドキュメント（Could）

> **NestJS Module**: `DocumentModule` = `DocumentsController` + multer ファイルアップロード

### REQ-F01 ドキュメント管理
- **目的**: プロジェクトに紐づくドキュメントをアップロード/共有する
- **対象範囲（In）**: ファイルアップロード、フォルダ構造、アクセス権限
- **対象範囲（Out）**: オンラインエディタ、バージョン管理
- **優先度**: Could
- **ステークホルダー**: Member, PM

---

## Epic G: 通知/検索/レポート（Could）

> **NestJS Module**: `NotificationModule`, `SearchModule`, `DashboardModule`

### REQ-G01 通知
- **目的**: ワークフローイベントや期限アラートをユーザーに通知する
- **対象範囲（In）**: アプリ内通知、メール通知
- **対象範囲（Out）**: Slack/Teams連携
- **優先度**: Could

### REQ-G02 全文検索
- **目的**: 申請・プロジェクト・ドキュメント横断で検索する
- **優先度**: Could

### REQ-G03 ダッシュボード/レポート
- **目的**: KPI（工数消化率、経費推移、申請リードタイム等）を可視化する
- **優先度**: Could
