/**
 * Write API for sd-metadata
 *
 * Handles writing metadata to images with automatic format conversion.
 * Supports PNG, JPEG, and WebP formats.
 */

import { convertMetadata } from '../converters';
import type { ParseResult, WriteResult } from '../types';

import type { ImageFormat } from '../utils/binary';
import { detectFormat, toUint8Array } from '../utils/binary';
import { writeJpegMetadata } from '../writers/jpeg';
import { writePngMetadata } from '../writers/png';
import { writeWebpMetadata } from '../writers/webp';

/**
 * Write metadata to an image
 *
 * Automatically detects the target image format and converts the metadata
 * if necessary. For unrecognized metadata with cross-format conversion,
 * metadata is dropped and a warning is returned.
 *
 * @param input - Target image file data (Uint8Array or ArrayBuffer)
 * @param metadata - ParseResult from `read()`
 * @returns New image data with embedded metadata (or warning if metadata was dropped)
 */
export function write(
  input: Uint8Array | ArrayBuffer,
  metadata: ParseResult,
): WriteResult {
  const data = toUint8Array(input);
  const targetFormat = detectFormat(data);
  if (!targetFormat) {
    return { ok: false, error: { type: 'unsupportedFormat' } };
  }

  // Handle empty metadata: strip all metadata
  if (metadata.status === 'empty') {
    const result = HELPERS[targetFormat].writeEmpty(data, []);
    if (!result.ok) {
      return {
        ok: false,
        error: { type: 'writeFailed', message: result.error.type },
      };
    }
    return { ok: true, value: result.value };
  }

  // Handle invalid metadata
  if (metadata.status === 'invalid') {
    return {
      ok: false,
      error: { type: 'writeFailed', message: 'Cannot write invalid metadata' },
    };
  }

  // Handle unrecognized metadata
  if (metadata.status === 'unrecognized') {
    const sourceFormat = metadata.raw.format;

    // Same format: write as-is
    if (sourceFormat === targetFormat) {
      return writeRaw(data, targetFormat, metadata.raw);
    }

    // Cross-format: drop metadata and return with warning
    const result = HELPERS[targetFormat].writeEmpty(data, []);
    if (!result.ok) {
      return {
        ok: false,
        error: { type: 'writeFailed', message: result.error.type },
      };
    }
    return {
      ok: true,
      value: result.value,
      warning: { type: 'metadataDropped', reason: 'unrecognizedCrossFormat' },
    };
  }

  // Handle success metadata: convert if needed
  const conversionResult = convertMetadata(metadata, targetFormat);

  if (!conversionResult.ok) {
    return {
      ok: false,
      error: {
        type: 'conversionFailed',
        message: `Failed to convert metadata: ${conversionResult.error.type}`,
      },
    };
  }

  return writeRaw(data, targetFormat, conversionResult.value);
}

/**
 * Write raw metadata to image
 */
function writeRaw(
  data: Uint8Array,
  targetFormat: ImageFormat,
  raw: import('../types').RawMetadata,
): WriteResult {
  if (targetFormat === 'png' && raw.format === 'png') {
    const result = writePngMetadata(data, raw.chunks);
    if (!result.ok) {
      return {
        ok: false,
        error: { type: 'writeFailed', message: result.error.type },
      };
    }
    return { ok: true, value: result.value };
  }

  if (targetFormat === 'jpeg' && raw.format === 'jpeg') {
    const result = writeJpegMetadata(data, raw.segments);
    if (!result.ok) {
      return {
        ok: false,
        error: { type: 'writeFailed', message: result.error.type },
      };
    }
    return { ok: true, value: result.value };
  }

  if (targetFormat === 'webp' && raw.format === 'webp') {
    const result = writeWebpMetadata(data, raw.segments);
    if (!result.ok) {
      return {
        ok: false,
        error: { type: 'writeFailed', message: result.error.type },
      };
    }
    return { ok: true, value: result.value };
  }

  return {
    ok: false,
    error: {
      type: 'writeFailed',
      message: 'Internal error: format mismatch after conversion',
    },
  };
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
