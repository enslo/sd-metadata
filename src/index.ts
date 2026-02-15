/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Export core API functions
export { read, type ReadOptions } from './api/read';
export { write, type WriteResult, type WriteWarning } from './api/write';
export { embed } from './api/embed';

// Deprecated API functions
export { writeAsWebUI } from './api/write-webui';

// Export utility functions
export { stringify } from './serializers/stringify';

// Export constants
export { softwareLabels } from './constants';

// Deprecated utility functions (use stringify instead)
export { formatAsWebUI } from './serializers/a1111';
export { formatRaw } from './serializers/raw';

// Export types (minimal public API)
export type {
  BaseMetadata,
  CharacterPrompt,
  ComfyNode,
  ComfyNodeGraph,
  ComfyNodeInputValue,
  ComfyNodeReference,
  EmbedMetadata,
  GenerationMetadata,
  GenerationSoftware,
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
