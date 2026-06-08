# sd-metadata

[![CI](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[日本語版はこちら](./README.ja.md)**

A TypeScript library to read and write metadata embedded in AI-generated images.
Supports PNG, JPEG, and WebP formats across 18+ generation tools.
Zero dependencies, works in Node.js and browsers.

## Packages

| Package | Description | npm | |
| ------- | ----------- | --- | - |
| [@enslo/sd-metadata](./packages/core/) | Full-featured library with read, write, embed, and stringify APIs | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata.pages.dev/) |
| [@enslo/sd-metadata-lite](./packages/lite/) | Lightweight read-only parser for bookmarklets and userscripts | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata-lite.svg)](https://www.npmjs.com/package/@enslo/sd-metadata-lite) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata-lite.pages.dev/) |

### Which package should I use?

| Feature | `sd-metadata` | `sd-metadata-lite` |
| ------- | :-----------: | :----------------: |
| Read metadata | ✅ | ✅ (A1111-format text only) |
| Write metadata back to an image | ✅ | - |
| Embed custom (user-authored) metadata | ✅ | - |
| Format conversion (PNG/JPEG/WebP) | ✅ | - |
| Tool detection | ✅ | - |
| Structured metadata object | ✅ | - |
| IIFE build (userscript `@require`) | ✅ | ✅ |
| Bundle size (IIFE, minified) | ~51 KB | ~7 KB |
| Node.js + Browser | ✅ | ✅ |

- **Full library** (`@enslo/sd-metadata`)
  - Write support, format conversion, and the complete API
  - [Documentation](./packages/core/README.md)
- **Lite** (`@enslo/sd-metadata-lite`)
  - Read-only parser for bookmarklets and userscripts where bundle size matters
  - [Documentation](./packages/lite/README.md)

## Quick start

```bash
npm install @enslo/sd-metadata
```

```typescript
import { read } from '@enslo/sd-metadata';

const result = read(imageBytes); // Uint8Array | ArrayBuffer
if (result.status === 'success') {
  console.log(result.metadata.software); // 'novelai', 'comfyui', ...
  console.log(result.metadata.prompt);
}
```

That's it for reading. See the [full library docs](./packages/core/README.md) for write / embed / format conversion, or the [lite docs](./packages/lite/README.md) for the ~7 KB read-only build.

## Development

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
