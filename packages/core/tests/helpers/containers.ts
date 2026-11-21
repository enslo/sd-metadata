/**
 * Test helpers for looking into and adding to image containers
 *
 * PNG chunks and JPEG marker segments are listed by name and inserted by
 * hand, to build files that carry blocks no encoder at hand writes (a C2PA
 * manifest, a vendor chunk, a comment between two scans). WebP chunks are
 * handled by readWebpChunks / buildWebp in webp-pixels.ts.
 */

import { readChunkType, readUint32BE } from '../../src/utils/binary';
import { buildChunk } from '../../src/writers/png';

/** ASCII text as bytes */
export function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Chunk types of a PNG, in file order
 */
export function pngChunkTypes(png: Uint8Array): string[] {
  const types: string[] = [];
  for (let offset = 8; offset + 12 <= png.length; ) {
    types.push(readChunkType(png, offset + 4));
    offset += 12 + readUint32BE(png, offset);
  }
  return types;
}

/**
 * The PNG with chunks inserted right after IHDR
 */
export function insertPngChunks(
  png: Uint8Array,
  chunks: [type: string, data: Uint8Array][],
): Uint8Array {
  // Signature (8) and the IHDR chunk (12 + 13)
  const ihdrEnd = 8 + 25;
  return concat([
    png.subarray(0, ihdrEnd),
    ...chunks.map(([type, data]) => buildChunk(type, data)),
    png.subarray(ihdrEnd),
  ]);
}

/**
 * Marker segments of a JPEG up to its first scan: the marker in hex,
 * followed by the identifier of an application segment ("e1:Exif")
 */
export function jpegSegments(jpeg: Uint8Array): string[] {
  const segments: string[] = [];
  let offset = 2;
  while (offset + 4 <= jpeg.length) {
    const marker = jpeg[offset + 1] ?? 0;
    if (marker === 0xda) {
      break;
    }
    const length = ((jpeg[offset + 2] ?? 0) << 8) | (jpeg[offset + 3] ?? 0);
    let name = marker.toString(16);
    if (marker >= 0xe0 && marker <= 0xef) {
      let identifier = '';
      for (let i = offset + 4; i < offset + 2 + length; i++) {
        const code = jpeg[i] ?? 0;
        if (code < 0x21 || code > 0x7e) break;
        identifier += String.fromCharCode(code);
      }
      name += `:${identifier}`;
    }
    segments.push(name);
    offset += 2 + length;
  }
  return segments;
}

/**
 * The JPEG with marker segments inserted at an offset (default: right
 * after SOI)
 */
export function insertJpegSegments(
  jpeg: Uint8Array,
  segments: [marker: number, payload: Uint8Array][],
  at = 2,
): Uint8Array {
  return concat([
    jpeg.subarray(0, at),
    ...segments.map(([marker, payload]) => {
      const length = payload.length + 2;
      return concat([
        Uint8Array.of(0xff, marker, length >> 8, length & 0xff),
        payload,
      ]);
    }),
    jpeg.subarray(at),
  ]);
}
