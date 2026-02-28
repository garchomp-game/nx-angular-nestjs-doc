# T2-7: 画面仕様 一括移行

## タスク概要
OpsHub の画面仕様（SCR-001 ~ SCR-H02, 22ファイル）を Angular + Angular Material 版に移行する。全画面を1つの統合ドキュメントとして作成する。

## 入力ファイル（参照元）
- **元ドキュメント群**: `/home/garchomp-game/workspace/starlight-test/opsHub-doc/src/content/docs/spec/screens/`
  - SCR-001 (ログイン), SCR-002 (ダッシュボード)
  - SCR-A01~A03 (テナント/ユーザー/監査ログ)
  - SCR-B01~B03 (ワークフロー)
  - SCR-C01-1, C01-2, C02, C03-1, C03-2 (プロジェクト/タスク/工数)
  - SCR-D01, D03 (経費)
  - SCR-E01 (通知)
  - SCR-F01 (ドキュメント)
  - SCR-G02 (検索)
  - SCR-H01, H02 (請求)
- **画面一覧**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/requirements/screens.md`（移行済み、参照のみ）

## 出力ファイル
- **作成先**: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/spec/screens.md`

（1つの統合ドキュメントにまとめる。元が22ファイルに分かれていたが、サイドバー管理の簡素化のためまとめる）

## 移行ルール

### UI技術の変換
| 旧 (Next.js + Ant Design) | 新 (Angular + Material) |
|---|---|
| `<Table>` (Ant Design) | `<mat-table>` |
| `<Form>` + `Form.useForm()` | Angular Reactive Forms (`FormGroup`) |
| `<Modal>` | `MatDialog` |
| `<Button type="primary">` | `<button mat-raised-button color="primary">` |
| `<Select>` | `<mat-select>` |
| `<DatePicker>` | `<mat-datepicker>` |
| `<Card>` | `<mat-card>` |
| `<Tabs>` | `<mat-tab-group>` |
| `<Menu>` / `<Dropdown>` | `<mat-menu>` |
| `<Tag>` / `<Badge>` | `<mat-chip>` / `matBadge` |
| `<Drawer>` | `<mat-sidenav>` |
| `<message.success()>` | `MatSnackBar` |
| `<notification.info()>` | `MatSnackBar` |
| `useTransition` | Angular Signal + `async` pipe |
| `revalidatePath()` | Component の `loadData()` 再呼出 |
| Server Component (データ取得) | Angular Component + Service (HttpClient) |
| Client Component (インタラクション) | Angular Component (同一) |

### 各画面の構成
```markdown
### SCR-XXX: {画面名}

- **Angular Route**: `/xxx`
- **Component**: `XxxComponent` (Standalone)
- **Service**: `XxxService`
- **必要ロール**: `@Roles('...')`
- **対応API**: `GET /api/xxx`, `POST /api/xxx`

#### 画面構成
(テーブル、フォーム、ボタン等のAngular Material部品)

#### 操作フロー
1. ...
2. ...

#### 表示項目
| 項目 | 型 | 備考 |
```

## frontmatter
```yaml
---
title: 画面仕様
description: 全画面の Angular + Angular Material による UI 設計
---
```

## 注意事項
- SC/CC の区分は不要（Angular は単一コンポーネントモデル）
- `data-testid` 属性は Playwright E2E テスト向けに維持
- レスポンシブ対応は Angular Material Breakpoints を使用
- 元文書に記載されている Ant Design 固有の props は Angular Material 相当に変換
