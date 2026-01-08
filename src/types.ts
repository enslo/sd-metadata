/**
 * Result type for explicit error handling
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Helper functions for Result type
 */
export const Result = {
  ok: <T, E>(value: T): Result<T, E> => ({ ok: true, value }),
  error: <T, E>(error: E): Result<T, E> => ({ ok: false, error }),
};

// ============================================================================
// PNG Metadata Types
// ============================================================================

/**
 * Error types for PNG reading
 */
export type PngReadError =
  | { type: 'invalidSignature' }
  | { type: 'corruptedChunk'; message: string };

/**
 * Result type for PNG metadata reading
 */
export type PngMetadataResult = Result<PngMetadata, PngReadError>;

/**
 * PNG metadata container
 */
export interface PngMetadata {
  /** Raw chunk data for write-back */
  chunks: PngTextChunk[];
  /** Detected generation software */
  software: GenerationSoftware | null;
}

/**
 * PNG text chunk (tEXt or iTXt)
 */
export type PngTextChunk = TExtChunk | ITXtChunk;

/**
 * tEXt chunk (Latin-1 encoded text)
 */
export interface TExtChunk {
  type: 'tEXt';
  /** Chunk keyword (e.g., 'parameters', 'Comment') */
  keyword: string;
  /** Text content */
  text: string;
}

/**
 * iTXt chunk (UTF-8 encoded international text)
 */
export interface ITXtChunk {
  type: 'iTXt';
  /** Chunk keyword */
  keyword: string;
  /** Compression flag (0=uncompressed, 1=compressed) */
  compressionFlag: number;
  /** Compression method (0=zlib/deflate) */
  compressionMethod: number;
  /** Language tag (BCP 47) */
  languageTag: string;
  /** Translated keyword */
  translatedKeyword: string;
  /** Text content */
  text: string;
}

/**
 * Known AI image generation software
 */
export type GenerationSoftware =
  | 'novelai'
  | 'comfyui'
  | 'swarmui'
  | 'tensorart'
  | 'stability-matrix'
  | 'invokeai'
  | 'forge-neo'
  | 'forge'
  | 'sd-webui'
  | 'animagine';
