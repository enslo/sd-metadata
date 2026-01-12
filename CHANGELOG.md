# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-13

### Added

#### Core Features
- **Multi-format Support**: PNG (tEXt / iTXt), JPEG (COM / Exif), WebP (Exif)
- **Unified API**: Simple `read()` and `write()` functions work across all formats
- **TypeScript Native**: Written in TypeScript with full type definitions included
- **Zero Dependencies**: Works in Node.js and browsers without any external dependencies
- **Format Conversion**: Seamlessly convert metadata between PNG, JPEG, and WebP
- **Lossless Round-trip**: Preserves original metadata structure when converting back to native format
- Image dimension extraction with automatic fallback from image headers

#### Supported AI Tools

**Fully Supported** (verified with sample files, native format support):
- NovelAI - PNG and WebP native formats
- ComfyUI - PNG native format
- Stable Diffusion WebUI (AUTOMATIC1111) - Experimental (no samples yet)
- Forge / Forge Neo - PNG, JPEG, and WebP native formats
- InvokeAI - PNG native format
- SwarmUI - PNG and WebP native formats

**Extended Support** (sd-metadata specific parsers, cross-format conversion):
- Civitai - Uses A1111-compatible format, JPEG primary format
- TensorArt - Custom JSON format in PNG
- Stability Matrix - Custom JSON format in PNG
- HuggingFace Space - JSON format in Exif
- Ruined Fooocus - PNG format

**Experimental** (implemented from reference code, no sample verification):
- Easy Diffusion
- Fooocus

#### Advanced Features
- Segment/chunk tracking for lossless round-trip preservation
- ComfyUI detection priority when both prompt and workflow exist
- NovelAI WebP UTF-8 corruption auto-correction
- Force conversion for unrecognized metadata formats with `{ force: true }` option

### Known Limitations

- **ComfyUI JPEG/WebP**: While reading supports major custom node formats (e.g., `save-image-extended`), writing always uses the `comfyui-saveimage-plus` format for best information preservation and ComfyUI drag-and-drop workflow compatibility
- **NovelAI WebP**: Auto-corrects corrupted UTF-8 in Description field, breaking content-equivalent round-trip (intentional for data validity)
- **SwarmUI PNG→JPEG/WebP**: Loses ComfyUI workflow data from `prompt` chunk to match native WebP format (metadata preserved)

### Development
- Comprehensive test suite with unit, sample, and integration tests
- Test coverage reporting with Vitest
- GitHub Actions CI with automated coverage reports
- Lefthook pre-commit hooks for linting and type checking
- Biome for code formatting and linting
- CONTRIBUTING.md for community contributions

[1.0.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.0
