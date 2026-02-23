/**
 * Image dimension extraction from binary headers
 *
 * Reads width and height from image format headers without parsing metadata.
 * Supports PNG (IHDR), JPEG (SOF markers), and WebP (VP8X/VP8/VP8L).
 */

import type { ImageFormat } from '../utils/binary';
import {
  readChunkType,
  readUint16,
  readUint16BE,
  readUint24LE,
  readUint32BE,
  readUint32LE,
} from '../utils/binary';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Read image dimensions from binary data based on format
 */
export function readImageDimensions(
  data: Uint8Array,
  format: ImageFormat,
): ImageDimensions | null {
  if (format === 'png') return readPngDimensions(data);
  if (format === 'jpeg') return readJpegDimensions(data);
  return readWebpDimensions(data);
}

/**
 * Read width and height from PNG IHDR chunk
 */
function readPngDimensions(data: Uint8Array): ImageDimensions | null {
  const PNG_SIGNATURE_LENGTH = 8;
  if (data.length < 24) return null;
  // IHDR data starts at offset 16 (8 sig + 4 len + 4 type)
  // We assume valid PNG if detectFormat passed, and IHDR is always first.
  return {
    width: readUint32BE(data, PNG_SIGNATURE_LENGTH + 8),
    height: readUint32BE(data, PNG_SIGNATURE_LENGTH + 12),
  };
}

/**
 * Read width and height from JPEG SOF markers
 */
function readJpegDimensions(data: Uint8Array): ImageDimensions | null {
  let offset = 2;
  while (offset < data.length - 4) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset++;
      continue; // Padding
    }

    // Read length (16-bit BE)
    const length = readUint16BE(data, offset + 2);

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
      const height = readUint16BE(data, offset + 5);
      const width = readUint16BE(data, offset + 7);
      return { width, height };
    }

    offset += 2 + length;
    if (marker === 0xda) break; // SOS
  }
  return null;
}

/**
 * Read width and height from WebP chunks (VP8X, VP8, VP8L)
 */
function readWebpDimensions(data: Uint8Array): ImageDimensions | null {
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
      const start = offset + 8;
      const tag = readUint24LE(data, start);
      const keyFrame = !(tag & 1);

      if (keyFrame) {
        // Validation code: 0x9d 0x01 0x2a bytes @ start+3
        if (
          data[start + 3] === 0x9d &&
          data[start + 4] === 0x01 &&
          data[start + 5] === 0x2a
        ) {
          const wRaw = readUint16(data, start + 6, true);
          const hRaw = readUint16(data, start + 8, true);
          return { width: wRaw & 0x3fff, height: hRaw & 0x3fff };
        }
      }
    }

    if (chunkType === 'VP8L') {
      // VP8L (lossless)
      if (data[offset + 8] === 0x2f) {
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
