/**
 * Synthetic pictures for the WebP and PNG pixel tests
 *
 * Deterministic noise, pictures from a per-pixel function, few-color
 * pictures, and a conversion between the two pixel layouts in use.
 */

import type { RgbaPixels } from '../../src/types';

/** Deterministic pseudo-random bytes (mulberry32) */
export function randomBytes(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  };
}

/** RGBA image from a per-pixel function */
export function image(
  width: number,
  height: number,
  at: (x: number, y: number) => [number, number, number, number],
): RgbaPixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(at(x, y), (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

/** An image with `colors` distinct colors, in blocks so they repeat */
export function paletteImage(colors: number): RgbaPixels {
  const next = randomBytes(colors);
  const table = Array.from({ length: colors }, () => [
    next(),
    next(),
    next(),
    255,
  ]);
  const pick = randomBytes(colors + 1000);
  const blocks = Array.from({ length: 16 * 12 }, () => pick() % colors);
  return image(64, 48, (x, y) => {
    const [r, g, b, a] = table[blocks[(y >> 2) * 16 + (x >> 2)] ?? 0] ?? [];
    return [r ?? 0, g ?? 0, b ?? 0, a ?? 0];
  });
}

/**
 * Pictures that take an encoder down different paths: noise, gradients,
 * something photo-like, a flat color, translucency, and edge-case sizes
 */
export function samplePictures(): [name: string, picture: RgbaPixels][] {
  const noise = randomBytes(1);
  const photoNoise = randomBytes(2);
  return [
    [
      'noise in every channel',
      image(48, 40, () => [noise(), noise(), noise(), noise()]),
    ],
    [
      'smooth gradients',
      image(120, 90, (x, y) => [x * 2, y * 2, (x + y) & 0xff, 255]),
    ],
    [
      'a photo-like picture',
      image(200, 150, (x, y) => [
        (128 + 100 * Math.sin(x / 17) + (photoNoise() & 7)) & 0xff,
        (128 + 100 * Math.cos(y / 13) + (photoNoise() & 7)) & 0xff,
        (128 + 60 * Math.sin((x + y) / 23) + (photoNoise() & 7)) & 0xff,
        255,
      ]),
    ],
    ['a single flat color', image(70, 50, () => [12, 200, 90, 255])],
    [
      'a translucent ramp',
      image(96, 64, (x, y) => [x * 2, 255 - y * 3, 77, 16 + ((x * 2) & 0xef)]),
    ],
    ['one pixel', image(1, 1, () => [1, 2, 3, 200])],
    ['one column', image(1, 37, (_x, y) => [y, y * 3, 255 - y, 255])],
    ['one row', image(53, 1, (x) => [x, 255 - x, x * 4, 255])],
    [
      'odd dimensions',
      image(3, 5, (x, y) => [x * 80, y * 50, (x * y * 30) & 0xff, 255]),
    ],
  ];
}

/** ARGB values as interleaved RGBA bytes */
export function toRgba(pixels: Uint32Array): Uint8Array {
  const out = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const argb = pixels[i] ?? 0;
    out.set([argb >>> 16, argb >>> 8, argb, argb >>> 24], i * 4);
  }
  return out;
}

/**
 * The kind of the first transform in a VP8L stream, or null without one:
 * 0 = predictor, 1 = cross-color, 2 = subtract-green, 3 = color indexing.
 * The image header takes 40 bits; a presence bit and two type bits follow.
 */
export function firstTransform(stream: Uint8Array): number | null {
  const bits = stream[5] ?? 0;
  return (bits & 1) === 1 ? (bits >> 1) & 3 : null;
}

/** Interleaved RGBA bytes as ARGB values */
export function toArgb(rgba: Uint8Array | Uint8ClampedArray): Uint32Array {
  const out = new Uint32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] =
      (((rgba[i * 4 + 3] ?? 0) << 24) |
        ((rgba[i * 4] ?? 0) << 16) |
        ((rgba[i * 4 + 1] ?? 0) << 8) |
        (rgba[i * 4 + 2] ?? 0)) >>>
      0;
  }
  return out;
}
