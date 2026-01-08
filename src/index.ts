/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Types
export type {
  A1111Metadata,
  BaseMetadata,
  CharacterPrompt,
  ComfyUIMetadata,
  ExifMetadata,
  GenerationMetadata,
  GenerationSoftware,
  HiresSettings,
  InvokeAIMetadata,
  ITXtChunk,
  JpegMetadataResult,
  JpegReadError,
  MetadataFormat,
  MetadataSegment,
  MetadataSegmentSource,
  ModelSettings,
  NovelAIMetadata,
  ParseError,
  ParseResult,
  PngMetadata,
  PngMetadataResult,
  PngReadError,
  PngTextChunk,
  PngWriteError,
  PngWriteResult,
  Result,
  SamplingSettings,
  SwarmUIMetadata,
  TExtChunk,
  UpscaleSettings,
  WebpMetadataResult,
  WebpReadError,
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
