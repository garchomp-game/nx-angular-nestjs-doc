---
title: 状態遷移 / シーケンス
description: 主要業務フローの状態遷移図とシーケンス図（NestJS + Prisma 版）
---

## 目的 / In-Out

- **目的**: 複雑な状態遷移とコンポーネント間のやり取りを可視化する
- **対象範囲（In）**: ワークフロー、プロジェクト、タスク、請求書、ユーザーの状態遷移、主要操作のシーケンス
- **対象範囲（Out）**: 全画面のシーケンス（過剰にしない）

---

## 状態遷移ルール

システム内で定義される主な状態遷移は以下の通りです。これらの定数はフロントエンドとバックエンドの境界をまたいで共有されるため、`libs/shared/types` ディレクトリで管理します。

### ワークフロー状態遷移

```mermaid
stateDiagram-v2
    [*] --> draft : 作成

    draft --> submitted : 送信
    draft --> draft : 編集・保存

    submitted --> approved : 承認
    submitted --> rejected : 差戻し
    submitted --> withdrawn : 取下げ

    rejected --> submitted : 再申請
    rejected --> withdrawn : 取下げ

    approved --> [*]
    withdrawn --> [*]
```

### プロジェクト状態遷移

```mermaid
stateDiagram-v2
    [*] --> planning : 作成
    planning --> active : 開始
    active --> completed : 完了
    active --> cancelled : 中止
    planning --> cancelled : 中止
    completed --> [*]
    cancelled --> [*]
```

### タスク状態遷移

```mermaid
stateDiagram-v2
    [*] --> todo : 作成
    todo --> in_progress : 着手
    in_progress --> todo : 差戻し
    in_progress --> done : 完了
    done --> in_progress : 再開
```

### 請求書ステータス遷移

```mermaid
stateDiagram-v2
    [*] --> draft : 作成

    draft --> sent : 送付
    draft --> cancelled : キャンセル

    sent --> paid : 入金確認
    sent --> cancelled : キャンセル

    paid --> [*]
    cancelled --> [*]
```

### ユーザーステータス遷移

```mermaid
stateDiagram-v2
    [*] --> invited : 招待
    invited --> active : ログイン完了 / アクティブ化
    active --> inactive : 無効化
    inactive --> active : 再有効化
    invited --> inactive : 無効化
    inactive --> [*]
```

---

## 主要シーケンス図

以下では、Angular Component、Angular Service (HttpClient)、NestJS Controller、NestJS Service、PrismaService、Database 間の処理フローを示します。

> [!NOTE]
> - 監査ログの記録は NestJS の `AuditInterceptor` を用いてコントローラー・サービスを跨いで自動化されます
> - 通知の作成は NestJS Service レイヤー内で同期的に呼び出されます

### シーケンス: ワークフロー申請→承認フロー (最重要)

```mermaid
sequenceDiagram
    actor M as Member
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS Service
    participant AI as AuditInterceptor
    participant PS as PrismaService
    participant DB as Database

    M->>UI: フォーム入力して申請
    UI->>AS: submitWorkflow(formData)
    AS->>NC: POST /workflows { data }
    NC->>NS: submit(data)
    NS->>PS: workflows.create(...)
    PS->>DB: INSERT workflows (status=submitted)
    DB-->>PS: 戻り値
    PS-->>NS: 戻り値
    NS->>NS: NotificationService.create()
    NS-->>NC: 戻り値
    NC-->>AI: intercept()
    AI->>PS: audit_logs.create(workflow.submit)
    PS->>DB: INSERT audit_logs
    AI-->>NC: 
    NC-->>AS: 201 Created
    AS-->>UI: Signal 更新
    UI-->>M: トースト + 一覧へ遷移

    actor A as Approver
    A->>UI: 申請を開く
    UI->>AS: getWorkflow(id)
    AS->>NC: GET /workflows/:id
    NC->>NS: findOne(id)
    NS->>PS: workflows.findUnique(...)
    PS->>DB: SELECT
    DB-->>PS: データ
    PS-->>NS: 
    NS-->>NC: 
    NC-->>AS: 200 OK
    AS-->>UI: Signal 更新
    UI-->>A: 画面表示

    A->>UI: 「承認」ボタン押下
    UI->>AS: approveWorkflow(id)
    AS->>NC: POST /workflows/:id/approve
    NC->>NS: approve(id)
    NS->>NS: approver_id = currentUserId 検証
    NS->>PS: workflows.update(status=approved)
    PS->>DB: UPDATE
    DB-->>PS: 
    PS-->>NS: 
    NS->>NS: NotificationService.create()
    NS-->>NC: 
    NC-->>AI: intercept()
    AI->>PS: audit_logs.create(workflow.approve)
    PS->>DB: INSERT audit_logs
    AI-->>NC: 
    NC-->>AS: 200 OK
    AS-->>UI: Signal 更新
    UI-->>A: トースト + 一覧へ遷移
```

### シーケンス: プロジェクト作成→メンバーアサイン

```mermaid
sequenceDiagram
    actor M as PM
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS Service
    participant AI as AuditInterceptor
    participant PS as PrismaService

    M->>UI: プロジェクト情報入力
    UI->>AS: createProject(data)
    AS->>NC: POST /projects { data }
    NC->>NS: create(data)
    NS->>PS: $transaction()
    PS->>PS: projects.create()
    PS->>PS: project_members.createMany()
    PS-->>NS: result
    NS-->>NC: result
    NC-->>AI: intercept()
    AI->>PS: audit_logs.create(project.create)
    AI-->>NC: 
    NC-->>AS: 201 Created
    AS-->>UI: Signal 更新
    UI-->>M: 詳細画面へ遷移
```

