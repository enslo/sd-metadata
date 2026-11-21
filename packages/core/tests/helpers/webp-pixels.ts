/**
 * Test-only WebP helpers backed by sharp (libwebp)
 *
 * libwebp is the reference the built-in WebP decoder is checked against,
 * and the encoder behind every WebP test image: the library only decodes.
 */

import sharp, { type WebpOptions } from 'sharp';
import type { RgbaPixels } from '../../src/types';

/**
 * Decode an image to RGBA pixels using sharp
 */
export async function decodeWithSharp(
  data: Uint8Array,
): Promise<RgbaPixels | null> {
  const { data: pixels, info } = await sharp(data)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(pixels),
    width: info.width,
    height: info.height,
  };
}

/**
 * Encode RGBA pixels as a WebP using sharp
 */
export async function encodeWebp(
  pixels: RgbaPixels,
  options: WebpOptions,
): Promise<Uint8Array> {
  const buffer = await sharp(pixels.data, {
    raw: { width: pixels.width, height: pixels.height, channels: 4 },
  })
    .webp(options)
    .toBuffer();
  return new Uint8Array(buffer);
}

/** One top-level RIFF chunk of a WebP file */
export interface WebpChunk {
  /** FourCC, e.g. "VP8L" or "VP8 " */
  type: string;
  payload: Uint8Array;
}

/**
 * List the top-level RIFF chunks of a WebP file
 */
export function readWebpChunks(data: Uint8Array): WebpChunk[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: WebpChunk[] = [];
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = String.fromCharCode(...data.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    chunks.push({ type, payload: data.slice(offset + 8, offset + 8 + size) });
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

/**
 * Assemble a WebP file from RIFF chunks
 */
export function buildWebp(chunks: WebpChunk[]): Uint8Array {
  const body = chunks.reduce(
    (sum, chunk) => sum + 8 + chunk.payload.length + (chunk.payload.length % 2),
    4,
  );
  const out = new Uint8Array(8 + body);
  const view = new DataView(out.buffer);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, body, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  let offset = 12;
  for (const chunk of chunks) {
    for (let i = 0; i < 4; i++) {
      out[offset + i] = chunk.type.charCodeAt(i);
    }
    view.setUint32(offset + 4, chunk.payload.length, true);
    out.set(chunk.payload, offset + 8);
    offset += 8 + chunk.payload.length + (chunk.payload.length % 2);
  }
  return out;
}

/**
 * The payload of the first chunk of a type
 */
export function webpChunk(data: Uint8Array, type: string): Uint8Array {
  const chunk = readWebpChunks(data).find((c) => c.type === type);
  if (!chunk) {
    throw new Error(`no ${type} chunk`);
  }
  return chunk.payload;
}
