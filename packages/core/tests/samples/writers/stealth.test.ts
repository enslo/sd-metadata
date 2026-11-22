import { describe, expect, it } from 'vitest';
import {
  decodePngPixels,
  locateStealth,
  MAX_PIXEL_BYTES,
  type PixelData,
  scanDecodedPixels,
} from '../../../src/readers/stealth';
import { decodeWebpPixels } from '../../../src/readers/webp-pixels';
import { clearStealth } from '../../../src/writers/stealth';
import {
  loadSample,
  STEALTH_ALPHA_PNG_SAMPLES,
  STEALTH_RGB_PNG_SAMPLES,
  STEALTH_WEBP_SAMPLES,
} from '../../helpers/samples';

/**
 * clearStealth on the decoded pixels of every sample that carries stealth
 * data: the payload is found, cleared, and no pixel outside it changes.
 *
 * This is the part of strip() that depends on what real tools write. The
 * pixels are compared before they are compressed again, which keeps the
 * check to a decode per sample; writing them back into a file is covered
 * on one sample per kind in tests/samples/api/strip.test.ts.
 */

async function pngPixels(filename: string): Promise<PixelData> {
  const image = await decodePngPixels(loadSample('png', filename));
  if (typeof image === 'string') throw new Error(`${filename}: ${image}`);
  return image;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

/** Clear the image and expect only the 254s of its alpha to have changed */
async function expectAlphaCleared(image: PixelData): Promise<void> {
  const before = image.pixels.slice();
  expect(await scanDecodedPixels(image)).not.toBeNull();

  expect(clearStealth(image)).toBe(true);

  expect(await scanDecodedPixels(image)).toBeNull();
  expect(locateStealth(image)).toEqual([]);
  // Every 254, a zero bit of the payload, is 255 again. The colors are
  // untouched, and so is any other alpha value.
  const expected = before.map((value, i) =>
    i % 4 === 3 && value === 254 ? 255 : value,
  );
  expect(same(image.pixels, expected)).toBe(true);
}

describe('clearStealth - PNG samples', () => {
  it('knows every carrier among the samples', () => {
    expect(STEALTH_ALPHA_PNG_SAMPLES).toHaveLength(12);
    expect(STEALTH_RGB_PNG_SAMPLES).toHaveLength(6);
  });

  for (const filename of STEALTH_ALPHA_PNG_SAMPLES) {
    it(`makes the payload pixels opaque and keeps the colors: ${filename}`, async () => {
      await expectAlphaCleared(await pngPixels(filename));
    });
  }

  for (const filename of STEALTH_RGB_PNG_SAMPLES) {
    it(`clears the low color bits of the payload pixels only: ${filename}`, async () => {
      const image = await pngPixels(filename);
      const { width, height, channels } = image;
      const before = image.pixels.slice();
      const [location] = locateStealth(image);
      if (!location) throw new Error('no payload located');

      expect(clearStealth(image)).toBe(true);

      expect(await scanDecodedPixels(image)).toBeNull();
      // The payload runs down the first columns, three bits a pixel
      const expected = before.slice();
      for (let i = 0; i < Math.ceil(location.bits / 3); i++) {
        const at = ((i % height) * width + Math.floor(i / height)) * channels;
        for (let channel = 0; channel < 3; channel++) {
          expected[at + channel] = (expected[at + channel] ?? 0) & 0xfe;
        }
      }
      expect(same(image.pixels, expected)).toBe(true);
    });
  }
});

describe('clearStealth - a payload whose header is gone', () => {
  it('clears what is left in a picture with alpha values of its own: novelai-v5-full.png', async () => {
    // This sample is not opaque everywhere: nine pixels in the middle of
    // the picture have alpha between 239 and 253, far from the payload
    // in its first columns. "Opaque but for 254s" therefore cannot be
    // asked of the whole picture, only of the run it opens with.
    const image = await pngPixels('novelai-v5-full.png');
    const ownAlpha = image.pixels.filter((v, i) => i % 4 === 3 && v < 254);
    expect(ownAlpha).toHaveLength(9);

    // Paint over the magic: the first 120 pixels of the first column
    for (let y = 0; y < 120; y++) {
      image.pixels[y * image.width * 4 + 3] = 255;
    }
    // No reader finds the payload now, though the rest of it is there
    expect(await scanDecodedPixels(image)).toBeNull();
    expect(locateStealth(image)).toEqual([]);
    expect(
      image.pixels.filter((v, i) => i % 4 === 3 && v === 254),
    ).not.toHaveLength(0);

    expect(clearStealth(image)).toBe(true);

    const alpha = image.pixels.filter((_, i) => i % 4 === 3);
    expect(alpha).not.toContain(254);
    expect(alpha.filter((v) => v < 254)).toEqual(ownAlpha);
  });
});

describe('clearStealth - WebP samples', () => {
  // NovelAI's lossless WebP exports carry the same alpha payload
  for (const filename of STEALTH_WEBP_SAMPLES) {
    it(`makes the payload pixels opaque and keeps the colors: ${filename}`, async () => {
      const image = decodeWebpPixels(
        loadSample('webp', filename),
        MAX_PIXEL_BYTES,
      );
      if (!image) throw new Error(`${filename}: not decoded`);

      await expectAlphaCleared(image);
    });
  }
});
