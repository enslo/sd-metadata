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
 * Error types for PNG writing
 */
export type PngWriteError =
  | { type: 'invalidSignature' }
  | { type: 'noIhdrChunk' };

/**
 * Result type for PNG metadata writing
 */
export type PngWriteResult = Result<Uint8Array, PngWriteError>;

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

// ============================================================================
// Unified Metadata Types
// ============================================================================

/**
 * Base metadata fields shared by all tools
 */
export interface BaseMetadata {
  /** Positive prompt */
  prompt: string;
  /** Negative prompt */
  negativePrompt: string;
  /** Model settings */
  model?: ModelSettings;
  /** Sampling settings */
  sampling?: SamplingSettings;
  /** Hires.fix settings (if applied) */
  hires?: HiresSettings;
  /** Upscale settings (if applied) */
  upscale?: UpscaleSettings;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Raw metadata (for write-back) */
  raw: PngTextChunk[];
}

/**
 * NovelAI-specific metadata
 */
export interface NovelAIMetadata extends BaseMetadata {
  software: 'novelai';
  /** V4 character prompts (when using character placement) */
  characterPrompts?: CharacterPrompt[];
  /** Use character coordinates for placement */
  useCoords?: boolean;
  /** Use character order */
  useOrder?: boolean;
}

/**
 * Character prompt with position (NovelAI V4)
 */
export interface CharacterPrompt {
  /** Character-specific prompt */
  prompt: string;
  /** Character position (normalized 0-1) */
  center?: { x: number; y: number };
}

/**
 * ComfyUI-specific metadata
 */
export interface ComfyUIMetadata extends BaseMetadata {
  software: 'comfyui';
  /** Full workflow JSON (for reproducibility) */
  workflow?: unknown;
}

/**
 * A1111-format metadata (SD WebUI, Forge, Forge Neo)
 */
export interface A1111Metadata extends BaseMetadata {
  software: 'sd-webui' | 'forge' | 'forge-neo';
}

/**
 * Unified generation metadata (discriminated union)
 *
 * Use `metadata.software` to narrow to specific type:
 * ```typescript
 * if (metadata.software === 'novelai') {
 *   // TypeScript knows metadata.characterPrompts exists
 * }
 * ```
 */
export type GenerationMetadata =
  | NovelAIMetadata
  | ComfyUIMetadata
  | A1111Metadata;

/**
 * Model settings
 */
export interface ModelSettings {
  /** Model name */
  name?: string;
  /** Model hash */
  hash?: string;
  /** VAE name */
  vae?: string;
}

/**
 * Sampling settings
 */
export interface SamplingSettings {
  /** Sampler name */
  sampler?: string;
  /** Scheduler (sometimes included in sampler, sometimes separate) */
  scheduler?: string;
  /** Sampling steps */
  steps?: number;
  /** CFG scale */
  cfg?: number;
  /** Random seed */
  seed?: number;
  /** CLIP skip layers */
  clipSkip?: number;
}

/**
 * Hires.fix settings
 */
export interface HiresSettings {
  /** Upscale factor */
  scale?: number;
  /** Upscaler name */
  upscaler?: string;
  /** Hires steps */
  steps?: number;
  /** Hires denoising strength */
  denoise?: number;
}

/**
 * Upscale settings (post-generation)
 */
export interface UpscaleSettings {
  /** Upscaler name */
  upscaler?: string;
  /** Scale factor */
  scale?: number;
}

/**
 * Parse error types
 */
export type ParseError =
  | { type: 'unsupportedFormat' }
  | { type: 'parseError'; message: string };

/**
 * Result type for metadata parsing
 */
export type ParseResult = Result<GenerationMetadata, ParseError>;
