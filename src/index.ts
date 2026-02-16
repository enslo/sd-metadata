/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Export core API functions
export { read, type ReadOptions } from './api/read';
export { write, type WriteResult, type WriteWarning } from './api/write';
export { embed } from './api/embed';

// Export utility functions
export { stringify } from './api/stringify';

// Export constants
export { softwareLabels } from './constants';

// Deprecated functions (use embed/stringify instead)
/** @deprecated Use {@link embed} instead */
export { embed as writeAsWebUI } from './api/embed';
/** @deprecated Use {@link stringify} instead */
export { buildEmbedText as formatAsWebUI } from './api/stringify';
/** @deprecated Use {@link stringify} instead */
export { formatRaw } from './api/stringify';

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
