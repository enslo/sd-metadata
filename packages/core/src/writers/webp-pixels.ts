/**
 * Writing edited pixels back into a WebP
 *
 * The counterpart of readers/webp-pixels.ts, for the same two places a
 * WebP stores pixels losslessly:
 *
 * - a lossless image (VP8L chunk) is rewritten in place by rewriteVp8l;
 * - the alpha plane of a lossy image (ALPH chunk) is dropped when the
 *   edit left it fully opaque, and rewritten the same way otherwise.
 *
 * Where the original stream cannot take the edited pixels (its color table
 * lacks one of them), they are encoded afresh, plainly.
 *
 * Every other chunk is kept as it is.
 */

import type { PixelData } from '../readers/stealth';
import { decodeVp8l } from '../readers/vp8l';
import { decodeAlphaPlane } from '../readers/webp-pixels';
import {
  isWebp,
  readChunkType,
  readUint24LE,
  readUint32LE,
  writeUint32LE,
} from '../utils/binary';
import { concat, riffChunk } from './essentials';
import { encodeVp8l, rewriteVp8l } from './vp8l';

const VP8X_ANIMATION_FLAG = 0x02;
const VP8X_ALPHA_FLAG = 0x10;

/** One RIFF chunk of the file */
interface Chunk {
  type: string;
  payload: Uint8Array;
}

/**
 * Why there is no rewritten file: the WebP has no losslessly stored
 * pixels or the edit left them alone (`unchanged`), or they could not be
 * read (`undecodable`)
 */
type NotRewritten = 'unchanged' | 'undecodable';

/**
 * Let `edit` change the losslessly stored pixels of a WebP and write them
 * back
 *
 * @param data - WebP file data
 * @param maxBytes - Largest pixel buffer to decode
 * @param edit - Changes the pixels in place and says whether it did. It is
 *   given RGBA pixels for a lossless image, and the alpha plane alone (one
 *   channel) for a lossy one.
 * @returns The file with the edited pixels, or why there is none
 */
export function rewriteWebpPixels(
  data: Uint8Array,
  maxBytes: number,
  edit: (image: PixelData) => boolean,
): Uint8Array | NotRewritten {
  if (!isWebp(data)) {
    return 'unchanged';
  }

  const chunks: Chunk[] = [];
  // Start after the RIFF header (12 bytes: "RIFF" + size + "WEBP")
  let offset = 12;
  while (offset + 8 <= data.length) {
    const size = readUint32LE(data, offset + 4);
    const end = offset + 8 + size;
    if (end > data.length) {
      return 'undecodable';
    }
    chunks.push({
      type: readChunkType(data, offset),
      payload: data.subarray(offset + 8, end),
    });
    // RIFF chunks are padded to even byte boundaries
    offset = end + (size % 2);
  }

  const header = chunks.find((chunk) => chunk.type === 'VP8X');
  if (header && ((header.payload[0] ?? 0) & VP8X_ANIMATION_FLAG) !== 0) {
    // Frames of an animation are not stealth carriers
    return 'unchanged';
  }

  const image = chunks.findIndex(
    (chunk) => chunk.type === 'VP8L' || chunk.type === 'VP8 ',
  );
  const target = chunks[image];
  if (!target) {
    return 'unchanged';
  }

  let replaced: Chunk[] | NotRewritten;
  if (target.type === 'VP8L') {
    replaced = rewriteLossless(chunks, image, maxBytes, edit);
  } else {
    // The alpha plane of a lossy image comes before its color data
    const alpha = chunks.findIndex(
      (chunk, i) => chunk.type === 'ALPH' && i < image,
    );
    replaced =
      header && alpha >= 0
        ? rewriteAlpha(chunks, alpha, header, maxBytes, edit)
        : 'unchanged';
  }
  if (typeof replaced === 'string') {
    return replaced;
  }

  const body = concat(
    replaced.map((chunk) => riffChunk(chunk.type, chunk.payload)),
  );
  const out = new Uint8Array(12 + body.length);
  out.set(data.subarray(0, 4), 0); // "RIFF"
  writeUint32LE(out, 4, 4 + body.length);
  out.set(data.subarray(8, 12), 8); // "WEBP"
  out.set(body, 12);
  return out;
}

/**
 * Edit and rewrite the VP8L chunk at `index`
 */
