/**
 * WebP pixel decoding for the stealth scan
 *
 * Stealth data sits in pixel least-significant bits, so only the parts of
 * a WebP that are stored losslessly can carry it:
 *
 * - a lossless image (VP8L chunk): all four channels;
 * - the alpha plane of a lossy image (ALPH chunk before the VP8 chunk).
 *   Encoders keep alpha lossless by default, so alpha-channel stealth data
 *   survives a lossy re-save of the PNG it was written to.
 *
 * Lossy color data (the VP8 chunk) is not decoded: its low bits are not
 * what the encoder was given, and nothing hidden there survives.
 */

import {
  isWebp,
  readChunkType,
  readUint24LE,
  readUint32LE,
} from '../utils/binary';
import type { PixelData } from './stealth';
import { decodeVp8l } from './vp8l';

/** VP8X flag: the file is an animation, a sequence of frames */
const VP8X_ANIMATION = 0x02;

/**
 * Decode the losslessly stored pixels of a WebP file
 *
 * @param data - WebP file data
 * @param maxBytes - Largest pixel buffer to produce
 * @returns RGBA pixels of a lossless image, the alpha plane (one channel)
 *   of a lossy image that has one, or null when there is nothing lossless
 *   to read: lossy without alpha, animated, malformed, or past `maxBytes`
 */
export function decodeWebpPixels(
  data: Uint8Array,
  maxBytes: number,
): PixelData | null {
  if (!isWebp(data)) {
    return null;
  }
  try {
    return decodeImageChunks(data, maxBytes);
  } catch {
    // Malformed or truncated stream
    return null;
  }
}

/**
 * Walk the RIFF chunks up to the image data
 */
function decodeImageChunks(
  data: Uint8Array,
  maxBytes: number,
): PixelData | null {
  let canvas: { width: number; height: number } | null = null;
  let alpha: Uint8Array | null = null;

  // Start after the RIFF header (12 bytes: "RIFF" + size + "WEBP")
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = readChunkType(data, offset);
    const size = readUint32LE(data, offset + 4);
    const start = offset + 8;
    if (start + size > data.length) {
      return null;
    }
    const payload = data.subarray(start, start + size);

    switch (type) {
      case 'VP8X':
        // Frames of an animation are not stealth carriers
        if (size < 10 || ((payload[0] ?? 0) & VP8X_ANIMATION) !== 0) {
          return null;
        }
        canvas = {
          width: readUint24LE(payload, 4) + 1,
          height: readUint24LE(payload, 7) + 1,
        };
        break;
      case 'ALPH':
        alpha = payload;
        break;
      case 'VP8L':
        return decodeLossless(payload, maxBytes);
      case 'VP8 ':
        return canvas && alpha
          ? decodeAlphaPlane(alpha, canvas, maxBytes)
          : null;
    }

    // RIFF chunks are padded to even byte boundaries
    offset = start + size + (size % 2);
  }
  return null;
}

/**
 * A lossless image as interleaved RGBA bytes
 */
function decodeLossless(payload: Uint8Array, maxBytes: number): PixelData {
  const { width, height, pixels } = decodeVp8l(payload, {
    maxPixels: Math.floor(maxBytes / 4),
  });
  const rgba = new Uint8Array(pixels.length * 4);
  for (let i = 0, out = 0; i < pixels.length; i++, out += 4) {
    const argb = pixels[i] ?? 0;
    rgba[out] = argb >>> 16;
    rgba[out + 1] = argb >>> 8;
    rgba[out + 2] = argb;
    rgba[out + 3] = argb >>> 24;
  }
  return { width, height, channels: 4, pixels: rgba };
}

/**
 * The alpha plane of a lossy image: one byte per pixel
 *
 * The chunk starts with a byte of flags: bits 0-1 give the compression
 * (0 = raw bytes, 1 = a VP8L stream without its header, alpha in the
 * green channel), bits 2-3 a prediction filter applied before that.
 */
export function decodeAlphaPlane(
  chunk: Uint8Array,
  size: { width: number; height: number },
  maxBytes: number,
): PixelData | null {
  const { width, height } = size;
  const count = width * height;
  if (chunk.length < 1 || count > maxBytes) {
    return null;
  }
  const flags = chunk[0] ?? 0;
  const compression = flags & 0x03;
  const filter = (flags >> 2) & 0x03;

  const plane = new Uint8Array(count);
  if (compression === 0) {
    if (chunk.length - 1 < count) {
      return null;
    }
    plane.set(chunk.subarray(1, 1 + count));
  } else if (compression === 1) {
    const { pixels } = decodeVp8l(chunk.subarray(1), {
      maxPixels: count,
      size,
    });
    for (let i = 0; i < count; i++) {
      plane[i] = (pixels[i] ?? 0) >>> 8;
    }
  } else {
    return null;
  }

  unfilterAlpha(plane, width, height, filter);
  return { width, height, channels: 1, pixels: plane };
}

/**
 * Reverse the prediction filter of an alpha plane in place
 *
 * Each value is stored as the difference from its left neighbour (1), the
 * one above (2), or the gradient left + above - above-left (3). The first
 * row always predicts from the left and the first column from above.
 */
function unfilterAlpha(
  plane: Uint8Array,
  width: number,
  height: number,
  filter: number,
): void {
  if (filter === 0) {
    return;
  }
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      let prediction: number;
      if (y === 0) {
        prediction = x === 0 ? 0 : (plane[i - 1] ?? 0);
      } else if (x === 0 || filter === 2) {
        prediction = plane[i - width] ?? 0;
      } else if (filter === 1) {
        prediction = plane[i - 1] ?? 0;
      } else {
        const gradient =
          (plane[i - 1] ?? 0) +
          (plane[i - width] ?? 0) -
          (plane[i - width - 1] ?? 0);
        prediction = Math.min(255, Math.max(0, gradient));
      }
      plane[i] = (plane[i] ?? 0) + prediction;
    }
  }
}
