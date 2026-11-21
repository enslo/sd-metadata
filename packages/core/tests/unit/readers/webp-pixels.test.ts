import { describe, expect, it } from 'vitest';
import { decodeWebpPixels } from '../../../src/readers/webp-pixels';
import type { RgbaPixels } from '../../../src/types';
import { createMinimalWebp } from '../../helpers/minimal-images';
import {
  buildWebp,
  decodeWithSharp,
  encodeWebp,
  readWebpChunks,
  type WebpChunk,
} from '../../helpers/webp-pixels';

const MAX_BYTES = 64 * 1024 * 1024;
const WIDTH = 60;
const HEIGHT = 40;

/** A picture whose alpha varies: mostly opaque, a translucent band */
function picture(opaque = false): RgbaPixels {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const alpha = opaque ? 255 : y < 10 ? 254 + (x & 1) : 40 + x * 3;
      data.set([x * 4, y * 6, (x * y) & 0xff, alpha], (y * WIDTH + x) * 4);
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}

/** The alpha channel of what libwebp decodes */
async function referenceAlpha(webp: Uint8Array): Promise<Uint8Array> {
  const reference = await decodeWithSharp(webp);
  if (!reference) throw new Error('reference decoder failed');
  return reference.data.filter((_, i) => i % 4 === 3) as Uint8Array;
}

/** VP8X payload: flags, three reserved bytes, canvas size minus one */
function vp8x(flags: number, width: number, height: number): Uint8Array {
  const payload = new Uint8Array(10);
  payload[0] = flags;
  payload.set([(width - 1) & 0xff, ((width - 1) >> 8) & 0xff, 0], 4);
  payload.set([(height - 1) & 0xff, ((height - 1) >> 8) & 0xff, 0], 7);
  return payload;
}

function replaceChunk(
  webp: Uint8Array,
  type: string,
  edit: (payload: Uint8Array) => Uint8Array,
): Uint8Array {
  return buildWebp(
    readWebpChunks(webp).map(
      (chunk): WebpChunk =>
        chunk.type === type
          ? { type, payload: edit(chunk.payload.slice()) }
          : chunk,
    ),
  );
}

describe('decodeWebpPixels - lossless images', () => {
  it('returns the RGBA pixels of a lossless image', async () => {
    const webp = await encodeWebp(picture(), { lossless: true });
    const reference = await decodeWithSharp(webp);

    const decoded = decodeWebpPixels(webp, MAX_BYTES);

    expect(decoded?.width).toBe(WIDTH);
    expect(decoded?.height).toBe(HEIGHT);
    expect(decoded?.channels).toBe(4);
    expect(decoded?.pixels).toEqual(reference?.data);
  });

  it('reads a lossless image behind an extended header', async () => {
    // What a file with metadata chunks looks like: VP8X before VP8L
    const simple = await encodeWebp(picture(), { lossless: true });
    const [image] = readWebpChunks(simple);
    if (image?.type !== 'VP8L') throw new Error('expected a VP8L chunk');
    const extended = buildWebp([
      { type: 'VP8X', payload: vp8x(0x10, WIDTH, HEIGHT) },
      image,
    ]);

    expect(decodeWebpPixels(extended, MAX_BYTES)).toEqual(
      decodeWebpPixels(simple, MAX_BYTES),
    );
  });

  it('returns null when the pixels would exceed maxBytes', async () => {
    const webp = await encodeWebp(picture(), { lossless: true });

    expect(decodeWebpPixels(webp, WIDTH * HEIGHT * 4 - 1)).toBeNull();
    expect(decodeWebpPixels(webp, WIDTH * HEIGHT * 4)).not.toBeNull();
  });
});

