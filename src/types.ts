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
export type PngMetadataResult = Result<PngTextChunk[], PngReadError>;

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

// ============================================================================
// JPEG Writer Types
// ============================================================================

/**
 * Error types for JPEG writing
 */
export type JpegWriteError =
  | { type: 'invalidSignature' }
  | { type: 'corruptedStructure'; message: string };

/**
 * Result type for JPEG metadata writing
 */
export type JpegWriteResult = Result<Uint8Array, JpegWriteError>;

// ============================================================================
// WebP Writer Types
// ============================================================================

/**
 * Error types for WebP writing
 */
export type WebpWriteError =
  | { type: 'invalidSignature' }
  | { type: 'invalidRiffStructure'; message: string };

/**
 * Result type for WebP metadata writing
 */
export type WebpWriteResult = Result<Uint8Array, WebpWriteError>;

/**
 * PNG text chunk (tEXt or iTXt)
 */
export type PngTextChunk = TExtChunk | ITXtChunk;

// ============================================================================
// Exif Metadata Types (shared between JPEG/WebP)
// ============================================================================

/**
 * Source location of a metadata segment.
 * Used for round-tripping: reading and writing back to the correct location.
 */
export type MetadataSegmentSource =
  | { type: 'exifUserComment' }
  | { type: 'exifImageDescription'; prefix?: string }
  | { type: 'exifMake'; prefix?: string }
  | { type: 'jpegCom' };

/**
 * A single metadata segment with source tracking
 */
export interface MetadataSegment {
  /** Source location of this segment */
  source: MetadataSegmentSource;
  /** Raw data string */
  data: string;
}

// ============================================================================
// Format-Agnostic Metadata Types
// ============================================================================

/**
 * A single metadata entry (keyword + text)
 *
 * This is a format-agnostic representation used by parsers.
 */
export interface MetadataEntry {
  /** Entry keyword (e.g., 'parameters', 'Comment', 'prompt') */
  keyword: string;
  /** Text content */
  text: string;
}

/**
 * Raw metadata for write-back (preserves original format)
 */
export type RawMetadata =
  | { format: 'png'; chunks: PngTextChunk[] }
  | { format: 'jpeg'; segments: MetadataSegment[] }
  | { format: 'webp'; segments: MetadataSegment[] };

/**
 * Error types for JPEG reading
 */
export type JpegReadError =
  | { type: 'invalidSignature' }
  | { type: 'noMetadata' }
  | { type: 'parseError'; message: string };

/**
 * Result type for JPEG metadata reading
 */
export type JpegMetadataResult = Result<MetadataSegment[], JpegReadError>;

// ============================================================================
// WebP Metadata Types
// ============================================================================

/**
 * Error types for WebP reading
 */
export type WebpReadError =
  | { type: 'invalidSignature' }
  | { type: 'noExifChunk' }
  | { type: 'noMetadata' }
  | { type: 'parseError'; message: string };

/**
 * Result type for WebP metadata reading
 */
export type WebpMetadataResult = Result<MetadataSegment[], WebpReadError>;

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
  | 'civitai'
  | 'hf-space'
  | 'easydiffusion'
  | 'fooocus';

/**
 * Metadata format classification
 *
 * This represents the format/structure of the metadata, not the specific tool.
 * Use this to determine which fields are available and how to interpret them.
 */
export type MetadataFormat =
  | 'novelai'
  | 'comfyui'
  | 'a1111'
  | 'invokeai'
  | 'swarmui';

// ============================================================================
// Unified Metadata Types
// ============================================================================

/**
 * Base metadata fields shared by all tools
 */
export interface BaseMetadata {
  /** Format classification (for type narrowing) */
  type: MetadataFormat;
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
}

/**
 * NovelAI-specific metadata
 */
export interface NovelAIMetadata extends BaseMetadata {
  type: 'novelai';
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
 * ComfyUI-format metadata (ComfyUI, TensorArt, Stability Matrix)
 *
 * These tools use ComfyUI-compatible workflow format.
 */
export interface ComfyUIMetadata extends BaseMetadata {
  type: 'comfyui';
  software: 'comfyui' | 'tensorart' | 'stability-matrix';
  /** Full workflow JSON (for reproducibility) */
  workflow?: unknown;
}

/**
 * A1111-format metadata (SD WebUI, Forge, Forge Neo, Civitai)
 */
export interface A1111Metadata extends BaseMetadata {
  type: 'a1111';
  software:
    | 'sd-webui'
    | 'forge'
    | 'forge-neo'
    | 'civitai'
    | 'hf-space'
    | 'easydiffusion'
    | 'fooocus';
}

/**
 * InvokeAI-specific metadata
 */
export interface InvokeAIMetadata extends BaseMetadata {
  type: 'invokeai';
  software: 'invokeai';
}

/**
 * SwarmUI-specific metadata
 */
export interface SwarmUIMetadata extends BaseMetadata {
  type: 'swarmui';
  software: 'swarmui';
}

/**
 * Unified generation metadata (discriminated union)
 *
 * Use `metadata.type` to narrow by format, or `metadata.software` for specific tool:
 * ```typescript
 * if (metadata.type === 'comfyui') {
 *   // TypeScript knows metadata.workflow exists
 * }
 * if (metadata.software === 'tensorart') {
 *   // Specific tool within comfyui format
 * }
 * ```
 */
export type GenerationMetadata =
  | NovelAIMetadata
  | ComfyUIMetadata
  | A1111Metadata
  | InvokeAIMetadata
  | SwarmUIMetadata;

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
 * Result type for internal parsers
 */
export type InternalParseResult = Result<GenerationMetadata, ParseError>;

/**
 * Parse result with 4-status design
 *
 * - `success`: Parsing succeeded, metadata and raw data available
 * - `empty`: No metadata found in the file
 * - `unrecognized`: Metadata exists but format is not recognized
 * - `invalid`: File is corrupted or not a valid image
 */
export type ParseResult =
  | { status: 'success'; metadata: GenerationMetadata; raw: RawMetadata }
  | { status: 'empty' }
  | { status: 'unrecognized'; raw: RawMetadata }
  | { status: 'invalid'; message?: string };

// ============================================================================
// Metadata Conversion Types
// ============================================================================

/**
 * Target format for metadata conversion
 */
export type ConversionTargetFormat = 'png' | 'jpeg' | 'webp';

/**
 * Conversion error types
 */
export type ConversionError =
  | { type: 'unsupportedSoftware'; software: string }
  | { type: 'invalidParseResult'; status: string }
  | { type: 'missingRawData' }
  | { type: 'parseError'; message: string };

/**
 * Result type for metadata conversion
 */
export type ConversionResult = Result<RawMetadata, ConversionError>;
