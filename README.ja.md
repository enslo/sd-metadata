# sd-metadata

[![CI](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/enslo/sd-metadata)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。
PNG、JPEG、WebPフォーマットに対応し、18以上の生成ツールをサポートしています。
ゼロ依存、Node.jsとブラウザの両方で動作します。

## パッケージ

| パッケージ | 概要 | npm | |
| ---------- | ---- | --- | - |
| [@enslo/sd-metadata](./packages/core/) | 読み取り、書き込み、埋め込み、文字列化の全APIを備えたフル機能ライブラリ | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata.pages.dev/) |
| [@enslo/sd-metadata-lite](./packages/lite/) | ブックマークレットやユーザースクリプト向けの軽量読み取り専用パーサー（約7 KB） | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata-lite.svg)](https://www.npmjs.com/package/@enslo/sd-metadata-lite) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata-lite.pages.dev/) |

### どちらのパッケージを使うべき？

| 機能 | `sd-metadata` | `sd-metadata-lite` |
| ---- | :-----------: | :----------------: |
| メタデータ読み取り | ✅ | ✅ |
| メタデータ書き込み | ✅ | - |
| カスタムメタデータ埋め込み | ✅ | - |
| フォーマット変換（PNG/JPEG/WebP） | ✅ | - |
| ツール検知 | ✅ | - |
| 構造化メタデータオブジェクト | ✅ | - |
| IIFEビルド（ユーザースクリプト `@require`） | ✅ | ✅ |
| バンドルサイズ（IIFE、minified） | 約45 KB | 約6.5 KB |
| Node.js + ブラウザ | ✅ | ✅ |

- **フルライブラリ**（`@enslo/sd-metadata`）
  - 書き込み、フォーマット変換、完全なAPIを提供
  - [ドキュメント](./packages/core/README.ja.md)
- **軽量版**（`@enslo/sd-metadata-lite`）
  - バンドルサイズを重視するブックマークレット・ユーザースクリプト向けの読み取り専用パーサー
  - [ドキュメント](./packages/lite/README.ja.md)

## 開発

```bash
# 依存関係をインストール
pnpm install

# ビルドとテスト（core）
pnpm --filter @enslo/sd-metadata build
pnpm --filter @enslo/sd-metadata test

# ビルドとテスト（lite）
pnpm --filter @enslo/sd-metadata-lite build
pnpm --filter @enslo/sd-metadata-lite test

# リント（ワークスペース全体）
pnpm lint
```

## コントリビューション

ガイドラインについては[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

MIT
