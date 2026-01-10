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
  convertSwarmUIPngToSegments,
  convertSwarmUISegmentsToPng,
} from './swarmui';

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

  // For 'unrecognized', we have raw data but no metadata
  // We can still try to convert the raw data
  const raw = parseResult.raw;
  const software =
    parseResult.status === 'success' ? parseResult.metadata.software : null;

  // If source and target are the same format, return as-is
  if (
    (raw.format === 'png' && targetFormat === 'png') ||
    (raw.format === 'jpeg' && targetFormat === 'jpeg') ||
    (raw.format === 'webp' && targetFormat === 'webp')
  ) {
    return Result.ok(raw);
  }

  // Convert based on detected software
  return convertBySoftware(raw, targetFormat, software);
}

/**
 * Convert metadata based on detected software
 */
function convertBySoftware(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
  software: string | null,
): ConversionResult {
  if (!software) {
    return Result.error({
      type: 'unsupportedSoftware',
      software: 'unknown',
    });
  }

  const converter = softwareConverters[software];
  if (!converter) {
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
  createPngToSegments('Comment'),
  createSegmentsToPng('Comment'),
);

const convertRuinedFooocus = createFormatConverter(
  createPngToSegments('parameters'),
  createSegmentsToPng('parameters'),
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
  createSegmentsToPng('parameters'),
);

/**
 * Lookup table: software name → converter function
 */
const softwareConverters: Record<string, ConverterFn> = {
  // NovelAI
  novelai: convertNovelai,
  // A1111-format (sd-webui, forge, forge-neo, civitai, sd-next)
  'sd-webui': convertA1111,
  'sd-next': convertA1111,
  forge: convertA1111,
  'forge-neo': convertA1111,
  civitai: convertA1111,
  // ComfyUI-format (comfyui, tensorart, stability-matrix)
  comfyui: convertComfyUI,
  tensorart: convertComfyUI,
  'stability-matrix': convertComfyUI,
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
};
