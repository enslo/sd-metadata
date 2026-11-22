/**
 * Test-only PNG layouts, written by sharp (libpng)
 *
 * The ways another tool may store a picture when it saves a PNG again:
 * interlaced, at 16 bits per sample, or as grayscale. sharp writes the
 * files and is the reference the built-in PNG pixel decoder is checked
 * against.
 */

import sharp, { type Sharp } from 'sharp';
import type { RgbaPixels } from '../../src/types';

/** A PNG layout, and what the file header says for an RGBA picture in it */
export interface PngLayoutCase {
  name: string;
  convert: (image: Sharp) => Sharp;
  /** 6 = RGBA, 4 = grayscale with alpha */
  colorType: 4 | 6;
  bitDepth: 8 | 16;
  interlaced: boolean;
}

/**
 * Layouts that keep the pixel values of an 8-bit RGBA picture, or at least
 * its alpha channel, besides the plain one
 */
export const RESAVED_LAYOUTS: PngLayoutCase[] = [
  {
    name: 'interlaced',
    convert: (image) => image.png({ progressive: true }),
    colorType: 6,
    bitDepth: 8,
    interlaced: true,
  },
  {
    name: '16-bit',
    convert: (image) => image.toColourspace('rgb16').png(),
    colorType: 6,
    bitDepth: 16,
    interlaced: false,
  },
  {
    name: '16-bit and interlaced',
    convert: (image) => image.toColourspace('rgb16').png({ progressive: true }),
    colorType: 6,
    bitDepth: 16,
    interlaced: true,
  },
  {
    name: 'grayscale with alpha',
    convert: (image) => image.toColourspace('b-w').png(),
    colorType: 4,
    bitDepth: 8,
    interlaced: false,
  },
  {
    name: '16-bit grayscale with alpha',
    convert: (image) => image.toColourspace('grey16').png(),
    colorType: 4,
    bitDepth: 16,
    interlaced: false,
  },
  {
    name: 'grayscale with alpha and interlaced',
    convert: (image) => image.toColourspace('b-w').png({ progressive: true }),
    colorType: 4,
    bitDepth: 8,
    interlaced: true,
  },
];

/** A sharp pipeline over raw RGBA pixels or an encoded image */
export function open(source: RgbaPixels | Uint8Array): Sharp {
  return source instanceof Uint8Array
    ? sharp(source)
    : sharp(source.data, {
        raw: { width: source.width, height: source.height, channels: 4 },
      });
}

/** Run a pipeline to the bytes of the file it writes */
export async function bytes(image: Sharp): Promise<Uint8Array> {
  return new Uint8Array(await image.toBuffer());
}

/** Layout fields of a PNG header: color type, bit depth, interlace method */
export function pngHeader(png: Uint8Array) {
  return {
    colorType: png[25] ?? 0,
    bitDepth: png[24] ?? 0,
    interlaced: png[28] === 1,
  };
}

/**
 * A file's pixels as 8-bit RGBA, the way libpng and libvips reduce them:
 * a 16-bit sample to its high byte, a gray value to three equal colors
 */
export async function decodeAsRgba8(file: Uint8Array): Promise<Uint8Array> {
  const pixels = await sharp(file)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer();
  return new Uint8Array(pixels);
}
