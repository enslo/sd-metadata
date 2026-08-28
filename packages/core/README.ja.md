# @enslo/sd-metadata

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

🔗 **[ライブデモ](https://sd-metadata.pages.dev/)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。

## 特徴

- **マルチフォーマット対応**: PNG (tEXt / iTXt)、JPEG (COM / Exif)、WebP (Exif)
- **シンプルAPI**: `parse()`、`write()`、`embed()`、`stringify()` — 4つの関数で全ユースケースをカバー
- **Stealth PNGInfo の復元**: NovelAI や stealth-pnginfo 拡張がピクセルの最下位ビットに隠したメタデータを、画像ホストに通常のメタデータを剥がされた後でも復元
- **TypeScriptネイティブ**: TypeScriptで書かれており、型定義を完全同梱
- **ゼロ依存**: Node.jsとブラウザで外部依存なしで動作
- **フォーマット変換**: PNG、JPEG、WebP間でメタデータをシームレスに変換
- **メタデータ保持**: フォーマット変換時に元のメタデータ構造を保持（例：PNG → JPEG → PNG で全データを維持）
- **AI生成元の検出**: C2PA Content Credentials を持つ画像（OpenAI ChatGPT、Google Gemini）を識別 — 検出のみ、署名検証なし

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
  console.log('Tool:', result.metadata.software); // 'novelai', 'comfyui', ...
  console.log('Prompt:', result.metadata.prompt);
  console.log('Size:', result.metadata.width, 'x', result.metadata.height);
}
```

Node.js、ブラウザ、ユーザースクリプトでの利用方法は[使い方](#使い方)を、その他の結果ステータス（`c2pa`、`unrecognized`、`empty`、`invalid`）の扱いは[応用例](#応用例)を参照してください。

## ツールサポート

| ツール | PNG | JPEG | WebP |
| ------ | :---: | :----: | :----: |
| [NovelAI](https://novelai.net/) * | ✅ | 🔄️ | ✅ |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) * | ✅ | 🔄️ | ✅ |
| [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | ✅ | ✅ | ✅ |
| [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) | ✅ | ✅ | ✅ |
| [Forge Classic](https://github.com/Haoming02/sd-webui-forge-classic/tree/classic) | ✅ | ✅ | ✅ |
| [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) | ✅ | ✅ | ✅ |
| [reForge](https://github.com/Panchovix/stable-diffusion-webui-reForge) | ✅ | ✅ | ✅ |
| [EasyReforge](https://github.com/Zuntan03/EasyReforge) | ✅ | ✅ | ✅ |
| [SD.Next](https://github.com/vladmandic/automatic) | ✅ | ✅ | ✅ |
| [InvokeAI](https://github.com/invoke-ai/InvokeAI) | ✅ | 🔄️ | 🔄️ |
| [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) * | ✅ | ✅ | ✅ |
| [Civitai](https://civitai.com/) | ⚠️ | ✅ | ⚠️ |
| [TensorArt](https://tensor.art/) | ✅ | 🔄️ | 🔄️ |
| [Stability Matrix](https://github.com/LykosAI/StabilityMatrix) | ✅ | 🔄️ | 🔄️ |
| [HuggingFace Space](https://huggingface.co/spaces) | ✅ | 🔄️ | 🔄️ |
| [Fooocus](https://github.com/lllyasviel/Fooocus) | ⚠️ | ⚠️ | ⚠️ |
| [Ruined Fooocus](https://github.com/runew0lf/RuinedFooocus) | ✅ | 🔄️ | 🔄️ |
| [Easy Diffusion](https://github.com/easydiffusion/easydiffusion) | ⚠️ | ⚠️ | ⚠️ |
| [Draw Things](https://drawthings.ai/) | ⚠️ | ⚠️ | ⚠️ |

**凡例:**

- ✅ **完全対応** - ツールがネイティブでサポートするフォーマット。サンプルファイルで検証済み
- 🔄️ **拡張対応** - ツールがネイティブでサポートしないフォーマット。sd-metadataがカスタムフォーマット変換により読み書きを可能に。ネイティブフォーマットへのラウンドトリップ変換に対応
- ⚠️ **実験的** - リファレンスコードやドキュメントの分析により実装。サンプルファイルでの検証は未実施。全てのメタデータフィールドを正しく抽出できない可能性あり

<details>
<summary>拡張対応の例</summary>

- **Stability Matrix**（ネイティブ: PNGのみ）→ sd-metadataがJPEG/WebPをサポート
- **NovelAI**（ネイティブ: PNG、WebP）→ sd-metadataがJPEGをサポート

ネイティブフォーマットから拡張フォーマットに変換し、再度戻す場合（例：PNG → JPEG → PNG）、全てのメタデータが保持されます。

</details>

> [!NOTE]
> \* フォーマット固有の動作があるツール — 下記を参照。

> [!TIP]
> **ツールサポートの拡大にご協力ください！** 実験的なツール（Easy Diffusion、Fooocus）やサポートされていないツールのサンプル画像を募集しています。これらのAIツールで生成したサンプル画像をお持ちの方は、ぜひご提供ください！詳細は[CONTRIBUTING.md](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md)を参照してください。

## フォーマット固有の動作

一部のツールはフォーマット変換時に特定の動作をします：

- **ComfyUI JPEG/WebP**: 読み込みは複数のノードフォーマット（例：ビルトインの `Save Animated WEBP`、`save-image-extended`）に対応しています。書き込みは常にビルトインの `Save Animated WEBP` ノードの `Make`/`Model` EXIFタグをバイト単位で再現します — ComfyUI自身がWebPのドラッグ＆ドロップで読み取るレイアウトです。`prompt`/`workflow` 以外のPNGチャンク（サードパーティ製保存ノードによる `parameters` など）は破棄します。
- **NovelAI WebP**: Descriptionフィールドの破損したUTF-8を自動修正します。WebP → PNG → WebP のラウンドトリップは有効で読み取り可能なメタデータを生成しますが、軽微なテキスト修正が含まれます。
- **SwarmUI PNG→JPEG/WebP**: ネイティブのSwarmUI JPEG/WebPファイルにはノード情報が含まれません。PNGから変換する際、このライブラリは完全なメタデータ保持のためにComfyUIワークフローを `Make` フィールドに保存します（拡張対応）。

## Stealth PNGInfo の復元

NovelAI（標準機能）と [stealth-pnginfo](https://github.com/ashen-sensored/sd_webui_stealth_pnginfo) 系の拡張機能（A1111/Forge、[ComfyUI](https://github.com/catboxanon/comfyui_stealth_pnginfo)）は、生成メタデータのコピーをピクセルの最下位ビットに隠しています。通常のメタデータと違い、このコピーは画像ホストにメタデータチャンクを剥がされても生き残ります。

`parse()` はこれを自動で復元します。読み取り可能なメタデータがない画像に対してのみ、フォールバックとしてピクセルをスキャンします。復元された結果には `stealth: true` が付きます：

```typescript
import { parse } from '@enslo/sd-metadata';

