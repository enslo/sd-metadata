/**
 * sd-metadata - Read and write AI-generated image metadata
 */

// Types
export type {
  GenerationSoftware,
  ITXtChunk,
  PngMetadata,
  PngMetadataResult,
  PngReadError,
  PngTextChunk,
  Result,
  TExtChunk,
} from './types';
export { Result as ResultHelper } from './types';

// PNG Reader
export { readPngMetadata } from './readers/png';
