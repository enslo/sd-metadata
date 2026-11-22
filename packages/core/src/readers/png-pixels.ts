/**
 * PNG pixel decoding for the stealth scan
 *
 * Stealth data is written into an 8-bit RGB or RGBA PNG, but the file it
 * is found in may have been saved again by another tool, in a layout that
 * keeps the pixel values and the bits hidden in them:
 *
 * - interlaced (Adam7): the same samples, stored in seven passes;
 * - 16 bits per sample: each 8-bit value became its 16-bit equivalent,
 *   with the original as its high byte;
 * - grayscale with alpha: a picture without color keeps its alpha channel,
 *   and an alpha-embedded payload with it.
 *
 * Two layouts are not decoded. Grayscale without alpha has nowhere a
 * payload could be: an RGB one needs color channels that differ. A palette
 * image could carry one only after a lossless conversion of a picture of
 * few colors; that case is left unexamined and reported as such.
 */

import { readChunkType, readUint32BE } from '../utils/binary';
import { inflate } from '../utils/compression';
import type { PixelData } from './stealth';

const PNG_SIGNATURE_LENGTH = 8;

/** Filter type 4: what rows are stored with when the file gives no choice */
const FILTER_PAETH = 4;

/** How a PNG stores its samples */
export interface PngLayout {
  /** 2 = RGB, 4 = grayscale with alpha, 6 = RGBA */
  colorType: 2 | 4 | 6;
  /** Bits per sample */
  bitDepth: 8 | 16;
  interlaced: boolean;
}

/** Decoded PNG pixels, with what it takes to store them again */
export interface PngPixels extends PixelData {
  layout: PngLayout;
  /**
   * The samples as the file holds them: its own channels at its own bit
   * depth, row by row, unfiltered and not interlaced. For 8-bit RGB and
   * RGBA this is `pixels` itself; otherwise `pixels` is an 8-bit RGBA
   * view derived from it.
   */
  samples: Uint8Array;
  /**
   * Filter type to store each row with: the file's own, or Paeth for a
   * file that was interlaced, whose rows had none of their own
   */
  filters: Uint8Array;
}

/**
 * Why the pixels of a PNG were not decoded: a layout the decoder does not
 * take (a palette image), a size past the cap, or data that does not
 * decode
 */
export type PixelDecodeFailure =
  | 'unsupportedLayout'
  | 'imageTooLarge'
  | 'undecodable';

/** Bytes one pixel takes in the samples of a layout */
export function pixelSize(layout: PngLayout): number {
  const channels = layout.colorType === 2 ? 3 : layout.colorType === 4 ? 2 : 4;
  return channels * (layout.bitDepth / 8);
}

/** One pass of an image: every `xStep`-th pixel of every `yStep`-th row */
interface Pass {
  xStart: number;
  yStart: number;
  xStep: number;
  yStep: number;
  width: number;
  height: number;
}

/** The seven Adam7 passes as (xStart, yStart, xStep, yStep) */
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

/**
 * Decode the pixels of a PNG
 *
 * @param data - PNG file data
 * @param maxBytes - Largest sample buffer to produce
 * @returns The pixels; null for a layout that cannot carry stealth data
 *   (grayscale without alpha); or the reason there are none
 */