const result = await parse(strippedImage);
if (result.status === 'success') {
  console.log(result.stealth); // true — ピクセルから復元された
  console.log(result.metadata.prompt);
}
```

4つの変種すべて — アルファ/RGBチャンネル埋め込み × 圧縮/非圧縮 — に対応し、NovelAI の JSON ペイロードも拡張機能のプレーンテキスト（infotext）ペイロードも扱えます。

### WebP 画像

NovelAI はロスレス WebP 書き出しにも stealth データを埋め込みます。PNG のピクセルはライブラリ自身がデコードしますが、WebP のデコードはランタイム依存です：

- **ブラウザ**: 自動 — `parse()` がプラットフォームのデコーダ（WebCodecs `ImageDecoder`、フォールバックとして `createImageBitmap` + `OffscreenCanvas`）を使います。設定不要です。
- **Node.js / Bun / Deno**: `decodePixels` オプションでピクセルを供給してください（例：[sharp](https://www.npmjs.com/package/sharp) を利用）。指定がない場合、WebP の stealth スキャンは静かにスキップされます。

```typescript
import { parse } from '@enslo/sd-metadata';
import sharp from 'sharp';

const result = await parse(webpData, {
  decodePixels: async (data) => {
    const { data: pixels, info } = await sharp(data)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(pixels), width: info.width, height: info.height };
  },
});
```

### 剥がされたメタデータのレスキュー

復元した結果はそのまま `write()` に渡せます。剥がされたファイルに元ツールのネイティブメタデータが復元されます — 専用APIは不要です：

```typescript
import { parse, write } from '@enslo/sd-metadata';

