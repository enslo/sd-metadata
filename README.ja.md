# sd-metadata

[![CI](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

🔗 **[ライブデモ](https://sd-metadata.pages.dev/)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。
PNG、JPEG、WebPフォーマットに対応し、20以上の生成ツールをサポートしています。
ゼロ依存、Node.jsとブラウザの両方で動作します。

## 特徴

- **マルチフォーマット対応**: PNG (tEXt / iTXt / eXIf)、JPEG (COM / Exif)、WebP (Exif)、さらに MP4 / MOV、WebM / MKV 動画（読み取りのみ）
- **シンプルAPI**: `parse()`、`write()`、`embed()`、`stringify()` — 4つの関数で全ユースケースをカバー
- **TypeScriptネイティブ**: TypeScriptで書かれており、型定義を完全同梱
- **ゼロ依存**: Node.jsとブラウザで外部依存なしで動作
- **フォーマット変換**: PNG、JPEG、WebP間でメタデータをシームレスに変換
- **メタデータ保持**: フォーマット変換時に元のメタデータ構造を保持（例：PNG → JPEG → PNG で全データを維持）
- **Stealth PNGInfo の復元**: 通常のメタデータが削除されていても、ピクセルに隠されたメタデータを読み取り
- **AI生成元の検出**: 商用サービス（OpenAI、Google、xAI）の画像・動画を C2PA / XMP の宣言から識別 — 検出のみ、署名検証なし

## インストール

```bash
npm install @enslo/sd-metadata
```

## クイックスタート

```typescript
import { parse } from '@enslo/sd-metadata';

// `imageBytes` は Uint8Array または ArrayBuffer（fs、fetch、ファイル入力などから取得）
const result = await parse(imageBytes);
if (result.status === 'success') {
  console.log(result.metadata.software); // 'novelai', 'comfyui', ...
  console.log(result.metadata.prompt);
}
```

読み取りはこれだけです。書き込み・埋め込み・フォーマット変換もそれぞれ数行で書けます。詳しくは[ドキュメント](#ドキュメント)を参照してください。

## 対応ツール

Stable Diffusion WebUI (A1111)、Forge、reForge、ComfyUI、NovelAI、SD.Next、InvokeAI、SwarmUI、Fooocus、Civitai、TensorArt、Stability Matrix、Draw Things など。

フォーマットごとの対応状況を含む全リストは[ツールサポート表](./packages/core/README.ja.md#ツールサポート)を参照してください。

## ドキュメント

詳細なドキュメントはパッケージのREADMEにあります。

- [使い方](./packages/core/README.ja.md#使い方) — Node.js、ブラウザ、ユーザースクリプトでの利用方法
- [応用例](./packages/core/README.ja.md#応用例) — 書き込み、埋め込み、フォーマット変換、各結果ステータスの扱い
- [APIリファレンス](./packages/core/README.ja.md#apiリファレンス)
- [型リファレンス](./packages/core/docs/types.ja.md)
- [変更履歴](./packages/core/CHANGELOG.md)

## Lite版

`@enslo/sd-metadata-lite` は、バンドルサイズが最優先となるブックマークレット・ユーザースクリプト向けの読み取り専用パッケージです。
約 7 KB の IIFE で同じメタデータを A1111 形式のテキストとして取り出します。書き込み、フォーマット変換、構造化オブジェクトは提供しません。

このトレードオフがユースケースに合う場合は[lite版のドキュメント](./packages/lite/README.ja.md)を参照してください。

## 開発

このリポジトリは pnpm ワークスペースです: `packages/core`（ライブラリ本体）、`packages/lite`（lite版）、`apps/`（デモサイト）。

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
