/**
 * Test helpers for Stealth PNGInfo
 *
 * createStealthPng builds a synthetic PNG with a payload embedded in
 * pixel least-significant bits, exactly as NovelAI and the
 * stealth-pnginfo extensions write it. stripTextChunks removes all
 * text chunks from a PNG, simulating a metadata-stripping image host.
 */

import { deflateSync, gzipSync } from 'node:zlib';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface StealthPngOptions {
  /** Payload text to embed */
  payload: string;
  /** Which channels carry the bitstream (default: 'alpha') */
  mode?: 'alpha' | 'rgb';
  /** Gzip the payload (*comp magic) or embed as plain UTF-8 (default: true) */
  compress?: boolean;
  /** Override the 15-byte magic (default: derived from mode/compress) */
  magic?: string;
  /** Override the declared payload bit length (default: actual length) */
  declaredBitLength?: number;
  /** Image width in pixels (default: 64) */
  width?: number;
  /** Image height in pixels (default: auto-sized to fit the payload) */
  height?: number;
  /** PNG color type: 6 = RGBA, 2 = RGB (default: 6 for alpha, 2 for rgb) */
  colorType?: 2 | 6;
}

/**
 * Build a synthetic PNG with Stealth PNGInfo embedded in pixel LSBs
 */
export function createStealthPng(options: StealthPngOptions): Uint8Array {
  const colorType =
    options.colorType ?? ((options.mode ?? 'alpha') === 'alpha' ? 6 : 2);
  const channels = colorType === 6 ? 4 : 3;
  const { width, height, pixels } = buildStealthPixels(options, channels);
  return buildPng(width, height, colorType, channels, pixels);
}

/**
 * Build raw RGBA pixels with Stealth PNGInfo embedded in the LSBs
 *
 * Same embedding as createStealthPng, but returned as a decoded pixel
 * buffer — the shape an external WebP decoder would produce.
 */
export function createStealthRgbaPixels(options: StealthPngOptions): {
  data: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height, pixels } = buildStealthPixels(options, 4);
  return { data: pixels, width, height };
}

/**
 * Embed the stealth bitstream into a fresh pixel buffer
 */
function buildStealthPixels(
  options: StealthPngOptions,
  channels: number,
): { width: number; height: number; pixels: Uint8Array } {
  const mode = options.mode ?? 'alpha';
  const compress = options.compress ?? true;

  const magic =
    options.magic ??
    (mode === 'alpha'
      ? compress
        ? 'stealth_pngcomp'
        : 'stealth_pnginfo'
      : compress
        ? 'stealth_rgbcomp'
        : 'stealth_rgbinfo');

  const payloadBytes = compress
    ? new Uint8Array(gzipSync(Buffer.from(options.payload, 'utf8')))
    : new Uint8Array(Buffer.from(options.payload, 'utf8'));
  const declaredBitLength =
    options.declaredBitLength ?? payloadBytes.length * 8;

  // Assemble the bitstream: magic + 32-bit length + payload, MSB first.
  const header = new Uint8Array(magic.length + 4);
  for (let i = 0; i < magic.length; i++) {
    header[i] = magic.charCodeAt(i);
  }
  header[magic.length] = (declaredBitLength >>> 24) & 0xff;
  header[magic.length + 1] = (declaredBitLength >>> 16) & 0xff;
  header[magic.length + 2] = (declaredBitLength >>> 8) & 0xff;
  header[magic.length + 3] = declaredBitLength & 0xff;

  const bits: number[] = [];
  for (const source of [header, payloadBytes]) {
    for (const byte of source) {
      for (let bit = 7; bit >= 0; bit--) {
        bits.push((byte >> bit) & 1);
      }
    }
  }

  // Size the image to fit the bitstream unless dimensions were forced.
  const bitsPerPixel = mode === 'alpha' ? 1 : 3;
  const width = options.width ?? 64;
  const height =
    options.height ?? Math.ceil(bits.length / (width * bitsPerPixel)) + 1;

  // Opaque mid-gray canvas, then write the bitstream column-major.
  const pixels = new Uint8Array(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels] = 128;
    pixels[i * channels + 1] = 128;
    pixels[i * channels + 2] = 128;
    if (channels === 4) {
      pixels[i * channels + 3] = 255;
    }
  }
  for (let i = 0; i < bits.length; i++) {
    const pixelIndex = Math.floor(i / bitsPerPixel);
    const x = Math.floor(pixelIndex / height);
    const y = pixelIndex % height;
    if (x >= width) {
      break; // Payload larger than the forced dimensions — truncate.
    }
    const channel = mode === 'alpha' ? channels - 1 : i % bitsPerPixel;
    const offset = (y * width + x) * channels + channel;
    pixels[offset] = ((pixels[offset] ?? 0) & 0xfe) | (bits[i] ?? 0);
  }

  return { width, height, pixels };
}

/**
 * Remove all text chunks (tEXt, iTXt, zTXt) from a PNG
 */
export function stripTextChunks(png: Uint8Array): Uint8Array {
  const dropped = new Set(['tEXt', 'iTXt', 'zTXt']);
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length =
      (((png[offset] ?? 0) << 24) |
        ((png[offset + 1] ?? 0) << 16) |
        ((png[offset + 2] ?? 0) << 8) |
        (png[offset + 3] ?? 0)) >>>
      0;
    const type = String.fromCharCode(
      png[offset + 4] ?? 0,
      png[offset + 5] ?? 0,
      png[offset + 6] ?? 0,
      png[offset + 7] ?? 0,
    );
    const end = offset + 12 + length;
    if (!dropped.has(type)) {
      parts.push(png.subarray(offset, end));
    }
    offset = end;
    if (type === 'IEND') {
      break;
    }
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

// ============================================================================
// PNG encoding
// ============================================================================

/**
 * Encode raw pixels as a minimal PNG (filter type 0 on every scanline)
 */
function buildPng(
  width: number,
  height: number,
  colorType: number,
  channels: number,
  pixels: Uint8Array,
): Uint8Array {
  const stride = width * channels;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(
      pixels.subarray(y * stride, (y + 1) * stride),
      y * (stride + 1) + 1,
    );
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = new Uint8Array(deflateSync(Buffer.from(raw)));

  const chunks = [
    buildChunk('IHDR', ihdr),
    buildChunk('IDAT', idat),
    buildChunk('IEND', new Uint8Array(0)),
  ];
  const total = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  out.set(PNG_SIGNATURE, 0);
  let pos = 8;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

/**
 * Build one PNG chunk: length + type + data + CRC
 */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/**
 * CRC-32 as defined by the PNG specification
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
