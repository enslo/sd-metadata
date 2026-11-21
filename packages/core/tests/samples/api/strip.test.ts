import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { write } from '../../../src/api/write';
import { decodePngPixels, locateStealth } from '../../../src/readers/stealth';
import { strip } from '../../../src/strip';
import { writePngPixels } from '../../../src/writers/png-pixels';
import {
  loadSample,
  loadVendorSample,
  STEALTH_ALPHA_PNG_SAMPLES,
  STEALTH_RGB_PNG_SAMPLES,
  STEALTH_WEBP_SAMPLES,
  VENDOR_SAMPLES,
} from '../../helpers/samples';
import { decodeWithSharp } from '../../helpers/webp-pixels';

// The samples that carry stealth data; those without are covered in
// strip-untouched.test.ts

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

// Each strip here decodes, recompresses and re-reads a megapixel image.
// Much of that runs off the main thread (zlib streams, the reference
// decoder), so the tests of a group run side by side.
describe.concurrent('strip - stealth PNG samples', () => {
  it('knows every carrier among the samples', () => {
    expect(STEALTH_ALPHA_PNG_SAMPLES).toHaveLength(12);
    expect(STEALTH_RGB_PNG_SAMPLES).toHaveLength(6);
  });

  for (const filename of STEALTH_ALPHA_PNG_SAMPLES) {
    it(`makes the payload pixels opaque and keeps the colors: ${filename}`, async () => {
      const original = loadSample('png', filename);
      // An empty write leaves the copy in the pixels
      const emptied = await parse(emptyWrite(original));
      expect(emptied.status === 'success' && emptied.stealth).toBe(true);

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: true });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');

      // Every 254, a zero bit of the payload, is 255 again. The colors
      // are untouched, and so is any other alpha value.
      const expected = await rgbaOf(original);
      for (let i = 3; i < expected.length; i += 4) {
        if (expected[i] === 254) expected[i] = 255;
      }
      expect((await rgbaOf(result.value)).equals(expected)).toBe(true);
      // Recompressed with the original filter types: about the same size
      expect(result.value.length).toBeLessThan(original.length * 1.05);
    });
  }

  for (const filename of STEALTH_RGB_PNG_SAMPLES) {
    it(`clears the low color bits of the payload pixels only: ${filename}`, async () => {
      const original = loadSample('png', filename);
      const emptied = await parse(emptyWrite(original));
      expect(emptied.status === 'success' && emptied.stealth).toBe(true);

      const result = await strip(original);

      expect(result).toMatchObject({ ok: true, stealthRemoved: true });
      if (!result.ok) return;
      expect(result.warning).toBeUndefined();
      expect((await parse(result.value)).status).toBe('empty');

      // The payload runs down the first columns, three bits a pixel
      const image = await decodePngPixels(original);
      if (typeof image === 'string') throw new Error(image);
      const [location] = locateStealth(image);
      if (!location) throw new Error('no payload located');
      const expected = await rgbaOf(original);
      for (let i = 0; i < Math.ceil(location.bits / 3); i++) {
        const at =
          ((i % image.height) * image.width + Math.floor(i / image.height)) * 4;
        for (let channel = 0; channel < 3; channel++) {
          expected[at + channel] = (expected[at + channel] ?? 0) & 0xfe;
        }
      }
      expect((await rgbaOf(result.value)).equals(expected)).toBe(true);
      expect(result.value.length).toBeLessThan(original.length * 1.05);
    });
  }

  it('removes what a painted-over header leaves in a picture with alpha values of its own: novelai-v5-full.png', async () => {
    // This sample is not opaque everywhere: nine pixels in the middle of
    // the picture have alpha between 239 and 253, far from the payload
    // in its first columns. "Opaque but for 254s" therefore cannot be
    // asked of the whole picture, only of the run it opens with.
    const original = loadSample('png', 'novelai-v5-full.png');
    const image = await decodePngPixels(original);
    if (typeof image === 'string') throw new Error(image);
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

describe('strip - stealth WebP samples', () => {
  // Writing WebP pixels back is not implemented yet: until it is, the
  // metadata chunks go and a warning says the copy in the pixels stays
  for (const filename of STEALTH_WEBP_SAMPLES) {
    it(`warns that stealth data remains: ${filename}`, async () => {
      const original = loadSample('webp', filename);

      const result = await strip(original);

      expect(result).toMatchObject({
        ok: true,
        stealthRemoved: false,
        warning: { type: 'stealthRemains' },
      });
      if (!result.ok) return;
      const after = await parse(result.value);
      expect(after.status === 'success' && after.stealth).toBe(true);
    });
  }
});

describe.concurrent('strip - vendor samples', () => {
  // Pictures from commercial services declare their origin in a C2PA
  // manifest or in XMP. An empty write only drops what it manages, so
  // the manifest stays and the picture still parses as a vendor's;
  // strip() keeps nothing but the image.
  const images = VENDOR_SAMPLES.filter(
    (sample) =>
      sample.format === 'png' ||
      sample.format === 'jpg' ||
      sample.format === 'webp',
  );

  for (const { format, filename, info } of images) {
    it(`removes the vendor's declaration and keeps the pixels: ${filename}`, async () => {
      const original = loadVendorSample(
        format as 'png' | 'jpg' | 'webp',
        filename,
      );
      expect((await parse(original)).status).toBe('vendor');
      if (info.source === 'c2pa') {
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
