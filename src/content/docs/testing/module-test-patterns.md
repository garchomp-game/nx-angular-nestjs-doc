---
title: モジュールテストパターン
description: 各モジュール開発時に必ず作成すべきテストの具体的パターン集
---

**エージェントがモジュール開発チケットを実行する際、本ドキュメントのパターンに従ってテストを作成すること。**

---

## テストファイル構成

各モジュールは以下のテストファイルを必ず含むこと:

```
apps/api/src/modules/{module}/
├── {module}.controller.spec.ts      # Controller 統合テスト
├── {module}.service.spec.ts         # Service ユニットテスト
└── dto/
    └── *.dto.spec.ts                # (任意) DTO バリデーションテスト

apps/web/src/app/features/{module}/
├── {module}-list.component.spec.ts  # Component テスト
├── {module}-form.component.spec.ts  # フォーム Component テスト
└── {module}.service.spec.ts         # Angular Service テスト
```

---

## 1. NestJS Service テスト（必須）

### テンプレート

```typescript
// apps/api/src/modules/workflows/workflows.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '@prisma-db';
import { NotificationsService } from '../notifications/notifications.service';

describe('WorkflowsService', () => {
  let service: WorkflowsService;

  // ─── Prisma Mock ───
  const mockPrisma = {
    workflow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(mockPrisma)),
  };

  // ─── 他モジュール Service Mock ───
  const mockNotifications = {
    create: vi.fn(),
  };

  // ─── テストデータ ───
  const tenantId = 'tenant-001';
  const userId = 'user-001';
  const approverId = 'approver-001';

  const mockWorkflow = {
    id: 'wf-001',
    tenantId,
    title: 'テスト申請',
    status: 'submitted',
    createdBy: userId,
    approverId,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    vi.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('テナント内のワークフロー一覧を返すこと', async () => {
      mockPrisma.workflow.findMany.mockResolvedValue([mockWorkflow]);

      const result = await service.findAll(tenantId, userId, {});

      expect(result).toHaveLength(1);
      expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId }),
        }),
      );
    });
  });

  // ─── findOne ───
  describe('findOne', () => {
    it('存在するワークフローを返すこと', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await service.findOne(tenantId, 'wf-001');

      expect(result).toEqual(mockWorkflow);
    });

    it('存在しない場合 NotFoundException を投げること', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(service.findOne(tenantId, 'nonexist'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── approve ───
  describe('approve', () => {
    it('submitted → approved に状態遷移すること', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflow.update.mockResolvedValue({
        ...mockWorkflow, status: 'approved',
      });

      const result = await service.approve(tenantId, 'wf-001', approverId);

      expect(result.status).toBe('approved');
      expect(mockNotifications.create).toHaveBeenCalled();
    });

    it('draft → approved は ConflictException を投げること', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow, status: 'draft',
      });

      await expect(service.approve(tenantId, 'wf-001', approverId))
        .rejects.toThrow(ConflictException);
    });

    it('自分の申請は承認できないこと (ForbiddenException)', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      await expect(service.approve(tenantId, 'wf-001', userId))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Prisma エラーハンドリング ───
  describe('create', () => {
    it('重複時に ConflictException を投げること', async () => {
      const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library');
      mockPrisma.workflow.create.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['workflowNumber'] },
        }),
      );

      await expect(service.create(tenantId, userId, { title: 'test', type: 'expense' }))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

### カバーすべきテストケース

| カテゴリ | テストケース | 必須 |
|---|---|---|
| 正常系 | CRUD 操作が成功 | ✅ |
| 正常系 | 状態遷移が正しく動作 | ✅ |
| 正常系 | ページネーションが動作 | ✅ |
| 異常系 | リソース未検出 → NotFoundException | ✅ |
| 異常系 | 不正な状態遷移 → ConflictException | ✅ |
| 異常系 | 権限不足 → ForbiddenException | ✅ |
| 異常系 | Prisma P2002 (重複) → ConflictException | ✅ |
| 連携 | 通知 Service の呼び出し確認 | ✅ |
| 連携 | 状態遷移定数 (TRANSITIONS) の参照確認 | ⚠️ |

---

## 2. NestJS Controller テスト（必須）

```typescript
// apps/api/src/modules/workflows/workflows.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsController', () => {
  let controller: WorkflowsController;

  const mockService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    withdraw: vi.fn(),
  };

  const mockUser = {
    id: 'user-001',
    tenantId: 'tenant-001',
    roles: [{ tenantId: 'tenant-001', role: 'approver' }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        { provide: WorkflowsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<WorkflowsController>(WorkflowsController);
    vi.clearAllMocks();
  });

  it('findAll が Service に委譲すること', async () => {
    const expected = [{ id: 'wf-001', title: '申請' }];
    mockService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(mockUser, {});

    expect(result).toEqual(expected);
    expect(mockService.findAll).toHaveBeenCalledWith(
      mockUser.tenantId, mockUser.id, {},
    );
  });

  it('approve が Service に正しい引数を渡すこと', async () => {
    mockService.approve.mockResolvedValue({ id: 'wf-001', status: 'approved' });

    await controller.approve('wf-001', mockUser);

    expect(mockService.approve).toHaveBeenCalledWith(
      mockUser.tenantId, 'wf-001', mockUser.id,
    );
  });
});
```

---

## 3. Angular Service テスト（必須）

```typescript
// apps/web/src/app/features/workflows/workflow.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkflowService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkflowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll が GET /api/workflows を呼ぶこと', () => {
    const mockData = { success: true, data: [{ id: 'wf-001' }] };
    service.getAll().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpMock.expectOne('/api/workflows');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('approve が POST /api/workflows/:id/approve を呼ぶこと', () => {
    service.approve('wf-001').subscribe();

    const req = httpMock.expectOne('/api/workflows/wf-001/approve');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: { id: 'wf-001', status: 'approved' } });
  });

  it('エラー時にエラーレスポンスを返すこと', () => {
    service.getAll().subscribe({
      error: (err) => expect(err.status).toBe(403),
    });

    const req = httpMock.expectOne('/api/workflows');
    req.flush(
      { success: false, error: { code: 'ERR-AUTH-002', message: '権限がありません' } },
      { status: 403, statusText: 'Forbidden' },
    );
  });
});
```

---

## 4. Angular Component テスト（必須）

```typescript
// apps/web/src/app/features/workflows/workflow-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { WorkflowListComponent } from './workflow-list.component';
import { WorkflowService } from './workflow.service';
import { AuthService } from '../../core/auth/auth.service';