function rewriteLossless(
  chunks: Chunk[],
  index: number,
  maxBytes: number,
  edit: (image: PixelData) => boolean,
): Chunk[] | NotRewritten {
  const stream = chunks[index]?.payload ?? new Uint8Array(0);
  let decoded: ReturnType<typeof decodeVp8l>;
  try {
    decoded = decodeVp8l(stream, {
      maxPixels: Math.floor(maxBytes / 4),
      layout: true,
    });
  } catch {
    return 'undecodable';
  }
  const { width, height, pixels, layout } = decoded;
  if (!layout) {
    return 'undecodable';
  }

  // Interleaved RGBA bytes for the edit, ARGB values again afterwards
  const rgba = new Uint8Array(pixels.length * 4);
  for (let i = 0, at = 0; i < pixels.length; i++, at += 4) {
    const argb = pixels[i] ?? 0;
    rgba[at] = argb >>> 16;
    rgba[at + 1] = argb >>> 8;
    rgba[at + 2] = argb;
    rgba[at + 3] = argb >>> 24;
  }
  if (!edit({ width, height, channels: 4, pixels: rgba })) {
    return 'unchanged';
  }
  for (let i = 0, at = 0; i < pixels.length; i++, at += 4) {
    pixels[i] =
      (((rgba[at + 3] ?? 0) << 24) |
        ((rgba[at] ?? 0) << 16) |
        ((rgba[at + 1] ?? 0) << 8) |
        (rgba[at + 2] ?? 0)) >>>
      0;
  }

  let payload: Uint8Array;
  try {
    payload = rewriteVp8l(stream, layout, height, pixels);
  } catch {
    // The edited pixels do not fit a transform of the original stream
    payload = encodeVp8l(width, height, pixels);
  }
  return chunks.map((chunk, i) =>
    i === index ? { type: chunk.type, payload } : chunk,
  );
}

/**
 * Edit the alpha plane in the ALPH chunk at `index` and store it again
 */
function rewriteAlpha(
  chunks: Chunk[],
  index: number,
  header: Chunk,
  maxBytes: number,
  edit: (image: PixelData) => boolean,
): Chunk[] | NotRewritten {
  const original = chunks[index]?.payload ?? new Uint8Array(0);
  if (header.payload.length < 10) {
    return 'undecodable';
  }
  const size = {
    width: readUint24LE(header.payload, 4) + 1,
    height: readUint24LE(header.payload, 7) + 1,
  };

  let plane: PixelData | null;
  try {
    plane = decodeAlphaPlane(original, size, maxBytes);
  } catch {
    plane = null;
  }
  if (!plane) {
    return 'undecodable';
  }
  if (!edit(plane)) {
    return 'unchanged';
  }

  if (plane.pixels.every((alpha) => alpha === 255)) {
    // Opaque everywhere: the picture needs no alpha plane at all
    const flags = header.payload.slice();
    flags[0] = (flags[0] ?? 0) & ~VP8X_ALPHA_FLAG;
    return chunks
      .filter((_, i) => i !== index)
      .map((chunk) =>
        chunk === header ? { type: chunk.type, payload: flags } : chunk,
      );
  }

  const payload = storeAlphaPlane(original, size, plane.pixels);
  return chunks.map((chunk, i) =>
    i === index ? { type: chunk.type, payload } : chunk,
  );
}

/**
 * Payload of an ALPH chunk for an edited plane
 *
 * A compressed, unfiltered chunk holds a VP8L stream with alpha in the
 * green channel, which takes the edited plane like any image. Where that
 * does not work (a filtered or uncompressed plane, or a color table
 * without the new values), the plane is encoded afresh as such a stream.
 */
function storeAlphaPlane(
  original: Uint8Array,
  size: { width: number; height: number },
  plane: Uint8Array,
): Uint8Array {
  const flags = original[0] ?? 0;
  // Bits 0-1: compression (1 = VP8L), bits 2-3: filter (0 = none)
  if ((flags & 0x0f) === 0x01) {
    try {
      const stream = original.subarray(1);
      const { pixels, layout } = decodeVp8l(stream, {
        maxPixels: plane.length,
        size,
        layout: true,
      });
      if (layout) {
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] =
            (((pixels[i] ?? 0) & 0xffff00ff) | ((plane[i] ?? 0) << 8)) >>> 0;
        }
        return concat([
          Uint8Array.of(flags),
          rewriteVp8l(stream, layout, size.height, pixels),
        ]);
      }
    } catch {
      // Encoded afresh below
    }
  }

  const pixels = new Uint32Array(plane.length);
  for (let i = 0; i < plane.length; i++) {
    pixels[i] = (0xff000000 | ((plane[i] ?? 0) << 8)) >>> 0;
  }
  // Flags: VP8L compression, no filter
  return concat([
    Uint8Array.of(0x01),
    encodeVp8l(size.width, size.height, pixels, false),
  ]);
}
