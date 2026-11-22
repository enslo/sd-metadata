import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { write } from '../../../src/api/write';
import {
  decodePngPixels,
  MAX_PIXEL_BYTES,
  type PixelData,
} from '../../../src/readers/stealth';
import { decodeWebpPixels } from '../../../src/readers/webp-pixels';
import { strip } from '../../../src/strip';
import { clearStealth } from '../../../src/writers/stealth';
import { loadSample, loadVendorSample } from '../../helpers/samples';
import { decodeWithSharp, encodeWebp } from '../../helpers/webp-pixels';

/**
 * strip() end to end on real files: the result is read back with parse()
 * and its pixels with the reference decoder.
 *
 * Stripping a megapixel image decodes it, stores it again and re-reads
 * it, which takes seconds on a two-core CI runner, so this runs on one
 * sample per path through strip(). Its halves are checked on every sample
 * where that is cheap:
 *
 * - clearing decoded pixels, on all stealth samples:
 *   tests/samples/writers/stealth.test.ts
 * - which container blocks go, on all samples:
 *   tests/samples/writers/essentials.test.ts
 * - storing a lossless WebP stream again, on one sample per kind of
 *   stream: tests/samples/writers/vp8l.test.ts
 */

// Recompressing a large image takes seconds on a slow machine
const TIMEOUT = { timeout: 30_000 };

function emptyWrite(image: Uint8Array): Uint8Array {
  const written = write(image, { status: 'empty' });
  if (!written.ok) throw new Error(written.error.type);
  return written.value;
}

async function rgbaOf(image: Uint8Array): Promise<Buffer> {
  const decoded = await decodeWithSharp(image);
  if (!decoded) throw new Error('reference decoder failed');
  return Buffer.from(decoded.data);
}

/** Decoded pixels as RGBA bytes: an RGB image is opaque */
function toRgba({ channels, pixels }: PixelData): Buffer {
  if (channels === 4) return Buffer.from(pixels);
  const rgba = Buffer.alloc((pixels.length / 3) * 4, 255);
  for (let i = 0, out = 0; i < pixels.length; i += 3, out += 4) {
    rgba.set(pixels.subarray(i, i + 3), out);
  }
  return rgba;
}

describe('strip - stealth samples', TIMEOUT, () => {
  /** What the original decodes to, with its stealth data cleared */
  async function clearedPixels(
    format: 'png' | 'webp',
    original: Uint8Array,
  ): Promise<Buffer> {
    const image =
      format === 'png'
        ? await decodePngPixels(original)
        : decodeWebpPixels(original, MAX_PIXEL_BYTES);
    if (!image || typeof image === 'string') throw new Error('not decoded');
    clearStealth(image);
    return toRgba(image);
  }

  // NovelAI's alpha payload in a PNG, the ComfyUI node's RGB payload of a
  // whole workflow in a PNG, and NovelAI's alpha payload in a lossless WebP
  const samples: ['png' | 'webp', string][] = [
    ['png', 'novelai-full.png'],
    ['png', 'comfyui-stealth-rgb-raw.png'],
    ['webp', 'novelai-curated.webp'],
  ];

  for (const [format, filename] of samples) {
    it(`takes the stealth data out of the file: ${filename}`, async () => {
      const original = loadSample(format, filename);
      // An empty write leaves the copy in the pixels
      const emptied = await parse(emptyWrite(original));
      expect(emptied.status === 'success' && emptied.stealth).toBe(true);

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: true });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');

      // The file holds the cleared pixels, as the reference decoder
      // reads them
      expect(
        (await rgbaOf(result.value)).equals(
          await clearedPixels(format, original),
        ),
      ).toBe(true);
      // Stored the way the original was: about the same size
      expect(result.value.length).toBeLessThan(original.length * 1.05);
    });
  }

  it('takes the stealth data out of a lossy re-save: novelai-full.png as WebP', async () => {
    // Re-saved as a lossy WebP, the picture keeps its alpha plane
    // lossless, and the payload with it. The plane is all the picture
    // has of alpha, so clearing it leaves nothing to store.
    const pixels = await decodeWithSharp(loadSample('png', 'novelai-full.png'));
    if (!pixels) throw new Error('reference decoder failed');
    const webp = await encodeWebp(pixels, { quality: 80 });
    const before = await parse(webp);
    expect(before.status === 'success' && before.stealth).toBe(true);

    const result = await strip(webp);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    expect(result.warning).toBeUndefined();
    expect((await parse(result.value)).status).toBe('empty');
    const expected = await rgbaOf(webp);
    for (let i = 3; i < expected.length; i += 4) {
      expected[i] = 255;
    }
    expect((await rgbaOf(result.value)).equals(expected)).toBe(true);
  });
});

describe('strip - samples without stealth data', TIMEOUT, () => {
  // The metadata goes and the picture stays exactly what it was. One
  // sample per container: text and EXIF chunks in a PNG, EXIF in a JPEG
  // and in a lossless WebP.
  const samples: ['png' | 'jpg' | 'webp', string][] = [
    ['png', 'dezgo.png'],
    ['jpg', 'civitai-hires.jpg'],
    ['webp', 'dezgo.webp'],
  ];

  for (const [format, filename] of samples) {
    it(`removes the metadata and keeps the pixels: ${filename}`, async () => {
      const original = loadSample(format, filename);
      expect((await parse(original)).status).toBe('success');

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: false });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');
      expect(result.value.length).toBeLessThan(original.length);
      expect((await rgbaOf(result.value)).equals(await rgbaOf(original))).toBe(
        true,
      );
    });
  }
});

describe('strip - vendor samples', TIMEOUT, () => {
  // Pictures from commercial services declare their origin in a C2PA
  // manifest or in XMP. An empty write only drops what it manages, so
  // the manifest stays and the picture still parses as a vendor's;
  // strip() keeps nothing but the image.
  const samples: ['jpg' | 'webp', string, boolean][] = [
    ['jpg', 'gemini_3.1pro-latest.jpg', true],
    ['webp', 'muse.webp', false],
  ];

  for (const [format, filename, manifest] of samples) {
    it(`removes the vendor's declaration and keeps the pixels: ${filename}`, async () => {
      const original = loadVendorSample(format, filename);
      expect((await parse(original)).status).toBe('vendor');
      if (manifest) {
        expect((await parse(emptyWrite(original))).status).toBe('vendor');
      }

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: false });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');
      expect((await rgbaOf(result.value)).equals(await rgbaOf(original))).toBe(
        true,
      );
    });
  }
});
