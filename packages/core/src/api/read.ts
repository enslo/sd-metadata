/**
 * Read API for sd-metadata
 *
 * Handles reading and parsing metadata from images.
 * Automatically detects image format and extracts embedded generation metadata.
 */

import { parseMetadata } from '../parsers';
import { detectC2pa } from '../parsers/c2pa';
import { readImageDimensions } from '../readers/dimensions';
import { readJpegMetadata } from '../readers/jpeg';
import { readPngMetadata } from '../readers/png';
import { readWebpMetadata } from '../readers/webp';
import type {
  MetadataSegment,
  ParseResult,
  PngTextChunk,
  RawMetadata,
  ReadOptions,
} from '../types';
import { detectFormat, type ImageFormat, toUint8Array } from '../utils/binary';
import { pngChunksToRecord, segmentsToRecord } from '../utils/convert';

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

  const rawResult = readRawMetadata(data, format);
  if (rawResult.status === 'invalid') {
    return rawResult;
  }

  // 1. Generation metadata (the library's primary path) takes precedence.
  if (rawResult.status === 'success') {
    const { raw } = rawResult;
    const entries =
      raw.format === 'png'
        ? pngChunksToRecord(raw.chunks)
        : segmentsToRecord(raw.segments);

    const parseResult = parseMetadata(entries);
    if (parseResult.ok) {
      const metadata = parseResult.value;

      // Fallback for dimensions if missing (unless strict mode).
      if (!options?.strict && (metadata.width === 0 || metadata.height === 0)) {
        try {
          const dims = readImageDimensions(data, format);
          if (dims) {
            metadata.width = metadata.width || dims.width;
            metadata.height = metadata.height || dims.height;
          }
        } catch {
          // Malformed image header — leave dimensions as 0.
        }
      }

      return { status: 'success', metadata, raw };
    }
  }

  // 2. No generation metadata: surface Content Credentials (C2PA) if present.
  //    Commercial AI tools (ChatGPT/Gemini) carry only a signed manifest.
  const c2pa = detectC2pa(data, format);
  if (c2pa) {
    return { status: 'c2pa', c2pa };
  }

  // 3. Otherwise distinguish "no metadata" from "metadata in an unknown format".
  return rawResult.status === 'empty'
    ? { status: 'empty' }
    : { status: 'unrecognized', raw: rawResult.raw };
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
