/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Export core API functions
export { read, type ReadOptions } from './api/read';
export { write, type WriteResult, type WriteWarning } from './api/write';
export { writeAsWebUI } from './api/write-webui';

// Export utility functions
export { formatAsWebUI } from './serializers/a1111';
export { formatRaw } from './serializers/raw';

// Export types (minimal public API)
export type {
  CharacterPrompt,
  ComfyNode,
  ComfyNodeGraph,
  ComfyNodeInputValue,
  ComfyNodeReference,
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
