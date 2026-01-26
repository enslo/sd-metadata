/**
 * Read API for sd-metadata
 *
 * Handles reading and parsing metadata from images.
 * Automatically detects image format and extracts embedded generation metadata.
 */

import { parseMetadata } from '../parsers';
import { readJpegMetadata } from '../readers/jpeg';
import { readPngMetadata } from '../readers/png';
import { readWebpMetadata } from '../readers/webp';
import type {
  MetadataSegment,
  ParseResult,
  PngTextChunk,
  RawMetadata,
} from '../types';
import {
  type ImageFormat,
  detectFormat,
  readChunkType,
  readUint24LE,
  readUint32BE,
  readUint32LE,
  toUint8Array,
} from '../utils/binary';
import { pngChunksToEntries, segmentsToEntries } from '../utils/convert';

/**
 * Read and parse metadata from an image
 *
 * Automatically detects the image format (PNG, JPEG, WebP) and parses
 * any embedded generation metadata.
 *
 * @param input - Image file data (Uint8Array or ArrayBuffer)
 * @returns Parse result containing metadata and raw data
 */
export function read(input: Uint8Array | ArrayBuffer): ParseResult {
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

  // 2. Convert to agnostic entries
  const entries =
    raw.format === 'png'
      ? pngChunksToEntries(raw.chunks)
      : segmentsToEntries(raw.segments);

  // 3. Parse metadata
  const parseResult = parseMetadata(entries);
  if (!parseResult.ok) {
    return { status: 'unrecognized', raw };
  }

  const metadata = parseResult.value;

  // 4. Fallback for dimensions if missing
  if (metadata.width === 0 || metadata.height === 0) {
    const dims = HELPERS[format].readDimensions(data);

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

/** Format-specific helper functions */
const HELPERS = {
  png: {
    readMetadata: readPngMetadata,
    readDimensions: readPngDimensions,
    createRaw: (chunks: PngTextChunk[]) => ({ format: 'png' as const, chunks }),
  },
  jpeg: {
    readMetadata: readJpegMetadata,
    readDimensions: readJpegDimensions,
    createRaw: (segments: MetadataSegment[]) => ({
      format: 'jpeg' as const,
      segments,
    }),
  },
  webp: {
    readMetadata: readWebpMetadata,
    readDimensions: readWebpDimensions,
    createRaw: (segments: MetadataSegment[]) => ({
      format: 'webp' as const,
      segments,
    }),
  },
} as const satisfies Record<ImageFormat, unknown>;

/** Result type for readRawMetadata */
type RawReadResult =
  | { status: 'success'; raw: RawMetadata }
  | { status: 'empty' }
  | { status: 'invalid'; message: string };

/**
 * Read raw metadata from image data
 */
function readRawMetadata(data: Uint8Array, format: ImageFormat): RawReadResult {
  const result = HELPERS[format].readMetadata(data);

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
      raw: HELPERS.png.createRaw(result.value as PngTextChunk[]),
    };
  }
  return {
    status: 'success',
    raw: HELPERS[format].createRaw(result.value as MetadataSegment[]),
  };
}

/**
 * Read width and height from PNG IHDR chunk
 */
function readPngDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  const PNG_SIGNATURE_LENGTH = 8;
  if (data.length < 24) return null;
  // IHDR data starts at offset 16 (8 sig + 4 len + 4 type)
  // Check if it is indeed IHDR?
  // We assume valid PNG if detectFormat passed, and IHDR is always first.
  return {
    width: readUint32BE(data, PNG_SIGNATURE_LENGTH + 8),
    height: readUint32BE(data, PNG_SIGNATURE_LENGTH + 12),
  };
}

/**
 * Read width and height from JPEG chunks
 */
function readJpegDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  // Use a SafeView-like approach or just manual parsing
  let offset = 2;
  while (offset < data.length - 4) {
    // Check validation
    if (data[offset] !== 0xff) {
      // Should handle scanning for FF, but in valid JPEG segments start with FF
      offset++;
      continue;
    }

    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset++;
      continue; // Padding
    }

    // Read length (16-bit BE)
    const length = ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0);

    // SOF0 (C0) ... SOF15 (CF), except C4 (DHT), C8 (JPG), CC (DAC)
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      // Structure: Precision(1), Height(2), Width(2)
      // Offset: Marker(2) + Length(2) + Precision(1) = 5
      const height = ((data[offset + 5] ?? 0) << 8) | (data[offset + 6] ?? 0);
      const width = ((data[offset + 7] ?? 0) << 8) | (data[offset + 8] ?? 0);
      return { width, height };
    }

    offset += 2 + length;
    if (marker === 0xda) break; // SOS
  }
  return null;
}

/**
 * Read width and height from WebP chunks
 */
function readWebpDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  // RIFF(4) + Size(4) + WEBP(4) = 12 bytes
  let offset = 12;

  while (offset < data.length) {
    if (offset + 8 > data.length) break;

    const chunkType = readChunkType(data, offset);
    const chunkSize = readUint32LE(data, offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);

    if (chunkType === 'VP8X') {
      // VP8X: Width (3 bytes @ offset 12) + Height (3 bytes @ offset 15)
      // Both are 1-based (stored value is width-1)
      const wMinus1 = readUint24LE(data, offset + 12);
      const hMinus1 = readUint24LE(data, offset + 15);
      return { width: wMinus1 + 1, height: hMinus1 + 1 };
    }

    if (chunkType === 'VP8 ') {
      // VP8 (lossy): Check keyframe
      // Frame tag (3 bytes @ offset 8+0)
      // Keyframe if bit 0 is 0
      const start = offset + 8;
      const tag =
        (data[start] ?? 0) |
        ((data[start + 1] ?? 0) << 8) |
        ((data[start + 2] ?? 0) << 16);
      const keyFrame = !(tag & 1);

      if (keyFrame) {
        // Validation code: 0x9d 0x01 0x2a bytes @ start+3
        if (
          data[start + 3] === 0x9d &&
          data[start + 4] === 0x01 &&
          data[start + 5] === 0x2a
        ) {
          // Width: 2 bytes @ start+6 (14 bits)
          // Height: 2 bytes @ start+8 (14 bits)
          const wRaw = (data[start + 6] ?? 0) | ((data[start + 7] ?? 0) << 8);
          const hRaw = (data[start + 8] ?? 0) | ((data[start + 9] ?? 0) << 8);
          return { width: wRaw & 0x3fff, height: hRaw & 0x3fff };
        }
      }
    }

    if (chunkType === 'VP8L') {
      // VP8L (lossless)
      // Signature 0x2f @ offset + 8
      if (data[offset + 8] === 0x2f) {
        // 4 bytes @ offset + 9 containing W (14 bits), H (14 bits)
        const bits = readUint32LE(data, offset + 9);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
    }

    offset += 8 + paddedSize;
  }
  return null;
}
