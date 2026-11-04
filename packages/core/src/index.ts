/**
 * sd-metadata - Read and write AI-generated image metadata
 */

export { embed } from './api/embed';
// Export core API functions
export { parse } from './api/parse';
export { parseVideo } from './api/parse-video';
/** @deprecated Use {@link parse} instead */
export { read } from './api/read';
// Export utility functions
export { stringify } from './api/stringify';
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