export async function decodePngPixels(
  data: Uint8Array,
  maxBytes: number,
): Promise<PngPixels | PixelDecodeFailure | null> {
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
      return 'undecodable';
    }

    if (chunkType === 'IHDR') {
      if (length < 13) {
        return 'undecodable';
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
    return 'undecodable';
  }
  if (colorType === 0) {
    return null;
  }
  if (colorType === 3) {
    return 'unsupportedLayout';
  }
  if (
    (colorType !== 2 && colorType !== 4 && colorType !== 6) ||
    (bitDepth !== 8 && bitDepth !== 16) ||
    interlace > 1
  ) {
    return 'undecodable';
  }
  const layout: PngLayout = {
    colorType,
    bitDepth,
    interlaced: interlace === 1,
  };

  // A header past the size cap is not decoded, and the IDAT stream is not
  // inflated past the scanlines it declares, so a crafted file cannot
  // claim memory far beyond its pixel count.
  const bytesPerPixel = pixelSize(layout);
  if (width * height * bytesPerPixel > maxBytes) {
    return 'imageTooLarge';
  }
  const passes = layout.interlaced
    ? adam7Passes(width, height)
    : [{ xStart: 0, yStart: 0, xStep: 1, yStep: 1, width, height }];
  // Filtered scanlines: one filter byte and then the samples of each row
  const rawLength = passes.reduce(
    (sum, pass) => sum + pass.height * (pass.width * bytesPerPixel + 1),
    0,
  );

  let raw: Uint8Array;
  try {
    raw = await inflate(concatBytes(idatParts), rawLength);
  } catch {
    return 'undecodable';
  }

  let samples: Uint8Array | null;
  const filters = new Uint8Array(height);
  if (layout.interlaced) {
    samples = deinterlace(raw, passes, width, height, bytesPerPixel);
    filters.fill(FILTER_PAETH);
  } else {
    samples = unfilter(raw, width, height, bytesPerPixel);
    for (let y = 0; y < height; y++) {
      filters[y] = raw[y * (width * bytesPerPixel + 1)] ?? 0;
    }
  }
  if (!samples) {
    return 'undecodable';
  }

  return {
    width,
    height,
    channels: colorType === 2 ? 3 : 4,
    pixels: eightBitView(samples, width * height, layout),
    layout,
    samples,
    filters,
  };
}

/**
 * The passes of an interlaced image that hold any pixels: a small image
 * leaves some of the seven empty
 */
function adam7Passes(width: number, height: number): Pass[] {
  const passes: Pass[] = [];
  for (const [xStart, yStart, xStep, yStep] of ADAM7) {
    const pass = {
      xStart,
      yStart,
      xStep,
      yStep,
      width: Math.ceil((width - xStart) / xStep),
      height: Math.ceil((height - yStart) / yStep),
    };
    if (pass.width > 0 && pass.height > 0) {
      passes.push(pass);
    }
  }
  return passes;
}

/**
 * Unfilter the passes of an interlaced image and put their samples where
 * they belong in the full image
 */
