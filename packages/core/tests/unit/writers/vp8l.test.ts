import { describe, expect, it } from 'vitest';
import { decodeVp8l } from '../../../src/readers/vp8l';
import { encodeVp8l, rewriteVp8l } from '../../../src/writers/vp8l';
import {
  firstTransform,
  image,
  paletteImage,
  randomBytes,
  samplePictures,
  toArgb,
  toRgba,
} from '../../helpers/pictures';
import { createStealthRgbaPixels } from '../../helpers/stealth-images';
import {
  buildWebp,
  decodeWithSharp,
  encodeWebp,
  readWebpChunks,
  webpChunk,
} from '../../helpers/webp-pixels';

const MAX_PIXELS = 4096 * 4096;

type Edit = (pixels: Uint32Array, width: number, height: number) => void;

/**
 * Rewrite the lossless stream of a WebP for edited pixels, and expect both
 * the built-in decoder and libwebp to read exactly those pixels back
 *
 * @returns Size of the new stream relative to the original
 */
async function expectRewritten(webp: Uint8Array, edit: Edit): Promise<number> {
  const stream = webpChunk(webp, 'VP8L');
  const decoded = decodeVp8l(stream, { maxPixels: MAX_PIXELS, layout: true });
  if (!decoded.layout) throw new Error('no layout');
  const pixels = decoded.pixels.slice();
  edit(pixels, decoded.width, decoded.height);

  const rewritten = rewriteVp8l(stream, decoded.layout, decoded.height, pixels);

  // Compared as one value: a megabyte-sized diff is unreadable
  const wanted = Buffer.from(toRgba(pixels));
  const own = decodeVp8l(rewritten, { maxPixels: MAX_PIXELS });
  expect(Buffer.from(toRgba(own.pixels)).equals(wanted)).toBe(true);

  const file = buildWebp(
    readWebpChunks(webp).map((chunk) =>
      chunk.type === 'VP8L' ? { type: chunk.type, payload: rewritten } : chunk,
    ),
  );
  const reference = await decodeWithSharp(file);
  expect(Buffer.from(reference?.data ?? []).equals(wanted)).toBe(true);

  return rewritten.length / stream.length;
}

const unchanged: Edit = () => {};

describe('rewriteVp8l - unchanged pixels', () => {
  for (const [name, picture] of samplePictures()) {
    // Each effort level takes a different path through the encoder, so
    // the streams differ in transforms, color cache and code groups
    for (const effort of [0, 4, 6]) {
      it(`stores ${name} again (effort ${effort})`, async () => {
        await expectRewritten(
          await encodeWebp(picture, { lossless: true, effort }),
          unchanged,
        );
      });
    }
  }

  // Tables of up to 2, 4 and 16 colors pack several indexes into a value
  for (const colors of [2, 4, 16, 200]) {
    it(`stores a picture of ${colors} colors again through its color table`, async () => {
      const webp = await encodeWebp(paletteImage(colors), { lossless: true });
      expect(firstTransform(webpChunk(webp, 'VP8L'))).toBe(3);

      await expectRewritten(webp, unchanged);
    });
  }

  it('stays the size of the original', async () => {
    const [, photo] = samplePictures()[2] ?? [];
    if (!photo) throw new Error('missing picture');
    const webp = await encodeWebp(photo, { lossless: true });

    // Only the prefix codes are built anew, from the same symbol counts
    const ratio = await expectRewritten(webp, unchanged);

    expect(ratio).toBeGreaterThan(0.99);
    expect(ratio).toBeLessThan(1.01);
  });
});

