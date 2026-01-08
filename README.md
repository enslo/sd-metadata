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

### Phase 1.6: API Simplification ⬅️ Next

- [ ] Unified read API (readPngMetadata returns GenerationMetadata directly)
- [ ] Image size fallback (extract width/height from IHDR when not in metadata)
- [ ] ComfyUI: workflow-based prompt extraction (node-independent, includes comments)

### Phase 2: JPEG Support

- [ ] JPEG reading (COM segment / Exif UserComment)
- [ ] JPEG writing

### Phase 3: WebP Support

- [ ] WebP reading (EXIF / XMP chunks)
- [ ] WebP writing

### Phase 4: Format Conversion

- [ ] Convert between formats while preserving metadata

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
