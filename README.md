# sd-metadata

[![CI](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![npm downloads](https://img.shields.io/npm/dm/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[日本語版はこちら](./README.ja.md)**

🔗 **[Live Demo](https://sd-metadata.pages.dev/)**

A TypeScript library to read and write metadata embedded in AI-generated images.
Supports PNG, JPEG, and WebP formats across 20+ generation tools.
Zero dependencies, works in Node.js and browsers.

## Features

- **Multi-format support**: PNG (tEXt / iTXt / eXIf), JPEG (COM / Exif), WebP (Exif), plus MP4 / MOV and WebM / MKV videos (read-only)
- **Simple API**: `parse()`, `write()`, `embed()`, `stringify()` — four functions cover all use cases
- **TypeScript native**: Written in TypeScript with full type definitions included
- **Zero dependencies**: Works in Node.js and browsers without any external dependencies
- **Format conversion**: Seamlessly convert metadata between PNG, JPEG, and WebP
- **Metadata preservation**: Keeps the original metadata structure when converting formats (e.g., PNG → JPEG → PNG retains all original data)
- **Stealth PNGInfo recovery**: Reads metadata hidden in pixel data when the regular metadata has been stripped
- **AI provenance detection**: Identifies images and videos from commercial services (OpenAI, Google, xAI) by their C2PA / XMP declarations — detection only, no signature verification

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
  console.log(result.metadata.software); // 'novelai', 'comfyui', ...
  console.log(result.metadata.prompt);
}
```

That's it for reading. Writing, embedding, and format conversion take a few lines each — see the [documentation](#documentation).

## Supported Tools

Stable Diffusion WebUI (A1111), Forge, reForge, ComfyUI, NovelAI, SD.Next, InvokeAI, SwarmUI, Fooocus, Civitai, TensorArt, Stability Matrix, Draw Things, and more.

See the [tool support matrix](./packages/core/README.md#tool-support) for the full list with per-format status.

## Documentation

The full documentation lives in the [package README](./packages/core/README.md):

- [Usage](./packages/core/README.md#usage) — Node.js, browser, and userscript entry points
- [Advanced Examples](./packages/core/README.md#advanced-examples) — write, embed, format conversion, and handling every result status
- [API Reference](./packages/core/README.md#api-reference)
- [Type Reference](./packages/core/docs/types.md)
- [Changelog](./packages/core/CHANGELOG.md)

## Lite Build

`@enslo/sd-metadata-lite` is a read-only companion for bookmarklets and userscripts, where every kilobyte counts.
It extracts the same metadata as A1111-format text in a ~7 KB IIFE — no write support, format conversion, or structured output.

See the [lite documentation](./packages/lite/README.md) if that trade-off fits your use case.

## Development

This repository is a pnpm workspace: `packages/core` (the library), `packages/lite` (the lite build), and `apps/` (demo sites).

```bash
# Install dependencies
pnpm install

# Build and test (core)
pnpm --filter @enslo/sd-metadata build
pnpm --filter @enslo/sd-metadata test

# Build and test (lite)
pnpm --filter @enslo/sd-metadata-lite build
pnpm --filter @enslo/sd-metadata-lite test

# Lint (entire workspace)
pnpm lint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
