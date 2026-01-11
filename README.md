# sd-metadata

A TypeScript library to read and write metadata embedded in AI-generated images.

## Features

### Supported Image Formats

- PNG (tEXt / iTXt chunks)
- JPEG (COM segment / Exif UserComment)
- WebP (EXIF / XMP chunks)

### Supported AI Tools

- NovelAI
- ComfyUI
- Stable Diffusion WebUI (AUTOMATIC1111)
- And more (based on sample image analysis)

## Installation

```bash
npm install sd-metadata
```

> **Note**: This package is not yet published. Coming soon!

## Usage

```typescript
import { readMetadata, writeMetadata } from 'sd-metadata';

// Read metadata from an image
const metadata = readMetadata(imageData);
console.log(metadata.tool);    // 'novelai' | 'comfyui' | 'sdwebui' | ...
console.log(metadata.prompt);  // 'a beautiful landscape...'

// Write metadata to an image
const newImageData = writeMetadata(imageData, metadata);
```

## Roadmap

### Phase 1: PNG Support ✅

- [x] PNG reading (extract metadata from tEXt / iTXt chunks)
- [x] PNG writing (embed metadata into chunks)
- [x] Tool-specific parsers (NovelAI, ComfyUI, A1111/Forge)

### Phase 1.5: Additional Tool Support ✅

- [x] InvokeAI parser
- [x] SwarmUI parser
- [x] TensorArt parser
- [x] Stability Matrix parser

### Phase 1.6: API Simplification ✅

- [x] Unified read API (`parsePng` returns GenerationMetadata directly)
- [x] Image size fallback (extract width/height from IHDR when not in metadata)
- [x] ComfyUI: workflow-based prompt extraction (node-independent, includes comments)

### Phase 2: JPEG/WebP Reading ✅

- [x] Shared Exif parsing utilities
- [x] JPEG reading (UserComment, ImageDescription, Make, COM segment)
- [x] WebP reading (EXIF chunk)
- [x] Segment tracking for round-trip preservation

### Phase 3: JPEG/WebP Writing ✅

- [x] JPEG writing (Exif UserComment, COM segment)
- [x] WebP writing (EXIF chunk)

### Phase 4: Format Conversion ✅

- [x] Metadata converters for all supported tools
  - NovelAI, ComfyUI, A1111/Forge/Civitai, SwarmUI, InvokeAI, HF-Space
- [x] PNG ↔ JPEG/WebP round-trip preservation
- [x] HuggingFace Space converter (separate from A1111, uses JSON format)
- [x] ComfyUI detection priority (prioritize when prompt + workflow exist)

### Known Limitations

- **Exif UserComment UTF-16LE Encoding**: The current implementation uses `charCodeAt()` for UTF-16LE encoding, which does not properly handle:
  - Multibyte characters (e.g., Japanese, Chinese, Korean)
  - Surrogate pairs (emoji and other Unicode characters beyond BMP)
  - This affects JPEG and WebP formats when writing Exif UserComment
  - Workaround: Use PNG format for full Unicode support
  - Future: Implement proper UTF-16LE encoding with `TextEncoder`/`codePointAt()`

- **A1111 Size Field Requirement**: The current A1111 parser treats the `Size` field as mandatory, returning a parse error if missing. This deviates from SD Prompt Reader's behavior:
  - SD Prompt Reader: Falls back to `"0x0"` (width=0, height=0) when `Size` is absent
  - Current implementation: Returns `parseError` when `Size` is missing
  - This overly strict validation may reject valid A1111 metadata that lacks `Size` (e.g., some img2img workflows)
  - Future: Align with SD Prompt Reader by making `Size` optional with `"0x0"` fallback
  - Reference: [SD Prompt Reader a1111.py](https://github.com/receyuki/stable-diffusion-prompt-reader/blob/master/sd_prompt_reader/format/a1111.py)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Build
npm run build

# Lint
npm run lint
```

## License

MIT