const rescued = await parse(strippedImage);
if (rescued.status === 'success') {
  const restored = write(strippedImage, rescued);
  if (restored.ok) {
    // restored.value は再び通常のメタデータを持ち、
    // どのツールからも読み取れます — ピクセル内の stealth データはそのまま残ります。
  }
}
```

> [!NOTE]
> stealth スキャンには `DecompressionStream` が必要です（Node.js 18+、Bun 1.4+、Deno、全モダンブラウザ）。対応していないランタイムでは、`parse()` はチャンクベースの読み取りに静かにフォールバックします。stealth データの書き込みは意図的にスコープ外です。

## 使い方

> [!NOTE]
> 例は全てESM構文を使用しています。CommonJSユーザーは `import` を `require` に
> 置き換えてください：`const { parse } = require('@enslo/sd-metadata');`

### Node.jsでの使用

```typescript
import { parse, stringify } from '@enslo/sd-metadata';
import { readFileSync } from 'fs';

const imageData = readFileSync('image.png');
const result = await parse(imageData);

if (result.status === 'success') {
  console.log('Tool:', result.metadata.software);       // 'novelai', 'comfyui', etc.
  console.log('Prompt:', result.metadata.prompt);
  console.log('Model:', result.metadata.model?.name);
  console.log('Size:', result.metadata.width, 'x', result.metadata.height);
}

// 読みやすいテキストにフォーマット（任意のstatusで動作）
const text = stringify(result);
if (text) {
  console.log(text);
}
```

### ブラウザでの使用

```typescript
import { parse, softwareLabels } from '@enslo/sd-metadata';

// ファイル入力を処理
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const result = await parse(arrayBuffer);

  if (result.status === 'success') {
    document.getElementById('tool').textContent = softwareLabels[result.metadata.software];
    document.getElementById('prompt').textContent = result.metadata.prompt;
    document.getElementById('model').textContent = result.metadata.model?.name || 'N/A';
  }
});
```

### ユーザースクリプトでの使用

ユーザースクリプト（Tampermonkey、Violentmonkeyなど）では、IIFEビルドを `@require` で読み込みます：

```javascript
// ==UserScript==
// @name        My Script
// @namespace   https://example.com
// @require     https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@4.0.0/dist/index.global.js
// ==/UserScript==

const response = await fetch(imageUrl);
const arrayBuffer = await response.arrayBuffer();
const result = await sdMetadata.parse(arrayBuffer);

if (result.status === 'success') {
  console.log('Tool:', result.metadata.software);
  console.log('Prompt:', result.metadata.prompt);
}
```

> [!TIP]
> 安定性のため、`@require` では常に特定のバージョンを指定してください。

### 応用例

<details>
<summary>フォーマット変換</summary>

異なる画像フォーマット間でメタデータを変換：

```typescript
import { parse, write } from '@enslo/sd-metadata';

// PNGからメタデータを読み込み
const pngData = readFileSync('comfyui-output.png');
const parseResult = await parse(pngData);

if (parseResult.status === 'success') {
  // PNGをJPEGに変換（お好みの画像処理ライブラリを使用）
  const jpegImageData = convertToJpeg(pngData); // 疑似コード：sharp、canvasなどを使用
  
  // メタデータをJPEGに埋め込み
  const result = write(jpegImageData, parseResult);
  
  if (result.ok) {
    writeFileSync('output.jpg', result.value);
    console.log('画像をメタデータ付きでJPEGに変換しました');
  }
}
```

> **Tip:** このライブラリはメタデータの読み書きのみを扱います。実際の画像フォーマット変換（ピクセルのデコード/エンコード）には、[sharp](https://www.npmjs.com/package/sharp)、[jimp](https://www.npmjs.com/package/jimp)、ブラウザCanvas APIなどの画像処理ライブラリを使用してください。

</details>

<details>
<summary>読み込み結果のタイプごとの処理</summary>

```typescript
import { parse } from '@enslo/sd-metadata';

const result = await parse(imageData);

