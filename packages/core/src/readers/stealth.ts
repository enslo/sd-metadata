/**
 * Stealth PNGInfo reader
 *
 * NovelAI and the stealth-pnginfo family of extensions (A1111 WebUI,
 * ComfyUI) hide generation metadata in the least-significant bits of PNG
 * pixel data, so it survives metadata-chunk stripping. The bitstream is
 * read in column-major order (all rows of column 0, then column 1, ...),
 * most-significant bit first within each byte:
 *
 *   [15-byte magic][32-bit payload length in bits][payload]
 *
 * Magic values: "stealth_pnginfo" / "stealth_pngcomp" (alpha-channel
 * LSBs), "stealth_rgbinfo" / "stealth_rgbcomp" (RGB-channel LSBs, three
 * bits per pixel). The *comp variants gzip the payload.
 *
 * NovelAI writes stealth_pngcomp with a JSON object mirroring its tEXt
 * chunks; the A1111 extension writes the plain infotext. Both are
 * normalized here into synthesized text chunks so the regular parser
 * pipeline can consume them.
 *
 * The same bits survive in a WebP wherever its pixels are stored
 * losslessly (NovelAI's lossless exports, and the alpha plane of a lossy
 * re-save); decodeWebpPixels in webp-pixels.ts supplies those pixels and
 * scanDecodedPixels reads them here.
 *
 * @see https://github.com/NovelAI/novelai-image-metadata
 * @see https://github.com/ashen-sensored/sd_webui_stealth_pnginfo
 */

import type { PngTextChunk, RgbaPixels } from '../types';
import { isPng } from '../utils/binary';
import { gunzip } from '../utils/compression';
import { decodePngPixels } from './png-pixels';

const MAGIC_LENGTH = 15;

/**
 * Largest pixel buffer the scan decodes: 8192 × 8192 RGBA. The scan reads
 * a few hundred bits, but the whole image has to be inflated and
 * unfiltered first; past this size that work is not worth a long shot at
 * hidden metadata, and a crafted header could claim gigabytes.
 */
export const MAX_PIXEL_BYTES = 256 * 1024 * 1024;

/**
 * Largest stealth payload after gunzip. Payloads are generation metadata
 * as text, far below this; a compressed payload that inflates past it is
 * not one.
 */
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

const ALPHA_MAGICS = ['stealth_pnginfo', 'stealth_pngcomp'];
const RGB_MAGICS = ['stealth_rgbinfo', 'stealth_rgbcomp'];

/** Which pixel channels carry the hidden bitstream */
export type LsbMode = 'alpha' | 'rgb';

/** Decoded pixel data, interleaved and row-major */
export interface PixelData {
  width: number;
  height: number;
  /** Bytes per pixel: 4 = RGBA, 3 = RGB, 1 = alpha only */
  channels: number;
  /** width * height * channels bytes */
  pixels: Uint8Array;
}

/** Where a stealth payload sits in the pixels */
export interface StealthLocation {
  mode: LsbMode;
  /** Bits it spans from the first pixel on: magic, length and payload */
  bits: number;
}

/**
 * Extract Stealth PNGInfo from PNG pixel data
 *
 * @param data - PNG file data
 * @returns Synthesized text chunks, or null when no stealth data is found
 *   or the pixels are not ones decodePngPixels reads
 */
export async function readStealthChunks(
  data: Uint8Array,
): Promise<PngTextChunk[] | null> {
  if (!isPng(data)) {
    return null;
  }

  const image = await decodePngPixels(data, MAX_PIXEL_BYTES);
  if (image === null || typeof image === 'string') {
    return null;
  }
  return scanDecodedPixels(image);
}

/**
 * Scan externally decoded RGBA pixels for Stealth PNGInfo
 *
 * For pixels the library did not decode itself: those an injected
 * decoder (the deprecated ReadOptions.decodePixels) supplies.
 *
 * @param rgba - Decoded RGBA pixel data
 * @returns Synthesized text chunks, or null when no stealth data is found
 */
export async function scanStealthPixels(
  rgba: RgbaPixels,
): Promise<PngTextChunk[] | null> {
  const { data, width, height } = rgba;
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return null;
  }
  const pixels =
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return scanDecodedPixels({ width, height, channels: 4, pixels });
}

/**
 * Scan decoded pixels for Stealth PNGInfo, trying each LSB mode the
 * pixel layout can carry
 *
 * @param image - Pixels from the PNG decoder here or from decodeWebpPixels
 * @returns Synthesized text chunks, or null when no stealth data is found
 */
export async function scanDecodedPixels(
  image: PixelData,
): Promise<PngTextChunk[] | null> {
  for (const mode of lsbModes(image.channels)) {
    const text = await extractStealthText(image, mode);
    if (text !== null) {
      return toTextChunks(text);
    }
  }
  return null;
}

/**
 * Find the stealth payloads in decoded pixels without reading them
 *
 * Only the magic and the declared length are looked at, so a payload is
 * located even when its content would not decode. A length that makes no
 * sense counts as running to the last pixel.
 *
 * @returns One entry per LSB mode that opens with a stealth magic
 */
