# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-21

### ⚠️ BREAKING CHANGES

- **Replace `workflow` with `nodes` in ComfyUIMetadata** (#58): The `workflow?: unknown` field has been replaced with typed `nodes: ComfyNodeGraph`.
  - **What `workflow` was**: ComfyUI UI layout data containing node positions, sizes, link connections, and visual groupings—information used by ComfyUI's graph editor but not required for image reproduction.
  - **What `nodes` is**: The actual node graph (from PNG `prompt` chunk) mapping node IDs to their inputs and class types—the essential data needed to reproduce the generation.
  - **Why this change**: Previously, `workflow` only existed in ComfyUI images and was `undefined` for other ComfyUI-compatible tools (TensorArt, Stability Matrix, SwarmUI). Now `nodes` provides actual node graph data from all tools.
- **Remove `type` field from GenerationMetadata** (#57): Use `metadata.software` instead of `metadata.type` for type narrowing.
- **Internal types no longer exported** (#60): `BaseMetadata` and `GenerationSoftware` are now internal types.

### Added

- **SwarmUI workflow preservation** (#59): Store ComfyUI node graph in `exifMake` segment when converting PNG to JPEG/WebP, enabling complete round-trip preservation
- **Typed ComfyUI node graph** (#58): New types `ComfyNode`, `ComfyNodeGraph`, `ComfyNodeReference`, `ComfyNodeInputValue` for type-safe workflow access
- **Expanded type exports** (#60): Export `ModelSettings`, `SamplingSettings`, `HiresSettings`, `UpscaleSettings`, `CharacterPrompt`, and chunk/segment types
- **Type documentation** (#60): Comprehensive type reference at `docs/types.md`

### Fixed

- **TensorArt seed extraction** (#61): Extract actual seed from KSampler node when `generation_data.seed` is -1 (random placeholder)

### Changed

- **Metadata type consolidation** (#60): Renamed `A1111Metadata` to `StandardMetadata`, merged `InvokeAIMetadata` into `StandardMetadata`
- **ComfyUIMetadata restructure** (#60): Split into `BasicComfyUIMetadata` (nodes required) and `SwarmUIMetadata` (nodes optional)

### Documentation

- Improved GenerationMetadata documentation in README (#62)
- Added comprehensive type reference docs (#60)
- Improved README usage examples (#56)

## [1.0.2] - 2026-01-19

### Fixed

- **Incorrect SD-WebUI Detection**: Fixed false positives where non-AI generated images (e.g., from photo editing software) were incorrectly detected as SD-WebUI/A1111 format (#47)
- **ComfyUI Detection**: Improved detection for ComfyUI files, fixing cases where valid ComfyUI metadata was not recognized (#47, #50)

### Changed

- Refactored detection logic with tier-based structure for improved maintainability (#47)

## [1.0.1] - 2026-01-13

### Changed

- Updated package homepage URL to point to the demo site (<https://sd-metadata.pages.dev/>) instead of the GitHub repository

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

[1.1.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.1.0
[1.0.2]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.2
[1.0.1]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.1
[1.0.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.0
