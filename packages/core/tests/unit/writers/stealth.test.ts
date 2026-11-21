import { describe, expect, it } from 'vitest';
import {
  locateStealth,
  type PixelData,
  scanDecodedPixels,
} from '../../../src/readers/stealth';
import { clearStealth } from '../../../src/writers/stealth';
import {
  createStealthRgbaPixels,
  type StealthPngOptions,
} from '../../helpers/stealth-images';

const A1111_PAYLOAD =
  'masterpiece, 1girl\nNegative prompt: lowres\n' +
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

const SIZE = 64;

/** A 64x64 RGBA picture with a payload that fills only its first columns */
function stealthImage(options: Partial<StealthPngOptions> = {}): PixelData {
  const { data, width, height } = createStealthRgbaPixels({
    payload: A1111_PAYLOAD,
    compress: false,
    width: SIZE,
    height: SIZE,
    ...options,
  });
  return { width, height, channels: 4, pixels: data };
}

/** Whether the pixel at (x, y) carries payload bits: the stream is column-major */
function inPayload(x: number, y: number, bits: number, perPixel: number) {
  return x * SIZE + y < Math.ceil(bits / perPixel);
}

function alphaAt(image: PixelData, x: number, y: number): number {
  return image.pixels[(y * image.width + x) * image.channels + 3] ?? 0;
}

