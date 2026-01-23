# sd-metadata

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。

## 特徴

- **マルチフォーマット対応**: PNG (tEXt / iTXt)、JPEG (COM / Exif)、WebP (Exif)
- **統一API**: シンプルな `read()` と `write()` 関数で全フォーマットに対応
- **TypeScriptネイティブ**: TypeScriptで書かれており、型定義を完全同梱
- **ゼロ依存**: Node.jsとブラウザで外部依存なしで動作
- **フォーマット変換**: PNG、JPEG、WebP間でメタデータをシームレスに変換
- **メタデータ保持**: フォーマット変換時に元のメタデータ構造を保持（例：PNG → JPEG → PNG で全データを維持）

## インストール

```bash
npm install @enslo/sd-metadata
```

## ツールサポート

| ツール | PNG | JPEG | WebP |
| ------ | :---: | :----: | :----: |
| [NovelAI](https://novelai.net/) * | ✅ | 🔄️ | ✅ |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) * | ✅ | 🔄️ | 🔄️ |
| [AUTOMATIC1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | ⚠️ | ⚠️ | ⚠️ |
| [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) / [Forge Neo](https://github.com/neggles/sd-webui-forge-neoforge) | ✅ | ✅ | ✅ |
| [InvokeAI](https://github.com/invoke-ai/InvokeAI) | ✅ | 🔄️ | 🔄️ |
| [SwarmUI](https://github.com/Stability-AI/StableSwarmUI) * | ✅ | ✅ | ✅ |
| [Civitai](https://civitai.com/) | ⚠️ | ✅ | ⚠️ |
| [TensorArt](https://tensor.art/) | ✅ | 🔄️ | 🔄️ |
| [Stability Matrix](https://github.com/LykosAI/StabilityMatrix) | ✅ | 🔄️ | 🔄️ |
| [HuggingFace Space](https://huggingface.co/spaces) | ✅ | 🔄️ | 🔄️ |
| [Ruined Fooocus](https://github.com/runew0lf/RuinedFooocus) | ✅ | 🔄️ | 🔄️ |
| [Easy Diffusion](https://github.com/easydiffusion/easydiffusion) | ⚠️ | ⚠️ | ⚠️ |
| [Fooocus](https://github.com/lllyasviel/Fooocus) | ⚠️ | ⚠️ | ⚠️ |

**凡例:**

- ✅ **完全対応** - ツールがネイティブでサポートするフォーマット。サンプルファイルで検証済み
- 🔄️ **拡張対応** - ツールがネイティブでサポートしないフォーマット。sd-metadataがカスタムフォーマット変換により読み書きを可能に。ネイティブフォーマットへのラウンドトリップ変換に対応
- ⚠️ **実験的** - リファレンスコードやドキュメントの分析により実装。サンプルファイルでの検証は未実施。全てのメタデータフィールドを正しく抽出できない可能性あり

**拡張対応の例:**

- **Stability Matrix**（ネイティブ: PNGのみ）→ sd-metadataがJPEG/WebPをサポート
- **NovelAI**（ネイティブ: PNG、WebP）→ sd-metadataがJPEGをサポート

ネイティブフォーマットから拡張フォーマットに変換し、再度戻す場合（例：PNG → JPEG → PNG）、全てのメタデータが保持されます。

> [!NOTE]
> \* フォーマット固有の動作があるツール。詳細は[フォーマット固有の動作](#フォーマット固有の動作)を参照してください。

> [!TIP]
> **ツールサポートの拡大にご協力ください！** 実験的なツール（Easy Diffusion、Fooocus）やサポートされていないツールのサンプル画像を募集しています。これらのAIツールで生成したサンプル画像をお持ちの方は、ぜひご提供ください！詳細は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## フォーマット固有の動作

一部のツールはフォーマット変換時に特定の動作をします：

- **ComfyUI JPEG/WebP**: 読み込みは複数のカスタムノードフォーマット（例：`save-image-extended`）に対応していますが、書き込みは情報保持とComfyUIネイティブのドラッグ＆ドロップワークフロー読み込みとの互換性のため、常に `comfyui-saveimage-plus` フォーマットを使用します。
- **NovelAI WebP**: Descriptionフィールドの破損したUTF-8を自動修正します。WebP → PNG → WebP のラウンドトリップは有効で読み取り可能なメタデータを生成しますが、軽微なテキスト修正が含まれます。
- **SwarmUI PNG→JPEG/WebP**: ネイティブのSwarmUI JPEG/WebPファイルにはノード情報が含まれません。PNGから変換する際、このライブラリは完全なメタデータ保持のためにComfyUIワークフローを `Make` フィールドに保存します（拡張対応）。

## インポート

**ESM (TypeScript / Modern JavaScript):**

```typescript
import { read } from '@enslo/sd-metadata';
```

**CommonJS (Node.js):**

```javascript
const { read } = require('@enslo/sd-metadata');
```

> [!NOTE]
> 以下の例は全てESM構文を使用しています。CommonJSユーザーは `import` を `require` に置き換えてください。

## 使い方

### Node.jsでの使用

```typescript
import { read, write } from '@enslo/sd-metadata';
import { readFileSync, writeFileSync } from 'fs';

// サポートされている任意のフォーマットからメタデータを読み込み
const imageData = readFileSync('image.png');
const result = read(imageData);

if (result.status === 'success') {
  console.log('Tool:', result.metadata.software);       // 'novelai', 'comfyui', etc.
  console.log('Prompt:', result.metadata.prompt);
  console.log('Model:', result.metadata.model?.name);
  console.log('Size:', result.metadata.width, 'x', result.metadata.height);
}
```

### ブラウザでの使用

```typescript
import { read } from '@enslo/sd-metadata';

// ファイル入力を処理
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const arrayBuffer = await file.arrayBuffer();
  const imageData = new Uint8Array(arrayBuffer);
  
  const result = read(imageData);
  
  if (result.status === 'success') {
    document.getElementById('tool').textContent = result.metadata.software;
    document.getElementById('prompt').textContent = result.metadata.prompt;
    document.getElementById('model').textContent = result.metadata.model?.name || 'N/A';
  }
});
```

### CDN使用（ブックマークレット / ユーザースクリプト）

ブックマークレットやユーザースクリプト（Tampermonkey、Violentmonkeyなど）では、jsDelivr CDNから読み込みます：

```javascript
// CDNからインポート
import { read } from 'https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@latest/dist/index.js';

// 画像を取得してメタデータを読み込み
const response = await fetch(imageUrl);
const arrayBuffer = await response.arrayBuffer();
const imageData = new Uint8Array(arrayBuffer);

const result = read(imageData);
if (result.status === 'success') {
  console.log('Tool:', result.metadata.software);
  console.log('Prompt:', result.metadata.prompt);
}
```

> [!TIP]
> 本番環境では `@latest` の代わりに特定のバージョンを指定してください：
>
> ```text
> https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@1.4.0/dist/index.js
> ```

### 応用例

<details>
<summary>フォーマット変換</summary>

異なる画像フォーマット間でメタデータを変換：

```typescript
import { read, write } from '@enslo/sd-metadata';

// PNGからメタデータを読み込み
const pngData = readFileSync('comfyui-output.png');
const parseResult = read(pngData);

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

> [!TIP]
> このライブラリはメタデータの読み書きのみを扱います。実際の画像フォーマット変換（ピクセルのデコード/エンコード）には、[sharp](https://www.npmjs.com/package/sharp)、[jimp](https://www.npmjs.com/package/jimp)、ブラウザCanvas APIなどの画像処理ライブラリを使用してください。

</details>

<details>
<summary>読み込み結果のタイプごとの処理</summary>

```typescript
import { read } from '@enslo/sd-metadata';

const result = read(imageData);

switch (result.status) {
  case 'success':
    // メタデータのパース成功
    console.log(`Generated by ${result.metadata.software}`);
    console.log(`Prompt: ${result.metadata.prompt}`);
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
import { read, write } from '@enslo/sd-metadata';

const source = read(unknownImage);
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
<summary>WebUIフォーマットでメタデータを書き込む</summary>

SD WebUI (A1111) フォーマットでカスタムメタデータを作成して埋め込み：

```typescript
import { writeAsWebUI } from '@enslo/sd-metadata';

// カスタムメタデータをゼロから作成
const metadata = {
  software: 'sd-webui',
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
const result = writeAsWebUI(imageData, metadata);
if (result.ok) {
  writeFileSync('output.png', result.value);
}
```

> [!TIP]
> `writeAsWebUI` は以下の場合に特に便利です：
>
> - プログラムで生成した画像に生成パラメータを埋め込みたい場合
> - ツール固有フォーマットからWebUI互換フォーマットにメタデータを変換する場合
> - WebUIで読み取り可能なメタデータを出力するツールを構築する場合

</details>

<details>
<summary>表示用にメタデータをフォーマット</summary>

**どのツールのメタデータであっても**、統一されたWebUIフォーマットのテキストに変換できます。ツール間の差異（NovelAI、ComfyUI、Forgeなど）を吸収し、一貫したテキスト形式に正規化します：

```typescript
import { read, formatAsWebUI } from '@enslo/sd-metadata';

const result = read(imageData);
if (result.status === 'success') {
  // どのツールでもOK: NovelAI, ComfyUI, Forge, InvokeAI, etc.
  const text = formatAsWebUI(result.metadata);
  console.log(text);
  
  // 常に統一されたWebUIフォーマットで出力:
  // masterpiece, best quality, 1girl
  // Negative prompt: lowres, bad quality
  // Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x768, Model: model.safetensors
}
```

> [!NOTE]
> どのツールで生成された画像であっても、`formatAsWebUI` は共通の生成パラメータを抽出し、標準化された形式に整形します。ツール固有のフォーマットを意識することなく、ユーザーにメタデータを表示するのに最適です。

</details>

## APIリファレンス

### `read(data: Uint8Array): ParseResult`

画像ファイルからメタデータを読み込み、パースします。

**戻り値:**

- `{ status: 'success', metadata, raw }` - パース成功
  - `metadata`: 統一されたメタデータオブジェクト（`GenerationMetadata`を参照）
  - `raw`: 元のフォーマット固有のデータ（chunks/segments）
- `{ status: 'unrecognized', raw }` - 画像にメタデータがあるが既知のAIツールからではない
  - `raw`: 変換用に保持された元のメタデータ
- `{ status: 'empty' }` - 画像にメタデータが見つからない
- `{ status: 'invalid', message? }` - 破損または非対応の画像フォーマット
  - `message`: オプションのエラー説明

### `write(data: Uint8Array, metadata: ParseResult): WriteResult`

画像ファイルにメタデータを書き込みます。

**パラメータ:**

- `data` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
- `metadata` - `read()` から得られた `ParseResult`
  - `status: 'success'` または `'empty'` - 直接書き込み可能
  - `status: 'unrecognized'` - 同じフォーマット：そのまま書き込み、異なるフォーマット：warning付きでメタデータ削除

**戻り値:**

- `{ ok: true, value: Uint8Array, warning?: WriteWarning }` - 書き込み成功
  - `warning` はメタデータが意図的に削除された場合に設定される（例：未対応のクロスフォーマット変換）
- `{ ok: false, error: { type, message? } }` - 失敗。`type` は以下のいずれか：
  - `'unsupportedFormat'`: 対象画像がPNG、JPEG、WebP以外の場合
  - `'conversionFailed'`: メタデータ変換に失敗（例：互換性のないフォーマット）
  - `'writeFailed'`: 画像へのメタデータ埋め込みに失敗

### `writeAsWebUI(data: Uint8Array, metadata: GenerationMetadata): WriteResult`

SD WebUI (A1111) フォーマットで画像にメタデータを書き込みます。

**パラメータ:**

- `data` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
- `metadata` - 埋め込む生成メタデータ
  - 任意のツールからでも、カスタム作成でも可能
  - 自動的にWebUIフォーマットに変換される

**戻り値:**

- `{ ok: true, value: Uint8Array }` - 書き込み成功（新しい画像データを返す）
- `{ ok: false, error: { type, message? } }` - 失敗。`type` は以下のいずれか：
  - `'unsupportedFormat'`: 対象画像がPNG、JPEG、WebP以外の場合
  - `'writeFailed'`: 画像へのメタデータ埋め込みに失敗

**ユースケース:**

- プログラムで生成した画像にカスタムメタデータを作成
- 他のツールからWebUI互換フォーマットにメタデータを変換
- WebUIで読み取り可能なメタデータを出力するアプリケーションの構築

### `formatAsWebUI(metadata: GenerationMetadata): string`

メタデータをSD WebUI (A1111) フォーマットのテキストにフォーマットします。

**パラメータ:**

- `metadata` - 任意のツールからの生成メタデータ

**戻り値:**

- WebUIフォーマットの文字列（プレーンテキスト）

**出力フォーマット:**

```text
positive prompt
[NovelAIのキャラクタープロンプト]
Negative prompt: negative prompt
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x768, ...
```

**ユースケース:**

- ユーザーに一貫したフォーマットでメタデータを表示
- 生成パラメータをテキストとしてコピー
- 生成設定のログ出力やデバッグ

### `formatRaw(raw: RawMetadata): string`

生のメタデータをプレーンテキストとしてフォーマットします。

**パラメータ:**

- `raw` - `ParseResult` から得られた生のメタデータ（`result.raw`）

**戻り値:**

- メタデータのプレーンテキスト内容（複数エントリは空行で区切られる）

**ユースケース:**

- 認識できないメタデータをユーザーに表示
- 生のメタデータ内容の素早い確認
- パース失敗時のフォールバック表示

**例:**

```typescript
import { read, formatAsWebUI, formatRaw } from '@enslo/sd-metadata';

const result = read(imageData);

switch (result.status) {
  case 'success':
    console.log(formatAsWebUI(result.metadata));
    break;
  case 'unrecognized':
    console.log(formatRaw(result.raw));
    break;
}
```

## 型リファレンス

このセクションでは主要な型の概要を説明します。完全な型定義については[型ドキュメント](./docs/types.ja.md)を参照してください。

### `ParseResult`

`read()` 関数の結果。`status` フィールドで分岐するユニオン型です。

```typescript
type ParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: RawMetadata }
  | { status: 'unrecognized'; raw: RawMetadata }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `GenerationMetadata`

`read()` 関数が返す統一されたメタデータ構造。`software` フィールドで区別される3つのメタデータ型のユニオン型です。

**共通フィールド（全タイプで利用可能）:**

全てのメタデータ型にはこれらの基本フィールドが含まれます：

- `prompt: string` - ポジティブプロンプトテキスト
- `negativePrompt: string` - ネガティブプロンプトテキスト
- `width: number` - 画像の幅（ピクセル）
- `height: number` - 画像の高さ（ピクセル）
- `model?: ModelSettings` - モデル情報（name、hash、VAE）
- `sampling?: SamplingSettings` - サンプリングパラメータ（seed、steps、CFG、sampler、scheduler、clipSkip）
- `hires?: HiresSettings` - Hires.fix設定（適用されている場合）
- `upscale?: UpscaleSettings` - アップスケール設定（適用されている場合）

**メタデータ型のバリアント:**

- **`NovelAIMetadata`** (`software: 'novelai'`)  
  V4キャラクター配置用のNovelAI固有フィールドを含む：
  - `characterPrompts?: CharacterPrompt[]` - キャラクターごとのプロンプトと位置
  - `useCoords?: boolean` - 配置にキャラクター座標を使用
  - `useOrder?: boolean` - キャラクターの順序を使用

- **`ComfyUIMetadata`** (`software: 'comfyui' | 'tensorart' | 'stability-matrix' | 'swarmui'`)  
  ComfyUIワークフローグラフを含む：
  - `nodes: ComfyNodeGraph`（comfyui/tensorart/stability-matrixでは必須）
  - `nodes?: ComfyNodeGraph`（swarmuiではオプション - PNGフォーマットのみ）

- **`StandardMetadata`** (`software: 'sd-webui' | 'forge' | 'invokeai' | 'civitai' | ...`)  
  ツール固有の拡張なしのベースラインメタデータ。ほとんどのSD WebUIベースのツールで使用。

**型定義:**

```typescript
type GenerationMetadata =
  | NovelAIMetadata
  | ComfyUIMetadata
  | StandardMetadata;
```

**使用例:**

```typescript
const result = read(imageData);

if (result.status === 'success') {
  const metadata = result.metadata;
  
  // 共通フィールドにアクセス
  console.log('Prompt:', metadata.prompt);
  console.log('Model:', metadata.model?.name);
  console.log('Seed:', metadata.sampling?.seed);
  
  // ユニオン型を使用したタイプ固有の処理
  if (metadata.software === 'novelai') {
    // TypeScriptはこれがNovelAIMetadataであることを認識
    console.log('Character prompts:', metadata.characterPrompts);
  } else if (
    metadata.software === 'comfyui' ||
    metadata.software === 'tensorart' ||
    metadata.software === 'stability-matrix'
  ) {
    // TypeScriptはこれがBasicComfyUIMetadata（nodesは常に存在）であることを認識
    console.log('Node count:', Object.keys(metadata.nodes).length);
  } else if (metadata.software === 'swarmui') {
    // TypeScriptはこれがSwarmUIMetadata（nodesはオプション）であることを認識
    if (metadata.nodes) {
      console.log('Workflow included');
    }
  }
}
```

各メタデータ型の詳細なインターフェース定義については[型ドキュメント](./docs/types.ja.md)を参照してください。

### `RawMetadata`

ラウンドトリップ変換のために元のメタデータ構造を保持します。

```typescript
type RawMetadata =
  | { format: 'png'; chunks: PngTextChunk[] }
  | { format: 'jpeg'; segments: MetadataSegment[] }
  | { format: 'webp'; segments: MetadataSegment[] };
```

> [!TIP]
> TypeScriptユーザー向け：全ての型はエクスポートされており、インポートして使用できます。
>
> ```typescript
> import type { 
>   ParseResult, 
>   GenerationMetadata, 
>   ModelSettings, 
>   SamplingSettings 
> } from '@enslo/sd-metadata';
> ```
>
> IDEのIntelliSenseを使用して自動補完とインラインドキュメントを活用してください。

`ModelSettings`、`SamplingSettings`、フォーマット固有の型を含む全てのエクスポート型の詳細なドキュメントについては、[型ドキュメント](./docs/types.ja.md)を参照してください。

## 開発

```bash
# 依存関係をインストール
npm install

# テストを実行
npm test

# ウォッチモード
npm run test:watch

# テストカバレッジ
npm run test:coverage

# ビルド
npm run build

# リント
npm run lint
```

## ライセンス

MIT
