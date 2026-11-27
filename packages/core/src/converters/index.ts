/**
 * Metadata conversion utilities
 *
 * Provides functions to convert metadata between different image formats.
 */

import type {
  GenerationSoftware,
  MetadataSegment,
  ParseResult,
  PngTextChunk,
  RawMetadata,
} from '../types';
import { Result } from '../types';

import { convertA1111PngToSegments, convertA1111SegmentsToPng } from './a1111';
import {
  convertCivitaiPngToSegments,
  convertCivitaiSegmentsToPng,
} from './civitai';
import {
  convertComfyUIPngToSegments,
  convertComfyUISegmentsToPng,
} from './comfyui';
import { convertDezgoPngToSegments, convertDezgoSegmentsToPng } from './dezgo';
import {
  convertDrawThingsPngToSegments,
  convertDrawThingsSegmentsToPng,
} from './draw-things';
import {
  convertEasyDiffusionPngToSegments,
  convertEasyDiffusionSegmentsToPng,
} from './easydiffusion';
import {
  convertFooocusPngToSegments,
  convertFooocusSegmentsToPng,
} from './fooocus';
import {
  convertInvokeAIPngToSegments,
  convertInvokeAISegmentsToPng,
} from './invokeai';
import {
  convertKusArtPngToSegments,
  convertKusArtSegmentsToPng,
} from './kusart';
import {
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
} from './novelai';
import {
  convertSimpleChunkPngToSegments,
  convertSimpleChunkSegmentsToPng,
} from './simple-chunk';
import {
  convertStabilityMatrixPngToSegments,
  convertStabilityMatrixSegmentsToPng,
} from './stability-matrix';
import {
  convertSwarmUIPngToSegments,
  convertSwarmUISegmentsToPng,
} from './swarmui';
import {
  convertTensorArtPngToSegments,
  convertTensorArtSegmentsToPng,
} from './tensorart';

// Internal types
type ConversionTargetFormat = 'png' | 'jpeg' | 'webp';

type ConversionError =
  | { type: 'missingRawData' }
  | { type: 'invalidParseResult'; status: string }
  | { type: 'unsupportedSoftware'; software: string };

type ConversionResult = Result<RawMetadata, ConversionError>;

/**
 * Convert metadata from one format to another
 *
 * Takes a ParseResult and converts the raw metadata to the target format.
 * Conversion strategy is determined by the detected software.
 *
 * @param parseResult - Result from parsePng, parseJpeg, or parseWebp
 * @param targetFormat - Target format ('png', 'jpeg', or 'webp')
 * @returns Converted RawMetadata or error
 *
 * @example
 * ```typescript
 * const pngResult = parsePng(pngData);
 * const converted = convertMetadata(pngResult, 'webp');
 * if (converted.ok) {
 *   const webpWithMetadata = writeWebpMetadata(webpData, converted.value.segments);
 * }
 * ```
 */
export function convertMetadata(
  parseResult: ParseResult,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  // Handle non-success statuses
  if (parseResult.status === 'empty') {
    return Result.error({ type: 'missingRawData' });
  }

  if (parseResult.status === 'invalid') {
    return Result.error({
      type: 'invalidParseResult',
      status: parseResult.status,
    });
  }

  // Handle unrecognized - should not reach here in normal flow
  // since write() handles unrecognized separately
  if (parseResult.status === 'unrecognized') {
    return Result.error({
      type: 'unsupportedSoftware',
      software: 'unknown',
    });
  }

  // Vendor declarations carry no generation metadata to convert; write() also
  // guards this, so reaching here is a defensive backstop.
  if (parseResult.status === 'vendor') {
    return Result.error({
      type: 'invalidParseResult',
      status: 'vendor',
    });
  }

  const raw = parseResult.raw;

  // If source and target are the same format, return as-is
  if (raw.format === targetFormat) {
    return Result.ok(raw);
  }

  const software = parseResult.metadata.software;

  // Get the converter pair for detected software
  const converters = softwareConverters[software];
  if (!converters) {
    // This should never happen if software is a valid GenerationSoftware
    return Result.error({
      type: 'unsupportedSoftware',
      software,
    });
  }

  return convertRaw(raw, targetFormat, converters);
}

