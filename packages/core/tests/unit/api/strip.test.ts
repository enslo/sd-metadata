import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { write } from '../../../src/api/write';
import { decodePngPixels } from '../../../src/readers/stealth';
import { strip } from '../../../src/strip';
import { writePngMetadata } from '../../../src/writers/png';
import { writePngPixels } from '../../../src/writers/png-pixels';
import {
  ascii,
  insertJpegSegments,
  insertPngChunks,
  pngChunkTypes,
} from '../../helpers/containers';
import { createMinimalWebp } from '../../helpers/minimal-images';
import {
  createStealthPng,
  createStealthRgbaPixels,
} from '../../helpers/stealth-images';
import { decodeWithSharp, encodeWebp } from '../../helpers/webp-pixels';

const A1111_PAYLOAD =
  'masterpiece, 1girl\nNegative prompt: lowres\n' +
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

const RAW = { raw: { width: 32, height: 24, channels: 4 } } as const;

/** Opaque 32x24 pixels with nothing hidden in them */
function plainPixels(): Uint8Array {
  return Uint8Array.from({ length: 32 * 24 * 4 }, (_, i) =>
    i % 4 === 3 ? 255 : (i * 7) & 0xff,
  );
}

async function bytes(image: Sharp): Promise<Uint8Array> {
  return new Uint8Array(await image.toBuffer());
}

/** The PNG with an A1111 parameters chunk */
function withParameters(png: Uint8Array): Uint8Array {
  const written = writePngMetadata(png, [
    { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
  ]);
  if (!written.ok) throw new Error(written.error.type);
  return written.value;
}

/** What write() makes of the image for an empty result */
function emptyWrite(image: Uint8Array): Uint8Array {
  const written = write(image, { status: 'empty' });
  if (!written.ok) throw new Error(written.error.type);
  return written.value;
}

describe('strip - PNG', () => {
  it('removes alpha-embedded stealth data', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    expect((await parse(png)).status).toBe('success');

    const result = await strip(png);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    expect(result.warning).toBeUndefined();
    expect((await parse(result.value)).status).toBe('empty');
  });

  it('removes RGB-embedded stealth data', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD, mode: 'rgb' });
    expect((await parse(png)).status).toBe('success');

    const result = await strip(png);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    expect(result.warning).toBeUndefined();
    expect((await parse(result.value)).status).toBe('empty');
  });

  it('removes text chunks and stealth data together', async () => {
    const png = withParameters(createStealthPng({ payload: A1111_PAYLOAD }));
    // An empty write leaves the copy in the pixels: parse() still reads it
    const emptied = await parse(emptyWrite(png));
    expect(emptied.status === 'success' && emptied.stealth).toBe(true);

    const result = await strip(png);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    expect((await parse(result.value)).status).toBe('empty');
  });

  it('changes the alpha bits and nothing else', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    const before = await decodeWithSharp(png);

    const result = await strip(png);

    if (!result.ok || !before) throw new Error('strip failed');
    const after = await decodeWithSharp(result.value);
    const expected = before.data.map((value, i) => (i % 4 === 3 ? 255 : value));
    expect(after?.data).toEqual(expected);
  });

  it('gives back the file as it was before any metadata was added', async () => {
    const base = await bytes(sharp(plainPixels(), RAW).png());
    const png = withParameters(base);

    // No stealth data: the image data is not compressed again, and what
    // is left is the original file, byte for byte
    expect(await strip(png)).toEqual({
      ok: true,
      value: base,
      stealthRemoved: false,
    });
  });

  it('removes metadata this library does not read', async () => {
    const base = await bytes(sharp(plainPixels(), RAW).png());
    // A compressed text chunk, a C2PA manifest, and a chunk of some
    // vendor's own: an empty write passes all three through
    const png = insertPngChunks(base, [
      ['zTXt', ascii('Comment\0\0compressed')],
      ['caBX', ascii('a C2PA manifest')],
      ['prVt', ascii('a vendor block')],
    ]);
    expect(pngChunkTypes(emptyWrite(png))).toEqual(
      expect.arrayContaining(['zTXt', 'caBX', 'prVt']),
    );

    expect(await strip(png)).toEqual({
      ok: true,
      value: base,
      stealthRemoved: false,
    });
  });

  it('keeps a turned image turned', async () => {
    // Stealth data and an EXIF orientation: the bits go, and so does the
    // rest of EXIF, but the picture must not fall on its side
    const png = await bytes(
      sharp(createStealthPng({ payload: A1111_PAYLOAD }))
        .withExif({ IFD0: { Make: 'TestCam' } })
        .withMetadata({ orientation: 6 })
        .png(),
    );
    expect((await parse(png)).status).toBe('success');
    expect(Buffer.from(png).includes('TestCam')).toBe(true);

    const result = await strip(png);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    expect((await parse(result.value)).status).toBe('empty');
    expect((await sharp(result.value).metadata()).orientation).toBe(6);
    expect(Buffer.from(result.value).includes('TestCam')).toBe(false);
  });

  it('removes what a painted-over header leaves behind', async () => {
    // The first 120 payload pixels made opaque, as painting over the
    // top-left corner would: the magic is gone and parse() finds
    // nothing, yet the payload after it is still in the pixels
    const png = createStealthPng({
      payload: A1111_PAYLOAD,
      width: 64,
      height: 64,
    });
    const image = await decodePngPixels(png);
    if (typeof image === 'string') throw new Error(image);
    for (let i = 0; i < 120; i++) {
      image.pixels[((i % 64) * 64 + Math.floor(i / 64)) * 4 + 3] = 255;
    }
    const damaged = await writePngPixels(png, image);
    expect((await parse(damaged)).status).toBe('empty');
    const before = await decodeWithSharp(damaged);
    expect(before?.data.filter((_, i) => i % 4 === 3)).toContain(254);

    const result = await strip(damaged);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
    if (!result.ok) return;
    const after = await decodeWithSharp(result.value);
    expect(new Set(after?.data.filter((_, i) => i % 4 === 3))).toEqual(
      new Set([255]),
    );
  });

  // Layouts the pixel decoder does not take. The stealth bits survive
  // such a re-save (other readers find them), so strip() must not pass
  // the file off as clean.
  const layouts: [string, (image: Sharp) => Sharp][] = [
    ['interlaced', (image) => image.png({ progressive: true })],
    ['16-bit', (image) => image.toColourspace('rgb16').png()],
    ['palette', (image) => image.png({ palette: true })],
    ['grayscale with alpha', (image) => image.toColourspace('b-w').png()],
  ];
  for (const [name, convert] of layouts) {
    it(`warns that it could not examine a PNG re-saved as ${name}`, async () => {
      const stealth = createStealthPng({ payload: A1111_PAYLOAD });
      const png = withParameters(await bytes(convert(sharp(stealth))));

      const result = await strip(png);

      expect(result).toMatchObject({
        ok: true,
        stealthRemoved: false,
        warning: { type: 'stealthUnchecked', reason: 'unsupportedLayout' },
      });
      // The metadata chunks are gone all the same
      expect(result.ok && read(result.value).status).toBe('empty');
    });
  }

  it('warns when the pixel data does not decode', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    // The IDAT chunk follows the signature and IHDR: its data starts
    // at byte 41 with the zlib header
    png[41] = 0;

    const result = await strip(png);

    expect(result).toMatchObject({
      ok: true,
      stealthRemoved: false,
      warning: { type: 'stealthUnchecked', reason: 'undecodable' },
    });
  });

  it('warns when the image is past the size cap', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    // Claim 20000 x 20000 pixels in IHDR: 1.6 GB of RGBA
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    view.setUint32(16, 20000);
    view.setUint32(20, 20000);

    const result = await strip(png);

    expect(result).toMatchObject({
      ok: true,
      stealthRemoved: false,
      warning: { type: 'stealthUnchecked', reason: 'imageTooLarge' },
    });
  });
});

