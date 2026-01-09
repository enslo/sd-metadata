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
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
} from './novelai';

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

  // A1111-format conversion (sd-webui, forge, forge-neo, civitai, hf-space)
  if (
    software === 'sd-webui' ||
    software === 'forge' ||
    software === 'forge-neo' ||
    software === 'civitai' ||
    software === 'hf-space'
  ) {
    return convertA1111(raw, targetFormat);
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
