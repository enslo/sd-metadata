/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Export core API functions
export { read } from './api/read';
export { write, type WriteOptions, type WriteResult } from './api/write';
export { writeAsWebUI } from './api/write-webui';

// Export utility functions
export { formatAsWebUI } from './serializers/a1111';

// Export types (minimal public API)
export type {
  CharacterPrompt,
  GenerationMetadata,
  HiresSettings,
  ITXtChunk,
  MetadataSegment,
  MetadataSegmentSource,
  ModelSettings,
  ParseResult,
  PngTextChunk,
  RawMetadata,
  SamplingSettings,
  TExtChunk,
  UpscaleSettings,
} from './types';
