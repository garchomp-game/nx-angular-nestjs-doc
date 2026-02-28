---
title: 請求書モジュール設計 (InvoiceModule)
description: 請求書 CRUD・ステータス遷移・採番・印刷プレビューの NestJS Module + Angular Feature 設計
---

## 概要

- **責務**: 請求書の CRUD、ステータス遷移（下書き → 送付済 → 入金済 / キャンセル）、印刷プレビュー、請求番号の並行安全な採番
- **Epic**: REQ-E01（請求一覧・詳細/編集）
- **Prisma Models**: `Invoice`, `InvoiceItem`

> [!NOTE]
> 請求書はヘッダー/明細の 2 テーブル構成。明細更新は全削除 → 再 INSERT パターンを `Prisma.$transaction` で実行する。
> 採番ロジックは旧 `next_invoice_number()` RPC を `InvoiceService.generateNumber()` に移行。

---

## NestJS 構成

### ファイル構成

```
apps/api/src/modules/invoices/
├── invoices.module.ts
├── invoices.controller.ts
├── invoices.service.ts
├── dto/
│   ├── create-invoice.dto.ts
│   ├── update-invoice.dto.ts
│   ├── update-invoice-status.dto.ts
│   └── invoice-item.dto.ts
├── constants/
│   └── invoice-status.ts
└── tests/
    └── invoices.controller.spec.ts
```

### Controller エンドポイント

| Method | Path | 説明 | 必要ロール |
|---|---|---|---|
| `GET` | `/api/invoices` | 請求書一覧取得（ページネーション + フィルタ） | `pm`, `accounting`, `tenant_admin` |
| `GET` | `/api/invoices/:id` | 請求書詳細取得（明細含む） | `pm`, `accounting`, `tenant_admin` |
| `POST` | `/api/invoices` | 請求書作成（採番 + 明細一括作成） | `pm`, `accounting`, `tenant_admin` |
| `PATCH` | `/api/invoices/:id` | 請求書更新（ヘッダー + 明細全置換） | `pm`, `accounting`, `tenant_admin` |
| `PATCH` | `/api/invoices/:id/status` | ステータス変更（遷移ルール検証） | `pm`, `accounting`, `tenant_admin` |
| `DELETE` | `/api/invoices/:id` | 請求書削除（`draft` のみ） | `pm`, `accounting`, `tenant_admin` |

### Service メソッド

| メソッド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `findAll` | `tenantId, query` | `PaginatedResult<Invoice>` | 一覧取得（フィルタ + ページネーション） |
| `findOne` | `tenantId, id` | `Invoice & { items: InvoiceItem[] }` | 詳細取得（明細含む） |
| `create` | `tenantId, userId, dto` | `Invoice` | 作成（`$transaction` で採番 + ヘッダー + 明細） |
| `update` | `tenantId, id, dto` | `Invoice` | 更新（`$transaction` でヘッダー更新 + 明細全削除→再INSERT） |
| `updateStatus` | `tenantId, id, dto` | `Invoice` | ステータス遷移（`INVOICE_STATUS_TRANSITIONS` で検証） |
| `remove` | `tenantId, id` | `void` | 削除（`draft` ステータスのみ許可） |
| `generateNumber` | `tenantId` | `string` | 採番（`SELECT FOR UPDATE` で `tenants.invoice_seq` をロック） |

### 採番ロジック

```typescript
// invoices.service.ts - generateNumber()
async generateNumber(tenantId: string): Promise<string> {
  return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { invoiceSeq: true },
    });
    // Prisma の $transaction 内で排他ロック相当の処理
    const nextSeq = tenant.invoiceSeq + 1;
    await tx.tenant.update({
      where: { id: tenantId },
      data: { invoiceSeq: nextSeq },
    });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
  });
}
```

### ステータス遷移ルール

