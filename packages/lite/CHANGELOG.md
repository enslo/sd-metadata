# Changelog

All notable changes to `@enslo/sd-metadata-lite` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
