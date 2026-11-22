/**
 * Writing edited pixels back into a PNG
 *
 * The samples go back in the layout they were decoded from, its channels
 * and its bit depth, each row filtered with the filter type it had, so the
 * recompressed image stays about the size it was. One layout is not
 * reproduced: a file that was interlaced is written without interlacing,
 * which shows the same picture. The IDAT chunks are replaced by a single
 * new one; every other chunk is kept as it is.
 */

import { type PngPixels, pixelSize } from '../readers/png-pixels';
import { readChunkType, readUint32BE } from '../utils/binary';
import { deflate } from '../utils/compression';
import { buildChunk } from './png';

const PNG_SIGNATURE_LENGTH = 8;
/** Offset of the interlace method in the IHDR data */
const IHDR_INTERLACE = 12;

/**
 * Replace the pixel data of a PNG
 *
 * @param data - The PNG file the pixels were decoded from
 * @param image - Its pixels, edited in their 8-bit view (`pixels`)
 * @returns The PNG with new IDAT data, not interlaced
 * @throws if the runtime has no CompressionStream
 */
export async function writePngPixels(
  data: Uint8Array,
  image: PngPixels,
): Promise<Uint8Array> {
  const raw = filterScanlines(
    storedSamples(image),
    image.width,
    image.height,
    pixelSize(image.layout),
    image.filters,
  );
  const idat = buildChunk('IDAT', await deflate(raw));

  const parts: Uint8Array[] = [data.subarray(0, PNG_SIGNATURE_LENGTH)];
  let placed = false;
  let offset = PNG_SIGNATURE_LENGTH;
  while (offset + 12 <= data.length) {
    // Length, type, data and CRC
    const end = offset + 12 + readUint32BE(data, offset);
    if (end > data.length) {
      break;
    }
    const type = readChunkType(data, offset + 4);
    if (type === 'IDAT') {
      if (!placed) {
        parts.push(idat);
        placed = true;
      }
    } else if (type === 'IHDR' && image.layout.interlaced) {
      // The rows are written one after the other now
      const header = data.slice(offset + 8, end - 4);
      header[IHDR_INTERLACE] = 0;
      parts.push(buildChunk('IHDR', header));
    } else {
      parts.push(data.subarray(offset, end));
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
 * The samples to store: the file's own, with whatever was changed in the
 * 8-bit view carried over
 *
 * A changed 8-bit value becomes its 16-bit equivalent, both bytes alike,
 * in a 16-bit file; the samples nothing touched keep their full depth. A
 * grayscale image takes its gray from the red channel of the view.
 */
function storedSamples(image: PngPixels): Uint8Array {
  const { pixels, samples, layout } = image;
  if (pixels === samples) {
    return samples;
  }
  const step = layout.bitDepth / 8;
  const store = (at: number, value: number): void => {
    if (samples[at] !== value) {
      samples.fill(value, at, at + step);
    }
  };

  if (layout.colorType === 4) {
    // Gray and alpha, from the RGBA view
    for (let from = 0, to = 0; from < pixels.length; from += 4) {
      store(to, pixels[from] ?? 0);
      store(to + step, pixels[from + 3] ?? 0);
      to += step * 2;
    }
  } else {
    for (let i = 0; i < pixels.length; i++) {
      store(i * step, pixels[i] ?? 0);
    }
  }
  return samples;
}

/**
 * Apply PNG scanline filtering (filter types 0-4), the reverse of the
 * unfilter in readers/png-samples.ts
 *
 * One loop per filter type, with the first pixel of a row and the first
 * row handled apart, as there. Stores into the Uint8Array wrap modulo 256
 * as the filters require.
 */
function filterScanlines(
  samples: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
  filters: Uint8Array,
): Uint8Array {
  const stride = width * bytesPerPixel;
  const raw = new Uint8Array(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    const filter = filters[y] ?? 0;
    // The row's samples in `samples`, its bytes in `raw`, and the row above
    const row = y * stride;
    const out = y * (stride + 1) + 1;
    const prior = row - stride;
    const first = y === 0;
    raw[out - 1] = filter;

    switch (filter) {
      case 1:
        filterSub(samples, row, raw, out, stride, bytesPerPixel);
        break;
      case 2:
        if (first) {
          raw.set(samples.subarray(row, row + stride), out);
        } else {
          for (let i = 0; i < stride; i++) {
            raw[out + i] = (samples[row + i] ?? 0) - (samples[prior + i] ?? 0);
          }
        }
        break;
      case 3:
        if (first) {
          // No row above: the average is half the left neighbour
          for (let i = 0; i < bytesPerPixel; i++) {
            raw[out + i] = samples[row + i] ?? 0;
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            raw[out + i] =
              (samples[row + i] ?? 0) -
              ((samples[row + i - bytesPerPixel] ?? 0) >> 1);
          }
        } else {
          for (let i = 0; i < bytesPerPixel; i++) {
            raw[out + i] =
              (samples[row + i] ?? 0) - ((samples[prior + i] ?? 0) >> 1);
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            raw[out + i] =
              (samples[row + i] ?? 0) -
              (((samples[row + i - bytesPerPixel] ?? 0) +
                (samples[prior + i] ?? 0)) >>
                1);
          }
        }
        break;
      case 4:
        if (first) {
          // No row above: the Paeth predictor is the left neighbour
          filterSub(samples, row, raw, out, stride, bytesPerPixel);
        } else {
          // No left neighbour: the predictor is the byte above
          for (let i = 0; i < bytesPerPixel; i++) {
            raw[out + i] = (samples[row + i] ?? 0) - (samples[prior + i] ?? 0);
          }
          for (let i = bytesPerPixel; i < stride; i++) {
            const left = samples[row + i - bytesPerPixel] ?? 0;
            const up = samples[prior + i] ?? 0;
            const upLeft = samples[prior + i - bytesPerPixel] ?? 0;
            const p = left + up - upLeft;
            const pa = Math.abs(p - left);
            const pb = Math.abs(p - up);
            const pc = Math.abs(p - upLeft);
            raw[out + i] =
              (samples[row + i] ?? 0) -
              (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          }
        }
        break;
      default:
        raw.set(samples.subarray(row, row + stride), out);
    }
  }
  return raw;
}

/**
 * Apply the Sub filter (type 1) to one row: each byte minus the byte one
 * pixel to its left
 */
function filterSub(
  samples: Uint8Array,
  row: number,
  raw: Uint8Array,
  out: number,
  stride: number,
  bytesPerPixel: number,
): void {
  for (let i = 0; i < bytesPerPixel; i++) {
    raw[out + i] = samples[row + i] ?? 0;
  }
  for (let i = bytesPerPixel; i < stride; i++) {
    raw[out + i] =
      (samples[row + i] ?? 0) - (samples[row + i - bytesPerPixel] ?? 0);
  }
}