switch (result.status) {
  case 'success':
    // メタデータのパース成功
    console.log(`Generated by ${result.metadata.software}`);
    console.log(`Prompt: ${result.metadata.prompt}`);
    break;

  case 'c2pa':
    // C2PA Content Credentials — 下記「AI生成元の検出」を参照
    console.log(`AI生成元（未検証）: ${result.c2pa.vendor}`);
    console.log(`Claim generator: ${result.c2pa.claimGenerator ?? 'unknown'}`);
    break;

  case 'unrecognized':
    // メタデータは存在するがフォーマットが認識できない
    console.log('不明なメタデータフォーマット');
    // デバッグ用に生のメタデータにアクセス可能：
    console.log('Raw chunks:', result.raw);
    break;

  case 'empty':
    // メタデータが見つからない
    console.log('この画像にはメタデータがありません');
    break;

  case 'invalid':
    // 破損または無効な画像データ
    console.log('Error:', result.message);
    break;
}
```

</details>

<details>
<summary>未対応メタデータの扱い</summary>

未対応ツールのメタデータを含む画像を扱う場合：

```typescript
import { parse, write } from '@enslo/sd-metadata';

const source = await parse(unknownImage);
// source.status === 'unrecognized'

// ターゲット画像に書き込み
// - 同じフォーマット（例：PNG → PNG）：メタデータそのまま保持
// - 異なるフォーマット（例：PNG → JPEG）：warning付きでメタデータ削除
const result = write(targetImage, source);
if (result.ok) {
  saveFile('output.png', result.value);
  if (result.warning) {
    // クロスフォーマット変換によりメタデータが削除された場合
    console.warn('メタデータが削除されました:', result.warning.reason);
  }
}
```

</details>

<details>
<summary>AI生成元の検出（C2PA Content Credentials）</summary>

一部の商用ツール（OpenAI ChatGPT、Google Gemini）は、生成パラメータの代わりに C2PA Content Credentials を埋め込みます。これらの画像に対して `parse()` は `{ status: 'c2pa', c2pa }` を返します：

```typescript
import { parse, c2paVendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);

if (result.status === 'c2pa') {
  console.log('Vendor:', c2paVendorLabels[result.c2pa.vendor]);
  console.log('Declared AI-generated:', result.c2pa.aiGenerated);
  console.log('Claim generator:', result.c2pa.claimGenerator ?? 'unknown');
}
```

> **検出のみ — 証明にはなりません。** C2PA署名を検証しないため、`c2pa` の結果は偽造可能で、真正性の証明にはなりません。また Content Credentials は再アップロードや再エンコードで失われやすいため、`c2pa` にならないことも「AI生成ではない」ことの証明にはなりません。
>
> **現時点ではPNGのみ。** マニフェストはPNGの `caBX` チャンクから読み取ります。JPEG/WebPでの検出は対応予定です。

</details>

<details>
<summary>メタデータの削除</summary>

画像から全てのメタデータを削除：

```typescript
import { write } from '@enslo/sd-metadata';

const result = write(imageData, { status: 'empty' });
if (result.ok) {
  writeFileSync('clean-image.png', result.value);
}
```

</details>

<details>
<summary>カスタムメタデータの埋め込み</summary>

A1111フォーマットでカスタムメタデータを作成して埋め込み：

```typescript
import { embed } from '@enslo/sd-metadata';

const metadata = {
  prompt: 'masterpiece, best quality, 1girl',
  negativePrompt: 'lowres, bad quality',
  width: 512,
  height: 768,
  sampling: {
    steps: 20,
    sampler: 'Euler a',
    cfg: 7,
    seed: 12345,
  },
  model: { name: 'model.safetensors' },
};

// 任意の画像フォーマット（PNG、JPEG、WebP）に書き込み
const result = embed(imageData, metadata);
if (result.ok) {
  writeFileSync('output.png', result.value);
}
```

`extras` で設定行に任意のキーバリューを追加できます：

```typescript
const result = embed(imageData, {
  ...metadata,
  extras: {
    Version: 'v1.10.0',
    'Lora hashes': 'abc123',
  },
});
```

> **Tip:** extras のキーが構造化フィールド（例：`Steps`）と一致する場合、extras の値が元の位置で構造化フィールドを上書きします。新しいキーは末尾に追加されます。

`EmbedMetadata` はすべての `GenerationMetadata` バリアントのサブセットなので、パース結果のメタデータをそのまま渡せます — `characterPrompts` を持つ NovelAI も含めて：

```typescript
import { parse, embed } from '@enslo/sd-metadata';

