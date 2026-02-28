---
title: Nx + Angular + NestJS 開発ガイド
description: 大規模開発に耐えうるバグ検知・厳格なテスト設計を備えた開発ドキュメント
template: splash
hero:
  tagline: エージェントファースト × 堅牢な型安全スタック
  actions:
    - text: アーキテクチャ概要
      link: /architecture/overview/
      icon: right-arrow
    - text: テスト戦略
      link: /testing/strategy/
      icon: right-arrow
      variant: minimal
---

## このドキュメントについて

本ドキュメントは、**Nx + Angular + NestJS** で大規模アプリケーションを構築するための開発ガイドです。

### 背景

Next.js + Supabase で構築した OpsHub プロジェクトにおいて、規模が大きくなるにつれ以下の問題が顕在化しました：

- **turbopack の不安定さ**: 複数画面で予期しない issue が頻発
- **ランタイムエラーの後追い**: 型安全が不十分な箇所でバグが本番で発覚
- **テストの脆弱性**: E2E テストのみに依存し、ユニット・統合テストが不足

これらの教訓を活かし、**事前にバグを検知できる仕組み**をアーキテクチャレベルで組み込んだ新スタックを設計しました。

### 技術スタック サマリ

| カテゴリ | 技術 | バージョン |
|---|---|---|
| モノレポ管理 | Nx | 20.x |
| フロントエンド | Angular | 19.x |
| UI | Angular Material | 19.x |
| バックエンド | NestJS | 10.x |
| ORM | Prisma | 6.x |
| 開発DB | SQLite | — |
| テスト | Vitest + Playwright | 2.x / 1.49.x |
| Lint | ESLint (Flat Config) | 9.x |
| 言語 | TypeScript | 5.6.x |
| ランタイム | Node.js | 22.x LTS |
| パッケージ | pnpm | 9.x |

### ドキュメント構成

| セクション | 内容 |
|---|---|
| 🏗️ アーキテクチャ | 全体設計・技術スタック・Nx 構成 |
| 🔍 デバッグ・バグ事前検知 | デバッグツール・静的解析・型安全・Prisma |
| 🧪 テスト設計 | テスト戦略・Unit/Integration/E2E・CI/CD |
| 📘 開発ガイド | エージェントファースト開発 |
| 📝 ADR | 意思決定記録テンプレート |
