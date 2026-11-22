import { describe, expect, it } from 'vitest';
import { decodeVp8l } from '../../../src/readers/vp8l';
import {
  firstTransform,
  image,
  paletteImage,
  randomBytes,
  samplePictures,
  toRgba,
} from '../../helpers/pictures';
import {
  decodeWithSharp,
  encodeWebp,
  webpChunk,
} from '../../helpers/webp-pixels';

const MAX_PIXELS = 4096 * 4096;

/** Decode with the built-in decoder and with libwebp, expect the same pixels */
async function expectSameAsLibwebp(webp: Uint8Array): Promise<void> {
  const reference = await decodeWithSharp(webp);
  if (!reference) throw new Error('reference decoder failed');
  const decoded = decodeVp8l(webpChunk(webp, 'VP8L'), {
    maxPixels: MAX_PIXELS,
  });

  expect(decoded.width).toBe(reference.width);
  expect(decoded.height).toBe(reference.height);
  // Compared as one value: a per-pixel diff of a megabyte is unreadable
  expect(
    Buffer.from(toRgba(decoded.pixels)).equals(Buffer.from(reference.data)),
  ).toBe(true);
}

describe('decodeVp8l - against libwebp', () => {
  const pictures = samplePictures();

  for (const [name, picture] of pictures) {
    // Each effort level takes a different path through the encoder, so
    // the streams differ in transforms, color cache and code groups
    for (const effort of [0, 4, 6]) {
      it(`decodes ${name} (effort ${effort})`, async () => {
        await expectSameAsLibwebp(
          await encodeWebp(picture, { lossless: true, effort }),
        );
      });
    }
  }

  // Color indexing packs 8, 4 or 2 indexes into one value for tables of
  // up to 2, 4 and 16 colors, and stores one index per pixel above that
  for (const colors of [2, 3, 4, 5, 16, 17, 200]) {
    it(`decodes a picture of ${colors} colors through a color table`, async () => {
      const webp = await encodeWebp(paletteImage(colors), { lossless: true });

      expect(firstTransform(webpChunk(webp, 'VP8L'))).toBe(3);
      await expectSameAsLibwebp(webp);
    });
  }

  it('covers streams coded with prediction rather than a color table', async () => {
    const [, photo] = pictures[2] ?? [];
    if (!photo) throw new Error('missing picture');
    const webp = await encodeWebp(photo, { lossless: true });

    // Predictor, cross-color or subtract-green, whichever the encoder
    // put first: the photo-like picture does not go through a color table
    expect([0, 1, 2]).toContain(firstTransform(webpChunk(webp, 'VP8L')));
  });
});

describe('decodeVp8l - limits and malformed streams', () => {
  const picture = image(64, 64, (x, y) => [x * 4, y * 4, (x ^ y) * 4, 255]);

  async function validStream(): Promise<Uint8Array> {
    return webpChunk(await encodeWebp(picture, { lossless: true }), 'VP8L');
  }

  it('throws on an image larger than maxPixels', async () => {
    const stream = await validStream();

    expect(() => decodeVp8l(stream, { maxPixels: 64 * 64 - 1 })).toThrow(
      'image size out of range',
    );
    expect(decodeVp8l(stream, { maxPixels: 64 * 64 }).width).toBe(64);
  });

  it('throws before decoding when the header claims a huge image', () => {
    // 16384 x 16384, nothing after the header
    const stream = new Uint8Array([0x2f, 0xff, 0xff, 0xff, 0x0f, 0x00]);

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'image size out of range',
    );
  });

  it('throws on a wrong signature', async () => {
    const stream = await validStream();
    stream[0] = 0x2e;

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'invalid signature',
    );
  });

  it('throws on an unknown version', async () => {
    const stream = await validStream();
    stream[4] = (stream[4] ?? 0) | 0x20; // version bits are 29-31

    expect(() => decodeVp8l(stream, { maxPixels: MAX_PIXELS })).toThrow(
      'unsupported version',
    );
  });

  it('throws on an empty stream', () => {
    expect(() =>
      decodeVp8l(new Uint8Array(0), { maxPixels: MAX_PIXELS }),
    ).toThrow();
  });

  it('throws on a stream cut short, wherever the cut falls', async () => {
    const stream = await validStream();

    for (const keep of [5, 6, 12, 40, 0.25, 0.5, 0.75, 0.95]) {
      const length = keep < 1 ? Math.floor(stream.length * keep) : keep;
      expect(
        () => decodeVp8l(stream.subarray(0, length), { maxPixels: MAX_PIXELS }),
        `cut at ${length} of ${stream.length} bytes`,
      ).toThrow();
    }
  });

  it('ends on a damaged stream, by throwing or with a full image', async () => {
    const stream = await validStream();
    const next = randomBytes(7);

    // Flip bytes all over the stream: whatever the damage, decoding must
    // end, either with an error or with pixels for the whole image
    for (let round = 0; round < 300; round++) {
      const damaged = stream.slice();
      for (let i = 0; i < 3; i++) {
        const at = 5 + (((next() << 8) | next()) % (damaged.length - 5));
        damaged[at] = next();
      }
      try {
        const decoded = decodeVp8l(damaged, { maxPixels: MAX_PIXELS });
        expect(decoded.pixels.length).toBe(decoded.width * decoded.height);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it('decodes a headerless stream with the given size', async () => {
    // The stream of an ALPH chunk: VP8L without the 5-byte image header.
    // Rebuilt here by moving the bits of a regular stream down by 40.
    const stream = await validStream();
    const headerless = stream.subarray(5);

    const decoded = decodeVp8l(headerless, {
      maxPixels: MAX_PIXELS,
      size: { width: 64, height: 64 },
    });

    expect(decoded.pixels).toEqual(
      decodeVp8l(stream, { maxPixels: MAX_PIXELS }).pixels,
    );
  });
});
