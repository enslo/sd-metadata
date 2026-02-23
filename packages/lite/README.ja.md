# @enslo/sd-metadata-lite

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata-lite.svg)](https://www.npmjs.com/package/@enslo/sd-metadata-lite)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata-lite.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

AI生成画像のメタデータを読み取る軽量パーサーです。
バンドルサイズが重要なブックマークレットやユーザースクリプト向けに設計されています。

- **超軽量**: **6,525 bytes** のminified IIFEビルド
- **読み取り専用**: メタデータを抽出し、A1111形式のテキストで返却
- **ゼロ依存**: Node.jsとブラウザの両方で動作
- **18以上のツール対応**: 主要なAI画像生成ツールをサポート

> [!TIP]
> 書き込み、フォーマット変換、構造化メタデータが必要な場合は[フルライブラリ](../core/README.ja.md)をご利用ください。

## インストール

```bash
npm install @enslo/sd-metadata-lite
```

## 使い方

### ESM

```typescript
import { parse } from '@enslo/sd-metadata-lite';

const response = await fetch(imageUrl);
const data = new Uint8Array(await response.arrayBuffer());
const text = parse(data);

if (text) {
  console.log(text);
  // masterpiece, best quality, 1girl
  // Negative prompt: lowres, bad quality
  // Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, ...
}
```

### ユーザースクリプト

`@require` でIIFEビルドを読み込みます：

```javascript
// ==UserScript==
// @name        My Script
// @namespace   https://example.com
// @require     https://cdn.jsdelivr.net/npm/@enslo/sd-metadata-lite@1.0.0/dist/index.global.js
// ==/UserScript==

const response = await fetch(imageUrl);
const data = new Uint8Array(await response.arrayBuffer());
const text = sdml.parse(data);

if (text) {
  console.log(text);
}
```

> [!TIP]
> 安定性のため、`@require` では必ず特定のバージョンを指定してください。

### ブックマークレット

多くのサイトではCSPにより外部スクリプトの読み込みがブロックされます。代わりに、IIFEバンドルをインラインで貼り付けてください：

1. `dist/index.global.js` の内容をコピー（または[npm](https://cdn.jsdelivr.net/npm/@enslo/sd-metadata-lite@1.0.0/dist/index.global.js)からダウンロード）
2. コードをインラインでブックマークレットに組み込みます：

```javascript
javascript:void(async()=>{/* index.global.js の内容をここに貼り付け */;/* sdml.parse() を使用するコード */})()
```

IIFEは `var sdml` に代入するため、インラインコードの直後から `sdml.parse()` を呼び出せます。

## API

### `parse(input: Uint8Array | ArrayBuffer): string`

画像からメタデータを解析し、A1111形式のテキストを返します。

**パラメータ:**

- `input` - 画像ファイルデータ（PNG、JPEG、またはWebP）

**戻り値:**

- メタデータが見つかった場合はA1111形式のテキスト
- メタデータが見つからない、またはフォーマットが認識できない場合は空文字列（`""`）

### 出力フォーマット

出力は[Stable Diffusion WebUI (A1111)](https://github.com/AUTOMATIC1111/stable-diffusion-webui)のテキスト形式に準拠します：

```text
masterpiece, best quality, 1girl
Negative prompt: lowres, bad quality
Steps: 20, Sampler: Euler a, Schedule type: Karras, CFG scale: 7, Seed: 12345, Size: 512x768, Model hash: a1b2c3d4, Model: model.safetensors
```

フィールドはソースメタデータに存在する場合のみ出力されます。

## 対応ツール

PNG、JPEG、WebPのメタデータを読み取り可能：

- [Stable Diffusion WebUI (A1111)](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) / [Forge Classic](https://github.com/Haoming02/sd-webui-forge-classic/tree/classic) / [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
- [reForge](https://github.com/Panchovix/stable-diffusion-webui-reForge) / [EasyReforge](https://github.com/Zuntan03/EasyReforge)
- [NovelAI](https://novelai.net/)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [SD.Next](https://github.com/vladmandic/automatic)
- [InvokeAI](https://github.com/invoke-ai/InvokeAI)
- [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI)
- [Stability Matrix](https://github.com/LykosAI/StabilityMatrix)
- [Civitai](https://civitai.com/)（JPEGのみ検証済み、PNG/WebPは実験的 *）
- [TensorArt](https://tensor.art/)
- [HuggingFace Space](https://huggingface.co/spaces)
- [Ruined Fooocus](https://github.com/runew0lf/RuinedFooocus)
- [Fooocus](https://github.com/lllyasviel/Fooocus) *
- [Easy Diffusion](https://github.com/easydiffusion/easydiffusion) *

> [!NOTE]
> \* リファレンスコードの解析に基づく実装であり、実際のサンプルファイルでは未検証です。

## グローバル変数

`<script>` タグまたはユーザースクリプトの `@require` で読み込んだ場合、IIFEビルドは以下を公開します：

```javascript
window.sdml.parse(input)
```

## コントリビューション

ガイドラインについては[CONTRIBUTING.md](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md)を参照してください。

## ライセンス

MIT
