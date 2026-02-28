# TI-7: 請求書モジュール

> **作業開始前に `_common-rules.md` を必ず読むこと。**
> ワークスペース: `/home/garchomp-game/workspace/starlight-test/opshub/`
> ドキュメント: `/home/garchomp-game/workspace/starlight-test/nx-angular-nestjs-doc/src/content/docs/`


## 概要
請求書の CRUD + 自動採番 + 状態遷移 (draft→sent→paid/cancelled) + 印刷レイアウトを実装する。

## 実装対象

### NestJS (`apps/api/src/modules/invoices/`)
| ファイル | 内容 |
|---|---|
| `invoices.module.ts` | InvoicesModule |
| `invoices.controller.ts` | GET/POST/PATCH/DELETE + status change |
| `invoices.service.ts` | CRUD + 自動採番 + 状態遷移 + 金額計算 |
| `dto/` | CreateInvoiceDto, CreateInvoiceItemDto, QueryInvoiceDto |
| `*.spec.ts` | Service + Controller テスト |

### Angular (`apps/web/src/app/features/invoices/`)
| ファイル | 内容 |
|---|---|
| `invoices.routes.ts` | INVOICE_ROUTES |
| `invoice-list.component.ts` | 一覧 (mat-table, ステータスフィルタ) |
| `invoice-form.component.ts` | FormArray で明細行管理 |
| `invoice-detail.component.ts` | 詳細 + 状態変更ボタン |
| `invoice-print.component.ts` | 印刷用レイアウト (@media print) |
| `invoice.service.ts` | HttpClient + Signal |
| `*.spec.ts` | Service + Component テスト |

### 重要な実装ポイント
1. **自動採番**: INV-YYYYMM-NNN 形式。Service 内でカウント + format
2. **明細行**: FormArray + mat-table で動的行追加/削除
3. **金額計算**: `subtotal = Σ(quantity × unitPrice)`, `tax = subtotal × taxRate`, `total = subtotal + tax`
4. **税率**: `DEFAULT_TAX_RATE` (0.10) を `@shared/types` から参照
5. **状態遷移**: `INVOICE_TRANSITIONS` で制御
6. **印刷**: `@media print` CSS で印刷最適化

## 参照ドキュメント
- `detail/modules/invoice.md` — 全体
- `spec/apis.md` §API-H01
- `spec/screens.md` §SCR-H01〜H02
- `detail/db.md` — Invoice, InvoiceItem モデル