// PNG↔segment conversion functions of one tool
type PngToSegmentsFn = (chunks: PngTextChunk[]) => MetadataSegment[];
type PngRaw = Extract<RawMetadata, { format: 'png' }>;
// A converter answers with text chunks, or with text chunks plus the
// segments of an eXIf chunk
type SegmentsToPngFn = (
  segments: MetadataSegment[],
) => PngTextChunk[] | Omit<PngRaw, 'format'>;
type ConverterPair = readonly [PngToSegmentsFn, SegmentsToPngFn];

/**
 * Convert raw metadata to another format with a tool's pair of converters
 *
 * All tools follow the same pattern:
 * - PNG → JPEG/WebP: convert chunks to segments; segments already held in
 *   an eXIf chunk are carried over as they are
 * - JPEG/WebP → PNG: convert segments to chunks (or to an eXIf chunk)
 * - Same format: return as-is
 */
function convertRaw(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
  [pngToSegments, segmentsToPng]: ConverterPair,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → same format: return as-is
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }
    // PNG → JPEG/WebP
    const segments = [
      ...(raw.chunks.length > 0 ? pngToSegments(raw.chunks) : []),
      ...(raw.exif ?? []),
    ];
    return Result.ok({ format: targetFormat, segments });
  }

  // JPEG/WebP → JPEG/WebP: just copy segments
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({ format: targetFormat, segments: raw.segments });
  }

  // JPEG/WebP → PNG
  const png = segmentsToPng(raw.segments);
  return Result.ok(
    Array.isArray(png)
      ? { format: 'png', chunks: png }
      : { format: 'png', ...png },
  );
}

// Pairs shared by several tools
const a1111: ConverterPair = [
  convertA1111PngToSegments,
  convertA1111SegmentsToPng,
];
const simpleChunk: ConverterPair = [
  convertSimpleChunkPngToSegments,
  convertSimpleChunkSegmentsToPng,
];

/**
 * Lookup table: software name → its pair of converters
 *
 * The table holds function references only. Nothing is called while the
 * module loads, so a bundler drops every converter from a bundle that
 * never calls convertMetadata().
 */
const softwareConverters: Record<GenerationSoftware, ConverterPair> = {
  // NovelAI
  novelai: [convertNovelaiPngToSegments, convertNovelaiSegmentsToPng],
  // A1111-format (sd-webui, forge family, sd-next)
  'sd-webui': a1111,
  'sd-next': a1111,
  forge: a1111,
  'forge-classic': a1111,
  'forge-neo': a1111,
  reforge: a1111,
  'easy-reforge': a1111,
  // CivitAI Orchestration format
  civitai: [convertCivitaiPngToSegments, convertCivitaiSegmentsToPng],
  // ComfyUI-format
  comfyui: [convertComfyUIPngToSegments, convertComfyUISegmentsToPng],
  // TensorArt (per-chunk encoding: generation_data uses raw UTF-8)
  tensorart: [convertTensorArtPngToSegments, convertTensorArtSegmentsToPng],
  // Stability Matrix (per-chunk encoding: parameters uses raw UTF-8)
  'stability-matrix': [
    convertStabilityMatrixPngToSegments,
    convertStabilityMatrixSegmentsToPng,
  ],
  // Easy Diffusion
  easydiffusion: [
    convertEasyDiffusionPngToSegments,
    convertEasyDiffusionSegmentsToPng,
  ],
  // Fooocus variants
  fooocus: [convertFooocusPngToSegments, convertFooocusSegmentsToPng],
  'ruined-fooocus': simpleChunk,
  // SwarmUI
  swarmui: [convertSwarmUIPngToSegments, convertSwarmUISegmentsToPng],
  // InvokeAI
  invokeai: [convertInvokeAIPngToSegments, convertInvokeAISegmentsToPng],
  // HuggingFace Space
  'hf-space': simpleChunk,
  // Draw Things (XMP format)
  'draw-things': [
    convertDrawThingsPngToSegments,
    convertDrawThingsSegmentsToPng,
  ],
  // Dezgo (YAML in the EXIF UserComment)
  dezgo: [convertDezgoPngToSegments, convertDezgoSegmentsToPng],
  // KusArt (both chunks packed into the EXIF UserComment)
  kusart: [convertKusArtPngToSegments, convertKusArtSegmentsToPng],
};