const result = await parse(novelaiPng);
if (result.status === 'success') {
  // NovelAI（や他のツール）のメタデータをそのまま利用可能
  const output = embed(blankJpeg, result.metadata);
}
```

</details>

## APIリファレンス

### `parse(input: Uint8Array | ArrayBuffer, options?: ReadOptions): Promise<ParseResult>`

画像ファイルからメタデータを読み込み、パースします。読み取り可能なメタデータがない画像に対しては、追加でピクセルの Stealth PNGInfo をスキャンします（「Stealth PNGInfo の復元」セクションを参照）。スキャンはその場合にのみ実行されるため、通常のメタデータを持つ画像に追加コストはありません。

**パラメータ:**

- `input` - 画像ファイルデータ（PNG、JPEG、またはWebP）
- `options` - オプションの読み込み設定
  - `strict?: boolean`（デフォルト: `false`）— `true` の場合、寸法（`width` / `height`）はメタデータからのみ取得します。`false` の場合、メタデータに寸法がなければ画像ヘッダーから取得します。
  - `decodePixels?: (data, format) => Promise<RgbaPixels | null>` — プラットフォームがデコードできない環境（サーバー）で、stealth スキャン用に WebP ピクセルをデコードします。WebP に読み取り可能なメタデータがない場合にのみ遅延呼び出しされます。「WebP 画像」セクションを参照。

**戻り値:**

- `{ status: 'success', metadata, raw, stealth? }` - パース成功
  - `metadata`: 統一されたメタデータオブジェクト（`GenerationMetadata`を参照）
  - `raw`: 元のフォーマット固有のデータ（chunks/segments）
  - `stealth`: メタデータがピクセルLSBから復元された場合に `true`
- `{ status: 'c2pa', c2pa }` - 画像がC2PA Content Credentials（例：OpenAI ChatGPT、Google Gemini）を持つが、パース可能な生成メタデータがない
  - `c2pa`: 未検証の Content Credentials（`C2paMetadata`を参照）。検出のみ — 署名は検証されません。
- `{ status: 'unrecognized', raw, stealth? }` - 画像にメタデータがあるが既知のAIツールからではない
  - `raw`: 変換用に保持された元のメタデータ
  - `stealth`: 生データがピクセルLSBから復元された場合に `true`
- `{ status: 'empty' }` - 画像にメタデータが見つからない
- `{ status: 'invalid', message? }` - 破損または非対応の画像フォーマット
  - `message`: オプションのエラー説明

### `read(input: Uint8Array | ArrayBuffer, options?: ReadOptions): ParseResult`

> [!WARNING]
> **非推奨** — 代わりに `parse()` を使用してください。`read()` は同期・チャンク限定の読み取りが必要な場合のために残されていますが、Stealth PNGInfo は復元できません。

`parse()` と同一の動作ですが、同期実行で、ピクセルスキャンは行いません。

### `write(input: Uint8Array | ArrayBuffer, metadata: ParseResult): WriteResult`

画像ファイルにメタデータを書き込みます。

**パラメータ:**

- `input` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
- `metadata` - `parse()` から得られた `ParseResult`
  - `status: 'success'` または `'empty'` - 直接書き込み可能
  - `status: 'unrecognized'` - 同じフォーマット：そのまま書き込み、異なるフォーマット：warning付きでメタデータ削除
  - stealth 復元された結果もそのまま渡せます — 書き込むと元ツールのネイティブメタデータが復元されます（「剥がされたメタデータのレスキュー」セクションを参照）

**戻り値:**

- `{ ok: true, value: Uint8Array, warning?: WriteWarning }` - 書き込み成功
  - `warning` はメタデータが意図的に削除された場合に設定される（例：未対応のクロスフォーマット変換）
- `{ ok: false, error: { type, message? } }` - 失敗。`type` は以下のいずれか：
  - `'unsupportedFormat'`: 対象画像がPNG、JPEG、WebP以外の場合
  - `'conversionFailed'`: メタデータ変換に失敗（例：互換性のないフォーマット）
  - `'writeFailed'`: 画像へのメタデータ埋め込みに失敗、または再書き込みが不可能な場合

### `embed(input: Uint8Array | ArrayBuffer, metadata: EmbedMetadata | GenerationMetadata): WriteResult`

SD WebUI (A1111) フォーマットでカスタムメタデータを画像に埋め込みます。

**パラメータ:**

- `input` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
- `metadata` - 埋め込む `EmbedMetadata` または `GenerationMetadata`（`extras` で任意のキーバリューを追加可能）

**戻り値:**

- `{ ok: true, value: Uint8Array }` - 書き込み成功（新しい画像データを返す）
- `{ ok: false, error: { type, message? } }` - 失敗。`type` は以下のいずれか：
  - `'unsupportedFormat'`: 対象画像がPNG、JPEG、WebP以外の場合
  - `'writeFailed'`: 画像へのメタデータ埋め込みに失敗

**ユースケース:**

- プログラムで生成した画像にカスタムメタデータを作成
- 他のツールからWebUI互換フォーマットにメタデータを変換
- WebUIで読み取り可能なメタデータを出力するアプリケーションの構築

### `stringify(input: ParseResult | EmbedMetadata | GenerationMetadata): string`

メタデータを読みやすい文字列に変換します。`ParseResult`、`EmbedMetadata`、`GenerationMetadata` のいずれも受け付けます。

**パラメータ:**

- `input` - `ParseResult`、`EmbedMetadata`、または `GenerationMetadata`

**戻り値:**

- `ParseResult` の場合:
  - `success` → WebUIフォーマット
  - `c2pa` → claim generator 名（`claimGenerator ?? ''`）
  - `unrecognized` → 生テキスト
  - `empty` / `invalid` → 空文字列
- `EmbedMetadata` / `GenerationMetadata` の場合: WebUIフォーマットのテキスト

**ユースケース:**

- 画像ビューアやギャラリーでの生成パラメータ表示
- メタデータをクリップボードに読みやすいテキストとしてコピー
- パース結果のログ出力やデバッグ
- `EmbedMetadata` の事前プレビュー（埋め込み前の確認用）

### `softwareLabels: Record<GenerationSoftware, string>`

`GenerationSoftware` の識別子から表示用の名前への読み取り専用マッピング。

```typescript
import { softwareLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'success') {
  console.log(softwareLabels[result.metadata.software]);
  // => "NovelAI", "ComfyUI", "Stable Diffusion WebUI", etc.
}
```

### `c2paVendorLabels: Record<C2paVendor, string>`

`C2paVendor` の識別子から表示用の名前への読み取り専用マッピング。

```typescript
import { c2paVendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'c2pa') {
  console.log(c2paVendorLabels[result.c2pa.vendor]);
  // => "OpenAI (ChatGPT)", "Google (Gemini)", "AI-generated (Content Credentials)"
}
```

## 型リファレンス

このセクションでは主要な型の概要を説明します。完全な型定義については[型ドキュメント](./docs/types.ja.md)を参照してください。

### `ParseResult`

`parse()`（および非推奨の `read()`）関数の結果。`status` フィールドで分岐するユニオン型です。`stealth` は結果がピクセルLSB（Stealth PNGInfo）から復元された場合に `parse()` が `true` を設定します。

```typescript
type ParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: RawMetadata; stealth?: boolean }
  | { status: 'c2pa'; c2pa: C2paMetadata }
  | { status: 'unrecognized'; raw: RawMetadata; stealth?: boolean }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `GenerationMetadata`

