/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Types
export type {
  A1111Metadata,
  BaseMetadata,
  CharacterPrompt,
  ComfyUIMetadata,
  GenerationMetadata,
  GenerationSoftware,
  HiresSettings,
  InvokeAIMetadata,
  ITXtChunk,
  JpegMetadataResult,
  JpegReadError,
  JpegWriteError,
  JpegWriteResult,
  MetadataEntry,
  MetadataFormat,
  MetadataSegment,
  MetadataSegmentSource,
  ModelSettings,
  NovelAIMetadata,
  ParseError,
  ParseResult,
  InternalParseResult,
  PngMetadataResult,
  PngReadError,
  PngTextChunk,
  PngWriteError,
  PngWriteResult,
  RawMetadata,
  Result,
  SamplingSettings,
  SwarmUIMetadata,
  TExtChunk,
  UpscaleSettings,
  WebpMetadataResult,
  WebpReadError,
  WebpWriteError,
  WebpWriteResult,
  // Conversion types
  ConversionError,
  ConversionResult,
  ConversionTargetFormat,
} from './types';
export { Result as ResultHelper } from './types';

// PNG Reader
export { readPngMetadata } from './readers/png';

// JPEG Reader
export { readJpegMetadata } from './readers/jpeg';

// WebP Reader
export { readWebpMetadata } from './readers/webp';

// PNG Writer
export { writePngMetadata } from './writers/png';

// JPEG Writer
export { writeJpegMetadata } from './writers/jpeg';

// WebP Writer
export { writeWebpMetadata } from './writers/webp';

// Parsers
export {
  parseMetadata,
  parseA1111,
  parseComfyUI,
  parseInvokeAI,
  parseNovelAI,
  parseStabilityMatrix,
  parseSwarmUI,
  parseTensorArt,
} from './parsers';

// Unified API
export { parsePng } from './api/png';
export { parseJpeg } from './api/jpeg';
export { parseWebp } from './api/webp';

// Metadata Conversion
export { convertMetadata } from './converters';
