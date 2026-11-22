import { describe, expect, it } from 'vitest';
import type { PixelData } from '../../../src/readers/stealth';
import type { RgbaPixels } from '../../../src/types';
import { clearStealth } from '../../../src/writers/stealth';
import { rewriteWebpPixels } from '../../../src/writers/webp-pixels';
import { ascii } from '../../helpers/containers';
import { createMinimalWebp } from '../../helpers/minimal-images';
import { firstTransform, image, paletteImage } from '../../helpers/pictures';
import { createStealthRgbaPixels } from '../../helpers/stealth-images';
import {
  buildWebp,
  decodeWithSharp,
  encodeWebp,
  readWebpChunks,
  webpChunk,
} from '../../helpers/webp-pixels';

const MAX_BYTES = 64 * 1024 * 1024;
const PAYLOAD =
  'masterpiece, 1girl\nNegative prompt: lowres\n' +
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

function stealthPixels(mode: 'alpha' | 'rgb' = 'alpha'): RgbaPixels {
  return createStealthRgbaPixels({
    payload: PAYLOAD,
    mode,
    width: 64,
    height: 64,
  });
}

/** A translucent 60x40 picture with many alpha values */
function translucent(): RgbaPixels {
  return image(60, 40, (x, y) => [x * 4, y * 6, (x * y) & 0xff, 40 + x * 3]);
}

/** Pixels of a file as libwebp decodes them, RGBA */
async function rgbaOf(file: Uint8Array): Promise<Uint8Array> {
  const decoded = await decodeWithSharp(file);
  if (!decoded) throw new Error('reference decoder failed');
  return new Uint8Array(decoded.data);
}

/** The rewritten file, failing the test when there is none */
function rewritten(
  webp: Uint8Array,
  edit: (image: PixelData) => boolean,
): Uint8Array {
  const result = rewriteWebpPixels(webp, MAX_BYTES, edit);
  if (typeof result === 'string') throw new Error(`not rewritten: ${result}`);
  return result;
}

const types = (webp: Uint8Array) => readWebpChunks(webp).map((c) => c.type);

