/**
 * Read API for sd-metadata
 *
 * Handles reading and parsing metadata from images.
 * Automatically detects image format and extracts embedded generation metadata.
 */

import { parseMetadata } from '../parsers';
import { readImageDimensions } from '../readers/dimensions';
import { readJpegMetadata } from '../readers/jpeg';
import { readPngMetadata } from '../readers/png';
import { readWebpMetadata } from '../readers/webp';
import type {
  MetadataSegment,
  ParseResult,
  PngTextChunk,
  RawMetadata,
} from '../types';
import { type ImageFormat, detectFormat, toUint8Array } from '../utils/binary';
import { pngChunksToRecord, segmentsToRecord } from '../utils/convert';

/** Options for the read function */
export interface ReadOptions {
  /**
   * When true, dimensions are taken strictly from metadata only.
   * When false (default), missing dimensions are extracted from image headers.
   * @default false
   */
  strict?: boolean;
}

/**
 * Read and parse metadata from an image
 *
 * Automatically detects the image format (PNG, JPEG, WebP) and parses
 * any embedded generation metadata.
 *
 * @param input - Image file data (Uint8Array or ArrayBuffer)
 * @param options - Read options
 * @returns Parse result containing metadata and raw data
 */
export function read(
  input: Uint8Array | ArrayBuffer,
  options?: ReadOptions,
): ParseResult {
  const data = toUint8Array(input);
  const format = detectFormat(data);

  if (!format) {
    return { status: 'invalid', message: 'Unknown image format' };
  }

  // 1. Read raw metadata based on format
  const rawResult = readRawMetadata(data, format);
  if (rawResult.status !== 'success') {
    return rawResult;
  }
  const raw = rawResult.raw;

  // 2. Convert to entry record
  const entries =
    raw.format === 'png'
      ? pngChunksToRecord(raw.chunks)
      : segmentsToRecord(raw.segments);

  // 3. Parse metadata
  const parseResult = parseMetadata(entries);
  if (!parseResult.ok) {
    return { status: 'unrecognized', raw };
  }

  const metadata = parseResult.value;

  // 4. Fallback for dimensions if missing (unless strict mode)
  if (!options?.strict && (metadata.width === 0 || metadata.height === 0)) {
    const dims = readImageDimensions(data, format);

    if (dims) {
      metadata.width = metadata.width || dims.width;
      metadata.height = metadata.height || dims.height;
    }
  }

  return { status: 'success', metadata, raw };
}

// ============================================================================
// Helpers
// ============================================================================

/** Result type for readRawMetadata */
type RawReadResult =
  | { status: 'success'; raw: RawMetadata }
  | { status: 'empty' }
  | { status: 'invalid'; message: string };

/**
 * Read raw metadata from image data
 */
function readRawMetadata(data: Uint8Array, format: ImageFormat): RawReadResult {
  const result =
    format === 'png'
      ? readPngMetadata(data)
      : format === 'jpeg'
        ? readJpegMetadata(data)
        : readWebpMetadata(data);

  if (!result.ok) {
    const message =
      result.error.type === 'invalidSignature'
        ? `Invalid ${format.toUpperCase()} signature`
        : result.error.message;
    return { status: 'invalid', message };
  }

  if (result.value.length === 0) return { status: 'empty' };

  // PNG uses PngTextChunk[], JPEG/WebP use MetadataSegment[]
  if (format === 'png') {
    return {
      status: 'success',
      raw: { format: 'png', chunks: result.value as PngTextChunk[] },
    };
  }
  return {
    status: 'success',
    raw: { format, segments: result.value as MetadataSegment[] },
  };
}