`parse()` が返す統一されたメタデータ構造。`software` フィールドで判別される3つのメタデータ型のユニオン型です：

```typescript
type GenerationMetadata =
  | NovelAIMetadata   // 'novelai' — V4キャラクター配置フィールドを追加
  | ComfyUIMetadata   // 'comfyui' | 'tensorart' | 'stability-matrix' | 'swarmui' — ワークフローグラフ（nodes）を追加
  | StandardMetadata; // 'sd-webui', 'forge', 'invokeai', ... — 基本フィールドのみ
```

全バリアントが `BaseMetadata` のフィールド — `prompt`、`negativePrompt`、`width`、`height`、およびオプションの `model` / `sampling` / `hires` / `upscale` 設定 — を共有します。ツール固有のフィールドには `software` ディスクリミネータで絞り込んでアクセスします：

```typescript
if (result.status === 'success') {
  const metadata = result.metadata;
  console.log('Prompt:', metadata.prompt);
  console.log('Model:', metadata.model?.name);

  if (metadata.software === 'novelai') {
    // TypeScriptはこれがNovelAIMetadataであることを認識
    console.log('Character prompts:', metadata.characterPrompts);
  }
}
```

`BaseMetadata`、`EmbedMetadata`、`RawMetadata`、`GenerationSoftware`、各設定型を含む全エクスポート型の完全な定義については、[型ドキュメント](./docs/types.ja.md)を参照してください。

## 開発

開発のセットアップとガイドラインについては、[コントリビューションガイド](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md)を参照してください。

## ライセンス

MIT
