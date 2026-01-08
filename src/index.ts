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
  PngWriteError,
  PngWriteResult,
  Result,
  TExtChunk,
} from './types';
export { Result as ResultHelper } from './types';

// PNG Reader
export { readPngMetadata } from './readers/png';

// PNG Writer
export { writePngMetadata } from './writers/png';
