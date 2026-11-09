/**
 * Write API for sd-metadata
 *
 * Handles writing metadata to images with automatic format conversion.
 * Supports PNG, JPEG, and WebP formats.
 */

import { convertMetadata } from '../converters';
import type {
  ParseResult,
  RawMetadata,
  WriteResult,
  WriteWarning,
} from '../types';

import type { ImageFormat } from '../utils/binary';
import { detectFormat, toUint8Array } from '../utils/binary';
import { writeJpegMetadata } from '../writers/jpeg';
import { writePngMetadata } from '../writers/png';
import { writeWebpMetadata } from '../writers/webp';

/**
 * Write metadata to an image
 *
 * Automatically detects the target image format and converts the metadata
 * if necessary. When some or all of the metadata cannot be written, the
 * image is still returned, with a {@link WriteWarning} saying what was
 * dropped and why: unrecognized metadata converted across formats, a
 * conversion that produced nothing, or a JPEG segment that does not fit.
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
    return writeRaw(data, targetFormat, emptyRaw(targetFormat));
  }

  // Handle invalid metadata
  if (metadata.status === 'invalid') {
    return {
      ok: false,
      error: { type: 'writeFailed', message: 'Cannot write invalid metadata' },
    };
  }

  // Vendor declarations are read-only: a signed C2PA manifest is hash-bound,
  // and moving a vendor's marker onto another image would misattribute it.
  // Refuse rather than silently strip it.
  if (metadata.status === 'vendor') {
    return {
      ok: false,
      error: {
        type: 'writeFailed',
        message: 'Cannot write vendor (AI service) metadata',
      },
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
    return withWarning(writeRaw(data, targetFormat, emptyRaw(targetFormat)), {
      type: 'metadataDropped',
      reason: 'unrecognizedCrossFormat',
    });
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

  // A converter that found nothing to carry over (a NovelAI JPEG without
  // its UserComment, say) yields an image without metadata: say so
  const converted = conversionResult.value;
  const result = writeRaw(data, targetFormat, converted);
  return isEmptyRaw(converted)
    ? withWarning(result, {
        type: 'metadataDropped',
        reason: 'conversionEmpty',
      })
    : result;
}

/**
 * Raw metadata with nothing in it, for stripping an image
 */
function emptyRaw(format: ImageFormat): RawMetadata {
  return format === 'png' ? { format, chunks: [] } : { format, segments: [] };
}

/**
 * Whether raw metadata holds nothing a writer would put in the image
 */
function isEmptyRaw(raw: RawMetadata): boolean {
  return raw.format === 'png'
    ? raw.chunks.length === 0 && (raw.exif ?? []).length === 0
    : raw.segments.length === 0;
}

/**
 * Attach a warning to a successful write that has none yet
 */
function withWarning(result: WriteResult, warning: WriteWarning): WriteResult {
  return result.ok && !result.warning ? { ...result, warning } : result;
}

/**
 * Write raw metadata to image
 */
function writeRaw(
  data: Uint8Array,
  targetFormat: ImageFormat,
  raw: RawMetadata,
): WriteResult {
  if (targetFormat === 'png' && raw.format === 'png') {
    const result = writePngMetadata(data, raw.chunks, raw.exif);
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
    const { data: value, dropped } = result.value;
    if (dropped.length === 0) {
      return { ok: true, value };
    }
    const names = dropped.map((s) => s.source.type).join(', ');
    return {
      ok: true,
      value,
      warning: {
        type: 'metadataDropped',
        reason: 'segmentTooLarge',
        message: `Segments longer than a JPEG marker segment holds (65,533 bytes) were left out: ${names}`,
      },
    };
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