describe('clearStealth', () => {
  it('makes an opaque picture opaque again (alpha embedding)', async () => {
    const image = stealthImage();
    const before = image.pixels.slice();
    expect(await scanDecodedPixels(image)).not.toBeNull();

    expect(clearStealth(image)).toBe(true);

    for (let i = 0; i < image.pixels.length; i++) {
      // Alpha is 255 everywhere, the colors are what they were
      expect(image.pixels[i]).toBe(i % 4 === 3 ? 255 : before[i]);
    }
    expect(await scanDecodedPixels(image)).toBeNull();
    expect(locateStealth(image)).toEqual([]);
  });

  it('clears the low color bits the payload used (RGB embedding)', async () => {
    const image = stealthImage({ mode: 'rgb' });
    // Odd values everywhere the payload does not reach, to see them kept
    const [location] = locateStealth(image);
    if (!location) throw new Error('no payload located');
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!inPayload(x, y, location.bits, 3)) {
          image.pixels.set([129, 131, 133], (y * SIZE + x) * 4);
        }
      }
    }
    const before = image.pixels.slice();

    expect(clearStealth(image)).toBe(true);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const at = (y * SIZE + x) * 4;
        const expected = inPayload(x, y, location.bits, 3)
          ? [...before.subarray(at, at + 3)].map((value) => value & 0xfe)
          : [129, 131, 133];
        expect([...image.pixels.subarray(at, at + 3)]).toEqual(expected);
        expect(image.pixels[at + 3]).toBe(255);
      }
    }
    expect(await scanDecodedPixels(image)).toBeNull();
  });

  it('touches only the payload pixels of a translucent picture', async () => {
    // Stealth bits in the alpha of a picture that really is translucent:
    // the payload pixels keep their bit, the others their own alpha
    const image = stealthImage();
    const [location] = locateStealth(image);
    if (!location) throw new Error('no payload located');
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const at = (y * SIZE + x) * 4 + 3;
        const own = 40 + x * 3 + (y & 1);
        image.pixels[at] = inPayload(x, y, location.bits, 1)
          ? (own & 0xfe) | ((image.pixels[at] ?? 0) & 1)
          : own;
      }
    }
    expect(await scanDecodedPixels(image)).not.toBeNull();
    const before = image.pixels.slice();

    expect(clearStealth(image)).toBe(true);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const was = before[(y * SIZE + x) * 4 + 3] ?? 0;
        expect(alphaAt(image, x, y)).toBe(
          inPayload(x, y, location.bits, 1) ? was | 1 : was,
        );
      }
    }
    expect(await scanDecodedPixels(image)).toBeNull();
  });

  it('leaves a picture without stealth data alone', () => {
    const opaque: PixelData = {
      width: SIZE,
      height: SIZE,
      channels: 4,
      pixels: new Uint8Array(SIZE * SIZE * 4).fill(255),
    };
    const translucent: PixelData = {
      width: SIZE,
      height: SIZE,
      channels: 4,
      pixels: Uint8Array.from({ length: SIZE * SIZE * 4 }, (_, i) => i % 251),
    };

    for (const image of [opaque, translucent]) {
      const before = image.pixels.slice();
      expect(clearStealth(image)).toBe(false);
      expect(image.pixels).toEqual(before);
    }
  });

  it('makes alpha opaque when only the header was painted over', async () => {
    // The first 120 payload pixels back to opaque: the magic is gone, no
    // reader finds the payload, and all of it is still in the pixels
    const image = stealthImage();
    for (let i = 0; i < 120; i++) {
      image.pixels[((i % SIZE) * SIZE + Math.floor(i / SIZE)) * 4 + 3] = 255;
    }
    expect(locateStealth(image)).toEqual([]);
    expect(await scanDecodedPixels(image)).toBeNull();
    expect(image.pixels.filter((_, i) => i % 4 === 3)).toContain(254);

    expect(clearStealth(image)).toBe(true);

    expect(new Set(image.pixels.filter((_, i) => i % 4 === 3))).toEqual(
      new Set([255]),
    );
  });

  it('clears to the last pixel when the declared length makes no sense', () => {
    // A length past the capacity of the picture: no reader takes it, but
    // the magic says something was written here
    const image = stealthImage({ mode: 'rgb', declaredBitLength: 0xfffffff0 });
    image.pixels.set([129, 131, 133], (SIZE * SIZE - 1) * 4);
    expect(locateStealth(image)).toEqual([
      { mode: 'rgb', bits: SIZE * SIZE * 3 },
    ]);

    expect(clearStealth(image)).toBe(true);

    expect([...image.pixels.subarray((SIZE * SIZE - 1) * 4)]).toEqual([
      128, 130, 132, 255,
    ]);
    expect(locateStealth(image)).toEqual([]);
  });

  it('clears a lone alpha plane', async () => {
    // What a lossy WebP offers: alpha only
    const { pixels } = stealthImage();
    const plane: PixelData = {
      width: SIZE,
      height: SIZE,
      channels: 1,
      pixels: pixels.filter((_, i) => i % 4 === 3),
    };
    expect(await scanDecodedPixels(plane)).not.toBeNull();

    expect(clearStealth(plane)).toBe(true);

    expect(new Set(plane.pixels)).toEqual(new Set([255]));
  });

  it('clears both embeddings of a picture that carries two', async () => {
    const image = stealthImage({ mode: 'rgb' });
    const alpha = stealthImage();
    for (let i = 3; i < image.pixels.length; i += 4) {
      image.pixels[i] = alpha.pixels[i] ?? 0;
    }
    expect(locateStealth(image).map((location) => location.mode)).toEqual([
      'alpha',
      'rgb',
    ]);

    expect(clearStealth(image)).toBe(true);

    expect(locateStealth(image)).toEqual([]);
    expect(await scanDecodedPixels(image)).toBeNull();
  });
});

describe('locateStealth', () => {
  it('measures a payload from its magic and declared length', () => {
    const payloadBits = new TextEncoder().encode(A1111_PAYLOAD).length * 8;

    // 15 bytes of magic and 4 of length come before the payload
    expect(locateStealth(stealthImage())).toEqual([
      { mode: 'alpha', bits: 152 + payloadBits },
    ]);
    expect(locateStealth(stealthImage({ mode: 'rgb' }))).toEqual([
      { mode: 'rgb', bits: 152 + payloadBits },
    ]);
  });

  it('locates a payload whose content would not decode', async () => {
    // Declared as gzip, holding plain text: readers give up, the bits
    // are there all the same
    const image = stealthImage({ magic: 'stealth_pngcomp' });

    expect(await scanDecodedPixels(image)).toBeNull();
    expect(locateStealth(image)).toHaveLength(1);
  });

  it('finds nothing without a magic', () => {
    const image = stealthImage({ magic: 'stealth_unknown' });

    expect(locateStealth(image)).toEqual([]);
  });
});
