/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Deprecated functions (use embed/stringify instead)
/** @deprecated Use {@link embed} instead */
export { embed, embed as writeAsWebUI } from './api/embed';
// Export core API functions
export { parse } from './api/parse';
export { parseVideo } from './api/parse-video';
/** @deprecated Use {@link parse} instead */
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
export {
  originLabel,
  productLabel,
  softwareLabels,
  vendorLabels,
} from './constants';

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
  LoraSettings,
  MetadataSegment,
  MetadataSegmentSource,
  ModelSettings,
  ParseResult,
  PngTextChunk,
  RawMetadata,
  ReadOptions,
  RgbaPixels,
  SamplingSettings,
  TExtChunk,
  UpscaleSettings,
  Vendor,
  VendorInfo,
  VendorSource,
  VideoParseResult,
  VideoRawMetadata,
  VideoReadOptions,
  VideoTag,
  WriteResult,
  WriteWarning,
} from './types';
