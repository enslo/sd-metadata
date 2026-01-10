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
  convertFooocusPngToSegments,
  convertFooocusSegmentsToPng,
} from './fooocus';
import {
  convertHfSpacePngToSegments,
  convertHfSpaceSegmentsToPng,
} from './hf-space';
import {
  convertInvokeAIPngToSegments,
  convertInvokeAISegmentsToPng,
} from './invokeai';
import {
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
} from './novelai';
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
  // NovelAI conversion
  if (software === 'novelai') {
    return convertNovelai(raw, targetFormat);
  }

  // A1111-format conversion (sd-webui, forge, forge-neo, civitai)
  if (
    software === 'sd-webui' ||
    software === 'forge' ||
    software === 'forge-neo' ||
    software === 'civitai'
  ) {
    return convertA1111(raw, targetFormat);
  }

  // HuggingFace Space conversion (uses JSON in parameters chunk)
  if (software === 'hf-space') {
    return convertHfSpace(raw, targetFormat);
  }

  // Easy Diffusion conversion (uses JSON in individual chunks)
  if (software === 'easydiffusion') {
    return convertEasyDiffusion(raw, targetFormat);
  }

  // Fooocus conversion (uses JSON in Comment chunk)
  if (software === 'fooocus') {
    return convertFooocus(raw, targetFormat);
  }

  // SwarmUI conversion
  if (software === 'swarmui') {
    return convertSwarmUI(raw, targetFormat);
  }

  // ComfyUI-format conversion (comfyui, tensorart, stability-matrix)
  if (
    software === 'comfyui' ||
    software === 'tensorart' ||
    software === 'stability-matrix'
  ) {
    return convertComfyUI(raw, targetFormat);
  }

  // InvokeAI conversion
  if (software === 'invokeai') {
    return convertInvokeAI(raw, targetFormat);
  }

  // Unsupported software
  return Result.error({
    type: 'unsupportedSoftware',
    software: software ?? 'unknown',
  });
}

/**
 * Convert NovelAI metadata between formats
 */
function convertNovelai(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertNovelaiPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    // JPEG ↔ WebP conversion
    // For NovelAI, the format is slightly different but we can handle it
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertNovelaiSegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert A1111-format metadata between formats
 */
function convertA1111(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertA1111PngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    // JPEG ↔ WebP: just copy segments
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertA1111SegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert HuggingFace Space metadata between formats
 *
 * HF-Space uses JSON in the parameters chunk, unlike A1111's plain text.
 */
function convertHfSpace(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertHfSpacePngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertHfSpaceSegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert Easy Diffusion metadata between formats
 *
 * Easy Diffusion uses JSON-like storage with individual chunks in PNG.
 */
function convertEasyDiffusion(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertEasyDiffusionPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertEasyDiffusionSegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert Fooocus metadata between formats
 *
 * Fooocus uses JSON in the Comment chunk.
 */
function convertFooocus(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertFooocusPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertFooocusSegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert SwarmUI metadata between formats
 */
function convertSwarmUI(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertSwarmUIPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertSwarmUISegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert ComfyUI-format metadata between formats
 */
function convertComfyUI(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertComfyUIPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertComfyUISegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}

/**
 * Convert InvokeAI metadata between formats
 */
function convertInvokeAI(
  raw: RawMetadata,
  targetFormat: ConversionTargetFormat,
): ConversionResult {
  if (raw.format === 'png') {
    // PNG → JPEG/WebP
    if (targetFormat === 'png') {
      return Result.ok(raw);
    }

    const segments = convertInvokeAIPngToSegments(raw.chunks);
    return Result.ok({
      format: targetFormat,
      segments,
    });
  }

  // JPEG/WebP → PNG or other
  if (targetFormat === 'jpeg' || targetFormat === 'webp') {
    return Result.ok({
      format: targetFormat,
      segments: raw.segments,
    });
  }

  const chunks = convertInvokeAISegmentsToPng(raw.segments);
  return Result.ok({
    format: 'png',
    chunks,
  });
}