function deinterlace(
  raw: Uint8Array,
  passes: Pass[],
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array | null {
  const samples = new Uint8Array(width * height * bytesPerPixel);
  let offset = 0;
  for (const pass of passes) {
    // Each pass is filtered as a small image of its own
    const length = pass.height * (pass.width * bytesPerPixel + 1);
    const rows = unfilter(
      raw.subarray(offset, offset + length),
      pass.width,
      pass.height,
      bytesPerPixel,
    );
    if (!rows) {
      return null;
    }
    offset += length;

    for (let y = 0, from = 0; y < pass.height; y++) {
      let to =
        ((pass.yStart + y * pass.yStep) * width + pass.xStart) * bytesPerPixel;
      for (let x = 0; x < pass.width; x++) {
        for (let i = 0; i < bytesPerPixel; i++) {
          samples[to + i] = rows[from + i] ?? 0;
        }
        from += bytesPerPixel;
        to += pass.xStep * bytesPerPixel;
      }
    }
  }
  return samples;
}

/**
 * The pixels as 8-bit RGB or RGBA: what a payload was written into
 *
 * A 16-bit sample gives its high byte (samples are big-endian), and a
 * gray value stands for all three colors. 8-bit RGB and RGBA are that
 * already and are returned as they are, not copied.
 */
function eightBitView(
  samples: Uint8Array,
  pixelCount: number,
  layout: PngLayout,
): Uint8Array {
  const step = layout.bitDepth / 8;
  if (layout.colorType !== 4) {
    if (step === 1) {
      return samples;
    }
    const pixels = new Uint8Array(samples.length / 2);
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = samples[i * 2] ?? 0;
    }
    return pixels;
  }

  const pixels = new Uint8Array(pixelCount * 4);
  for (let p = 0, from = 0, to = 0; p < pixelCount; p++) {
    const gray = samples[from] ?? 0;
    pixels[to] = gray;
    pixels[to + 1] = gray;
    pixels[to + 2] = gray;
    pixels[to + 3] = samples[from + step] ?? 0;
    from += step * 2;
    to += 4;
  }
  return pixels;
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
 *
 * One loop per filter type, with the first pixel of a row and the first
 * row handled apart, so the inner loops carry no per-byte branches: this
 * is where the scan spends its time after inflating. Stores into the
 * Uint8Array wrap modulo 256 as the filters require.
 */
function unfilter(
  raw: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array | null {
  const stride = width * bytesPerPixel;
  if (raw.length < height * (stride + 1)) {
    return null;
  }

  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    // The row's bytes in `raw`, its pixels in `pixels`, and the row above
    const row = y * (stride + 1) + 1;
    const out = y * stride;
    const prior = out - stride;
    const first = y === 0;

    switch (filter) {
      case 0:
        pixels.set(raw.subarray(row, row + stride), out);
        break;
      case 1:
        unfilterSub(raw, row, pixels, out, stride, bytesPerPixel);
        break;
      case 2:
        if (first) {
          pixels.set(raw.subarray(row, row + stride), out);
        } else {
          for (let i = 0; i < stride; i++) {
            pixels[out + i] = (raw[row + i] ?? 0) + (pixels[prior + i] ?? 0);
          }
        }
        break;
      case 3:
        if (first) {
          // No row above: the average is half the left neighbour
          for (let i = 0; i < bytesPerPixel; i++) {
            pixels[out + i] = raw[row + i] ?? 0;
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            pixels[out + i] =
              (raw[row + i] ?? 0) +
              ((pixels[out + i - bytesPerPixel] ?? 0) >> 1);
          }
        } else {
          for (let i = 0; i < bytesPerPixel; i++) {
            pixels[out + i] =
              (raw[row + i] ?? 0) + ((pixels[prior + i] ?? 0) >> 1);
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            pixels[out + i] =
              (raw[row + i] ?? 0) +
              (((pixels[out + i - bytesPerPixel] ?? 0) +
                (pixels[prior + i] ?? 0)) >>
                1);
          }
        }
        break;
      case 4:
        if (first) {
          // No row above: the Paeth predictor is the left neighbour
          unfilterSub(raw, row, pixels, out, stride, bytesPerPixel);
        } else {
          // No left neighbour: the predictor is the byte above
          for (let i = 0; i < bytesPerPixel; i++) {
            pixels[out + i] = (raw[row + i] ?? 0) + (pixels[prior + i] ?? 0);
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            const left = pixels[out + i - bytesPerPixel] ?? 0;
            const up = pixels[prior + i] ?? 0;
            const upLeft = pixels[prior + i - bytesPerPixel] ?? 0;
            const p = left + up - upLeft;
            const pa = Math.abs(p - left);
            const pb = Math.abs(p - up);
            const pc = Math.abs(p - upLeft);
            pixels[out + i] =
              (raw[row + i] ?? 0) +
              (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          }
        }
        break;
      default:
        return null;
    }
  }
  return pixels;
}

/**
 * Reverse the Sub filter (type 1) on one row: each byte plus the byte one
 * pixel to its left
 */
function unfilterSub(
  raw: Uint8Array,
  row: number,
  pixels: Uint8Array,
  out: number,
  stride: number,
  bytesPerPixel: number,
): void {
  for (let i = 0; i < bytesPerPixel; i++) {
    pixels[out + i] = raw[row + i] ?? 0;
  }
  for (let i = bytesPerPixel; i < stride; i++) {
    pixels[out + i] =
      (raw[row + i] ?? 0) + (pixels[out + i - bytesPerPixel] ?? 0);
  }
}