describe('rewriteWebpPixels - lossless images', () => {
  it('writes cleared alpha bits back', async () => {
    const webp = await encodeWebp(stealthPixels(), { lossless: true });
    const before = await rgbaOf(webp);
    expect(before.filter((_, i) => i % 4 === 3)).toContain(254);

    const result = rewritten(webp, clearStealth);

    expect(await rgbaOf(result)).toEqual(
      before.map((value, i) => (i % 4 === 3 ? 255 : value)),
    );
    expect(types(result)).toEqual(types(webp));
  });

  it('writes cleared color bits back', async () => {
    const webp = await encodeWebp(stealthPixels('rgb'), { lossless: true });
    const before = await rgbaOf(webp);

    const result = rewritten(webp, clearStealth);

    const after = await rgbaOf(result);
    expect(after).not.toEqual(before);
    // Each value is what it was, or its low bit cleared
    expect(
      after.every((v, i) => v === before[i] || v === (before[i] ?? 0) - 1),
    ).toBe(true);
  });

  it('hands the edit RGBA pixels and stores whatever it does to them', async () => {
    const webp = await encodeWebp(translucent(), { lossless: true });
    const before = await rgbaOf(webp);

    const result = rewritten(webp, (picture) => {
      expect(picture).toMatchObject({ width: 60, height: 40, channels: 4 });
      expect(picture.pixels).toEqual(before);
      picture.pixels[0] = (picture.pixels[0] ?? 0) ^ 0x80;
      picture.pixels[picture.pixels.length - 1] = 7;
      return true;
    });

    const expected = before.slice();
    expected[0] = (expected[0] ?? 0) ^ 0x80;
    expected[expected.length - 1] = 7;
    expect(await rgbaOf(result)).toEqual(expected);
  });

  it('keeps the chunks around the image', async () => {
    const lossless = await encodeWebp(stealthPixels(), { lossless: true });
    const webp = buildWebp([
      {
        type: 'VP8X',
        payload: Uint8Array.of(0x18, 0, 0, 0, 63, 0, 0, 63, 0, 0),
      },
      { type: 'VP8L', payload: webpChunk(lossless, 'VP8L') },
      { type: 'EXIF', payload: ascii('kept as it is') },
    ]);

    const result = rewritten(webp, clearStealth);

    const [header, , exif] = readWebpChunks(result);
    expect(types(result)).toEqual(['VP8X', 'VP8L', 'EXIF']);
    expect(header?.payload).toEqual(readWebpChunks(webp)[0]?.payload);
    expect(exif?.payload).toEqual(ascii('kept as it is'));
  });

  it('encodes the image afresh when its color table lacks an edited color', async () => {
    // A picture of 16 colors is stored through a color table, which is
    // part of what a rewrite copies: a seventeenth color cannot go in
    const webp = await encodeWebp(paletteImage(16), { lossless: true });
    expect(firstTransform(webpChunk(webp, 'VP8L'))).toBe(3);
    const before = await rgbaOf(webp);

    const result = rewritten(webp, (picture) => {
      picture.pixels.set([1, 2, 3, 255], 0);
      return true;
    });

    const expected = before.slice();
    expected.set([1, 2, 3, 255], 0);
    expect(await rgbaOf(result)).toEqual(expected);
    // No transform at all in the new stream
    expect(firstTransform(webpChunk(result, 'VP8L'))).toBeNull();
  });

  it('returns unchanged when the edit leaves the pixels alone', async () => {
    const webp = await encodeWebp(translucent(), { lossless: true });

    expect(rewriteWebpPixels(webp, MAX_BYTES, () => false)).toBe('unchanged');
  });

  it('returns undecodable for an image that does not decode', () => {
    const webp = buildWebp([
      { type: 'VP8L', payload: Uint8Array.of(0x2f, 1, 2, 3, 4, 5, 6, 7) },
    ]);

    expect(rewriteWebpPixels(webp, MAX_BYTES, () => true)).toBe('undecodable');
  });

  it('returns undecodable for an image past the size limit', async () => {
    const webp = await encodeWebp(translucent(), { lossless: true });

    expect(rewriteWebpPixels(webp, 60 * 40 * 4 - 1, () => true)).toBe(
      'undecodable',
    );
  });
});