### シーケンス: 工数入力→週次保存

```mermaid
sequenceDiagram
    actor M as Member
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS Service
    participant AI as AuditInterceptor
    participant PS as PrismaService

    M->>UI: 週表示
    UI->>AS: getWeeklyTimesheet(week)
    AS->>NC: GET /timesheets?week=...
    NC->>NS: findWeekly(...)
    NS->>PS: timesheets.findMany()
    PS-->>NS: data
    NS-->>NC: data
    NC-->>AS: data
    AS-->>UI: Signal 更新
    UI-->>M: グリッド表示

    M->>UI: セル編集 + 保存
    UI->>AS: upsertTimesheet(entries[])
    AS->>NC: PUT /timesheets/bulk
    NC->>NS: bulkUpsert(entries)
    NS->>NS: バリデーション（0-24h、0.25h単位）
    NS->>PS: $transaction()
    PS->>PS: timesheets.upsert(...) x N件
    PS-->>NS: result
    NS-->>NC: result
    NC-->>AI: intercept()
    AI->>PS: audit_logs.create(timesheet.update)
    AI-->>NC: 
    NC-->>AS: 200 OK
    AS-->>UI: Signal 更新
    UI-->>M: トースト「保存しました」
```

### シーケンス: 経費申請→ワークフロー連携

```mermaid
sequenceDiagram
    actor M as Member
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS ExpenseService
    participant PS as PrismaService

    M->>UI: 経費情報入力
    UI->>AS: createExpense(data)
    AS->>NC: POST /expenses
    NC->>NS: createWithWorkflow(data)
    NS->>PS: $transaction()
    PS->>PS: workflows.create(type=expense, status=submitted)
    PS->>PS: expenses.create(workflow_id=...)
    PS-->>NS: result
    NS-->>NC: result
    NC-->>AS: 201 Created
    AS-->>UI: Signal 更新
```

### シーケンス: 請求書作成→ステータス遷移

```mermaid
sequenceDiagram
    actor A as Accounting
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS Service
    participant PS as PrismaService

    A->>UI: 請求書作成
    UI->>AS: createInvoice(data)
    AS->>NC: POST /invoices
    NC->>NS: create(data)
    NS->>PS: $transaction()
    PS->>PS: invoices.create(status=draft)
    PS->>PS: invoice_items.createMany()
    PS-->>NS: result
    NS-->>NC: result
    NC-->>AS: 201 Created
    AS-->>UI: 一覧画面へ

    A->>UI: 「送付済」に変更
    UI->>AS: updateStatus(id, 'sent')
    AS->>NC: PATCH /invoices/:id/status
    NC->>NS: updateStatus(id, 'sent')
    NS->>NS: 状態遷移ルール検証 (draft -> sent)
    NS->>PS: invoices.update(status=sent)
    PS-->>NS: result
    NS-->>NC: result
    NC-->>AS: 200 OK
    AS-->>UI: Signal 更新
```

### シーケンス: ファイルアップロード

Multer を用いたファイルアップロードと Database, Object Storage への保存フローです。

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller (Multer)
    participant NS as NestJS DocumentService
    participant SS as StorageService
    participant PS as PrismaService

    U->>UI: ファイル選択 (最大サイズの制限)
    UI->>AS: uploadFile(formData)
    AS->>NC: POST /documents/upload
    NC->>NC: FileInterceptor (Multer)
    NC->>NS: upload(file, projectId)
    NS->>SS: uploadFileToStorage(file buffer)
    SS-->>NS: storage path URL
    NS->>PS: documents.create(...)
    PS-->>NS: document record
    NS-->>NC: result
    NC-->>AS: 201 Created
    AS-->>UI: Signal 更新
```

### シーケンス: 全文検索

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Angular Component
    participant AS as Angular Service
    participant NC as NestJS Controller
    participant NS as NestJS SearchService
    participant PS as PrismaService

    U->>UI: キーワード入力
    UI->>AS: search(query)
    AS->>NC: GET /search?q=query
    NC->>NS: searchAll(query)
    NS->>PS: Promise.all([
    PS->>PS:   workflows.findMany(search),
    PS->>PS:   projects.findMany(search),
    PS->>PS:   tasks.findMany(search),
    PS->>PS:   expenses.findMany(search)
    NS->>PS: ])
    PS-->>NS: 各テーブルの検索結果
    NS->>NS: 統合・正規化 (SearchResult 型)
    NS-->>NC: result
    NC-->>AS: 200 OK
    AS-->>UI: Signal 更新
    UI-->>U: ハイライト付き結果表示
```

---

## 状態遷移定数の配置ルール

すべての状態遷移ルールに関する定数定義は、フロントエンド (Angular) とバックエンド (NestJS) 間で型を共有できるよう共有ライブラリ内に定義します。

**配置先**: `libs/shared/types/src/lib/constants/transitions.ts`

```typescript
// libs/shared/types/src/lib/constants/transitions.ts
export const WORKFLOW_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected', 'withdrawn'],
  rejected: ['submitted', 'withdrawn'],
  approved: [],
  withdrawn: [],
} as const;

export const TASK_TRANSITIONS = {
  todo: ['in_progress'],
  in_progress: ['todo', 'done'],
  done: ['in_progress'],
} as const;

// ...その他 PROJECT_TRANSITIONS, INVOICE_STATUS_TRANSITIONS 等
```

この定数を、Angularのバリデーション・UI表示と、NestJS Serviceのビジネスロジック内での状態遷移チェックにおいて共有して使用します。