describe('WorkflowListComponent', () => {
  let component: WorkflowListComponent;
  let fixture: ComponentFixture<WorkflowListComponent>;

  const mockWorkflowService = {
    workflows: signal([
      { id: 'wf-001', title: '経費申請', status: 'submitted' },
      { id: 'wf-002', title: '休暇申請', status: 'approved' },
    ]),
    isLoading: signal(false),
    loadAll: vi.fn(),
  };

  const mockAuthService = {
    currentUser: signal({ id: 'user-001', tenantId: 't-001', roles: [] }),
    isAuthenticated: signal(true),
    hasRole: vi.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: WorkflowService, useValue: mockWorkflowService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('コンポーネントが作成されること', () => {
    expect(component).toBeTruthy();
  });

  it('ワークフロー一覧が表示されること', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="workflow-row"]');
    expect(rows.length).toBe(2);
  });

  it('初期化時に loadAll が呼ばれること', () => {
    expect(mockWorkflowService.loadAll).toHaveBeenCalled();
  });

  it('ローディング中はスピナーが表示されること', () => {
    mockWorkflowService.isLoading.set(true);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
    expect(spinner).toBeTruthy();
  });

  it('承認者ロールの場合、承認ボタンが表示されること', () => {
    mockAuthService.hasRole.mockReturnValue(true);
    fixture.detectChanges();

    const approveBtn = fixture.nativeElement.querySelector('[data-testid="approve-btn"]');
    expect(approveBtn).toBeTruthy();
  });
});
```

---

## 5. data-testid 規約

全 Component で `data-testid` 属性を付与。E2E テストと Component テストの両方で使用:

```
{module}-{element}[-{variant}]
```

| 例 | 用途 |
|---|---|
| `data-testid="workflow-row"` | 一覧の各行 |
| `data-testid="workflow-form"` | フォーム全体 |
| `data-testid="approve-btn"` | 承認ボタン |
| `data-testid="reject-btn"` | 差戻しボタン |
| `data-testid="loading"` | ローディングスピナー |
| `data-testid="empty-state"` | データなし表示 |
| `data-testid="error-message"` | エラーメッセージ |

---

## チェックリスト

各モジュール PR 時に以下を確認:

- [ ] NestJS Service テスト: 正常系 + 異常系 (4種以上) のテストケース
- [ ] NestJS Controller テスト: 全エンドポイントの委譲テスト
- [ ] Angular Service テスト: 全 HTTP メソッドのリクエスト/レスポンステスト
- [ ] Angular Component テスト: 表示、ローディング、ロール分岐のテスト
- [ ] `data-testid` が主要 UI 要素に付与されている
- [ ] `vi.clearAllMocks()` がテスト間で呼ばれている
- [ ] `httpMock.verify()` が `afterEach` で呼ばれている
