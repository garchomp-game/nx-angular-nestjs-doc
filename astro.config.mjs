// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
    markdown: {
        syntaxHighlight: {
            excludeLangs: ['mermaid'],
        },
    },
    integrations: [
        starlight({
            title: 'Nx Angular NestJS Docs',
            defaultLocale: 'root',
            locales: {
                root: { label: '日本語', lang: 'ja' },
            },
            sidebar: [
                { label: 'START HERE', link: '/' },
                {
                    label: '要件定義 (Requirements)',
                    items: [
                        { label: '目次', link: '/requirements/' },
                        { label: 'プロジェクト概要', link: '/requirements/project-brief/' },
                        { label: 'ロール/権限', link: '/requirements/roles/' },
                        { label: 'REQ カタログ', link: '/requirements/req-catalog/' },
                        { label: '非機能要件 (NFR)', link: '/requirements/nfr/' },
                        { label: '画面一覧', link: '/requirements/screens/' },
                    ],
                },
                {
                    label: '基本設計 (Spec)',
                    items: [
                        { label: '目次', link: '/spec/' },
                        { label: 'アーキテクチャ概要', link: '/spec/architecture/' },
                        { label: '権限と認可', link: '/spec/authz/' },
                        { label: '画面仕様', link: '/spec/screens/' },
                        { label: 'API仕様', link: '/spec/apis/' },
                        { label: 'エラー方針', link: '/spec/error-handling/' },
                        { label: '監査ログ方針', link: '/spec/audit-logging/' },
                    ],
                },
                {
                    label: '詳細設計 (Detail)',
                    items: [
                        { label: '目次', link: '/detail/' },
                        {
                            label: 'Wave 0: 共有基盤',
                            items: [
                                { label: '共有型カタログ', link: '/detail/shared-types/' },
                                { label: 'Prisma セットアップ', link: '/detail/prisma-setup/' },
                                { label: 'NestJS 共通基盤', link: '/detail/common-infrastructure/' },
                                { label: 'Angular Core 基盤', link: '/detail/angular-core/' },
                            ],
                        },
                        { label: 'DB設計 (Prisma)', link: '/detail/db/' },
                        { label: 'Guard/Middleware設計', link: '/detail/guard-design/' },
                        { label: '状態遷移/シーケンス', link: '/detail/sequences/' },
                        { label: 'モジュール全体設計', link: '/detail/modules/' },
                        {
                            label: 'モジュール個別',
                            collapsed: true,
                            items: [
                                { label: 'ワークフロー', link: '/detail/modules/workflow/' },
                                { label: 'プロジェクト', link: '/detail/modules/project/' },
                                { label: '工数', link: '/detail/modules/timesheet/' },
                                { label: '経費', link: '/detail/modules/expense/' },
                                { label: '通知', link: '/detail/modules/notification/' },
                                { label: 'ダッシュボード', link: '/detail/modules/dashboard/' },
                                { label: '管理', link: '/detail/modules/admin/' },
                                { label: '請求書', link: '/detail/modules/invoice/' },
                                { label: 'ドキュメント', link: '/detail/modules/document/' },
                                { label: '検索', link: '/detail/modules/search/' },
                                { label: '運用基盤', link: '/detail/modules/operations/' },
                                { label: '認証 (Auth)', link: '/detail/modules/auth/' },
                            ],
                        },
                    ],
                },
                {
                    label: '🏗️ アーキテクチャ (Dev)',
                    items: [
                        { label: '全体概要', link: '/architecture/overview/' },
                        { label: '技術スタック', link: '/architecture/tech-stack/' },
                        { label: 'Nx ワークスペース設計', link: '/architecture/nx-workspace/' },
                    ],
                },
                {
                    label: '🔍 デバッグ・バグ事前検知',
                    items: [
                        { label: 'デバッグツール', link: '/debug/debug-tools/' },
                        { label: '静的解析・Lint', link: '/debug/static-analysis/' },
                        { label: '型安全設計', link: '/debug/type-safety/' },
                        { label: 'Prisma V6 + SQLite', link: '/debug/prisma-guide/' },
                    ],
                },
                {
                    label: '🧪 テスト設計',
                    items: [
                        { label: 'テスト戦略', link: '/testing/strategy/' },
                        { label: 'ユニットテスト', link: '/testing/unit-testing/' },
                        { label: '統合テスト', link: '/testing/integration-testing/' },
                        { label: 'E2Eテスト', link: '/testing/e2e-testing/' },
                        { label: 'モジュールテストパターン', link: '/testing/module-test-patterns/' },
                        { label: 'CI/CDパイプライン', link: '/testing/ci-pipeline/' },
                    ],
                },
                {
                    label: '📘 開発ガイド',
                    items: [
                        { label: 'エージェントファースト開発', link: '/guides/agent-first/' },
                    ],
                },
                {
                    label: '📝 ADR (意思決定)',
                    items: [
                        { label: '意思決定記録', link: '/adr/decisions/' },
                        { label: 'テンプレート', link: '/adr/template/' },
                    ],
                },
                {
                    label: '📋 計画',
                    items: [
                        { label: 'Phase 2 計画', link: '/plans/phase-2-plan/' },
                        { label: '開発チケット計画', link: '/plans/dev-tickets/' },
                        { label: 'Phase 7-8 作業ログ', link: '/plans/phase-7-8-log/' },
                        { label: 'ネクストアクション', link: '/plans/next-actions/' },
                        { label: 'Lint レポート分析', link: '/plans/lint-report-analysis/' },
                    ],
                },
            ],
        }),
        mermaid(),
    ],
});
