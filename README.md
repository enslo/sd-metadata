# sd-metadata

A TypeScript library to read and write metadata embedded in AI-generated images.

## Features

### Supported Image Formats

- PNG (tEXt / iTXt chunks)
- JPEG (COM segment / Exif UserComment)
- WebP (EXIF / XMP chunks)

### Supported AI Tools

#### Verified (Tested with sample files)

- NovelAI
- ComfyUI
- Stable Diffusion WebUI (AUTOMATIC1111)
- Forge / Forge Neo
- Civitai
- InvokeAI
- SwarmUI
- TensorArt
- Stability Matrix
- HuggingFace Space
- Ruined Fooocus

#### Unverified (Based on reference implementations)

> ⚠️ **Note**: The following parsers are implemented based on reference code from other libraries
> but have not been verified with actual sample files. They may not work correctly.
> Please report any issues if you encounter problems.

- Easy Diffusion
- Fooocus

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

- **SwarmUI cross-format conversion**:  
  SwarmUI PNG files contain both `prompt` (ComfyUI workflow) and `parameters` (sui_image_params) chunks.
  When converting PNG → JPEG/WebP, only `parameters` is preserved to match the native WebP format.
  This means PNG → JPEG/WebP → PNG conversions will lose the `prompt` chunk.
  - ✅ Metadata (prompt, model, sampling settings) is fully preserved
  - ❌ ComfyUI workflow data in `prompt` chunk is lost
  - Note: This is intentional to maintain compatibility with SwarmUI's native WebP format

### Advanced Features

#### Unrecognized Format Conversion

When encountering unrecognized metadata formats (`status: 'unrecognized'`), you can force blind conversion using the `force` option:

```typescript
import { read, write } from '@repo/sd-metadata';

// Read unrecognized format
const source = read(unknownImage);
// source.status === 'unrecognized'

// Force blind conversion (preserves all metadata chunks/segments)
const result = write(targetImage, source, { force: true });
```

This enables format conversion for unknown/future tools without parser implementation by:

- Combining all PNG chunks into single JSON in exifUserComment
- Converting between formats while preserving all metadata

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
