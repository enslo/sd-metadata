# @enslo/sd-metadata-lite

[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata-lite.svg)](https://www.npmjs.com/package/@enslo/sd-metadata-lite)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata-lite.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🇯🇵 **[日本語版はこちら](./README.ja.md)**

A lightweight, read-only metadata parser for AI-generated images.
Designed for bookmarklets and userscripts where bundle size matters.

- **Tiny**: **6,525 bytes** minified IIFE build
- **Read-only**: Extracts metadata and returns A1111-format text
- **Zero dependencies**: Works in Node.js and browsers
- **18+ tools**: Supports all major AI image generation tools

> [!TIP]
> Need write support, format conversion, or structured metadata? Use the [full library](../core/README.md) instead.

## Installation

```bash
npm install @enslo/sd-metadata-lite
```

## Usage

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

### Userscript

Load the IIFE build via `@require`:

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
> Always pin to a specific version in `@require` for stability.

### Bookmarklet

Most sites block external script loading via CSP. Instead, paste the IIFE bundle inline:

1. Copy the contents of `dist/index.global.js` (or download from [npm](https://cdn.jsdelivr.net/npm/@enslo/sd-metadata-lite@1.0.0/dist/index.global.js))
2. Build your bookmarklet with the code inlined:

```javascript
javascript:void(async()=>{/* paste contents of index.global.js here */;/* your code using sdml.parse() */})()
```

Since the IIFE assigns to `var sdml`, calling `sdml.parse()` works immediately after the inlined code.

## API

### `parse(input: Uint8Array | ArrayBuffer): string`

Parses metadata from an image and returns A1111-format text.

**Parameters:**

- `input` - Image file data (PNG, JPEG, or WebP)

**Returns:**

- A1111-format metadata string if metadata is found
- Empty string (`""`) if no metadata is found or the format is unrecognized

### Output Format

The output follows the [Stable Diffusion WebUI (A1111)](https://github.com/AUTOMATIC1111/stable-diffusion-webui) text format:

```text
masterpiece, best quality, 1girl
Negative prompt: lowres, bad quality
Steps: 20, Sampler: Euler a, Schedule type: Karras, CFG scale: 7, Seed: 12345, Size: 512x768, Model hash: a1b2c3d4, Model: model.safetensors
```

Fields are included only when present in the source metadata.

## Supported Tools

Reads PNG, JPEG, and WebP metadata from:

- [Stable Diffusion WebUI (A1111)](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) / [Forge Classic](https://github.com/Haoming02/sd-webui-forge-classic/tree/classic) / [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
- [reForge](https://github.com/Panchovix/stable-diffusion-webui-reForge) / [EasyReforge](https://github.com/Zuntan03/EasyReforge)
- [NovelAI](https://novelai.net/)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [SD.Next](https://github.com/vladmandic/automatic)
- [InvokeAI](https://github.com/invoke-ai/InvokeAI)
- [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI)
- [Stability Matrix](https://github.com/LykosAI/StabilityMatrix)
- [Civitai](https://civitai.com/) (JPEG only verified; PNG/WebP are experimental *)
- [TensorArt](https://tensor.art/)
- [HuggingFace Space](https://huggingface.co/spaces)
- [Ruined Fooocus](https://github.com/runew0lf/RuinedFooocus)
- [Fooocus](https://github.com/lllyasviel/Fooocus) *
- [Easy Diffusion](https://github.com/easydiffusion/easydiffusion) *

> [!NOTE]
> \* Implemented based on reference code analysis, not verified with actual sample files.

## Globals

When loaded via `<script>` tag or userscript `@require`, the IIFE build exposes:

```javascript
window.sdml.parse(input)
```

## Contributing

See [CONTRIBUTING.md](https://github.com/enslo/sd-metadata/blob/main/CONTRIBUTING.md) for guidelines.

## License

MIT
