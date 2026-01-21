/**
 * Write API for sd-metadata
 *
 * Handles writing metadata to images with automatic format conversion.
 * Supports PNG, JPEG, and WebP formats.
 */

import { convertMetadata } from '../converters';
import type { ParseResult } from '../types';
import { Result } from '../types';
import type { ImageFormat } from '../utils/binary';
import { detectFormat } from '../utils/binary';
import { writeJpegMetadata } from '../writers/jpeg';
import { writePngMetadata } from '../writers/png';
import { writeWebpMetadata } from '../writers/webp';

// ============================================================================
// Public API
// ============================================================================

/**
 * Result of the write operation
 */
export type WriteResult = Result<
  Uint8Array,
  | { type: 'unsupportedFormat' }
  | { type: 'conversionFailed'; message: string }
  | { type: 'writeFailed'; message: string }
>;

/**
 * Options for write operation
 */
export interface WriteOptions {
  /**
   * Force blind conversion for unrecognized formats
   *
   * When true, converts raw chunks/segments between formats even when
   * the generating software is unknown. Enables format conversion for
   * unknown/future tools without parser implementation.
   *
   * When false (default), returns error for unrecognized formats.
   *
   * @default false
   */
  force?: boolean;
}

/**
 * Write metadata to an image
 *
 * Automatically detects the target image format and converts the metadata
 * if necessary.
 *
 * @param data - Target image file data
 * @param metadata - ParseResult from `read()` (must be 'success' or contain raw data)
 * @param options - Write options (e.g., { force: true } for blind conversion)
 * @returns New image data with embedded metadata
 */
export function write(
  data: Uint8Array,
  metadata: ParseResult,
  options?: WriteOptions,
): WriteResult {
  const targetFormat = detectFormat(data);
  if (!targetFormat) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Handle empty or invalid metadata
  if (metadata.status === 'empty') {
    // Strip metadata (write empty segments/chunks)
    const result = HELPERS[targetFormat].writeEmpty(data, []);
    if (!result.ok) {
      return Result.error({ type: 'writeFailed', message: result.error.type });
    }
    return Result.ok(result.value);
  }

  if (metadata.status === 'invalid') {
    return Result.error({
      type: 'writeFailed',
      message: 'Cannot write invalid metadata',
    });
  }

  // Conversion logic handled by convertMetadata
  // If source == target, convertMetadata returns raw as-is.
  // If source != target, it tries to convert.
  // If force option is set, enables blind conversion for unrecognized formats.
  const conversionResult = convertMetadata(
    metadata,
    targetFormat,
    options?.force ?? false,
  );

  if (!conversionResult.ok) {
    return Result.error({
      type: 'conversionFailed',
      message: `Failed to convert metadata: ${conversionResult.error.type}`,
    });
  }

  const newRaw = conversionResult.value;

  // Dispatch to writer
  if (targetFormat === 'png' && newRaw.format === 'png') {
    const result = writePngMetadata(data, newRaw.chunks);
    if (!result.ok)
      return Result.error({ type: 'writeFailed', message: result.error.type });
    return Result.ok(result.value);
  }

  if (targetFormat === 'jpeg' && newRaw.format === 'jpeg') {
    const result = writeJpegMetadata(data, newRaw.segments);
    if (!result.ok)
      return Result.error({ type: 'writeFailed', message: result.error.type });
    return Result.ok(result.value);
  }

  if (targetFormat === 'webp' && newRaw.format === 'webp') {
    const result = writeWebpMetadata(data, newRaw.segments);
    if (!result.ok)
      return Result.error({ type: 'writeFailed', message: result.error.type });
    return Result.ok(result.value);
  }

  return Result.error({
    type: 'writeFailed',
    message: 'Internal error: format mismatch after conversion',
  });
}

// ============================================================================
// Format Helpers
// ============================================================================

/** Format-specific helper functions */
const HELPERS = {
  png: {
    writeEmpty: writePngMetadata,
  },
  jpeg: {
    writeEmpty: writeJpegMetadata,
  },
  webp: {
    writeEmpty: writeWebpMetadata,
  },
} as const satisfies Record<ImageFormat, unknown>;