export function locateStealth(image: PixelData): StealthLocation[] {
  const found: StealthLocation[] = [];
  for (const mode of lsbModes(image.channels)) {
    const cursor = new LsbCursor(image, mode);
    const magic = cursor.readBytes(MAGIC_LENGTH);
    const expected = mode === 'alpha' ? ALPHA_MAGICS : RGB_MAGICS;
    if (!magic || !expected.includes(String.fromCharCode(...magic))) {
      continue;
    }
    const capacity = image.width * image.height * (mode === 'alpha' ? 1 : 3);
    const payloadBits = cursor.readUint32() ?? 0;
    const bits = (MAGIC_LENGTH + 4) * 8 + payloadBits;
    found.push({
      mode,
      bits: payloadBits === 0 || bits > capacity ? capacity : bits,
    });
  }
  return found;
}

/**
 * The LSB modes a pixel layout can carry
 *
 * RGBA images may carry either variant; alpha comes first to match the
 * reference readers. RGB images can only carry rgb variants, and a lone
 * alpha plane (a lossy WebP) only alpha variants.
 */
function lsbModes(channels: number): LsbMode[] {
  return channels === 4
    ? ['alpha', 'rgb']
    : channels === 1
      ? ['alpha']
      : ['rgb'];
}

// ============================================================================
// LSB bitstream extraction
// ============================================================================

/**
 * Column-major reader over pixel least-significant bits
 */
class LsbCursor {
  private index = 0;
  private readonly bitsPerPixel: number;
  private readonly capacity: number;

  constructor(
    private readonly image: PixelData,
    private readonly mode: LsbMode,
  ) {
    this.bitsPerPixel = mode === 'alpha' ? 1 : 3;
    this.capacity = image.width * image.height * this.bitsPerPixel;
  }

  /**
   * Read bytes from the bitstream, or null when out of bits
   */
  readBytes(count: number): Uint8Array | null {
    if (count < 0 || this.index + count * 8 > this.capacity) {
      return null;
    }
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        byte = (byte << 1) | this.nextBit();
      }
      out[i] = byte;
    }
    return out;
  }

  /**
   * Read a 32-bit big-endian unsigned integer, or null when out of bits
   */
  readUint32(): number | null {
    const bytes = this.readBytes(4);
    if (!bytes) {
      return null;
    }
    return (
      ((bytes[0] ?? 0) * 0x1000000 +
        ((bytes[1] ?? 0) << 16) +
        ((bytes[2] ?? 0) << 8) +
        (bytes[3] ?? 0)) >>>
      0
    );
  }

  private nextBit(): number {
    const { width, height, channels, pixels } = this.image;
    const pixelIndex = Math.floor(this.index / this.bitsPerPixel);
    const channel =
      this.mode === 'alpha' ? channels - 1 : this.index % this.bitsPerPixel;
    // Column-major traversal: pixelIndex = x * height + y
    const x = Math.floor(pixelIndex / height);
    const y = pixelIndex % height;
    this.index++;
    return (pixels[(y * width + x) * channels + channel] ?? 0) & 1;
  }
}

/**
 * Extract and decode the stealth payload for one LSB mode
 */
async function extractStealthText(
  image: PixelData,
  mode: LsbMode,
): Promise<string | null> {
  const cursor = new LsbCursor(image, mode);

  const magicBytes = cursor.readBytes(MAGIC_LENGTH);
  if (!magicBytes) {
    return null;
  }
  const magic = String.fromCharCode(...magicBytes);
  const expected = mode === 'alpha' ? ALPHA_MAGICS : RGB_MAGICS;
  if (!expected.includes(magic)) {
    return null;
  }

  const bitLength = cursor.readUint32();
  if (bitLength === null || bitLength === 0 || bitLength % 8 !== 0) {
    return null;
  }
  const payload = cursor.readBytes(bitLength / 8);
  if (!payload) {
    return null;
  }

  try {
    const bytes = magic.endsWith('comp')
      ? await gunzip(payload, MAX_PAYLOAD_BYTES)
      : payload;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Corrupted gzip stream or invalid UTF-8 — treat as no stealth data.
    return null;
  }
}

// ============================================================================
// Chunk synthesis
// ============================================================================

/**
 * Normalize a stealth payload into synthesized text chunks
 *
 * NovelAI payloads are JSON objects whose keys mirror its tEXt chunk
 * keywords; each entry becomes one chunk. Plain-text payloads (the A1111
 * stealth extension) carry the raw infotext, equivalent to a
 * `parameters` tEXt chunk.
 */
function toTextChunks(text: string): PngTextChunk[] {
  const json = tryParseJsonObject(text);
  if (json) {
    return Object.entries(json).map(([keyword, value]) => ({
      type: 'tEXt',
      keyword,
      text: typeof value === 'string' ? value : JSON.stringify(value),
    }));
  }
  return [{ type: 'tEXt', keyword: 'parameters', text }];
}

/**
 * Parse text as a JSON object, returning null for non-objects
 */
function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Not JSON — plain-text payload.
  }
  return null;
}
