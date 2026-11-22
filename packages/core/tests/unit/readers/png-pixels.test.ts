import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { decodePngPixels } from '../../../src/readers/png-pixels';
import { image, samplePictures } from '../../helpers/pictures';
import {
  bytes,
  decodeAsRgba8,
  open,
  pngHeader,
  RESAVED_LAYOUTS,
} from '../../helpers/png-layouts';

const MAX_BYTES = 64 * 1024 * 1024;

/**
 * Pictures to decode in every layout: noise and translucency, and sizes
 * around the 8-pixel grid of interlacing, where passes come out empty or
 * a single pixel wide
 */
const PICTURES = [
  ...samplePictures().filter(([name]) => name !== 'a photo-like picture'),
  [
    'an 8 x 8 picture',
    image(8, 8, (x, y) => [x * 30, y * 30, (x * y) & 0xff, 255 - x - y]),
  ],
  [
    'a 9 x 17 picture',
    image(9, 17, (x, y) => [x * 25, y * 14, (x + y) * 9, 100 + x * 9 + y]),
  ],
  ['a 2 x 2 picture', image(2, 2, (x, y) => [x * 200, y * 200, 50, 254 + x])],
] as const;

async function decode(file: Uint8Array) {
  const decoded = await decodePngPixels(file, MAX_BYTES);
  if (!decoded || typeof decoded === 'string') {
    throw new Error(`not decoded: ${decoded}`);
  }
  return decoded;
}

/** The color and alpha channels a view of `channels` channels holds */
function channelsOf(rgba: Uint8Array, channels: number): Uint8Array {
  return channels === 4 ? rgba : rgba.filter((_, i) => i % 4 !== 3);
}

describe('decodePngPixels - layouts', () => {
  for (const [name, picture] of PICTURES) {
    it(`reads ${name} as plain 8-bit RGBA and RGB`, async () => {
      for (const file of [
        await bytes(open(picture).png()),
        await bytes(open(picture).removeAlpha().png()),
      ]) {
        const decoded = await decode(file);

        expect(decoded.layout).toMatchObject({
          bitDepth: 8,
          interlaced: false,
        });
        expect(decoded.pixels).toEqual(
          channelsOf(await decodeAsRgba8(file), decoded.channels),
        );
        // Nothing to derive: the view is the samples themselves
        expect(decoded.pixels).toBe(decoded.samples);
      }
    });

    for (const layout of RESAVED_LAYOUTS) {
      it(`reads ${name} saved ${layout.name}`, async () => {
        const file = await bytes(layout.convert(open(picture)));
        expect(pngHeader(file)).toEqual({
          colorType: layout.colorType,
          bitDepth: layout.bitDepth,
          interlaced: layout.interlaced,
        });

        const decoded = await decode(file);

        expect(decoded).toMatchObject({
          width: picture.width,
          height: picture.height,
          channels: 4,
          layout: pngHeader(file),
        });
        expect(decoded.pixels).toEqual(await decodeAsRgba8(file));
      });
    }
  }

  it('reads RGB without alpha in the same layouts', async () => {
    const [, picture] = PICTURES[1];
    const rgb = RESAVED_LAYOUTS.filter((layout) => layout.colorType === 6);

    for (const layout of rgb) {
      const file = await bytes(layout.convert(open(picture).removeAlpha()));
      expect(pngHeader(file).colorType).toBe(2);

      const decoded = await decode(file);

      expect(decoded.channels).toBe(3);
      expect(decoded.pixels).toEqual(channelsOf(await decodeAsRgba8(file), 3));
    }
  });
});

describe('decodePngPixels - filters to store the rows with', () => {
  const [, picture] = PICTURES[1];

  it('takes the filter type of each row from the file', async () => {
    const file = await bytes(open(picture).png({ adaptiveFiltering: true }));

    const { filters } = await decode(file);

    expect(filters).toHaveLength(picture.height);
    expect(Math.max(...filters)).toBeLessThanOrEqual(4);
  });

  it('gives Paeth for a file that was interlaced', async () => {
    // The rows of the full image had no filter of their own: only the
    // rows of the seven passes did
    const file = await bytes(open(picture).png({ progressive: true }));

    const { filters } = await decode(file);

    expect([...filters]).toEqual(new Array(picture.height).fill(4));
  });
});

describe('decodePngPixels - what it does not decode', () => {
  const [, picture] = PICTURES[1];

  it('returns null for grayscale without alpha, which cannot carry stealth data', async () => {
    for (const convert of [
      (i: ReturnType<typeof open>) => i.toColourspace('b-w').png(),
      (i: ReturnType<typeof open>) => i.toColourspace('grey16').png(),
    ]) {
      const file = await bytes(convert(open(picture).removeAlpha()));
      expect(pngHeader(file).colorType).toBe(0);

      expect(await decodePngPixels(file, MAX_BYTES)).toBeNull();
    }
  });

  it('reports a palette image as a layout it does not take', async () => {
    const file = await bytes(open(picture).png({ palette: true }));
    expect(pngHeader(file).colorType).toBe(3);

    expect(await decodePngPixels(file, MAX_BYTES)).toBe('unsupportedLayout');
  });

  it('reports an image whose samples would exceed maxBytes', async () => {
    const sixteen = await bytes(open(picture).toColourspace('rgb16').png());
    const { width, height } = picture;

    // Eight bytes per pixel at 16 bits
    expect(await decodePngPixels(sixteen, width * height * 8 - 1)).toBe(
      'imageTooLarge',
    );
    expect(await decodePngPixels(sixteen, width * height * 8)).toMatchObject({
      width,
      height,
    });
  });

  it('reports interlaced data that breaks off', async () => {
    const file = await bytes(open(picture).png({ progressive: true }));
    // The IDAT chunk follows the signature and IHDR; cut its stream short
    const cut = file.slice(0, 41 + 20);

    expect(await decodePngPixels(cut, MAX_BYTES)).toBe('undecodable');
  });

  it('reports a bit depth the color type does not come in', async () => {
    const file = await bytes(open(picture).png());
    file[24] = 4;

    expect(await decodePngPixels(file, MAX_BYTES)).toBe('undecodable');
  });
});

describe('decodePngPixels - true 16-bit samples', () => {
  // A picture converted from 8 bits has samples whose two bytes are alike.
  // One made at 16 bits does not: 0x1234, 0x1c47, 0x265a, ...
  const width = 5;
  const height = 3;
  const values = Uint16Array.from(
    { length: width * height * 4 },
    (_, i) => (i * 2579 + 0x1234) & 0xffff,
  );

  for (const progressive of [false, true]) {
    it(`views them by their high byte${progressive ? ', interlaced' : ''}`, async () => {
      const file = await bytes(
        sharp(values, { raw: { width, height, channels: 4 } })
          .toColourspace('rgb16')
          .png({ progressive }),
      );
      expect(pngHeader(file)).toMatchObject({ bitDepth: 16, colorType: 6 });

      const decoded = await decode(file);

      expect(decoded.pixels).toEqual(Uint8Array.from(values, (v) => v >> 8));
      expect(decoded.pixels).toEqual(await decodeAsRgba8(file));
      // The samples keep both bytes, high byte first
      expect([...decoded.samples.subarray(0, 4)]).toEqual([
        0x12, 0x34, 0x1c, 0x47,
      ]);
    });
  }
});
