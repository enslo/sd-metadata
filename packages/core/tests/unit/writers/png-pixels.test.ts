import { describe, expect, it } from 'vitest';
import {
  decodePngPixels,
  type PngPixels,
} from '../../../src/readers/png-pixels';
import { MAX_PIXEL_BYTES } from '../../../src/readers/stealth';
import { readChunkType, readUint32BE } from '../../../src/utils/binary';
import { buildChunk, writePngMetadata } from '../../../src/writers/png';
import { writePngPixels } from '../../../src/writers/png-pixels';
import { pngChunkTypes } from '../../helpers/containers';
import { randomBytes, samplePictures } from '../../helpers/pictures';
import {
  bytes,
  decodeAsRgba8,
  open,
  pngHeader,
  RESAVED_LAYOUTS,
} from '../../helpers/png-layouts';
import { createStealthPng } from '../../helpers/stealth-images';
import { decodeWithSharp } from '../../helpers/webp-pixels';

async function decode(png: Uint8Array): Promise<PngPixels> {
  const decoded = await decodePngPixels(png, MAX_PIXEL_BYTES);
  if (!decoded || typeof decoded === 'string') {
    throw new Error(`not decoded: ${decoded}`);
  }
  return decoded;
}

/** The PNG with its IDAT chunk cut into two chunks */
function splitImageData(png: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  for (let offset = 8; offset + 12 <= png.length; ) {
    const length = readUint32BE(png, offset);
    const chunk = png.subarray(offset, offset + 12 + length);
    if (readChunkType(png, offset + 4) === 'IDAT') {
      const data = chunk.subarray(8, 8 + length);
      const half = length >> 1;
      parts.push(buildChunk('IDAT', data.subarray(0, half)));
      parts.push(buildChunk('IDAT', data.subarray(half)));
    } else {
      parts.push(chunk);
    }
    offset += 12 + length;
  }
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

describe('writePngPixels', () => {
  for (const filter of [0, 1, 2, 3, 4] as const) {
    for (const mode of ['alpha', 'rgb'] as const) {
      const layout = mode === 'alpha' ? 'RGBA' : 'RGB';

      it(`stores pixels through filter type ${filter} (${layout})`, async () => {
        // Rows of the given filter type, filled with noise so that every
        // predictor has something to predict
        const png = createStealthPng({
          payload: 'x'.repeat(400),
          mode,
          filter,
        });
        const image = await decode(png);
        const next = randomBytes(filter * 2 + (mode === 'alpha' ? 1 : 0));
        for (let i = 0; i < image.pixels.length; i++) {
          image.pixels[i] = next();
        }
        expect([...new Set(image.filters)]).toEqual([filter]);

        const written = await writePngPixels(png, image);

        // The same pixels come back, through the same filter types...
        expect(await decode(written)).toEqual(image);
        // ...and libpng reads the file the same way
        const reference = await decodeWithSharp(written);
        const expected =
          mode === 'alpha'
            ? image.pixels
            : Uint8Array.from(
                { length: image.width * image.height * 4 },
                (_, i) =>
                  i % 4 === 3
                    ? 255
                    : (image.pixels[(i >> 2) * 3 + (i % 4)] ?? 0),
              );
        expect(reference?.data).toEqual(expected);
      });
    }
  }

  it('keeps every other chunk in place and writes one image data chunk', async () => {
    const withText = writePngMetadata(
      splitImageData(createStealthPng({ payload: 'x'.repeat(400) })),
      [{ type: 'tEXt', keyword: 'parameters', text: 'kept as it is' }],
    );
    if (!withText.ok) throw new Error(withText.error.type);
    const png = withText.value;
    expect(pngChunkTypes(png)).toEqual([
      'IHDR',
      'tEXt',
      'IDAT',
      'IDAT',
      'IEND',
    ]);
    const image = await decode(png);

    const written = await writePngPixels(png, image);

    expect(pngChunkTypes(written)).toEqual(['IHDR', 'tEXt', 'IDAT', 'IEND']);
    expect(await decode(written)).toEqual(image);
  });

  it('writes edited pixels', async () => {
    const png = createStealthPng({ payload: 'x'.repeat(400), filter: 4 });
    const image = await decode(png);
    image.pixels.fill(255);

    const written = await writePngPixels(png, image);

    expect(new Set((await decode(written)).pixels)).toEqual(new Set([255]));
  });
});

describe('writePngPixels - files saved in other layouts', () => {
  // A translucent ramp: every alpha value matters
  const [, picture] = samplePictures()[4] ?? [];
  if (!picture) throw new Error('missing picture');

  for (const layout of RESAVED_LAYOUTS) {
    it(`stores edited pixels of a file that was ${layout.name}`, async () => {
      const file = await bytes(layout.convert(open(picture)));
      const image = await decode(file);
      // Set the low alpha bit everywhere, as clearing a payload does
      for (let i = 3; i < image.pixels.length; i += 4) {
        image.pixels[i] = (image.pixels[i] ?? 0) | 1;
      }
      const expected = image.pixels.slice();

      const written = await writePngPixels(file, image);

      // The same channels at the same bit depth, and no interlacing
      expect(pngHeader(written)).toEqual({
        colorType: layout.colorType,
        bitDepth: layout.bitDepth,
        interlaced: false,
      });
      expect(await decodeAsRgba8(written)).toEqual(expected);
      expect((await decode(written)).pixels).toEqual(expected);
    });
  }

  it('keeps the low byte of 16-bit samples it did not change', async () => {
    const file = await bytes(open(picture).toColourspace('rgb16').png());
    const image = await decode(file);
    // Samples are two bytes, high first: red of pixel 0 at 0-1, red of
    // pixel 1 at 8-9. Give both a low byte of their own, as a true
    // 16-bit picture has, then change pixel 1 in the 8-bit view.
    image.samples[1] = 0x12;
    image.samples[9] = 0x34;
    const changed = (image.pixels[4] ?? 0) ^ 0x80;
    image.pixels[4] = changed;

    const written = await decode(await writePngPixels(file, image));

    expect(written.samples[1]).toBe(0x12);
    // A changed value becomes its 16-bit equivalent: both bytes alike
    expect([...written.samples.subarray(8, 10)]).toEqual([changed, changed]);
  });

  it('takes the gray of a grayscale file from the red channel of the view', async () => {
    const file = await bytes(open(picture).toColourspace('b-w').png());
    const image = await decode(file);
    image.pixels[0] = 77;

    const written = await decode(await writePngPixels(file, image));

    expect([...written.pixels.subarray(0, 3)]).toEqual([77, 77, 77]);
  });
});
