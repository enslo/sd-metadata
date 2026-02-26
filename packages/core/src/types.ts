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
// PNG Text Chunk Types
// ============================================================================

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
  | { type: 'jpegCom' }
  | { type: 'xmpPacket' };

/**
 * A single metadata segment with source tracking
 */
export interface MetadataSegment {
  /** Source location of this segment */
  source: MetadataSegmentSource;
  /** Raw data string */
  data: string;
}

/**
 * Raw metadata for write-back (preserves original format)
 */
export type RawMetadata =
  | { format: 'png'; chunks: PngTextChunk[] }
  | { format: 'jpeg'; segments: MetadataSegment[] }
  | { format: 'webp'; segments: MetadataSegment[] };

// ============================================================================
// Generation Software
// ============================================================================

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
  | 'forge'
  | 'forge-classic'
  | 'forge-neo'
  | 'reforge'
  | 'easy-reforge'
  | 'sd-webui'
  | 'sd-next'
  | 'civitai'
  | 'hf-space'
  | 'easydiffusion'
  | 'fooocus'
  | 'ruined-fooocus'
  | 'draw-things';

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
 * ComfyUI-format metadata (ComfyUI, TensorArt, Stability Matrix)
 *
 * These tools use ComfyUI-compatible workflow format.
 */

/**
 * ComfyUI node reference (for node outputs)
 *
 * Format: [nodeId, outputIndex]
 * Example: ["CheckpointLoader_Base", 0]
 */
export type ComfyNodeReference = [nodeId: string, outputIndex: number];

/**
 * ComfyUI node input value
 */
export type ComfyNodeInputValue =
  | string
  | number
  | boolean
  | ComfyNodeReference
  | ComfyNodeInputValue[];

/**
 * ComfyUI node structure
 */
export interface ComfyNode {
  /** Node class type (e.g., "CheckpointLoaderSimple", "KSampler") */
  class_type: string;
  /** Node inputs */
  inputs: Record<string, ComfyNodeInputValue>;
  /** Node metadata (ComfyUI only) */
  _meta?: {
    /** Node title for display */
    title?: string;
  };
  /** Change detection hash (rare, for caching) */
  is_changed?: string[] | null;
}

/**
 * ComfyUI node graph
 *
 * Maps node IDs to their corresponding node data.
 */
export type ComfyNodeGraph = Record<string, ComfyNode>;

/**
 * ComfyUI-format metadata (ComfyUI, TensorArt, Stability Matrix)
 *
 * These tools always have nodes in all formats.
 */
export interface BasicComfyUIMetadata extends BaseMetadata {
  software: 'comfyui' | 'tensorart' | 'stability-matrix';
  /**
   * ComfyUI node graph (required)
   *
   * Always present in all image formats (PNG, JPEG, WebP).
   * Structure: Record<nodeId, ComfyNode> where ComfyNode contains inputs and class_type.
   */
  nodes: ComfyNodeGraph;
}

/**
 * SwarmUI-specific metadata
 *
 * SwarmUI uses ComfyUI workflow format but nodes are only present in PNG.
 */
export interface SwarmUIMetadata extends BaseMetadata {
  software: 'swarmui';
  /**
   * ComfyUI node graph (optional for SwarmUI)
   *
   * Only present in PNG format. JPEG/WebP contain SwarmUI parameters only.
   * Structure: Record<nodeId, ComfyNode> where ComfyNode contains inputs and class_type.
   */
  nodes?: ComfyNodeGraph;
}

/**
 * ComfyUI-format metadata (union of BasicComfyUI and SwarmUI)
 *
 * This is a union type to handle different node graph requirements:
 * - ComfyUI/TensorArt/Stability Matrix: nodes are always present
 * - SwarmUI: nodes are only present in PNG format
 */
export type ComfyUIMetadata = BasicComfyUIMetadata | SwarmUIMetadata;

/**
 * Standard metadata (SD WebUI, Forge, InvokeAI, and others)
 *
 * Baseline generation metadata without tool-specific extensions.
 * Used by most SD tools that don't require special features like
 * NovelAI's character prompts or ComfyUI's node graphs.
 */
export interface StandardMetadata extends BaseMetadata {
  software:
    | 'sd-webui'
    | 'sd-next'
    | 'forge'
    | 'forge-classic'
    | 'forge-neo'
    | 'reforge'
    | 'easy-reforge'
    | 'invokeai'
    | 'civitai'
    | 'hf-space'
    | 'easydiffusion'
    | 'fooocus'
    | 'ruined-fooocus'
    | 'draw-things';
}

/**
 * Unified generation metadata (discriminated union)
 *
 * Use `metadata.software` to narrow by specific tool:
 * ```typescript
 * if (metadata.software === 'comfyui' ||
 *     metadata.software === 'tensorart' ||
 *     metadata.software === 'stability-matrix' ||
 *     metadata.software === 'swarmui') {
 *   // TypeScript knows metadata is ComfyUIMetadata
 *   if (metadata.nodes) {
 *     // Access workflow graph
 *   }
 * }
 * ```
 */
export type GenerationMetadata =
  | NovelAIMetadata
  | ComfyUIMetadata
  | StandardMetadata;

/**
 * User-created custom metadata for the embed() and stringify() APIs
 *
 * While {@link GenerationMetadata} represents parsed output from a known AI tool,
 * EmbedMetadata is designed for users to compose their own metadata from
 * scratch. Includes all base generation fields plus optional character
 * prompts and extras for the settings line.
 */
export type EmbedMetadata = BaseMetadata &
  Pick<NovelAIMetadata, 'characterPrompts'> & {
    /** Additional key-value pairs for the settings line */
    extras?: Record<string, string | number>;
  };

// ============================================================================
// Settings Types
// ============================================================================

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
  /** Denoising strength (ComfyUI only, typically 1.0 for txt2img) */
  denoise?: number;
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

// ============================================================================
// Parse Result
// ============================================================================

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
// API Types
// ============================================================================

/**
 * Options for the read function
 */
export interface ReadOptions {
  /**
   * When true, dimensions are taken strictly from metadata only.
   * When false (default), missing dimensions are extracted from image headers.
   * @default false
   */
  strict?: boolean;
}

/**
 * Warning types for write operations
 */
export type WriteWarning = {
  type: 'metadataDropped';
  reason: 'unrecognizedCrossFormat';
};

/**
 * Error types for write operations
 */
type WriteError =
  | { type: 'unsupportedFormat' }
  | { type: 'conversionFailed'; message: string }
  | { type: 'writeFailed'; message: string };

/**
 * Result of the write operation
 *
 * Success case may include a warning when metadata was intentionally dropped.
 */
export type WriteResult =
  | { ok: true; value: Uint8Array; warning?: WriteWarning }
  | { ok: false; error: WriteError };
