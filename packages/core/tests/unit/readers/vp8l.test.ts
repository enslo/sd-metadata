import { describe, expect, it } from 'vitest';
import { decodeVp8l } from '../../../src/readers/vp8l';
import type { RgbaPixels } from '../../../src/types';
import {
  decodeWithSharp,
  encodeWebp,
  webpChunk,
} from '../../helpers/webp-pixels';

const MAX_PIXELS = 4096 * 4096;

/** Deterministic pseudo-random bytes (mulberry32) */
function randomBytes(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  };
}

/** RGBA image from a per-pixel function */
function image(
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
function paletteImage(colors: number): RgbaPixels {
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

/** ARGB values as interleaved RGBA bytes */
function toRgba(pixels: Uint32Array): Uint8Array {
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
function firstTransform(stream: Uint8Array): number | null {
  const bits = stream[5] ?? 0;
  return (bits & 1) === 1 ? (bits >> 1) & 3 : null;
}

/** Decode with the built-in decoder and with libwebp, expect the same pixels */
async function expectSameAsLibwebp(webp: Uint8Array): Promise<void> {
  const reference = await decodeWithSharp(webp);
  if (!reference) throw new Error('reference decoder failed');
  const decoded = decodeVp8l(webpChunk(webp, 'VP8L'), {
    maxPixels: MAX_PIXELS,
  });

  expect(decoded.width).toBe(reference.width);
  expect(decoded.height).toBe(reference.height);
  // Compared as one value: a per-pixel diff of a megabyte is unreadable
  expect(
    Buffer.from(toRgba(decoded.pixels)).equals(Buffer.from(reference.data)),
  ).toBe(true);
}

describe('decodeVp8l - against libwebp', () => {
  const noise = randomBytes(1);
  const photoNoise = randomBytes(2);

  const pictures: [string, RgbaPixels][] = [
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

  for (const [name, picture] of pictures) {
    // Each effort level takes a different path through the encoder, so
    // the streams differ in transforms, color cache and code groups
    for (const effort of [0, 4, 6]) {
      it(`decodes ${name} (effort ${effort})`, async () => {
        await expectSameAsLibwebp(
          await encodeWebp(picture, { lossless: true, effort }),
        );
      });
    }
  }

  // Color indexing packs 8, 4 or 2 indexes into one value for tables of
  // up to 2, 4 and 16 colors, and stores one index per pixel above that
  for (const colors of [2, 3, 4, 5, 16, 17, 200]) {
    it(`decodes a picture of ${colors} colors through a color table`, async () => {
      const webp = await encodeWebp(paletteImage(colors), { lossless: true });

      expect(firstTransform(webpChunk(webp, 'VP8L'))).toBe(3);
      await expectSameAsLibwebp(webp);
    });
  }

  it('covers streams coded with prediction rather than a color table', async () => {
    const [, photo] = pictures[2] ?? [];
    if (!photo) throw new Error('missing picture');
    const webp = await encodeWebp(photo, { lossless: true });

    // Predictor, cross-color or subtract-green, whichever the encoder
    // put first: the photo-like picture does not go through a color table
    expect([0, 1, 2]).toContain(firstTransform(webpChunk(webp, 'VP8L')));
  });
});

describe('decodeVp8l - limits and malformed streams', () => {
  const picture = image(64, 64, (x, y) => [x * 4, y * 4, (x ^ y) * 4, 255]);

  async function validStream(): Promise<Uint8Array> {
    return webpChunk(await encodeWebp(picture, { lossless: true }), 'VP8L');
  }

  it('throws on an image larger than maxPixels', async () => {
    const stream = await validStream();

    expect(() => decodeVp8l(stream, { maxPixels: 64 * 64 - 1 })).toThrow(
      'image size out of range',
    );
    expect(decodeVp8l(stream, { maxPixels: 64 * 64 }).width).toBe(64);
  });

  it('throws before decoding when the header claims a huge image', () => {
    // 16384 x 16384, nothing after the header
    const stream = new Uint8Array([0x2f, 0xff, 0xff, 0xff, 0x0f, 0x00]);

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'image size out of range',
    );
  });

  it('throws on a wrong signature', async () => {
    const stream = await validStream();
    stream[0] = 0x2e;

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'invalid signature',
    );
  });

  it('throws on an unknown version', async () => {
    const stream = await validStream();
    stream[4] = (stream[4] ?? 0) | 0x20; // version bits are 29-31

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'unsupported version',
    );
  });

  it('throws on an empty stream', () => {
    expect(() =>
      decodeVp8l(new Uint8Array(0), { maxPixels: MAX_PIXELS }),
    ).toThrow();
  });

  it('throws on a stream cut short, wherever the cut falls', async () => {
    const stream = await validStream();

    for (const keep of [5, 6, 12, 40, 0.25, 0.5, 0.75, 0.95]) {
      const length = keep < 1 ? Math.floor(stream.length * keep) : keep;
      expect(
        () => decodeVp8l(stream.subarray(0, length), { maxPixels: MAX_PIXELS }),
        `cut at ${length} of ${stream.length} bytes`,
      ).toThrow();
    }
  });

  it('ends on a damaged stream, by throwing or with a full image', async () => {
    const stream = await validStream();
    const next = randomBytes(7);

    // Flip bytes all over the stream: whatever the damage, decoding must
    // end, either with an error or with pixels for the whole image
    for (let round = 0; round < 300; round++) {
      const damaged = stream.slice();
      for (let i = 0; i < 3; i++) {
        const at = 5 + (((next() << 8) | next()) % (damaged.length - 5));
        damaged[at] = next();
      }
      try {
        const decoded = decodeVp8l(damaged, { maxPixels: MAX_PIXELS });
        expect(decoded.pixels.length).toBe(decoded.width * decoded.height);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it('decodes a headerless stream with the given size', async () => {
    // The stream of an ALPH chunk: VP8L without the 5-byte image header.
    // Rebuilt here by moving the bits of a regular stream down by 40.
    const stream = await validStream();
    const headerless = stream.subarray(5);

    const decoded = decodeVp8l(headerless, {
      maxPixels: MAX_PIXELS,
      size: { width: 64, height: 64 },
    });

    expect(decoded.pixels).toEqual(
      decodeVp8l(stream, { maxPixels: MAX_PIXELS }).pixels,
    );
  });
});
