/**
 * Writing edited pixels back into a PNG
 *
 * Each scanline is filtered with the filter type it had, so the
 * recompressed image stays about the size it was. The IDAT chunks are
 * replaced by a single new one; every other chunk is kept as it is.
 */

import type { PngPixels } from '../readers/stealth';
import { readChunkType, readUint32BE } from '../utils/binary';
import { deflate } from '../utils/compression';
import { buildChunk } from './png';

const PNG_SIGNATURE_LENGTH = 8;

/**
 * Replace the pixel data of a PNG
 *
 * @param data - The PNG file the pixels were decoded from
 * @param image - Its pixels, edited, with the filter type of each row
 * @returns The PNG with new IDAT data
 * @throws if the runtime has no CompressionStream
 */
export async function writePngPixels(
  data: Uint8Array,
  image: PngPixels,
): Promise<Uint8Array> {
  const idat = buildChunk('IDAT', await deflate(filterScanlines(image)));

  const parts: Uint8Array[] = [data.subarray(0, PNG_SIGNATURE_LENGTH)];
  let placed = false;
  let offset = PNG_SIGNATURE_LENGTH;
  while (offset + 12 <= data.length) {
    // Length, type, data and CRC
    const end = offset + 12 + readUint32BE(data, offset);
    if (end > data.length) {
      break;
    }
    if (readChunkType(data, offset + 4) !== 'IDAT') {
      parts.push(data.subarray(offset, end));
    } else if (!placed) {
      parts.push(idat);
      placed = true;
    }
    offset = end;
  }

  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Apply PNG scanline filtering (filter types 0-4), the reverse of the
 * unfilter in readers/stealth.ts
 *
 * One loop per filter type, with the first pixel of a row and the first
 * row handled apart, as there. Stores into the Uint8Array wrap modulo 256
 * as the filters require.
 */
function filterScanlines(image: PngPixels): Uint8Array {
  const { width, height, channels, pixels, filters } = image;
  const stride = width * channels;
  const raw = new Uint8Array(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    const filter = filters[y] ?? 0;
    // The row's pixels in `pixels`, its bytes in `raw`, and the row above
    const row = y * stride;
    const out = y * (stride + 1) + 1;
    const prior = row - stride;
    const first = y === 0;
    raw[out - 1] = filter;

    switch (filter) {
      case 1:
        filterSub(pixels, row, raw, out, stride, channels);
        break;
      case 2:
        if (first) {
          raw.set(pixels.subarray(row, row + stride), out);
        } else {
          for (let i = 0; i < stride; i++) {
            raw[out + i] = (pixels[row + i] ?? 0) - (pixels[prior + i] ?? 0);
          }
        }
        break;
      case 3:
        if (first) {
          // No row above: the average is half the left neighbour
          for (let i = 0; i < channels; i++) {
            raw[out + i] = pixels[row + i] ?? 0;
          }
          for (let i = channels; i < stride; i++) {
            raw[out + i] =
              (pixels[row + i] ?? 0) - ((pixels[row + i - channels] ?? 0) >> 1);
          }
        } else {
          for (let i = 0; i < channels; i++) {
            raw[out + i] =
              (pixels[row + i] ?? 0) - ((pixels[prior + i] ?? 0) >> 1);
          }
          for (let i = channels; i < stride; i++) {
            raw[out + i] =
              (pixels[row + i] ?? 0) -
              (((pixels[row + i - channels] ?? 0) + (pixels[prior + i] ?? 0)) >>
                1);
          }
        }
        break;
      case 4:
        if (first) {
          // No row above: the Paeth predictor is the left neighbour
          filterSub(pixels, row, raw, out, stride, channels);
        } else {
          // No left neighbour: the predictor is the byte above
          for (let i = 0; i < channels; i++) {
            raw[out + i] = (pixels[row + i] ?? 0) - (pixels[prior + i] ?? 0);
          }
          for (let i = channels; i < stride; i++) {
            const left = pixels[row + i - channels] ?? 0;
            const up = pixels[prior + i] ?? 0;
            const upLeft = pixels[prior + i - channels] ?? 0;
            const p = left + up - upLeft;
            const pa = Math.abs(p - left);
            const pb = Math.abs(p - up);
            const pc = Math.abs(p - upLeft);
            raw[out + i] =
              (pixels[row + i] ?? 0) -
              (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          }
        }
        break;
      default:
        raw.set(pixels.subarray(row, row + stride), out);
    }
  }
  return raw;
}

/**
 * Apply the Sub filter (type 1) to one row: each byte minus the byte one
 * pixel to its left
 */
function filterSub(
  pixels: Uint8Array,
  row: number,
  raw: Uint8Array,
  out: number,
  stride: number,
  channels: number,
): void {
  for (let i = 0; i < channels; i++) {
    raw[out + i] = pixels[row + i] ?? 0;
  }
  for (let i = channels; i < stride; i++) {
    raw[out + i] = (pixels[row + i] ?? 0) - (pixels[row + i - channels] ?? 0);
  }
}