describe('strip - JPEG', () => {
  it('gives back the file as it was before any metadata was added', async () => {
    // Lossy pixels carry no stealth data: only the segments go
    const base = await bytes(sharp(plainPixels(), RAW).jpeg());
    const jpeg = insertJpegSegments(base, [
      [0xe1, ascii('Exif\0\0not really TIFF')],
      [0xeb, ascii('JP\0\0a C2PA manifest')],
      [0xfe, ascii(A1111_PAYLOAD)],
    ]);

    expect(await strip(jpeg)).toEqual({
      ok: true,
      value: base,
      stealthRemoved: false,
    });
  });
});

describe('strip - WebP', () => {
  const stealthPixels = createStealthRgbaPixels({ payload: A1111_PAYLOAD });

  it('warns that stealth data remains in a lossless WebP', async () => {
    const webp = await encodeWebp(stealthPixels, { lossless: true });

    const result = await strip(webp);

    expect(result).toMatchObject({
      ok: true,
      stealthRemoved: false,
      warning: { type: 'stealthRemains' },
    });
  });

  it('warns that stealth data remains in the alpha plane of a lossy WebP', async () => {
    const webp = await encodeWebp(stealthPixels, { quality: 80 });

    const result = await strip(webp);

    expect(result).toMatchObject({
      ok: true,
      stealthRemoved: false,
      warning: { type: 'stealthRemains' },
    });
  });

  it('leaves a WebP without metadata or stealth data as it is', async () => {
    const pixels = { data: plainPixels(), width: 32, height: 24 };

    for (const webp of [
      await encodeWebp(pixels, { lossless: true }),
      await encodeWebp(pixels, { quality: 80 }),
      createMinimalWebp(),
    ]) {
      expect(await strip(webp)).toEqual({
        ok: true,
        value: webp,
        stealthRemoved: false,
      });
    }
  });
});

describe('strip - input', () => {
  it('rejects data that is not an image it knows', async () => {
    expect(await strip(new Uint8Array([1, 2, 3, 4]))).toEqual({
      ok: false,
      error: { type: 'unsupportedFormat' },
    });
  });

  it('reports a file it cannot rewrite', async () => {
    // A PNG that breaks off inside its image data
    const png = createStealthPng({ payload: A1111_PAYLOAD });

    expect(await strip(png.subarray(0, png.length - 20))).toEqual({
      ok: false,
      error: { type: 'writeFailed', message: 'PNG ends inside a chunk (IDAT)' },
    });
  });

  it('accepts ArrayBuffer input', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    const buffer = png.buffer.slice(
      png.byteOffset,
      png.byteOffset + png.byteLength,
    );

    const result = await strip(buffer as ArrayBuffer);

    expect(result).toMatchObject({ ok: true, stealthRemoved: true });
  });
});
