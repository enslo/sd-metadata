# sd-metadata

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[English version](./README.md)**

AI生成画像に埋め込まれたメタデータを読み書きするためのTypeScriptライブラリです。

## 特徴

- **マルチフォーマット対応**: PNG (tEXt / iTXt)、JPEG (COM / Exif)、WebP (Exif)
- **シンプルAPI**: `read()`、`write()`、`embed()`、`stringify()` — 4つの関数で全ユースケースをカバー
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
import { read, stringify } from '@enslo/sd-metadata';
import { readFileSync } from 'fs';

const imageData = readFileSync('image.png');
const result = read(imageData);

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
import { read, softwareLabels } from '@enslo/sd-metadata';

// ファイル入力を処理
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const result = read(arrayBuffer);

  if (result.status === 'success') {
    document.getElementById('tool').textContent = softwareLabels[result.metadata.software];
    document.getElementById('prompt').textContent = result.metadata.prompt;
    document.getElementById('model').textContent = result.metadata.model?.name || 'N/A';
  }
});
```

### CDN使用（ユーザースクリプト）

ユーザースクリプト（Tampermonkey、Violentmonkeyなど）では、jsDelivr CDNから読み込みます：

```javascript
// CDNからインポート
import { read } from 'https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@latest/dist/index.js';

const response = await fetch(imageUrl);
const arrayBuffer = await response.arrayBuffer();
const result = read(arrayBuffer);

if (result.status === 'success') {
  console.log('Tool:', result.metadata.software);
  console.log('Prompt:', result.metadata.prompt);
}
```

> [!TIP]
> 本番環境では `@latest` の代わりに特定のバージョンを指定してください：
>
> ```text
> https://cdn.jsdelivr.net/npm/@enslo/sd-metadata@2.0.0/dist/index.js
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

> [!TIP]
> extras のキーが構造化フィールド（例：`Steps`）と一致する場合、extras の値が元の位置で構造化フィールドを上書きします。新しいキーは末尾に追加されます。

`EmbedMetadata` はすべての `GenerationMetadata` バリアントのサブセットなので、パース結果のメタデータをそのまま渡せます — `characterPrompts` を持つ NovelAI も含めて：

```typescript
import { read, embed } from '@enslo/sd-metadata';

const result = read(novelaiPng);
if (result.status === 'success') {
  // NovelAI（や他のツール）のメタデータをそのまま利用可能
  const output = embed(blankJpeg, result.metadata);
}
```

</details>

<details>
<summary>表示用にメタデータをフォーマット</summary>

`ParseResult` を読みやすい文字列に変換します。ステータスに応じて最適な表現を自動選択します：

```typescript
import { read, stringify } from '@enslo/sd-metadata';

const result = read(imageData);
const text = stringify(result);
if (text) {
  console.log(text);

  // 'success' の場合: WebUIフォーマットで出力:
  // masterpiece, best quality, 1girl
  // Negative prompt: lowres, bad quality
  // Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x768, Model: model.safetensors
  //
  // 'unrecognized' の場合: 生のメタデータテキストを出力
  // 'empty' / 'invalid' の場合: 空文字列を返す
}
```

</details>

## APIリファレンス

### `read(input: Uint8Array | ArrayBuffer, options?: ReadOptions): ParseResult`

画像ファイルからメタデータを読み込み、パースします。

**パラメータ:**

- `input` - 画像ファイルデータ（PNG、JPEG、またはWebP）
- `options` - オプションの読み込み設定（詳細は[型ドキュメント](./docs/types.ja.md)を参照）

**戻り値:**

- `{ status: 'success', metadata, raw }` - パース成功
  - `metadata`: 統一されたメタデータオブジェクト（`GenerationMetadata`を参照）
  - `raw`: 元のフォーマット固有のデータ（chunks/segments）
- `{ status: 'unrecognized', raw }` - 画像にメタデータがあるが既知のAIツールからではない
  - `raw`: 変換用に保持された元のメタデータ
- `{ status: 'empty' }` - 画像にメタデータが見つからない
- `{ status: 'invalid', message? }` - 破損または非対応の画像フォーマット
  - `message`: オプションのエラー説明

### `write(input: Uint8Array | ArrayBuffer, metadata: ParseResult): WriteResult`

画像ファイルにメタデータを書き込みます。

**パラメータ:**

- `input` - ターゲット画像ファイルデータ（PNG、JPEG、またはWebP）
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

- `ParseResult` の場合: `success` → WebUIフォーマット、`unrecognized` → 生テキスト、`empty`/`invalid` → 空文字列
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

const result = read(imageData);
if (result.status === 'success') {
  console.log(softwareLabels[result.metadata.software]);
  // => "NovelAI", "ComfyUI", "Stable Diffusion WebUI", etc.
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

### `BaseMetadata`

全メタデータ型で共有される共通フィールド。このインターフェースは `EmbedMetadata` の基盤でもあります。

```typescript
interface BaseMetadata {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  model?: ModelSettings;
  sampling?: SamplingSettings;
  hires?: HiresSettings;
  upscale?: UpscaleSettings;
}
```

### `GenerationMetadata`

`read()` 関数が返す統一されたメタデータ構造。`software` フィールドで区別される3つのメタデータ型のユニオン型です。全タイプが `BaseMetadata` を拡張しています。

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

- **`StandardMetadata`** (`software: 'sd-webui' | 'forge' | 'forge-classic' | 'reforge' | 'invokeai' | ...`)
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

### `GenerationSoftware`

サポートされている全ソフトウェア識別子の文字列リテラルユニオン型。`softwareLabels` のキー型として使用します。

```typescript
type GenerationSoftware =
  | 'novelai' | 'comfyui' | 'swarmui' | 'tensorart' | 'stability-matrix'
  | 'sd-webui' | 'forge' | 'forge-classic' | 'forge-neo' 
  | 'reforge'| 'easy-reforge' | 'sd-next' | 'civitai' | 'hf-space'
  | 'invokeai' | 'easydiffusion' | 'fooocus' | 'ruined-fooocus';
```

### `EmbedMetadata`

`embed()` と `stringify()` で使用するユーザー作成カスタムメタデータ型。`GenerationMetadata` が既知のAIツールからのパース結果を表すのに対し、`EmbedMetadata` はユーザーが独自にメタデータを組み立てるための型です。`BaseMetadata` にオプションのキャラクタープロンプトと設定行への任意キーバリュー（`extras`）を追加。

```typescript
type EmbedMetadata = BaseMetadata &
  Pick<NovelAIMetadata, 'characterPrompts'> & {
    extras?: Record<string, string | number>;
  };
```

### `RawMetadata`

ラウンドトリップ変換のために元のメタデータ構造を保持します。

```typescript
type RawMetadata =
  | { format: 'png'; chunks: PngTextChunk[] }
  | { format: 'jpeg'; segments: MetadataSegment[] }
  | { format: 'webp'; segments: MetadataSegment[] };
```

`ModelSettings`、`SamplingSettings`、フォーマット固有の型を含む全てのエクスポート型の詳細なドキュメントについては、[型ドキュメント](./docs/types.ja.md)を参照してください。

## 開発

```bash
# 依存関係をインストール
pnpm install

# テストを実行
pnpm test

# ビルド
pnpm build

# リント
pnpm lint

# 型チェック
pnpm typecheck

# デモサイト起動
pnpm demo
```

## ライセンス

MIT
