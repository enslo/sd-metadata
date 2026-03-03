# sd-metadata

[![CI](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/enslo/sd-metadata/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@enslo/sd-metadata.svg)](https://github.com/enslo/sd-metadata/blob/main/LICENSE)

🌐 **[日本語版はこちら](./README.ja.md)**

A TypeScript library to read and write metadata embedded in AI-generated images.
Supports PNG, JPEG, and WebP formats across 15+ generation tools.
Zero dependencies, works in Node.js and browsers.

## Packages

| Package | Description | npm | |
| ------- | ----------- | --- | - |
| [@enslo/sd-metadata](./packages/core/) | Full-featured library with read, write, embed, and stringify APIs | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata.svg)](https://www.npmjs.com/package/@enslo/sd-metadata) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata.pages.dev/) |
| [@enslo/sd-metadata-lite](./packages/lite/) | Lightweight read-only parser for bookmarklets and userscripts | [![npm](https://img.shields.io/npm/v/@enslo/sd-metadata-lite.svg)](https://www.npmjs.com/package/@enslo/sd-metadata-lite) | [![demo](https://img.shields.io/badge/demo-blueviolet?logo=cloudflare&logoColor=white)](https://sd-metadata-lite.pages.dev/) |

### Which package should I use?

| Feature | `sd-metadata` | `sd-metadata-lite` |
| ------- | :-----------: | :----------------: |
| Read metadata | ✅ | ✅ |
| Write metadata | ✅ | - |
| Embed custom metadata | ✅ | - |
| Format conversion (PNG/JPEG/WebP) | ✅ | - |
| Tool detection | ✅ | - |
| Structured metadata object | ✅ | - |
| IIFE build (userscript `@require`) | ✅ | ✅ |
| Bundle size (IIFE, minified) | ~45 KB | ~6.5 KB |
| Node.js + Browser | ✅ | ✅ |

- **Full library** (`@enslo/sd-metadata`)
  - Write support, format conversion, and the complete API
  - [Documentation](./packages/core/README.md)
- **Lite** (`@enslo/sd-metadata-lite`)
  - Read-only parser for bookmarklets and userscripts where bundle size matters
  - [Documentation](./packages/lite/README.md)

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
