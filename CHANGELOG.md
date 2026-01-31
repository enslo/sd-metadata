# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-02-01

### Added

- **ComfyUI extended node support** (#108): Support for additional custom nodes
  - **Prompt nodes**: Power Prompt (rgthree), DF_Text_Box (Derfuu)
  - **Latent nodes**: SDXL Empty Latent Image (rgthree)
  - **Seed nodes**: CR Seed
  - **Hires detection**: LatentUpscale, LatentUpscaleBy
- **InvokeAI upscale settings** (#109): Extract upscale information from InvokeAI images
  - `upscale.upscaler`: Upscaler model name (e.g., RealESRGAN_x4plus_anime_6B)
  - `upscale.scale`: Scale factor
- **ComfyUI denoise in SamplingSettings** (#110): Extract denoising strength from KSampler nodes
  - Only captured when `denoise < 1.0` (img2img workflows)
  - `denoise = 1.0` (txt2img default) is omitted

### Changed

- **Internal refactoring** (#107): Type cleanup and developer experience improvements (no public API changes)

## [1.6.1] - 2026-01-29

### Fixed

- **CivitAI Orchestration JPEG→PNG conversion** (#102): Store all metadata in a single `prompt` chunk instead of separating into multiple chunks, improving round-trip compatibility
  - This fixes an issue introduced in v1.6.0 where the chunk structure was not optimal

## [1.6.0] - 2026-01-29

### Added

- **`strict` option for `read()`** (#95): Control dimension extraction behavior
  - When `true`, dimensions come strictly from metadata only (returns 0 if not present)
  - When `false` (default), missing dimensions fall back to image headers

### Fixed

- **CivitAI detection and format conversion** (#96): CivitAI images are now correctly detected and can be converted between formats
  - Previously, CivitAI Orchestration images were incorrectly detected as ComfyUI or SD WebUI
  - Images using Hires fix or Upscaler on CivitAI now convert to PNG correctly (previously became `unrecognized`)

### Changed

- **Parser refactoring** (#96, #98): Improved code quality across all parsers
  - Immutable patterns for better maintainability
  - Function decomposition for ComfyUI parser

## [1.5.0] - 2026-01-26

### Added

- **ArrayBuffer support** (#89): All public API functions (`read`, `write`, `writeAsWebUI`) now accept both `Uint8Array` and `ArrayBuffer` as input
  - Browser users can pass `ArrayBuffer` directly from `File.arrayBuffer()` or `fetch().arrayBuffer()` without manual conversion
  - Node.js `Buffer` (which extends `Uint8Array`) continues to work as before

## [1.4.2] - 2026-01-25

### Fixed

- **JPEG/WebP Format Conversion** (#85): Fixed metadata parsing for HF-Space, Ruined Fooocus, TensorArt, and Stability Matrix after cross-format conversion (PNG ↔ JPEG/WebP)
  - HF-Space and Ruined Fooocus: Now correctly parsed from Comment JSON (was `unrecognized`)
  - TensorArt and Stability Matrix: Now correctly detected from Comment JSON (was misidentified as `comfyui`)
- **Unicode Round-trip** (#85): Non-ASCII characters (e.g., Japanese) are now preserved during PNG → JPEG/WebP → PNG conversions

### Changed

- **Internal Refactoring** (#86): Removed unused `exifSoftware` and `exifDocumentName` support (no public API changes). These Exif tags were not populated in real NovelAI files.

## [1.4.1] - 2026-01-24

### Fixed

- **NovelAI WebP Data Loss** (#79): Fixed an issue where `Software` and `Title` (DocumentName) tags were lost when converting NovelAI images to WebP. They are now correctly preserved in Exif tags.
- **NovelAI Version Detection** (#79): Improved detection of NovelAI version strings to better support newer versions.

### Changed

- **Internal Refactoring** (#80): Decoupled encoding strategies from specific tool names for better maintainability (no public API changes).

## [1.4.0] - 2026-01-24

### ⚠️ BREAKING CHANGES

- **Remove `force` option from `write()`** (#76): Blind conversion for unrecognized formats is no longer supported.
- **Metadata drop behavior**: When converting unrecognized metadata to a different format (e.g., PNG → JPEG), metadata is now dropped instead of attempting a blind conversion.

### Added

- **`WriteWarning` type** (#76): Notifies when metadata was intentionally dropped during conversion (e.g., unrecognized cross-format).
- **Graceful unrecognized handling**: Unrecognized metadata is still preserved when writing back to the same format or using `writeAsWebUI` with structured metadata.

### Documentation

- Updated API examples to use the new `result.warning` pattern.

## [1.3.0] - 2026-01-23

### Added

- **`formatRaw()` function** (#72): Format raw metadata as plain text for display
  - Works with unrecognized metadata (`status: 'unrecognized'`)
  - Multiple entries separated by blank lines
  - Ideal for fallback display when parsing fails

### Changed

- **Migrate to pnpm** (#74): Replace npm with pnpm for faster, more disk-efficient package management
- **Upgrade Vitest to v4** (#74): Fix esbuild security vulnerability (GHSA-67mh-4wv8-2f99)

### Documentation

- Improve README quality and fix package import names (#73)
- Restructure Usage section with collapsible advanced examples
- Emphasize `formatAsWebUI` cross-tool normalization capability

## [1.2.0] - 2026-01-22

### Added

- **`writeAsWebUI()` function** (#69): Write any GenerationMetadata to PNG/JPEG/WebP in SD WebUI (A1111) format
  - Create custom metadata from scratch
  - Convert metadata from any tool to WebUI-compatible format
  - Automatic encoding strategy (tEXt for ASCII, iTXt for non-ASCII in PNG)
- **`formatAsWebUI()` function** (#69): Format metadata as human-readable text in SD WebUI format
  - Tool-agnostic standard format for displaying generation metadata
  - Supports NovelAI character prompts with position comments
  - Normalizes line endings for cross-platform compatibility

## [1.1.1] - 2026-01-21

### Documentation

- Update README CDN usage example to reference v1.1.0
- Add README version update step to release workflow
- Remove trailing slash from package.json homepage URL

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

[1.7.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.7.0
[1.6.1]: https://github.com/enslo/sd-metadata/releases/tag/v1.6.1
[1.6.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.6.0
[1.5.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.5.0
[1.4.2]: https://github.com/enslo/sd-metadata/releases/tag/v1.4.2
[1.4.1]: https://github.com/enslo/sd-metadata/releases/tag/v1.4.1
[1.4.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.4.0
[1.3.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.3.0
[1.2.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.2.0
[1.1.1]: https://github.com/enslo/sd-metadata/releases/tag/v1.1.1
[1.1.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.1.0
[1.0.2]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.2
[1.0.1]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.1
[1.0.0]: https://github.com/enslo/sd-metadata/releases/tag/v1.0.0
