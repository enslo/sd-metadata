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
 * @see https://github.com/NovelAI/novelai-image-metadata
 * @see https://github.com/ashen-sensored/sd_webui_stealth_pnginfo
 */

import type { PngTextChunk, RgbaPixels } from '../types';
import { isPng, readChunkType, readUint32BE } from '../utils/binary';
import { gunzip, inflate } from '../utils/compression';

const PNG_SIGNATURE_LENGTH = 8;
const MAGIC_LENGTH = 15;

const ALPHA_MAGICS = ['stealth_pnginfo', 'stealth_pngcomp'];
const RGB_MAGICS = ['stealth_rgbinfo', 'stealth_rgbcomp'];

/** Which pixel channels carry the hidden bitstream */
type LsbMode = 'alpha' | 'rgb';

/** Decoded pixel data, interleaved and row-major */
interface PixelData {
  width: number;
  height: number;
  /** Bytes per pixel: 4 = RGBA, 3 = RGB */
  channels: number;
  /** width * height * channels bytes */
  pixels: Uint8Array;
}

/**
 * Extract Stealth PNGInfo from PNG pixel data
 *
 * @param data - PNG file data
 * @returns Synthesized text chunks, or null when no stealth data is found
 *   or the image is not a supported PNG (8-bit RGB/RGBA, non-interlaced)
 */
export async function readStealthChunks(
  data: Uint8Array,
): Promise<PngTextChunk[] | null> {
  if (!isPng(data)) {
    return null;
  }

  const image = await decodePixels(data);
  if (!image) {
    return null;
  }
  return scanPixels(image);
}

/**
 * Scan externally decoded RGBA pixels for Stealth PNGInfo
 *
 * Used for formats the built-in decoder cannot handle (currently
 * WebP), with pixels supplied by the platform (browser image decoding)
 * or by an injected decoder (ReadOptions.decodePixels).
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
  return scanPixels({ width, height, channels: 4, pixels });
}

/**
 * Try each LSB mode the pixel layout can carry
 */
async function scanPixels(image: PixelData): Promise<PngTextChunk[] | null> {
  // RGBA images may carry either variant; alpha is checked first to
  // match the reference readers. RGB images can only carry rgb variants.
  const modes: LsbMode[] = image.channels === 4 ? ['alpha', 'rgb'] : ['rgb'];
  for (const mode of modes) {
    const text = await extractStealthText(image, mode);
    if (text !== null) {
      return toTextChunks(text);
    }
  }
  return null;
}

// ============================================================================
// PNG pixel decoding
// ============================================================================

/**
 * Decode PNG pixel data (8-bit RGB/RGBA, non-interlaced only)
 */
async function decodePixels(data: Uint8Array): Promise<PixelData | null> {
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let sawIhdr = false;
  const idatParts: Uint8Array[] = [];

  let offset = PNG_SIGNATURE_LENGTH;
  while (offset + 8 <= data.length) {
    const length = readUint32BE(data, offset);
    const chunkType = readChunkType(data, offset + 4);
    const dataStart = offset + 8;
    if (dataStart + length > data.length) {
      return null;
    }

    if (chunkType === 'IHDR') {
      if (length < 13) {
        return null;
      }
      width = readUint32BE(data, dataStart);
      height = readUint32BE(data, dataStart + 4);
      bitDepth = data[dataStart + 8] ?? 0;
      colorType = data[dataStart + 9] ?? 0;
      interlace = data[dataStart + 12] ?? 0;
      sawIhdr = true;
    } else if (chunkType === 'IDAT') {
      idatParts.push(data.subarray(dataStart, dataStart + length));
    } else if (chunkType === 'IEND') {
      break;
    }

    // Skip data and CRC
    offset = dataStart + length + 4;
  }

  if (!sawIhdr || idatParts.length === 0 || width === 0 || height === 0) {
    return null;
  }
  if (bitDepth !== 8 || interlace !== 0) {
    return null;
  }
  if (colorType !== 2 && colorType !== 6) {
    return null;
  }

  let raw: Uint8Array;
  try {
    raw = await inflate(concatBytes(idatParts));
  } catch {
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const pixels = unfilter(raw, width, height, channels);
  if (!pixels) {
    return null;
  }
  return { width, height, channels, pixels };
}

/**
 * Concatenate byte arrays
 */
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Reverse PNG scanline filtering (filter types 0-4)
 */
function unfilter(
  raw: Uint8Array,
  width: number,
  height: number,
  channels: number,
): Uint8Array | null {
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) {
    return null;
  }

  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    if (filter > 4) {
      return null;
    }
    const rowStart = y * (stride + 1) + 1;
    const outStart = y * stride;
    for (let i = 0; i < stride; i++) {
      const value = raw[rowStart + i] ?? 0;
      const left = i >= channels ? (pixels[outStart + i - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[outStart + i - stride] ?? 0) : 0;
      const upLeft =
        y > 0 && i >= channels
          ? (pixels[outStart + i - stride - channels] ?? 0)
          : 0;

      let reconstructed = value;
      switch (filter) {
        case 1:
          reconstructed = value + left;
          break;
        case 2:
          reconstructed = value + up;
          break;
        case 3:
          reconstructed = value + ((left + up) >> 1);
          break;
        case 4:
          reconstructed = value + paeth(left, up, upLeft);
          break;
      }
      pixels[outStart + i] = reconstructed & 0xff;
    }
  }
  return pixels;
}

/**
 * Paeth predictor (PNG filter type 4)
 */
function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  return pb <= pc ? up : upLeft;
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
    const bytes = magic.endsWith('comp') ? await gunzip(payload) : payload;
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
