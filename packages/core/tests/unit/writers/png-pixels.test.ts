import { describe, expect, it } from 'vitest';
import { decodePngPixels, type PngPixels } from '../../../src/readers/stealth';
import { readChunkType, readUint32BE } from '../../../src/utils/binary';
import { buildChunk, writePngMetadata } from '../../../src/writers/png';
import { writePngPixels } from '../../../src/writers/png-pixels';
import { pngChunkTypes } from '../../helpers/containers';
import { createStealthPng } from '../../helpers/stealth-images';
import { decodeWithSharp } from '../../helpers/webp-pixels';

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

async function decode(png: Uint8Array): Promise<PngPixels> {
  const decoded = await decodePngPixels(png);
  if (typeof decoded === 'string') {
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
