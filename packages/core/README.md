# @enslo/sd-metadata

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[日本語版はこちら](./README.ja.md)**

🔗 **[Live Demo](https://sd-metadata.pages.dev/)**

A TypeScript library to read and write metadata embedded in AI-generated images.

## Features

- **Multi-format Support**: PNG (tEXt / iTXt / eXIf), JPEG (COM / Exif), WebP (Exif), plus MP4 / MOV and WebM / MKV videos (read-only)
- **Simple API**: `parse()`, `write()`, `embed()`, `stringify()` — four functions cover all image use cases; `parseVideo()` adds videos
- **Stealth PNGInfo Recovery**: recovers metadata hidden in pixel LSBs by NovelAI and the stealth-pnginfo extensions, even after image hosts strip the regular metadata
- **LoRA Aware**: lists the LoRAs applied to an image, read from A1111 tags, tool JSON and ComfyUI loader nodes
- **TypeScript Native**: Written in TypeScript with full type definitions included
- **Zero Dependencies**: Works in Node.js and browsers without any external dependencies
- **Format Conversion**: Seamlessly convert metadata between PNG, JPEG, and WebP
- **Metadata Preservation**: Preserves original metadata structure when converting formats (e.g., PNG → JPEG → PNG maintains all original data)
- **AI Provenance Detection**: identifies images and videos that commercial AI services (OpenAI, Google, xAI, Meta) declared as their own, through C2PA, XMP or signature markers — detection only, no signature verification

## Installation

```bash
npm install @enslo/sd-metadata
```

## Quick Start

```typescript
import { parse } from '@enslo/sd-metadata';

// `imageBytes` is a Uint8Array or ArrayBuffer (from fs, fetch, a file input, ...)
const result = await parse(imageBytes);
if (result.status === 'success') {
  console.log('Tool:', result.metadata.software); // 'novelai', 'comfyui', ...
  console.log('Prompt:', result.metadata.prompt);
  console.log('Size:', result.metadata.width, 'x', result.metadata.height);
}
```

See [Usage](#usage) for Node.js, browser, and userscript entry points, and [Advanced Examples](#advanced-examples) for the other result statuses (`vendor`, `unrecognized`, `empty`, `invalid`).

## Tool Support

| Tool | PNG | JPEG | WebP |
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

**Legend:**

- ✅ **Fully Supported** - Formats natively supported by the tool, verified with sample files
- 🔄️ **Extended Support** - Formats not natively supported by the tool, but sd-metadata enables read/write through custom format conversion. Supports round-trip conversion back to native formats.
- ⚠️ **Experimental** - Implemented by analyzing reference code or documentation, not verified with actual sample files. May not extract all metadata fields correctly.

<details>
<summary>Extended-support examples</summary>

- **Stability Matrix** (native: PNG only) → sd-metadata enables JPEG/WebP support
- **NovelAI** (native: PNG, WebP) → sd-metadata enables JPEG support

When you convert from a native format to an extended format and back (e.g., PNG → JPEG → PNG), all metadata is preserved.

</details>

> [!NOTE]
> \* Tools with format-specific behaviors — see below.

> [!TIP]
> **Help us expand tool support!** We're actively collecting sample images from experimental combinations (Civitai WebP) and unsupported tools. If you have sample images generated by these or other AI tools, please consider contributing them! See [CONTRIBUTING.md](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md) for details.

### Videos

`parseVideo()` reads MP4 / MOV (QuickTime) and WebM / MKV (Matroska) files. Generation metadata goes through the same parsers as images, so a tool that writes its usual text into a video tag is reported as the same `software`. Verified with sample files from:

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) — the built-in `SaveVideo` node and [VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite)'s `Video Combine` (MP4, WebM, MKV; its ProRes MOV output carries no metadata)
- [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) — Wan 2.2 videos (MP4, MKV)

Videos are read-only: `write()` and `embed()` take images. See [Video Files](#video-files).

## Format-Specific Behaviors

Some tools have specific behaviors when converting between formats:

- **ComfyUI JPEG/WebP**: Reading supports multiple node formats (e.g., the built-in `Save Animated WEBP` and `save-image-extended`). Writing always matches the built-in `Save Animated WEBP` node's `Make`/`Model` EXIF tags byte-for-byte — the layout ComfyUI itself reads natively for WebP drag-and-drop — dropping any PNG chunk other than `prompt`/`workflow` (e.g. `parameters` from third-party save nodes).
- **NovelAI WebP**: Automatically corrects corrupted UTF-8 in the Description field. WebP → PNG → WebP round-trip produces valid, readable metadata but with minor text corrections.
- **SwarmUI PNG→JPEG/WebP**: Native SwarmUI JPEG/WebP files do not include node information. When converting from PNG, this library preserves the ComfyUI workflow in the `Make` field for complete metadata retention (extended support).

## Usage

> [!NOTE]
> All examples use ESM syntax. CommonJS users can replace `import` with
> `require`: `const { parse } = require('@enslo/sd-metadata');`

### Node.js Usage

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

// Format as human-readable text (works with any status)
const text = stringify(result);
if (text) {
  console.log(text);
}
```

### Browser Usage

```typescript
import { parse, softwareLabels } from '@enslo/sd-metadata';

// Handle file input
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

### Userscript Usage

For userscripts (Tampermonkey, Violentmonkey, etc.), load the IIFE build via `@require`:

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
> Always pin to a specific version in `@require` for stability.

## Stealth PNGInfo Recovery

NovelAI (by default) and the [stealth-pnginfo](https://github.com/ashen-sensored/sd_webui_stealth_pnginfo) family of extensions (A1111/Forge, [ComfyUI](https://github.com/catboxanon/comfyui_stealth_pnginfo)) hide a copy of the generation metadata in the least-significant bits of the pixels, where it survives when image hosts strip the metadata chunks. `parse()` recovers it automatically: when an image carries no readable metadata, it scans the pixels as a fallback, and the recovered result carries `stealth: true`:

```typescript
import { parse } from '@enslo/sd-metadata';

const result = await parse(strippedImage);
if (result.status === 'success') {
  console.log(result.stealth); // true — recovered from pixels
  console.log(result.metadata.prompt);
}
```

- **All four variants** are read — alpha- or RGB-channel embedding, compressed or uncompressed — for both NovelAI's JSON payloads and the extensions' plain-infotext payloads.
- **WebP**: NovelAI embeds stealth data in its lossless WebP exports too. Browsers decode the pixels automatically; in Node.js, Bun or Deno pass a decoder through the `decodePixels` option (e.g. backed by sharp), otherwise the WebP scan is skipped. See "Stealth recovery on servers" under [Advanced Examples](#advanced-examples).
- **Rescue**: a recovered result feeds `write()` unchanged, restoring the original tool's native metadata to the stripped file. See "Rescuing stripped metadata" under [Advanced Examples](#advanced-examples).
- The scan needs `DecompressionStream` (Node.js 18+, Bun 1.4+, Deno, all modern browsers); without it `parse()` degrades to chunk-based reading. Writing stealth data is intentionally out of scope.

## Video Files

`parseVideo()` reads generation metadata from MP4 / MOV and WebM / MKV files, with the same result statuses as `parse()`. Pass a `Blob` (a browser `File`, or Node's `fs.openAsBlob()`) and only the byte ranges that hold metadata are read, so a large file is never loaded whole:

```typescript
import { parseVideo, stringify } from '@enslo/sd-metadata';
import { openAsBlob } from 'node:fs';

const result = await parseVideo(await openAsBlob('output.mp4')); // or a File from an <input>
if (result.status === 'success') {
  console.log(result.metadata.software); // 'comfyui', 'forge-neo', ...
  console.log(result.metadata.prompt);
  console.log(result.raw.format);        // 'mp4' | 'mov' | 'webm' | 'mkv'
  console.log(result.raw.tags);          // the file's text tags, in file order
}

console.log(stringify(result)); // A1111-format text, as for images
```

Videos from commercial services (Google Veo, xAI Grok Imagine, Meta Muse, OpenAI Sora) are reported with the `vendor` status — see "AI Provenance Detection" under [Advanced Examples](#advanced-examples). Writing metadata into videos is not supported.

## Advanced Examples

<details>
<summary>Format Conversion</summary>

Convert metadata between different image formats:

```typescript
import { parse, write } from '@enslo/sd-metadata';

// Read metadata from PNG
const pngData = readFileSync('comfyui-output.png');
const parseResult = await parse(pngData);

if (parseResult.status === 'success') {
  // Convert PNG to JPEG (using your preferred image processing library)
  const jpegImageData = convertToJpeg(pngData); // Pseudo-code: use sharp, canvas, etc.

  // Embed the metadata into the JPEG
  const result = write(jpegImageData, parseResult);

  if (result.ok) {
    writeFileSync('output.jpg', result.value);
    console.log('Image converted to JPEG with metadata preserved');
  }
}
```

> **Tip:** This library handles metadata read/write only. For actual image format conversion (decoding/encoding pixels), use image processing libraries like [sharp](https://www.npmjs.com/package/sharp), [jimp](https://www.npmjs.com/package/jimp), or browser Canvas API.

</details>

<details>
<summary>Handling Different Result Types</summary>

```typescript
import { originLabel, parse } from '@enslo/sd-metadata';

const result = await parse(imageData);

switch (result.status) {
  case 'success':
    // Metadata successfully parsed
    console.log(`Generated by ${result.metadata.software}`);
    console.log(`Prompt: ${result.metadata.prompt}`);
    break;

  case 'vendor':
    // A commercial AI service declared the image as its own — see "AI Provenance Detection" below
    console.log(`Made by ${originLabel(result)} (unverified)`); // e.g. "xAI Grok Imagine"
    break;

  case 'unrecognized':
    // Metadata exists but format is not recognized
    console.log('Unknown metadata format');
    // You can still access raw metadata for debugging:
    console.log('Raw chunks:', result.raw);
    break;

  case 'empty':
    // No metadata found
    console.log('No metadata in this image');
    break;

  case 'invalid':
    // Corrupted or invalid image data
    console.log('Error:', result.message);
    break;
}
```

</details>

<details>
<summary>Handling Unrecognized Metadata</summary>

When working with metadata from unsupported tools:

```typescript
import { parse, write } from '@enslo/sd-metadata';

const source = await parse(unknownImage);
// source.status === 'unrecognized'

// Write to target image
// - Same format (e.g., PNG → PNG): metadata preserved as-is
// - Cross-format (e.g., PNG → JPEG): metadata dropped with warning
const result = write(targetImage, source);
if (result.ok) {
  saveFile('output.png', result.value);
  if (result.warning) {
    // Metadata was dropped during cross-format conversion
    console.warn('Metadata was dropped:', result.warning.reason);
  }
}
```

</details>

<details>
<summary>AI Provenance Detection (Vendor Declarations)</summary>

Commercial AI services embed a declaration that they made the image — a signed C2PA "Content Credentials" manifest, an IPTC DigitalSourceType in an XMP packet, or a vendor's own signature — instead of generation parameters. `parse()` and `parseVideo()` return `{ status: 'vendor', info }` for these files:

```typescript
import { originLabel, parse, productLabel, vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);

if (result.status === 'vendor') {
  console.log('Vendor:', vendorLabels[result.info.vendor]); // "OpenAI", "Google", "xAI", "Meta"
  console.log('Service:', productLabel(result.info));       // "GPT Image", "Gemini", "Grok Imagine", "Muse"
  console.log('Declared in:', result.info.source);          // 'c2pa' | 'xmp' | 'signature'
  console.log('As written:', result.info.product);          // e.g. "ChatGPT", or undefined
  console.log(originLabel(result));                         // "xAI Grok Imagine" — the two joined
}
```

| Vendor | Service | Declaration | Images | Videos |
| ------ | ------- | ----------- | ------ | ------ |
| OpenAI | GPT Image (ChatGPT), Sora | C2PA | PNG | MP4 |
| Google | Gemini, Veo | C2PA | PNG, JPEG | MP4 |
| xAI | Grok Imagine | C2PA, signature | JPEG | MP4 |
| Meta | Muse | XMP | JPEG, WebP | MP4 |

`productLabel()` names the service: a known product value (`ChatGPT`, `gpt-image`, ...) is mapped to its service name, and a declaration without one falls back to the vendor's main service for the media (images: GPT Image, Gemini, Grok Imagine, Muse; videos: Sora, Veo, Grok Imagine, Muse). The declared value stays in `info.product`.

> **Detection only — not proof.** No signature is verified, so a `vendor` result is forgeable and cannot prove authenticity. These markers are also easily stripped (screenshots, re-uploads, re-encoding), so the absence of a `vendor` result does not prove an image is *not* AI-generated.

</details>

<details>
<summary>Reading LoRAs</summary>

`metadata.loras` lists the LoRAs that affected the image, in the order the tool recorded them, and is absent when there are none:

```typescript
import { parse } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'success') {
  for (const lora of result.metadata.loras ?? []) {
    console.log(lora.name);       // exactly as the tool wrote it: file stem, path, URN or display name
    console.log(lora.weight);     // UNet / model strength, when recorded
    console.log(lora.clipWeight); // text-encoder strength, only when recorded separately
    console.log(lora.hash);       // as written (AutoV2, sha256, "blake3:..."), never normalized
  }
}
```

The list comes from `<lora:…>` tags and `Lora hashes` in A1111-style text, from the LoRA lists tools write in their JSON (SwarmUI, InvokeAI, Fooocus, Easy Diffusion, Draw Things, TensorArt, Dezgo, KusArt, ...), and from ComfyUI loader nodes — only the loaders the sampler actually depends on, so a bypassed or unconnected loader is not listed.

</details>

<details>
<summary>Stealth recovery on servers (WebP)</summary>

PNG pixels are decoded by the library itself, but WebP decoding depends on the runtime. Browsers use the platform decoder (WebCodecs `ImageDecoder`, falling back to `createImageBitmap` + `OffscreenCanvas`) with no configuration. In Node.js, Bun or Deno supply the pixels via `decodePixels`, e.g. backed by [sharp](https://www.npmjs.com/package/sharp); without it the WebP stealth scan is skipped gracefully:

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

</details>

<details>
<summary>Rescuing stripped metadata</summary>

A stealth-recovered result feeds `write()` directly, restoring the original tool's native metadata to the stripped file — no separate API needed:

```typescript
import { parse, write } from '@enslo/sd-metadata';

const rescued = await parse(strippedImage);
if (rescued.status === 'success') {
  const restored = write(strippedImage, rescued);
  if (restored.ok) {
    // restored.value now carries regular metadata again,
    // readable by any tool — stealth data stays untouched in the pixels.
  }
}
```

</details>

<details>
<summary>Removing Metadata</summary>

To strip all metadata from an image:

```typescript
import { write } from '@enslo/sd-metadata';

const result = write(imageData, { status: 'empty' });
if (result.ok) {
  writeFileSync('clean-image.png', result.value);
}
```

</details>

<details>
<summary>Embedding Custom Metadata</summary>

Create and embed custom metadata in A1111 format:

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
    seed: '12345', // seeds are strings — some tools use 64-bit values
  },
  model: { name: 'model.safetensors' },
  loras: [{ name: 'detail_tweaker', weight: 0.8 }], // written as <lora:detail_tweaker:0.8>
};

// Write to any image format (PNG, JPEG, WebP)
const result = embed(imageData, metadata);
if (result.ok) {
  writeFileSync('output.png', result.value);
}
```

You can also add arbitrary key-value pairs to the settings line with `extras`:

```typescript
const result = embed(imageData, {
  ...metadata,
  extras: { Version: 'v1.10.0', 'Lora hashes': 'abc123' },
});
```

> **Tip:** If an extras key matches a structured field (e.g., `Steps`), the extras value overrides the structured value at its original position. New keys are appended at the end.

Since `EmbedMetadata` is a subset of all `GenerationMetadata` variants, you can pass parsed metadata directly — including NovelAI with its `characterPrompts`:

```typescript
import { parse, embed } from '@enslo/sd-metadata';

const result = await parse(novelaiPng);
if (result.status === 'success') {
  // NovelAI metadata (or any other tool) works as-is
  const output = embed(blankJpeg, result.metadata);
}
```

</details>

## API Reference

### `parse(input: Uint8Array | ArrayBuffer, options?: ReadOptions): Promise<ParseResult>`

Reads and parses metadata from an image file. When an image carries no readable metadata, additionally scans the pixels for Stealth PNGInfo (see [Stealth PNGInfo Recovery](#stealth-pnginfo-recovery)); the scan only runs in that case, so images with regular metadata pay no extra cost.

**Parameters:**

- `input` - Image file data (PNG, JPEG, or WebP)
- `options` - Optional read options
  - `strict?: boolean` (default: `false`) — When `true`, dimensions (`width` / `height`) are taken strictly from metadata only. When `false`, missing dimensions are extracted from image headers.
  - `decodePixels?: (data, format) => Promise<RgbaPixels | null>` — Decodes WebP pixels for the stealth scan where the platform cannot (servers). Called lazily, only when a WebP carries no readable metadata. See "Stealth recovery on servers" under [Advanced Examples](#advanced-examples).

**Returns:**

- `{ status: 'success', metadata, raw, stealth? }` - Successfully parsed
  - `metadata`: Unified metadata object (see `GenerationMetadata`)
  - `raw`: Original format-specific data (chunks/segments)
  - `stealth`: `true` when the metadata was recovered from pixel LSBs
- `{ status: 'vendor', info }` - A commercial AI service (OpenAI, Google, xAI, Meta) declared the image as its own; there are no generation parameters to read
  - `info`: `VendorInfo` — `vendor`, `product` (as declared, if any), `source` (`'c2pa' | 'xmp' | 'signature'`) and `media: 'image'`. Detection only — nothing is verified.
- `{ status: 'unrecognized', raw, stealth? }` - Image has metadata but not from a known AI tool
  - `raw`: Original metadata preserved for conversion
  - `stealth`: `true` when the raw data was recovered from pixel LSBs
- `{ status: 'empty' }` - No metadata found in the image
- `{ status: 'invalid', message? }` - Corrupted or unsupported image format
  - `message`: Optional error description

### `parseVideo(input: Uint8Array | ArrayBuffer | Blob, options?: VideoReadOptions): Promise<VideoParseResult>`

Reads and parses metadata from a video file (MP4 / MOV, WebM / MKV). See [Video Files](#video-files).

**Parameters:**

- `input` - Video file data, or a `Blob` / `File`. A `Blob` is read in small ranges — only the boxes and elements that hold metadata — instead of being loaded whole.
- `options` - Optional read options
  - `strict?: boolean` (default: `false`) — When `true`, dimensions are taken strictly from metadata only. When `false`, missing dimensions are taken from the video track.

**Returns:**

The same statuses as `parse()`, with `VideoRawMetadata` (`format` and the file's text `tags`) in place of `RawMetadata` and `media: 'video'` in a vendor `info`. Videos carry no stealth data, and a `VideoParseResult` cannot be passed to `write()`.

### `read(input: Uint8Array | ArrayBuffer, options?: ReadOptions): ParseResult`

> [!WARNING]
> **Deprecated** — use [`parse()`](#parseinput-uint8array--arraybuffer-options-readoptions-promiseparseresult) instead. `read()` remains available for callers that need a synchronous, chunk-only read, but it cannot recover Stealth PNGInfo.

Identical to `parse()` except that it is synchronous and never scans pixels.

### `write(input: Uint8Array | ArrayBuffer, metadata: ParseResult): WriteResult`

Writes metadata to an image file.

**Parameters:**

- `input` - Target image file data (PNG, JPEG, or WebP)
- `metadata` - `ParseResult` from `parse()`
  - `status: 'success'` or `'empty'` - Can write directly
  - `status: 'unrecognized'` - Same format: writes as-is; Cross-format: drops metadata with warning
  - Stealth-recovered results work as-is — writing restores the original tool's native metadata (see "Rescuing stripped metadata" under [Advanced Examples](#advanced-examples))

**Returns:**

- `{ ok: true, value: Uint8Array, warning?: WriteWarning }` - Successfully written
  - `warning` is set when metadata was intentionally dropped (e.g., unrecognized cross-format)
- `{ ok: false, error: { type, message? } }` - Failed. `type` is one of:
  - `'unsupportedFormat'`: Target image is not PNG, JPEG, or WebP
  - `'conversionFailed'`: Metadata conversion failed (e.g., incompatible format)
  - `'writeFailed'`: Failed to embed metadata into the image, or the input cannot be written back

### `embed(input: Uint8Array | ArrayBuffer, metadata: EmbedMetadata | GenerationMetadata): WriteResult`

Embeds custom metadata into an image in SD WebUI (A1111) format.

**Parameters:**

- `input` - Target image file data (PNG, JPEG, or WebP)
- `metadata` - `EmbedMetadata` or `GenerationMetadata` to embed (use `extras` field for custom settings)

**Returns:**

- `{ ok: true, value: Uint8Array }` - Successfully written (returns new image data)
- `{ ok: false, error: { type, message? } }` - Failed. `type` is one of:
  - `'unsupportedFormat'`: Target image is not PNG, JPEG, or WebP
  - `'writeFailed'`: Failed to embed metadata into the image

**Use cases:**

- Creating custom metadata for programmatically generated images
- Converting metadata from other tools to WebUI-compatible format
- Building applications that output WebUI-readable metadata

### `stringify(input: ParseResult | VideoParseResult | EmbedMetadata | GenerationMetadata): string`

Converts metadata to a human-readable string.

**Parameters:**

- `input` - One of:
  - `ParseResult` from `parse()` or `VideoParseResult` from `parseVideo()` — selects best representation based on status
  - `EmbedMetadata` or `GenerationMetadata` — formats as A1111 text directly

**Returns:**

- `ParseResult` / `VideoParseResult`:
  - `success` → A1111-format text. For tools that write A1111 text themselves (sd-webui, Forge family, reForge, SD.Next, ...) the original text is returned as the tool wrote it, so keys the library does not model survive; for other tools the text is rebuilt from the metadata, LoRAs included
  - `vendor` → `<Vendor> <Service>` (e.g. `OpenAI GPT Image`), or the service alone when the vendor is unknown
  - `unrecognized` → Raw metadata as plain text
  - `empty` / `invalid` → Empty string
- `EmbedMetadata` / `GenerationMetadata` → A1111-format text

**Use cases:**

- Displaying generation parameters in image viewers or galleries
- Copying metadata to clipboard as readable text
- Logging or debugging parsed metadata
- Previewing `EmbedMetadata` before embedding

### `originLabel(input: ParseResult | VideoParseResult | GenerationMetadata | VendorInfo): string`

Display name of whatever made a file, in one call: the software of a `success` result (as in `softwareLabels`), or the vendor and its service of a `vendor` result (as in `vendorLabels` and `productLabel()`, the service alone when the vendor is unknown). Any other status gives an empty string. The metadata or the vendor declaration can also be passed on its own.

```typescript
import { originLabel, parse } from '@enslo/sd-metadata';

const result = await parse(imageData);
console.log(originLabel(result));
// => "NovelAI", "ComfyUI", "OpenAI GPT Image", "xAI Grok Imagine", ... or "" when there is nothing to name
```

### `softwareLabels: Record<GenerationSoftware, string>`

A read-only mapping from `GenerationSoftware` identifiers to their human-readable display names.

```typescript
import { softwareLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'success') {
  console.log(softwareLabels[result.metadata.software]);
  // => "NovelAI", "ComfyUI", "Stable Diffusion WebUI", etc.
}
```

### `vendorLabels: Record<Vendor, string>`

A read-only mapping from `Vendor` identifiers to company names.

```typescript
import { vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'vendor') {
  console.log(vendorLabels[result.info.vendor]);
  // => "OpenAI", "Google", "xAI", "Meta", "Unknown"
}
```

### `productLabel(info: VendorInfo): string`

Display name of the AI service that made a vendor image or video. A known declared product (`ChatGPT`, `gpt-image`, `Grok Imagine`, ...) is mapped to its service name; a declaration without a product falls back to the vendor's main service for the media (images: GPT Image, Gemini, Grok Imagine, Muse; videos: Sora, Veo, Grok Imagine, Muse). An unknown product value is returned as written.

```typescript
import { productLabel, vendorLabels } from '@enslo/sd-metadata';

const result = await parse(imageData);
if (result.status === 'vendor') {
  console.log(`${vendorLabels[result.info.vendor]} ${productLabel(result.info)}`);
  // => "OpenAI GPT Image", "Google Gemini", "xAI Grok Imagine", "Meta Muse"
}
```

## Type Reference

This section provides an overview of the main types. For complete type definitions, see [Type Documentation](./docs/types.md).

### `ParseResult`

The result of the `parse()` (and deprecated `read()`) function. It uses a discriminated union with a `status` field. `stealth` is set to `true` by `parse()` when the result was recovered from pixel LSBs (Stealth PNGInfo).

```typescript
type ParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: RawMetadata; stealth?: boolean }
  | { status: 'vendor'; info: VendorInfo }
  | { status: 'unrecognized'; raw: RawMetadata; stealth?: boolean }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `VideoParseResult`

The result of `parseVideo()`, with the same statuses. `raw` holds the container format and the file's text tags instead of chunks or segments.

```typescript
type VideoParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: VideoRawMetadata }
  | { status: 'vendor'; info: VendorInfo }
  | { status: 'unrecognized'; raw: VideoRawMetadata }
  | { status: 'empty' }
  | { status: 'invalid'; message?: string };
```

### `GenerationMetadata`

Unified metadata structure returned by `parse()` and `parseVideo()` — a discriminated union of 3 metadata types, distinguished by the `software` field:

```typescript
type GenerationMetadata =
  | NovelAIMetadata   // 'novelai' — adds V4 character-placement fields
  | ComfyUIMetadata   // 'comfyui' | 'tensorart' | 'stability-matrix' | 'swarmui' — adds the workflow graph (nodes)
  | StandardMetadata; // 'sd-webui', 'forge', 'invokeai', 'dezgo', ... — baseline fields only
```

All variants share the `BaseMetadata` fields: `prompt`, `negativePrompt`, `width`, `height`, and the optional `model` / `sampling` / `hires` / `upscale` settings and `loras` list. Narrow on the `software` discriminator to access tool-specific fields:

```typescript
if (result.status === 'success') {
  const metadata = result.metadata;
  console.log('Prompt:', metadata.prompt);
  console.log('Model:', metadata.model?.name);
  console.log('Seed:', metadata.sampling?.seed); // a string

  if (metadata.software === 'novelai') {
    // TypeScript knows this is NovelAIMetadata
    console.log('Character prompts:', metadata.characterPrompts);
  }
}
```

For the complete definitions of every exported type — including `BaseMetadata`, `EmbedMetadata`, `RawMetadata`, `VendorInfo`, `LoraSettings`, `GenerationSoftware`, and the settings types — see the [Type Documentation](./docs/types.md).

## Development

See the [Contributing Guide](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
