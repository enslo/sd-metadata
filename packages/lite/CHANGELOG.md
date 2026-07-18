# Changelog

All notable changes to `@enslo/sd-metadata-lite` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-07-18

### Added

- **ComfyUI Save Animated WEBP support** (#250): `parse()` now reads the
  workflow/prompt tag layout ComfyUI's official `Save Animated WEBP` node
  writes (EXIF `Make`/`Model`), which previously returned no metadata.

### Maintenance

- IIFE bundle size: 6,911 → 6,934 bytes (+23 bytes uncompressed; #250)
- Update development dependencies (#245, #246, #248)

## [1.3.0] - 2026-06-07

### Added

- **C2PA Content Credentials detection** (#235): For PNG images with no
  recognized generation parameters, `parse()` now falls back to C2PA Content
  Credentials and returns the generator name (e.g. ChatGPT / Gemini exports)
  instead of an empty string. Detection only — the signature is not verified.

### Maintenance

- IIFE bundle size: 6,571 → 6,911 bytes (+340 bytes uncompressed; #235)
- Update development dependencies

## [1.2.0] - 2026-05-30

### Improved

- **ComfyUI metadata parsing** (#219): Recognise `ShowText|pysssss` and
  `PromptStashSaver` nodes in the flat scanner.

### Maintenance

- IIFE bundle size: 6,519 → 6,571 bytes (+52 bytes uncompressed; #219)
- ESM bundle size: ~15.7 KB → ~17.7 KB (+13%); tsdown now preserves JSDoc
  comments by default — does not affect minified CDN or bookmarklet usage (#216)
- Add `index.d.ts.map` (declaration sourcemaps) to the published output (#216)
- Update development dependencies

## [1.1.0] - 2026-02-25

### Improved

- **Hires/upscaler extraction** (#168): Unified hires field extraction in `extractCommon`, improving upscaler metadata output for Fooocus, HF Space, and other JSON-based tools
- IIFE bundle size reduced from 6,525 to 6,519 bytes

## [1.0.0] - 2026-02-24

### Added

- Initial release
- `parse()` function: extract A1111-format metadata text from PNG, JPEG, and WebP images
- IIFE build (`dist/index.global.js`) for userscripts and bookmarklets
- Support for 18+ AI image generation tools

[1.1.0]: https://github.com/enslo/sd-metadata/compare/lite@1.0.0...lite@1.1.0
[1.0.0]: https://github.com/enslo/sd-metadata/releases/tag/lite@1.0.0
