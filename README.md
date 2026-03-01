# OpsHub ドキュメント

[OpsHub](https://github.com/garchomp-game/opshub-angular-nest-nx) の要件定義・基本設計・詳細設計・ADR・テスト戦略をまとめた Starlight ドキュメントサイトです。

## セットアップ

```bash
pnpm install
pnpm dev      # http://localhost:4321
```

## ドキュメント構成

```
src/content/docs/
├── index.md              # トップページ
├── architecture/         # アーキテクチャ (技術スタック, Nx ワークスペース, 概要)
├── requirements/         # 要件定義 (REQ カタログ, ロール定義)
├── spec/                 # 基本設計 (画面仕様)
├── detail/               # 詳細設計
│   └── modules/          # モジュール別仕様 (Auth, Workflow, Project 等)
├── adr/                  # ADR (Architecture Decision Records)
├── testing/              # テスト戦略 (ユニット, E2E)
├── guides/               # 開発ガイド (Agent-first 開発)
├── plans/                # 実装計画
├── knowledge/            # ナレッジベース
├── debug/                # デバッグノート
└── walkthroughs/         # ウォークスルー
```

## 技術スタック

| 項目 | 技術 |
|------|------|
| ドキュメントフレームワーク | [Starlight](https://starlight.astro.build/) (Astro 5) |
| ダイアグラム | Mermaid |

## 関連リポジトリ

- **[opshub-angular-nest-nx](https://github.com/garchomp-game/opshub-angular-nest-nx)** — 本体 (NestJS + Angular + Nx)

## OpsHub 技術概要

| カテゴリ | 技術 |
|---------|------|
| モノレポ | Nx 22 |
| フロントエンド | Angular 21 + PrimeNG 21 (Aura テーマ) |
| バックエンド | NestJS 11 + Passport JWT |
| DB | PostgreSQL 16 + Prisma 6 |
| キュー | BullMQ + Redis |
| テスト | Vitest (Web) / Jest (API) / Playwright (E2E) |
| CI/CD | GitHub Actions |