```typescript
// constants/invoice-status.ts
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: '下書き',
  sent: '送付済',
  paid: '入金済',
  cancelled: 'キャンセル',
};
```

### DTO 定義

```typescript
// create-invoice.dto.ts
export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsDateString()
  issuedDate: string;

  @IsDateString()
  dueDate: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @ArrayMinSize(1)
  items: InvoiceItemDto[];
}

// invoice-item.dto.ts
export class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
```

### 明細更新パターン

```typescript
// invoices.service.ts - update() 内
await this.prisma.$transaction(async (tx) => {
  // 1. ヘッダー更新
  await tx.invoice.update({ where: { id }, data: headerData });

  // 2. 既存明細を全削除
  await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

  // 3. 新しい明細を一括 INSERT
  await tx.invoiceItem.createMany({
    data: dto.items.map((item, index) => ({
      tenantId,
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
      sortOrder: item.sortOrder ?? index,
    })),
  });

  // 4. 合計再計算
  const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.floor(subtotal * dto.taxRate / 100);
  await tx.invoice.update({
    where: { id },
    data: { subtotal, taxAmount, totalAmount: subtotal + taxAmount },
  });
});
```

---

## Angular 構成

### ファイル構成

```
apps/web/src/app/features/invoices/
├── invoices.routes.ts
├── invoice-list/
│   ├── invoice-list.component.ts
│   └── invoice-list.component.html
├── invoice-form/
│   ├── invoice-form.component.ts
│   └── invoice-form.component.html
├── invoice-detail/
│   ├── invoice-detail.component.ts
│   └── invoice-detail.component.html
├── invoice-print-view/
│   ├── invoice-print-view.component.ts
│   └── invoice-print-view.component.html
└── services/
    └── invoices.service.ts
```

### Component 一覧

| Component | 種別 | 概要 |
|---|---|---|
| `InvoiceListComponent` | Smart | 請求書一覧テーブル + ステータスフィルタ |
| `InvoiceFormComponent` | Smart | 請求書作成/編集フォーム + Editable Table（明細行追加/削除） |
| `InvoiceDetailComponent` | Smart | 請求書詳細表示 + ステータス変更ボタン |
| `InvoicePrintViewComponent` | Presentational | 印刷プレビュー（`@media print` スタイル対応） |

### Service メソッド (HttpClient)

| メソッド | HTTP | Path | 概要 |
|---|---|---|---|
| `getInvoices(filter)` | `GET` | `/api/invoices` | 請求書一覧取得 |
| `getInvoice(id)` | `GET` | `/api/invoices/:id` | 請求書詳細取得（明細含む） |
| `createInvoice(dto)` | `POST` | `/api/invoices` | 請求書作成 |
| `updateInvoice(id, dto)` | `PATCH` | `/api/invoices/:id` | 請求書更新 |
| `updateStatus(id, status)` | `PATCH` | `/api/invoices/:id/status` | ステータス変更 |
| `deleteInvoice(id)` | `DELETE` | `/api/invoices/:id` | 請求書削除 |

### ルーティング

```typescript
// invoices.routes.ts
export const INVOICE_ROUTES: Routes = [
  { path: '', component: InvoiceListComponent },
  { path: 'new', component: InvoiceFormComponent },
  { path: ':id', component: InvoiceDetailComponent },
  { path: ':id/edit', component: InvoiceFormComponent },
  { path: ':id/print', component: InvoicePrintViewComponent },
];
```

---

## 依存関係

- **NestJS 内**: `PrismaModule`（DB アクセス）、`AuditLogModule`（監査ログ記録）
- **共有ライブラリ**: `libs/shared/constants`（`INVOICE_STATUS_LABELS`, `INVOICE_STATUS_COLORS`, `INVOICE_STATUS_TRANSITIONS`）
- **Guard**: `TenantGuard`（テナント分離）、`RolesGuard`（`@Roles('pm', 'accounting', 'tenant_admin')` デコレータ）
