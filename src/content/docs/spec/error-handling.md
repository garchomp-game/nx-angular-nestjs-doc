---
title: 例外・エラー方針
description: NestJS + Angular における統一エラーハンドリング方針とコード体系
---

## 目的

エラー処理の一貫性を確保し、ユーザー体験とデバッグ容易性を両立する。
**全モジュール開発者が本方針に従ってエラー処理を実装すること。**

---

## エラー分類

| カテゴリ | HTTP | NestJS Exception | ユーザー表示 | ログレベル |
|---|---|---|---|---|
| バリデーション | 400 | `BadRequestException` | フィールド別エラー | `log` |
| 認証エラー | 401 | `UnauthorizedException` | ログイン画面へリダイレクト | `warn` |
| 認可エラー | 403 | `ForbiddenException` | 「権限がありません」 | `warn` |
| 未検出 | 404 | `NotFoundException` | 「見つかりません」 | `log` |
| 競合 | 409 | `ConflictException` | 「他のユーザーが更新しました」 | `log` |
| レート制限 | 429 | `ThrottlerException` | 「しばらくお待ちください」 | `warn` |
| サーバーエラー | 500 | `InternalServerErrorException` | 「エラーが発生しました」 | `error` |

---

## エラーレスポンス形式 (API)

`HttpExceptionFilter` が全例外を以下の統一形式に変換:

```typescript
// エラーレスポンス
{
  "success": false,
  "error": {
    "code": "ERR-WF-003",
    "message": "承認済みのワークフローは取り下げできません",
    "fields": {                    // バリデーションエラー時のみ
      "title": "入力必須です",
      "amount": "0以上で入力してください"
    }
  }
}
```

---

## エラーコード体系

```
ERR-{カテゴリ}-{3桁番号}
```

| プレフィックス | カテゴリ | 番号帯 |
|---|---|---|
| `ERR-AUTH` | 認証/認可 | 001〜099 |
| `ERR-VAL` | 共通バリデーション | 001〜099 |
| `ERR-WF` | ワークフロー | 001〜099 |
| `ERR-PJ` | プロジェクト/タスク/工数 | 001〜099 |
| `ERR-EXP` | 経費 | 001〜099 |
| `ERR-INV` | 請求書 | 001〜099 |
| `ERR-DOC` | ドキュメント管理 | 001〜099 |
| `ERR-ADM` | 管理（テナント/ユーザー） | 001〜099 |
| `ERR-SYS` | システム（予期しないエラー） | 001〜099 |

### 主要エラーコード一覧

| コード | HTTP | 説明 |
|---|---|---|
| `ERR-AUTH-001` | 401 | 認証トークンが無効 or 期限切れ |
| `ERR-AUTH-002` | 403 | ロール不足（必要ロールなし） |
| `ERR-AUTH-003` | 403 | テナント不所属 |
| `ERR-VAL-001` | 400 | 必須フィールド未入力 |
| `ERR-VAL-002` | 400 | 値の形式が不正 |
| `ERR-WF-001` | 409 | 不正な状態遷移 |
| `ERR-WF-002` | 404 | ワークフローが見つからない |
| `ERR-WF-003` | 403 | 承認権限なし |
| `ERR-PJ-001` | 409 | プロジェクトコード重複 |
| `ERR-PJ-020` | 400 | 工数が0.25未満 or 24超過 |
| `ERR-INV-001` | 409 | 請求書番号重複 |
| `ERR-SYS-001` | 500 | 予期しないサーバーエラー |
| `ERR-SYS-002` | 404 | リソースが見つからない |
| `ERR-SYS-003` | 409 | データ競合（楽観的ロック） |

---

## NestJS Service 層でのエラーの投げ方

### ✅ 推奨パターン

```typescript
// Service 内でのビジネスエラー
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

@Injectable()
export class WorkflowsService {
  async approve(tenantId: string, id: string, approverId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id, tenantId },
    });

    // 404: リソース未検出
    if (!workflow) {
      throw new NotFoundException({
        code: 'ERR-WF-002',
        message: 'ワークフローが見つかりません',
      });
    }

    // 409: 状態遷移エラー
    if (!canTransition(WORKFLOW_TRANSITIONS, workflow.status, 'approved')) {
      throw new ConflictException({
        code: 'ERR-WF-001',
        message: `ステータス「${workflow.status}」からの承認はできません`,
      });
    }

    // 403: 承認権限チェック
    if (workflow.createdBy === approverId) {
      throw new ForbiddenException({
        code: 'ERR-WF-003',
        message: '自分が作成した申請は承認できません',
      });
    }

    return this.prisma.workflow.update({
      where: { id },
      data: { status: 'approved', approvedBy: approverId },
    });
  }
}
```

### ❌ 避けるべきパターン

```typescript
// NG: 生の文字列で throw
throw new Error('ワークフローが見つかりません');

// NG: try-catch で全てを握りつぶす
try { ... } catch (e) { return null; }

// NG: HttpException を直接使用（具体的な Exception を使う）
throw new HttpException('error', 400);
```

---

## Prisma エラーハンドリング

Service 内で Prisma の `PrismaClientKnownRequestError` を変換:

```typescript
// SWC 互換: 直接 import（名前空間経由は NG）
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

async create(dto: CreateProjectDto) {
  try {
    return await this.prisma.project.create({ data: dto });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      // P2002: Unique constraint violation
      if (error.code === 'P2002') {
        const fields = (error.meta?.target as string[])?.join(', ');
        throw new ConflictException({
          code: 'ERR-PJ-001',
          message: `${fields} は既に使用されています`,
        });
      }
      // P2025: Record not found
      if (error.code === 'P2025') {
        throw new NotFoundException({
          code: 'ERR-SYS-002',
          message: '対象レコードが見つかりません',
        });
      }
    }
    throw error; // 想定外のエラーはそのまま re-throw → HttpExceptionFilter で 500 に
  }
}
```

---

## Angular 側のエラーハンドリング

### ErrorInterceptor（共通）

`core/interceptors/error.interceptor.ts` で HTTP エラーを統一処理:
- **401**: `AuthInterceptor` がトークンリフレッシュ → 失敗時ログイン画面へ
- **403**: MatSnackBar で「権限がありません」表示
- **400/409**: MatSnackBar でエラーメッセージ表示
- **500**: MatSnackBar で「エラーが発生しました」表示

### フォームバリデーション

```typescript
// フォーム送信時のエラーハンドリング
submit() {
  this.http.post<ApiResponse<Workflow>>('/api/workflows', this.form.value).subscribe({
    next: (res) => {
      if (res.success) {
        this.snackBar.open('保存しました', '閉じる', { duration: 3000 });
        this.router.navigate(['/workflows']);
      }
    },
    error: (err: HttpErrorResponse) => {
      // フィールドエラーをフォームに反映
      if (err.error?.error?.fields) {
        Object.entries(err.error.error.fields).forEach(([field, message]) => {
          this.form.get(field)?.setErrors({ server: message });
        });
      }
    },
  });
}
```

### テンプレートでのエラー表示

```html
<!-- Angular Material Form Field -->
<mat-form-field>
  <mat-label>タイトル</mat-label>
  <input matInput formControlName="title" />
  @if (form.get('title')?.hasError('server')) {
    <mat-error>{{ form.get('title')?.getError('server') }}</mat-error>
  }
  @if (form.get('title')?.hasError('required')) {
    <mat-error>タイトルは必須です</mat-error>
  }
</mat-form-field>
```

---

## 未決事項

- エラー集約ツール（Sentry 等）の導入は Phase 4 で検討
- 429 レート制限の具体的な閾値設定