describe('rewriteVp8l - edited pixels', () => {
  const PAYLOAD =
    'masterpiece, 1girl\nNegative prompt: lowres\n' +
    'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

  it('stores an alpha channel made opaque', async () => {
    const webp = await encodeWebp(
      createStealthRgbaPixels({ payload: PAYLOAD, width: 64, height: 64 }),
      { lossless: true },
    );

    await expectRewritten(webp, (pixels) => {
      expect(pixels.some((argb) => argb >>> 24 === 254)).toBe(true);
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = ((pixels[i] ?? 0) | 0xff000000) >>> 0;
      }
    });
  });

  it('stores cleared low color bits', async () => {
    const webp = await encodeWebp(
      createStealthRgbaPixels({
        payload: PAYLOAD,
        mode: 'rgb',
        width: 64,
        height: 64,
      }),
      { lossless: true },
    );

    await expectRewritten(webp, (pixels, width, height) => {
      // The first six columns, where the payload sits
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < 6; x++) {
          const at = y * width + x;
          pixels[at] = ((pixels[at] ?? 0) & 0xfffefefe) >>> 0;
        }
      }
    });
  });

  it('spells out backward references that no longer hold', async () => {
    // The lower half repeats the upper half, so an encoder stores it as
    // references 40 rows back; with too many colors for a color table.
    // Each pixel changed down there breaks the reference covering it.
    const webp = await encodeWebp(
      image(100, 80, (x, y) => {
        const row = y % 40;
        return [
          (x * 7 + row * 13) & 0xff,
          (x * 3 + row * 29) & 0xff,
          ((x ^ row) * 11) & 0xff,
          255,
        ];
      }),
      { lossless: true },
    );
    expect(firstTransform(webpChunk(webp, 'VP8L'))).not.toBe(3);

    const ratio = await expectRewritten(webp, (pixels, width) => {
      for (const [x, y] of [
        [0, 40],
        [35, 55],
        [99, 60],
        [1, 79],
        [99, 79],
      ]) {
        pixels[(y ?? 0) * width + (x ?? 0)] = 0xff123456;
      }
    });

    // The pixels a broken reference covered are now spelled one by one
    expect(ratio).toBeGreaterThan(1);
  });

  for (const effort of [0, 4, 6]) {
    it(`stores edits scattered over a photo-like picture (effort ${effort})`, async () => {
      const [, photo] = samplePictures()[2] ?? [];
      if (!photo) throw new Error('missing picture');
      const webp = await encodeWebp(photo, { lossless: true, effort });
      const next = randomBytes(effort + 40);

      const ratio = await expectRewritten(webp, (pixels) => {
        for (let i = 0; i < 300; i++) {
          const at = ((next() << 8) | next()) % pixels.length;
          pixels[at] = ((pixels[at] ?? 0) ^ (1 << (next() % 24))) >>> 0;
        }
      });

      // 300 of 30,000 pixels changed: the stream grows by little
      expect(ratio).toBeLessThan(1.1);
    });
  }

  it('stores a translucent picture with a few alpha bits set', async () => {
    const [, ramp] = samplePictures()[4] ?? [];
    if (!ramp) throw new Error('missing picture');
    const webp = await encodeWebp(ramp, { lossless: true });

    await expectRewritten(webp, (pixels, width, height) => {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < 3; x++) {
          const at = y * width + x;
          pixels[at] = ((pixels[at] ?? 0) | 0x01000000) >>> 0;
        }
      }
    });
  });

  it('stores a color table picture whose pixels move within the table', async () => {
    const webp = await encodeWebp(paletteImage(16), { lossless: true });

    await expectRewritten(webp, (pixels) => {
      // Every pixel takes the color of the one before it
      for (let i = pixels.length - 1; i > 0; i--) {
        pixels[i] = pixels[i - 1] ?? 0;
      }
    });
  });

  it('refuses a color that the color table of the stream does not hold', async () => {
    // The table is part of what is copied from the original
    const stream = webpChunk(
      await encodeWebp(paletteImage(16), { lossless: true }),
      'VP8L',
    );
    const decoded = decodeVp8l(stream, { maxPixels: MAX_PIXELS, layout: true });
    if (!decoded.layout) throw new Error('no layout');
    const { layout, height } = decoded;
    const pixels = decoded.pixels.slice();
    pixels[0] = ((pixels[0] ?? 0) ^ 0x00010000) >>> 0;

    expect(() => rewriteVp8l(stream, layout, height, pixels)).toThrow(
      'edited color is not in the color table',
    );
  });
});

describe('encodeVp8l', () => {
  /** Encode plainly and expect both decoders to read the pixels back */
  async function expectEncoded(
    width: number,
    height: number,
    pixels: Uint32Array,
  ): Promise<Uint8Array> {
    const stream = encodeVp8l(width, height, pixels);

    const own = decodeVp8l(stream, { maxPixels: MAX_PIXELS });
    expect(own).toMatchObject({ width, height });
    expect(
      Buffer.from(toRgba(own.pixels)).equals(Buffer.from(toRgba(pixels))),
    ).toBe(true);
    const reference = await decodeWithSharp(
      buildWebp([{ type: 'VP8L', payload: stream }]),
    );
    expect(
      Buffer.from(reference?.data ?? []).equals(Buffer.from(toRgba(pixels))),
    ).toBe(true);
    return stream;
  }

  for (const [name, picture] of samplePictures()) {
    it(`encodes ${name}`, async () => {
      await expectEncoded(picture.width, picture.height, toArgb(picture.data));
    });
  }

  it('encodes a picture of few colors', async () => {
    const picture = paletteImage(16);

    await expectEncoded(picture.width, picture.height, toArgb(picture.data));
  });

  it('stores runs of one color as references, however long', async () => {
    // 20,000 pixels in two colors: runs far past the 4,096 pixels one
    // reference can cover
    const pixels = new Uint32Array(200 * 100).fill(0xff336699);
    pixels.fill(0x80112233, 12_345);

    const stream = await expectEncoded(200, 100, pixels);

    expect(stream.length).toBeLessThan(64);
  });

  it('writes a stream without the image header for an alpha plane', () => {
    const picture = paletteImage(4);
    const pixels = toArgb(picture.data);
    const size = { width: picture.width, height: picture.height };

    const stream = encodeVp8l(size.width, size.height, pixels, false);

    expect(stream[0]).not.toBe(0x2f);
    const decoded = decodeVp8l(stream, { maxPixels: MAX_PIXELS, size });
    expect(decoded.pixels).toEqual(pixels);
  });
});
