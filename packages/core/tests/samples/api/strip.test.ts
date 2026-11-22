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
import { writePngPixels } from '../../../src/writers/png-pixels';
import { clearStealth } from '../../../src/writers/stealth';
import {
  loadSample,
  loadVendorSample,
  STEALTH_WEBP_SAMPLES,
} from '../../helpers/samples';
import { decodeWithSharp, encodeWebp } from '../../helpers/webp-pixels';

/**
 * strip() end to end on real files: the result is read back with parse()
 * and its pixels with the reference decoder.
 *
 * Stripping a megapixel PNG decodes it, compresses it again and re-reads
 * it, so this runs on one sample per kind. The two halves are checked on
 * every sample where that is cheap: clearing decoded pixels in
 * tests/samples/writers/stealth.test.ts, and which container blocks go in
 * tests/samples/writers/essentials.test.ts.
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

async function pixelsOf(png: Uint8Array) {
  const image = await decodePngPixels(png);
  if (typeof image === 'string') throw new Error(image);
  return image;
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

describe('strip - stealth PNG samples', TIMEOUT, () => {
  // One per way stealth data gets into a PNG: NovelAI's own (alpha), the
  // WebUI extension in alpha mode, the ComfyUI node in RGB mode with a
  // whole workflow as payload, and the extension on an RGB PNG
  const samples = [
    'novelai-full.png',
    'forge-stealth-alpha-comp.png',
    'comfyui-stealth-rgb-raw.png',
    'forge-classic-lora.png',
  ];

  for (const filename of samples) {
    it(`takes the stealth data out of the file: ${filename}`, async () => {
      const original = loadSample('png', filename);
      // An empty write leaves the copy in the pixels
      const emptied = await parse(emptyWrite(original));
      expect(emptied.status === 'success' && emptied.stealth).toBe(true);

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: true });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');

      // The file holds the cleared pixels, as libpng reads them
      const cleared = await pixelsOf(original);
      clearStealth(cleared);
      expect((await rgbaOf(result.value)).equals(toRgba(cleared))).toBe(true);
      // Recompressed with the original filter types: about the same size
      expect(result.value.length).toBeLessThan(original.length * 1.05);
    });
  }

  it('removes what a painted-over header leaves in a picture with alpha values of its own: novelai-v5-full.png', async () => {
    // This sample is not opaque everywhere: nine pixels in the middle of
    // the picture have alpha between 239 and 253, far from the payload
    // in its first columns. "Opaque but for 254s" therefore cannot be
    // asked of the whole picture, only of the run it opens with.
    const original = loadSample('png', 'novelai-v5-full.png');
    const image = await pixelsOf(original);
    const ownAlpha = image.pixels.filter((v, i) => i % 4 === 3 && v < 254);
    expect(ownAlpha).toHaveLength(9);

    // The magic sits in the first 120 pixels of the first column
    for (let y = 0; y < 120; y++) {
      image.pixels[y * image.width * 4 + 3] = 255;
    }
    const damaged = await writePngPixels(original, image);
    // No reader finds the payload now, though all of it is still there
    expect((await parse(emptyWrite(damaged))).status).toBe('empty');

    const result = await strip(damaged);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    const alpha = (await rgbaOf(result.value)).filter((_, i) => i % 4 === 3);
    expect(alpha).not.toContain(254);
    expect(alpha.filter((v) => v < 254)).toEqual(Buffer.from(ownAlpha));
  });
});

describe('strip - stealth WebP samples', TIMEOUT, () => {
  // NovelAI's lossless WebP exports carry the payload in alpha, like its
  // PNGs. The image stream is rewritten rather than encoded anew, so the
  // file does not grow.
  for (const filename of STEALTH_WEBP_SAMPLES) {
    it(`takes the stealth data out of the file: ${filename}`, async () => {
      const original = loadSample('webp', filename);
      // An empty write leaves the copy in the pixels
      const emptied = await parse(emptyWrite(original));
      expect(emptied.status === 'success' && emptied.stealth).toBe(true);

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: true });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');

      // The file holds the cleared pixels, as libwebp reads them
      const cleared = decodeWebpPixels(original, MAX_PIXEL_BYTES);
      if (!cleared) throw new Error('not decoded');
      clearStealth(cleared);
      expect((await rgbaOf(result.value)).equals(toRgba(cleared))).toBe(true);
      expect(result.value.length).toBeLessThan(original.length);
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
  // sample per container and kind of metadata: text and EXIF in a PNG,
  // EXIF in a JPEG, EXIF in a lossless and in a lossy WebP.
  const samples: ['png' | 'jpg' | 'webp', string][] = [
    ['png', 'civitai-lora-hires.png'],
    ['jpg', 'civitai-hires.jpg'],
    ['webp', 'comfyui-animated-webp.webp'],
    ['webp', 'comfyui-save-image-extended.webp'],
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
  // manifest (a PNG chunk, a JPEG segment) or in XMP. An empty write
  // only drops what it manages, so the manifest stays and the picture
  // still parses as a vendor's; strip() keeps nothing but the image.
  const samples: ['png' | 'jpg' | 'webp', string, boolean][] = [
    ['png', 'chatgpt-image2.png', true],
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