describe('decodeWebpPixels - lossy images', () => {
  it('returns the alpha plane of a lossy image', async () => {
    const webp = await encodeWebp(picture(), { quality: 80 });
    expect(readWebpChunks(webp).map((chunk) => chunk.type)).toEqual([
      'VP8X',
      'ALPH',
      'VP8 ',
    ]);

    const decoded = decodeWebpPixels(webp, MAX_BYTES);

    expect(decoded?.width).toBe(WIDTH);
    expect(decoded?.height).toBe(HEIGHT);
    expect(decoded?.channels).toBe(1);
    expect(decoded?.pixels).toEqual(await referenceAlpha(webp));
  });

  it('returns null for a lossy image without alpha', async () => {
    const webp = await encodeWebp(picture(true), { quality: 80 });

    expect(decodeWebpPixels(webp, MAX_BYTES)).toBeNull();
  });

  it('returns null when the alpha plane would exceed maxBytes', async () => {
    const webp = await encodeWebp(picture(), { quality: 80 });

    expect(decodeWebpPixels(webp, WIDTH * HEIGHT - 1)).toBeNull();
    expect(decodeWebpPixels(webp, WIDTH * HEIGHT)).not.toBeNull();
  });

  // The flags byte of an ALPH chunk carries a prediction filter in bits
  // 2-3. libwebp picked none for the picture above, so the filter bits
  // are set by hand: the stored values then mean something else, and
  // both decoders have to agree on what.
  for (const [filter, name] of [
    [1, 'horizontal'],
    [2, 'vertical'],
    [3, 'gradient'],
  ] as const) {
    it(`reverses the ${name} filter of a compressed alpha plane`, async () => {
      const lossy = await encodeWebp(picture(), { quality: 80 });
      const webp = replaceChunk(lossy, 'ALPH', (payload) => {
        expect((payload[0] ?? 0) & 0x0f).toBe(0x01); // compressed, unfiltered
        payload[0] = (payload[0] ?? 0) | (filter << 2);
        return payload;
      });

      expect(decodeWebpPixels(webp, MAX_BYTES)?.pixels).toEqual(
        await referenceAlpha(webp),
      );
    });

    it(`reverses the ${name} filter of a raw alpha plane`, async () => {
      const lossy = await encodeWebp(picture(), { quality: 80 });
      const webp = replaceChunk(lossy, 'ALPH', () => {
        const payload = new Uint8Array(1 + WIDTH * HEIGHT);
        payload[0] = filter << 2; // uncompressed
        for (let i = 1; i < payload.length; i++) {
          payload[i] = (i * 7) % 5; // small steps, as filtered data has
        }
        return payload;
      });

      expect(decodeWebpPixels(webp, MAX_BYTES)?.pixels).toEqual(
        await referenceAlpha(webp),
      );
    });
  }

  it('returns null for a raw alpha plane shorter than the image', async () => {
    const lossy = await encodeWebp(picture(), { quality: 80 });
    const webp = replaceChunk(
      lossy,
      'ALPH',
      () => new Uint8Array(WIDTH * HEIGHT), // one byte short with the flags
    );

    expect(decodeWebpPixels(webp, MAX_BYTES)).toBeNull();
  });

  it('returns null for an unknown alpha compression', async () => {
    const lossy = await encodeWebp(picture(), { quality: 80 });
    const webp = replaceChunk(lossy, 'ALPH', (payload) => {
      payload[0] = 0x02;
      return payload;
    });

    expect(decodeWebpPixels(webp, MAX_BYTES)).toBeNull();
  });
});

describe('decodeWebpPixels - files without readable pixels', () => {
  it('returns null for an animation', async () => {
    const lossless = await encodeWebp(picture(), { lossless: true });
    const [image] = readWebpChunks(lossless);
    if (!image) throw new Error('expected an image chunk');
    const animated = buildWebp([
      { type: 'VP8X', payload: vp8x(0x12, WIDTH, HEIGHT) },
      image,
    ]);

    expect(decodeWebpPixels(animated, MAX_BYTES)).toBeNull();
  });

  it('returns null for a lossy image chunk alone', () => {
    expect(decodeWebpPixels(createMinimalWebp(), MAX_BYTES)).toBeNull();
  });

  it('returns null for data that is not a WebP', () => {
    expect(
      decodeWebpPixels(new Uint8Array([1, 2, 3, 4]), MAX_BYTES),
    ).toBeNull();
  });

  it('returns null for a file cut short', async () => {
    const webp = await encodeWebp(picture(), { lossless: true });

    // The chunk header promises more than the file holds
    expect(
      decodeWebpPixels(webp.subarray(0, webp.length - 10), MAX_BYTES),
    ).toBeNull();
  });

  it('returns null for a lossless chunk that is not a VP8L stream', () => {
    const webp = buildWebp([
      { type: 'VP8L', payload: new Uint8Array([0x2f, 1, 2, 3, 4, 5, 6, 7]) },
    ]);

    expect(decodeWebpPixels(webp, MAX_BYTES)).toBeNull();
  });
});
