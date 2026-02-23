/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Deprecated functions (use embed/stringify instead)
/** @deprecated Use {@link embed} instead */
export { embed, embed as writeAsWebUI } from './api/embed';
// Export core API functions
export { read } from './api/read';
// Export utility functions
/** @deprecated Use {@link stringify} instead */
/** @deprecated Use {@link stringify} instead */
export {
  buildEmbedText as formatAsWebUI,
  formatRaw,
  stringify,
} from './api/stringify';
export { write } from './api/write';
// Export constants
export { softwareLabels } from './constants';

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
  ReadOptions,
  SamplingSettings,
  TExtChunk,
  UpscaleSettings,
  WriteResult,
  WriteWarning,
} from './types';
