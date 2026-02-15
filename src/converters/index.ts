/**
 * Metadata conversion utilities
 *
 * Provides functions to convert metadata between different image formats.
 */

import type {
  ConversionResult,
  ConversionTargetFormat,
  ParseResult,
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
import {
  convertEasyDiffusionPngToSegments,
  convertEasyDiffusionSegmentsToPng,
} from './easydiffusion';
import {
  convertInvokeAIPngToSegments,
  convertInvokeAISegmentsToPng,
} from './invokeai';
import {
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
} from './novelai';
import { createPngToSegments, createSegmentsToPng } from './simple-chunk';
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

  const raw = parseResult.raw;

  // If source and target are the same format, return as-is
  if (raw.format === targetFormat) {
    return Result.ok(raw);
  }

  const software = parseResult.metadata.software;

  // Get converter for detected software
  const converter = softwareConverters[software];
  if (!converter) {
    // This should never happen if software is a valid GenerationSoftware
    return Result.error({
      type: 'unsupportedSoftware',
      software,
    });
  }

  return converter(raw, targetFormat);
}

// Type for converter function
type ConverterFn = (
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
) => ConversionResult;

// Type for PNG↔segment conversion functions
type PngToSegmentsFn = (
  chunks: import('../types').PngTextChunk[],
) => import('../types').MetadataSegment[];
type SegmentsToPngFn = (
  segments: import('../types').MetadataSegment[],
) => import('../types').PngTextChunk[];

/**
 * Factory function to create format converters
 *
 * All converters follow the same pattern:
 * - PNG → JPEG/WebP: convert chunks to segments
 * - JPEG/WebP → PNG: convert segments to chunks
 * - Same format: return as-is
 */
function createFormatConverter(
  pngToSegments: PngToSegmentsFn,
  segmentsToPng: SegmentsToPngFn,
): ConverterFn {
  return (raw, targetFormat) => {
    if (raw.format === 'png') {
      // PNG → same format: return as-is
      if (targetFormat === 'png') {
        return Result.ok(raw);
      }
      // PNG → JPEG/WebP
      const segments = pngToSegments(raw.chunks);
      return Result.ok({ format: targetFormat, segments });
    }

    // JPEG/WebP → JPEG/WebP: just copy segments
    if (targetFormat === 'jpeg' || targetFormat === 'webp') {
      return Result.ok({ format: targetFormat, segments: raw.segments });
    }

    // JPEG/WebP → PNG
    const chunks = segmentsToPng(raw.segments);
    return Result.ok({ format: 'png', chunks });
  };
}

// Create converters using factory
const convertNovelai = createFormatConverter(
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
);

const convertA1111 = createFormatConverter(
  convertA1111PngToSegments,
  convertA1111SegmentsToPng,
);

const convertComfyUI = createFormatConverter(
  convertComfyUIPngToSegments,
  convertComfyUISegmentsToPng,
);

const convertEasyDiffusion = createFormatConverter(
  convertEasyDiffusionPngToSegments,
  convertEasyDiffusionSegmentsToPng,
);

const convertFooocus = createFormatConverter(
  createPngToSegments('parameters'),
  createSegmentsToPng('parameters', 'text-unicode-escape'),
);

const convertRuinedFooocus = createFormatConverter(
  createPngToSegments('parameters'),
  createSegmentsToPng('parameters', 'text-unicode-escape'),
);

const convertSwarmUI = createFormatConverter(
  convertSwarmUIPngToSegments,
  convertSwarmUISegmentsToPng,
);

const convertInvokeAI = createFormatConverter(
  convertInvokeAIPngToSegments,
  convertInvokeAISegmentsToPng,
);

const convertHfSpace = createFormatConverter(
  createPngToSegments('parameters'),
  createSegmentsToPng('parameters', 'text-unicode-escape'),
);

const convertCivitai = createFormatConverter(
  convertCivitaiPngToSegments,
  convertCivitaiSegmentsToPng,
);

const convertStabilityMatrix = createFormatConverter(
  convertStabilityMatrixPngToSegments,
  convertStabilityMatrixSegmentsToPng,
);

const convertTensorArt = createFormatConverter(
  convertTensorArtPngToSegments,
  convertTensorArtSegmentsToPng,
);

/**
 * Lookup table: software name → converter function
 */
const softwareConverters = {
  // NovelAI
  novelai: convertNovelai,
  // A1111-format (sd-webui, forge family, sd-next)
  'sd-webui': convertA1111,
  'sd-next': convertA1111,
  forge: convertA1111,
  'forge-classic': convertA1111,
  'forge-neo': convertA1111,
  reforge: convertA1111,
  'easy-reforge': convertA1111,
  // CivitAI Orchestration format
  civitai: convertCivitai,
  // ComfyUI-format
  comfyui: convertComfyUI,
  // TensorArt (per-chunk encoding: generation_data uses raw UTF-8)
  tensorart: convertTensorArt,
  // Stability Matrix (per-chunk encoding: parameters uses raw UTF-8)
  'stability-matrix': convertStabilityMatrix,
  // Easy Diffusion
  easydiffusion: convertEasyDiffusion,
  // Fooocus variants
  fooocus: convertFooocus,
  'ruined-fooocus': convertRuinedFooocus,
  // SwarmUI
  swarmui: convertSwarmUI,
  // InvokeAI
  invokeai: convertInvokeAI,
  // HuggingFace Space
  'hf-space': convertHfSpace,
} as const;
