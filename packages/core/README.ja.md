# @enslo/sd-metadata

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

🔗 **[ライブデモ](https://sd-metadata.pages.dev/)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。

## 特徴

- **マルチフォーマット対応**: PNG (tEXt / iTXt / eXIf)、JPEG (COM / Exif)、WebP (Exif)、さらに MP4 / MOV、WebM / MKV 動画（読み取りのみ）
- **シンプルAPI**: `parse()`、`write()`、`embed()`、`stringify()` — 4つの関数で画像の全ユースケースをカバー。動画は `parseVideo()` で
- **Stealth PNGInfo の復元**: NovelAI や stealth-pnginfo 拡張がピクセルの最下位ビットに隠したメタデータを、画像ホストに通常のメタデータを剥がされた後でも復元
- **LoRA 対応**: A1111 のタグ、ツールの JSON、ComfyUI のローダーノードから、画像に適用された LoRA を一覧化
- **TypeScriptネイティブ**: TypeScriptで書かれており、型定義を完全同梱
- **ゼロ依存**: Node.jsとブラウザで外部依存なしで動作
- **フォーマット変換**: PNG、JPEG、WebP間でメタデータをシームレスに変換
- **メタデータ保持**: フォーマット変換時に元のメタデータ構造を保持（例：PNG → JPEG → PNG で全データを維持）
- **AI生成元の検出**: 商用AIサービス（OpenAI、Google、xAI、Meta）が自社製と宣言した画像・動画を、C2PA、XMP、署名のマーカーから識別 — 検出のみ、署名検証なし

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

Node.js、ブラウザ、ユーザースクリプトでの利用方法は[使い方](#使い方)を、その他の結果ステータス（`vendor`、`unrecognized`、`empty`、`invalid`）の扱いは[応用例](#応用例)を参照してください。

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
| [Civitai](https://civitai.com/) | ✅ | ✅ | ⚠️ |
| [TensorArt](https://tensor.art/) | ✅ | 🔄️ | 🔄️ |
| [Stability Matrix](https://github.com/LykosAI/StabilityMatrix) | ✅ | 🔄️ | 🔄️ |
| [HuggingFace Space](https://huggingface.co/spaces) | ✅ | 🔄️ | 🔄️ |
| [Fooocus](https://github.com/lllyasviel/Fooocus) | ✅ | ✅ | ✅ |
| [Ruined Fooocus](https://github.com/runew0lf/RuinedFooocus) | ✅ | 🔄️ | 🔄️ |
| [Easy Diffusion](https://github.com/easydiffusion/easydiffusion) | ✅ | ✅ | ✅ |
| [Draw Things](https://drawthings.ai/) | ✅ | 🔄️ | 🔄️ |
| [Dezgo](https://dezgo.com/) | ✅ | ✅ | ✅ |
| [KusArt](https://kusart.com/) | ✅ | 🔄️ | 🔄️ |

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
> **ツールサポートの拡大にご協力ください！** 実験的な組み合わせ（Civitai の WebP）やサポートされていないツールのサンプル画像を募集しています。これらのAIツールで生成したサンプル画像をお持ちの方は、ぜひご提供ください！詳細は[CONTRIBUTING.md](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md)を参照してください。

### 動画

`parseVideo()` は MP4 / MOV（QuickTime）と WebM / MKV（Matroska）ファイルを読み取ります。生成メタデータは画像と同じパーサーを通るため、いつものテキストを動画のタグに書き込むツールは、画像と同じ `software` として報告されます。以下のツールのサンプルファイルで検証済みです：

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) — ビルトインの `SaveVideo` ノードと [VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) の `Video Combine`（MP4、WebM、MKV。ProRes の MOV 出力にはメタデータが含まれません）
- [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) — Wan 2.2 の動画（MP4、MKV）

動画は読み取り専用です。`write()` と `embed()` は画像を対象とします。[動画ファイル](#動画ファイル)を参照してください。

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

## 動画ファイル

`parseVideo()` は MP4 / MOV と WebM / MKV ファイルから生成メタデータを読み取ります。結果のステータスは `parse()` と同じです。`Blob`（ブラウザの `File`、または Node.js の `fs.openAsBlob()`）を渡すと、メタデータを持つバイト範囲だけを読み取るため、大きなファイルでも丸ごと読み込むことはありません：

```typescript
import { parseVideo, stringify } from '@enslo/sd-metadata';
import { openAsBlob } from 'node:fs';

const result = await parseVideo(await openAsBlob('output.mp4')); // または <input> から得た File
if (result.status === 'success') {
  console.log(result.metadata.software); // 'comfyui', 'forge-neo', ...
  console.log(result.metadata.prompt);
  console.log(result.raw.format);        // 'mp4' | 'mov' | 'webm' | 'mkv'
  console.log(result.raw.tags);          // ファイル内のテキストタグ（ファイル順）
}

console.log(stringify(result)); // 画像と同じ A1111 形式のテキスト
```

商用サービスの動画（Google Veo、xAI Grok Imagine、Meta Muse、OpenAI Sora）は `vendor` ステータスで報告されます — [応用例](#応用例)の「AI生成元の検出」を参照してください。動画へのメタデータ書き込みには対応していません。

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
import { parse, productLabel, vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);

switch (result.status) {
  case 'success':
    // メタデータのパース成功
    console.log(`Generated by ${result.metadata.software}`);
    console.log(`Prompt: ${result.metadata.prompt}`);
    break;

  case 'vendor':
    // 商用AIサービスが自社製と宣言した画像 — 下記「AI生成元の検出」を参照
    console.log(`Made by ${vendorLabels[result.info.vendor]} ${productLabel(result.info)} (unverified)`);
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
<summary>AI生成元の検出（ベンダー宣言）</summary>

商用AIサービスは、生成パラメータの代わりに「この画像は自社が作った」という宣言 — 署名付きの C2PA "Content Credentials" マニフェスト、XMP パケット内の IPTC DigitalSourceType、またはベンダー独自の署名 — を埋め込みます。これらのファイルに対して `parse()` と `parseVideo()` は `{ status: 'vendor', info }` を返します：

```typescript
import { parse, productLabel, vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);

if (result.status === 'vendor') {
  console.log('Vendor:', vendorLabels[result.info.vendor]); // "OpenAI", "Google", "xAI", "Meta"
  console.log('Service:', productLabel(result.info));       // "GPT Image", "Gemini", "Grok Imagine", "Muse"
  console.log('Declared in:', result.info.source);          // 'c2pa' | 'xmp' | 'signature'
  console.log('As written:', result.info.product);          // 例："ChatGPT"、または undefined
}
```

| ベンダー | サービス | 宣言の形式 | 画像 | 動画 |
| ------ | ------- | ----------- | ------ | ------ |
| OpenAI | GPT Image (ChatGPT)、Sora | C2PA | PNG | MP4 |
| Google | Gemini、Veo | C2PA | PNG、JPEG | MP4 |
| xAI | Grok Imagine | C2PA、署名 | JPEG | MP4 |
| Meta | Muse | XMP | JPEG、WebP | MP4 |

`productLabel()` はサービス名を返します。既知のプロダクト値（`ChatGPT`、`gpt-image` など）はそのサービス名に対応付けられ、プロダクトのない宣言はメディアごとのベンダーの主要サービス（画像：GPT Image、Gemini、Grok Imagine、Muse。動画：Sora、Veo、Grok Imagine、Muse）にフォールバックします。宣言された値そのものは `info.product` に残ります。

> **検出のみ — 証明にはなりません。** 署名は一切検証しないため、`vendor` の結果は偽造可能で、真正性の証明にはなりません。これらのマーカーはスクリーンショット・再アップロード・再エンコードで簡単に失われるため、`vendor` にならないことも「AI生成ではない」ことの証明にはなりません。

</details>

<details>
<summary>LoRA の読み取り</summary>

`metadata.loras` は画像に影響した LoRA を、ツールが記録した順に一覧化します。LoRA がない場合はフィールド自体が存在しません：

```typescript
import { parse } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'success') {
  for (const lora of result.metadata.loras ?? []) {
    console.log(lora.name);       // ツールが書いたまま：拡張子を除いたファイル名、パス、URN、表示名
    console.log(lora.weight);     // UNet / モデル側の強度（記録されている場合）
    console.log(lora.clipWeight); // テキストエンコーダ側の強度（別々に記録されている場合のみ）
    console.log(lora.hash);       // 書かれたまま（AutoV2、sha256、"blake3:..."）。正規化なし
  }
}
```

一覧の元になるのは、A1111 形式テキストの `<lora:…>` タグと `Lora hashes`、各ツールが JSON に書く LoRA リスト（SwarmUI、InvokeAI、Fooocus、Easy Diffusion、Draw Things、TensorArt、Dezgo、KusArt など）、そして ComfyUI のローダーノードです。ComfyUI ではサンプラーが実際に依存するローダーのみを対象とするため、バイパスされたローダーや未接続のローダーは一覧に含まれません。

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
    seed: '12345', // シードは文字列 — 64ビット値を使うツールがあるため
  },
  model: { name: 'model.safetensors' },
  loras: [{ name: 'detail_tweaker', weight: 0.8 }], // <lora:detail_tweaker:0.8> として書き出し
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
  extras: { Version: 'v1.10.0', 'Lora hashes': 'abc123' },
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

画像ファイルからメタデータを読み込み、パースします。読み取り可能なメタデータがない画像に対しては、追加でピクセルの Stealth PNGInfo をスキャンします（[Stealth PNGInfo の復元](#stealth-pnginfo-の復元)を参照）。スキャンはその場合にのみ実行されるため、通常のメタデータを持つ画像に追加コストはありません。

**パラメータ:**

- `input` - 画像ファイルデータ（PNG、JPEG、またはWebP）
- `options` - オプションの読み込み設定
  - `strict?: boolean`（デフォルト: `false`）— `true` の場合、寸法（`width` / `height`）はメタデータからのみ取得します。`false` の場合、メタデータに寸法がなければ画像ヘッダーから取得します。
  - `decodePixels?: (data, format) => Promise<RgbaPixels | null>` — プラットフォームがデコードできない環境（サーバー）で、stealth スキャン用に WebP ピクセルをデコードします。WebP に読み取り可能なメタデータがない場合にのみ遅延呼び出しされます。[WebP 画像](#webp-画像)を参照。

**戻り値:**

- `{ status: 'success', metadata, raw, stealth? }` - パース成功
  - `metadata`: 統一されたメタデータオブジェクト（`GenerationMetadata`を参照）
  - `raw`: 元のフォーマット固有のデータ（chunks/segments）
  - `stealth`: メタデータがピクセルLSBから復元された場合に `true`
- `{ status: 'vendor', info }` - 商用AIサービス（OpenAI、Google、xAI、Meta）が自社製と宣言した画像。読み取れる生成パラメータはありません
  - `info`: `VendorInfo` — `vendor`、`product`（宣言されていれば、そのまま）、`source`（`'c2pa' | 'xmp' | 'signature'`）、`media: 'image'`。検出のみ — 何も検証しません。
- `{ status: 'unrecognized', raw, stealth? }` - 画像にメタデータがあるが既知のAIツールからではない
  - `raw`: 変換用に保持された元のメタデータ
  - `stealth`: 生データがピクセルLSBから復元された場合に `true`
- `{ status: 'empty' }` - 画像にメタデータが見つからない
- `{ status: 'invalid', message? }` - 破損または非対応の画像フォーマット
  - `message`: オプションのエラー説明

### `parseVideo(input: Uint8Array | ArrayBuffer | Blob, options?: VideoReadOptions): Promise<VideoParseResult>`

動画ファイル（MP4 / MOV、WebM / MKV）からメタデータを読み込み、パースします。[動画ファイル](#動画ファイル)を参照してください。

**パラメータ:**

- `input` - 動画ファイルデータ、または `Blob` / `File`。`Blob` は丸ごと読み込まず、メタデータを持つボックスや要素だけを小さな範囲で読み取ります。
- `options` - オプションの読み込み設定
  - `strict?: boolean`（デフォルト: `false`）— `true` の場合、寸法はメタデータからのみ取得します。`false` の場合、メタデータに寸法がなければ動画トラックから取得します。

**戻り値:**

`parse()` と同じステータスです。`RawMetadata` の代わりに `VideoRawMetadata`（`format` とファイルのテキスト `tags`）を持ち、vendor の `info` は `media: 'video'` になります。動画に stealth データはなく、`VideoParseResult` を `write()` に渡すことはできません。

### `read(input: Uint8Array | ArrayBuffer, options?: ReadOptions): ParseResult`

> [!WARNING]
> **非推奨** — 代わりに [`parse()`](#parseinput-uint8array--arraybuffer-options-readoptions-promiseparseresult) を使用してください。`read()` は同期・チャンク限定の読み取りが必要な場合のために残されていますが、Stealth PNGInfo は復元できません。

`parse()` と同一の動作ですが、同期実行で、ピクセルスキャンは行いません。

### `write(input: Uint8Array | ArrayBuffer, metadata: ParseResult): WriteResult`

画像ファイルにメタデータを書き込みます。

**パラメータ:**

- `input` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
- `metadata` - `parse()` から得られた `ParseResult`
  - `status: 'success'` または `'empty'` - 直接書き込み可能
  - `status: 'unrecognized'` - 同じフォーマット：そのまま書き込み、異なるフォーマット：warning付きでメタデータ削除
  - stealth 復元された結果もそのまま渡せます — 書き込むと元ツールのネイティブメタデータが復元されます（[剥がされたメタデータのレスキュー](#剥がされたメタデータのレスキュー)を参照）

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

### `stringify(input: ParseResult | VideoParseResult | EmbedMetadata | GenerationMetadata): string`

メタデータを読みやすい文字列に変換します。

**パラメータ:**

- `input` - 以下のいずれか：
  - `parse()` の `ParseResult` または `parseVideo()` の `VideoParseResult` — ステータスに応じて最適な表現を選択
  - `EmbedMetadata` または `GenerationMetadata` — そのまま A1111 テキストにフォーマット

**戻り値:**

- `ParseResult` / `VideoParseResult` の場合:
  - `success` → A1111 形式のテキスト。A1111 テキストを自ら書き出すツール（sd-webui、Forge 系、reForge、SD.Next など）では、ツールが書いた元のテキストをそのまま返すため、ライブラリが扱わないキーも残ります。それ以外のツールではメタデータから LoRA を含めてテキストを再構築します
  - `vendor` → `<ベンダー> <サービス>`（例：`OpenAI GPT Image`）。ベンダー不明の場合はサービス名のみ
  - `unrecognized` → 生のメタデータをプレーンテキストで
  - `empty` / `invalid` → 空文字列
- `EmbedMetadata` / `GenerationMetadata` の場合: A1111 形式のテキスト

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

### `vendorLabels: Record<Vendor, string>`

`Vendor` の識別子から企業名への読み取り専用マッピング。

```typescript
import { vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'vendor') {
  console.log(vendorLabels[result.info.vendor]);
  // => "OpenAI", "Google", "xAI", "Meta", "Unknown"
}
```

### `productLabel(info: VendorInfo): string`

ベンダーの画像・動画を作ったAIサービスの表示名を返します。既知の宣言値（`ChatGPT`、`gpt-image`、`Grok Imagine` など）はそのサービス名に対応付けられ、プロダクトのない宣言はメディアごとのベンダーの主要サービス（画像：GPT Image、Gemini、Grok Imagine、Muse。動画：Sora、Veo、Grok Imagine、Muse）にフォールバックします。未知のプロダクト値は書かれたまま返します。

```typescript
import { productLabel, vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'vendor') {
  console.log(`${vendorLabels[result.info.vendor]} ${productLabel(result.info)}`);
  // => "OpenAI GPT Image", "Google Gemini", "xAI Grok Imagine", "Meta Muse"
}
```

## 型リファレンス

このセクションでは主要な型の概要を説明します。完全な型定義については[型ドキュメント](./docs/types.ja.md)を参照してください。

### `ParseResult`

`parse()`（および非推奨の `read()`）関数の結果。`status` フィールドで分岐するユニオン型です。`stealth` は結果がピクセルLSB（Stealth PNGInfo）から復元された場合に `parse()` が `true` を設定します。

```typescript
type ParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: RawMetadata; stealth?: boolean }
  | { status: 'vendor'; info: VendorInfo }
  | { status: 'unrecognized'; raw: RawMetadata; stealth?: boolean }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `VideoParseResult`

`parseVideo()` の結果。ステータスは `ParseResult` と同じです。`raw` はチャンクやセグメントの代わりに、コンテナのフォーマットとファイルのテキストタグを持ちます。

```typescript
type VideoParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: VideoRawMetadata }
  | { status: 'vendor'; info: VendorInfo }
  | { status: 'unrecognized'; raw: VideoRawMetadata }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `GenerationMetadata`

`parse()` と `parseVideo()` が返す統一されたメタデータ構造。`software` フィールドで判別される3つのメタデータ型のユニオン型です：

```typescript
type GenerationMetadata =
  | NovelAIMetadata   // 'novelai' — V4キャラクター配置フィールドを追加
  | ComfyUIMetadata   // 'comfyui' | 'tensorart' | 'stability-matrix' | 'swarmui' — ワークフローグラフ（nodes）を追加
  | StandardMetadata; // 'sd-webui', 'forge', 'invokeai', 'dezgo', ... — 基本フィールドのみ
```

全バリアントが `BaseMetadata` のフィールド — `prompt`、`negativePrompt`、`width`、`height`、オプションの `model` / `sampling` / `hires` / `upscale` 設定、および `loras` リスト — を共有します。ツール固有のフィールドには `software` ディスクリミネータで絞り込んでアクセスします：

```typescript
if (result.status === 'success') {
  const metadata = result.metadata;
  console.log('Prompt:', metadata.prompt);
  console.log('Model:', metadata.model?.name);
  console.log('Seed:', metadata.sampling?.seed); // 文字列

  if (metadata.software === 'novelai') {
    // TypeScriptはこれがNovelAIMetadataであることを認識
    console.log('Character prompts:', metadata.characterPrompts);
  }
}
```

`BaseMetadata`、`EmbedMetadata`、`RawMetadata`、`VendorInfo`、`LoraSettings`、`GenerationSoftware`、各設定型を含む全エクスポート型の完全な定義については、[型ドキュメント](./docs/types.ja.md)を参照してください。

## 開発

開発のセットアップとガイドラインについては、[コントリビューションガイド](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md)を参照してください。

## ライセンス

MIT
