---
title: ユニットテスト
description: Vitest によるAngular コンポーネント・NestJS サービスのユニットテスト設計
---

## 概要

ユニットテストは **個別の関数・クラスを分離してテスト** します。外部依存はモックに置き換え、ロジックの正しさのみを検証します。

> [!NOTE] テストフレームワークの使い分け
> - **API (NestJS)**: `jest` + `@swc/jest` — NestJS 公式が Jest を採用、SWC トランスフォーマーで高速化
> - **Web (Angular)**: `vitest` + `@analogjs/vitest-angular` — Angular 21 公式推奨
> - **共有ライブラリ**: `vitest`

## Vitest 設定

### ワークスペース設定

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Angular フロントエンド (Vitest)
  {
    extends: 'apps/web/vite.config.ts',
    test: {
      name: 'web',
      environment: 'jsdom',
      include: ['apps/web/src/**/*.spec.ts'],
      setupFiles: ['apps/web/src/test-setup.ts'],
      coverage: {
        provider: 'v8',
        reportsDirectory: 'coverage/apps/web',
      },
    },
  },
  // 共有ライブラリ (Vitest)
  {
    test: {
      name: 'shared',
      include: ['libs/**/*.spec.ts'],
      coverage: {
        provider: 'v8',
        reportsDirectory: 'coverage/libs',
      },
    },
  },
]);
```

> [!IMPORTANT] API のテストは Jest
> NestJS API (`apps/api`) のテストは `jest` + `@swc/jest` で実行されます。
> 設定は `apps/api/jest.config.ts` に定義されています。

### Angular テストセットアップ

```typescript
// apps/web/src/test-setup.ts
import '@analogjs/vitest-angular/setup-zone';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
```

## Angular コンポーネントテスト

### Standalone Component テスト

```typescript
// apps/web/src/app/features/projects/project-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ProjectListComponent } from './project-list.component';
import { ProjectService } from './project.service';

describe('ProjectListComponent', () => {
  let component: ProjectListComponent;
  let fixture: ComponentFixture<ProjectListComponent>;
  let mockProjectService: Partial<ProjectService>;

  const mockProjects = [
    { id: '1', name: 'Project A', code: 'PRJ-A', status: 'ACTIVE' },
    { id: '2', name: 'Project B', code: 'PRJ-B', status: 'ARCHIVED' },
  ];

  beforeEach(async () => {
    mockProjectService = {
      projects: signal(mockProjects),
      isLoading: signal(false),
      error: signal(null),
      loadProjects: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display project list', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="project-row"]');
    expect(rows.length).toBe(2);
  });

  it('should call loadProjects on init', () => {
    expect(mockProjectService.loadProjects).toHaveBeenCalled();
  });

  it('should show loading spinner when isLoading is true', () => {
    (mockProjectService.isLoading as ReturnType<typeof signal>).set(true);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('[data-testid="loading"]');
    expect(spinner).toBeTruthy();
  });
});
```

### Signal テスト

```typescript
// apps/web/src/app/features/projects/project.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // 未処理の HTTP リクエストがないことを確認
  });

  it('should load projects', () => {
    const mockData = [{ id: '1', name: 'Test', code: 'T-1', status: 'ACTIVE' }];

    service.loadProjects();

    const req = httpMock.expectOne('/api/projects');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);

    expect(service.projects()).toEqual(mockData);
    expect(service.isLoading()).toBe(false);
  });

  it('should handle error', () => {
    service.loadProjects();

    const req = httpMock.expectOne('/api/projects');
    req.error(new ProgressEvent('error'));

    expect(service.error()).toBeTruthy();
    expect(service.isLoading()).toBe(false);
  });
});
```

## NestJS サービステスト

### 基本パターン

```typescript
// apps/api/src/modules/projects/projects.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '@myapp/prisma-db';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);

    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      const expected = [
        { id: '1', name: 'Project A', code: 'PRJ-A' },
      ];
      mockPrisma.project.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      const expected = { id: '1', name: 'Project A', code: 'PRJ-A' };
      mockPrisma.project.findUnique.mockResolvedValue(expected);

      const result = await service.findById('1');

      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create project with valid data', async () => {
      const dto = { name: 'New Project', code: 'PRJ-NEW' };
      const expected = { id: '1', ...dto };
      mockPrisma.project.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(result).toEqual(expected);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: dto,
      });
    });

    it('should throw ConflictException for duplicate code', async () => {
      const dto = { name: 'Duplicate', code: 'PRJ-DUP' };
      mockPrisma.project.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['code'] },
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });
});
```

## ユーティリティ関数テスト

```typescript
// libs/shared/util/src/lib/date.util.spec.ts
import { describe, it, expect } from 'vitest';
import {
  formatDate,
  isBusinessDay,
  addBusinessDays,
} from './date.util';

describe('DateUtils', () => {
  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      expect(formatDate(new Date('2024-12-25'))).toBe('2024-12-25');
    });

    it('should handle single-digit months', () => {
      expect(formatDate(new Date('2024-01-05'))).toBe('2024-01-05');
    });
  });

  describe('isBusinessDay', () => {
    it('should return true for weekdays', () => {
      // 2024-12-25 は水曜日
      expect(isBusinessDay(new Date('2024-12-25'))).toBe(true);
    });

    it('should return false for Saturday', () => {
      expect(isBusinessDay(new Date('2024-12-28'))).toBe(false);
    });

    it('should return false for Sunday', () => {
      expect(isBusinessDay(new Date('2024-12-29'))).toBe(false);
    });
  });
});
```

## Prisma モック戦略

### 方法 1: 手動モック (推奨)

```typescript
// テスト用のPrismaモックファクトリ
function createMockPrisma() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(createMockPrisma())),
  };
}
```

### 方法 2: vitest-mock-extended

```typescript
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = mockDeep<PrismaClient>();

// 使用例
prismaMock.user.findMany.mockResolvedValue([
  { id: '1', email: 'test@example.com', name: 'Test', role: 'MEMBER' },
]);
```

## テスト実行コマンド

```bash
# 全ユニットテスト
nx run-many -t test

# 特定プロジェクト
nx test api
nx test web

# ウォッチモード
nx test api --watch

# カバレッジ付き
nx test api --coverage

# 特定ファイル
nx test api -- --testPathPattern=projects

# Vitest UI
npx vitest --ui
```