describe('rewriteWebpPixels - lossy images', () => {
  /** Alpha channel of a file as libwebp decodes it */
  async function alphaOf(file: Uint8Array): Promise<Uint8Array> {
    return (await rgbaOf(file)).filter((_, i) => i % 4 === 3);
  }

  /** Color channels of a file as libwebp decodes it */
  async function colorsOf(file: Uint8Array): Promise<Uint8Array> {
    return (await rgbaOf(file)).filter((_, i) => i % 4 !== 3);
  }

  it('drops the alpha plane when the edit leaves it opaque', async () => {
    const webp = await encodeWebp(stealthPixels(), { quality: 80 });
    expect(types(webp)).toEqual(['VP8X', 'ALPH', 'VP8 ']);

    const result = rewritten(webp, clearStealth);

    expect(types(result)).toEqual(['VP8X', 'VP8 ']);
    // The header no longer announces alpha
    expect((readWebpChunks(result)[0]?.payload[0] ?? 0) & 0x10).toBe(0);
    expect(new Set(await alphaOf(result))).toEqual(new Set([255]));
    // The lossy color data is the very same chunk
    expect(webpChunk(result, 'VP8 ')).toEqual(webpChunk(webp, 'VP8 '));
  });

  it('hands the edit the alpha plane alone', async () => {
    const webp = await encodeWebp(translucent(), { quality: 80 });
    const alpha = await alphaOf(webp);

    const result = rewriteWebpPixels(webp, MAX_BYTES, (plane) => {
      expect(plane).toMatchObject({ width: 60, height: 40, channels: 1 });
      expect(plane.pixels).toEqual(alpha);
      return false;
    });

    expect(result).toBe('unchanged');
  });

  it('rewrites the plane through its own stream when the values fit', async () => {
    const webp = await encodeWebp(translucent(), { quality: 80 });
    const alpha = await alphaOf(webp);
    const colors = await colorsOf(webp);

    // Every value moves one pixel on: all of them are values the plane
    // already had
    const result = rewritten(webp, (plane) => {
      plane.pixels.copyWithin(1, 0);
      return true;
    });

    expect(await alphaOf(result)).toEqual(alpha.slice().copyWithin(1, 0));
    expect(await colorsOf(result)).toEqual(colors);
    expect(types(result)).toEqual(['VP8X', 'ALPH', 'VP8 ']);
  });

  it('encodes the plane afresh when its stream cannot take a new value', async () => {
    const webp = await encodeWebp(translucent(), { quality: 80 });
    const alpha = await alphaOf(webp);
    // 41 lies between the values of the ramp, which goes in steps of 3
    expect(alpha).not.toContain(41);

    const result = rewritten(webp, (plane) => {
      plane.pixels[5] = 41;
      return true;
    });

    const expected = alpha.slice();
    expected[5] = 41;
    expect(await alphaOf(result)).toEqual(expected);
    expect(await colorsOf(result)).toEqual(await colorsOf(webp));
  });

  for (const [filter, name] of [
    [1, 'horizontal'],
    [2, 'vertical'],
    [3, 'gradient'],
  ] as const) {
    it(`stores a plane that had a ${name} filter without one`, async () => {
      // No encoder at hand filters the plane, so the filter bits of a
      // real chunk are set by hand; libwebp says what it then holds
      const lossy = await encodeWebp(translucent(), { quality: 80 });
      const webp = buildWebp(
        readWebpChunks(lossy).map((chunk) => {
          if (chunk.type !== 'ALPH') return chunk;
          const payload = chunk.payload.slice();
          payload[0] = (payload[0] ?? 0) | (filter << 2);
          return { type: chunk.type, payload };
        }),
      );
      const alpha = await alphaOf(webp);

      const result = rewritten(webp, (plane) => {
        plane.pixels[0] = (plane.pixels[0] ?? 0) ^ 1;
        return true;
      });

      const expected = alpha.slice();
      expected[0] = (expected[0] ?? 0) ^ 1;
      expect(await alphaOf(result)).toEqual(expected);
      // Compressed, unfiltered
      expect(webpChunk(result, 'ALPH')[0]).toBe(0x01);
    });
  }

  it('returns undecodable for an alpha plane that does not decode', async () => {
    const lossy = await encodeWebp(translucent(), { quality: 80 });
    const webp = buildWebp(
      readWebpChunks(lossy).map((chunk) =>
        chunk.type === 'ALPH'
          ? { type: chunk.type, payload: Uint8Array.of(0x02, 1, 2, 3) }
          : chunk,
      ),
    );

    expect(rewriteWebpPixels(webp, MAX_BYTES, () => true)).toBe('undecodable');
  });
});

describe('rewriteWebpPixels - files without losslessly stored pixels', () => {
  const never = () => {
    throw new Error('the edit must not be called');
  };

  it('returns unchanged for a lossy image without alpha', async () => {
    const opaque = image(60, 40, (x, y) => [x * 4, y * 6, 90, 255]);
    const webp = await encodeWebp(opaque, { quality: 80 });

    expect(rewriteWebpPixels(webp, MAX_BYTES, never)).toBe('unchanged');
    expect(rewriteWebpPixels(createMinimalWebp(), MAX_BYTES, never)).toBe(
      'unchanged',
    );
  });

  it('returns unchanged for an animation', async () => {
    const lossless = await encodeWebp(translucent(), { lossless: true });
    const webp = buildWebp([
      {
        type: 'VP8X',
        payload: Uint8Array.of(0x12, 0, 0, 0, 59, 0, 0, 39, 0, 0),
      },
      { type: 'VP8L', payload: webpChunk(lossless, 'VP8L') },
    ]);

    expect(rewriteWebpPixels(webp, MAX_BYTES, never)).toBe('unchanged');
  });

  it('returns unchanged for data that is not a WebP', () => {
    expect(rewriteWebpPixels(Uint8Array.of(1, 2, 3, 4), MAX_BYTES, never)).toBe(
      'unchanged',
    );
  });
});
