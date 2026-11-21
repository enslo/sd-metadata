import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  writeEssentialJpeg,
  writeEssentialPng,
  writeEssentialWebp,
} from '../../../src/writers/essentials';
import {
  ascii,
  insertJpegSegments,
  insertPngChunks,
  jpegSegments,
  pngChunkTypes,
} from '../../helpers/containers';
import {
  buildWebp,
  decodeWithSharp,
  readWebpChunks,
} from '../../helpers/webp-pixels';

const RAW = { raw: { width: 32, height: 24, channels: 4 } } as const;

/** A 32x24 picture: opaque, or with a translucent half */
function picture(translucent = false): Sharp {
  const data = Uint8Array.from({ length: 32 * 24 * 4 }, (_, i) =>
    i % 4 === 3 ? (translucent && i % 8 === 7 ? 120 : 255) : (i * 7) & 0xff,
  );
  return sharp(data, RAW);
}

async function bytes(image: Sharp): Promise<Uint8Array> {
  return new Uint8Array(await image.toBuffer());
}

/** Unwrap a result, failing the test on an error */
function written(result: ReturnType<typeof writeEssentialPng>): Uint8Array {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Camera data and an orientation, the way a phone writes them */
function withCameraExif(image: Sharp, orientation: number): Sharp {
  return image
    .withExif({ IFD0: { Make: 'TestCam', Software: 'TestSoft' } })
    .withMetadata({ orientation });
}

function contains(data: Uint8Array, text: string): boolean {
  return Buffer.from(data).includes(text);
}

describe('writeEssentialPng', () => {
  it('keeps what a decoder uses and drops every other chunk', async () => {
    const base = await bytes(picture().withIccProfile('p3').png());
    expect(pngChunkTypes(base)).toEqual([
      'IHDR',
      'iCCP',
      'pHYs',
      'IDAT',
      'IEND',
    ]);
    // Text of all three kinds, a timestamp, a C2PA manifest, and a
    // private chunk nothing here has heard of
    const png = insertPngChunks(base, [
      ['tEXt', ascii('parameters\0a secret prompt')],
      ['zTXt', ascii('Comment\0\0compressed')],
      ['iTXt', ascii('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>')],
      ['tIME', new Uint8Array(7)],
      ['caBX', ascii('a C2PA manifest')],
      ['prVt', ascii('a vendor block')],
    ]);

    const result = written(writeEssentialPng(png));

    expect(result).toEqual(base);
    expect(await decodeWithSharp(result)).toEqual(await decodeWithSharp(png));
  });

  it('keeps transparency, palette and animation chunks', async () => {
    const base = await bytes(picture(true).png({ palette: true }));
    expect(pngChunkTypes(base)).toEqual(
      expect.arrayContaining(['PLTE', 'tRNS']),
    );
    // Animation control chunks of an APNG
    const png = insertPngChunks(base, [
      ['acTL', new Uint8Array(8)],
      ['fcTL', new Uint8Array(26)],
    ]);

    expect(written(writeEssentialPng(png))).toEqual(png);
  });

  it('keeps a critical chunk it does not know', async () => {
    // Critical chunks start with a capital letter: a decoder that does
    // not know one must not show the image, so taking it out would turn
    // the file into a different one
    const png = insertPngChunks(await bytes(picture().png()), [
      ['NEWc', ascii('unknown but critical')],
      ['neWc', ascii('unknown and ancillary')],
    ]);

    const types = pngChunkTypes(written(writeEssentialPng(png)));

    expect(types).toContain('NEWc');
    expect(types).not.toContain('neWc');
  });

  it('drops what follows the end of the image', async () => {
    const base = await bytes(picture().png());
    const png = Uint8Array.from([...base, ...ascii('appended after IEND')]);

    expect(written(writeEssentialPng(png))).toEqual(base);
  });

  it('carries the orientation over and nothing else of EXIF', async () => {
    const png = await bytes(withCameraExif(picture(), 6).png());
    expect(contains(png, 'TestCam')).toBe(true);

    const result = written(writeEssentialPng(png));

    const metadata = await sharp(result).metadata();
    expect(metadata.orientation).toBe(6);
    // 26 bytes: a TIFF header and one directory entry
    expect(metadata.exif?.length).toBe(26);
    expect(contains(result, 'TestCam')).toBe(false);
    expect(contains(result, 'TestSoft')).toBe(false);
  });

  it('writes no EXIF for an upright image', async () => {
    const png = await bytes(withCameraExif(picture(), 1).png());
    expect(pngChunkTypes(png)).toContain('eXIf');

    expect(pngChunkTypes(written(writeEssentialPng(png)))).not.toContain(
      'eXIf',
    );
  });

  it('refuses a file that breaks off inside a chunk', async () => {
    const png = await bytes(picture().png());

    expect(writeEssentialPng(png.subarray(0, png.length - 20))).toEqual({
      ok: false,
      error: 'PNG ends inside a chunk (IDAT)',
    });
  });

  it('refuses data that is not a PNG', () => {
    expect(writeEssentialPng(new Uint8Array([1, 2, 3, 4])).ok).toBe(false);
  });
});

describe('writeEssentialJpeg', () => {
  const JFIF = Uint8Array.of(
    0x4a,
    0x46,
    0x49,
    0x46,
    0,
    1,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
  );
  // "Adobe", version 100, flags, transform 1: the data is YCbCr
  const ADOBE = Uint8Array.from([...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);

  it('keeps the image structure, JFIF, the color profile and the Adobe marker', async () => {
    const base = insertJpegSegments(
      await bytes(picture().withIccProfile('p3').jpeg()),
      [
        [0xe0, JFIF],
        [0xee, ADOBE],
      ],
    );
    const kept = jpegSegments(base);
    expect(kept).toEqual(
      expect.arrayContaining([
        'e0:JFIF',
        'ee:Adobe',
        'e2:ICC_PROFILE',
        'db',
        'c0',
        'c4',
      ]),
    );
    // A thumbnail extension, EXIF, XMP, a C2PA manifest, Photoshop data,
    // an application segment nothing here has heard of, and a comment
    const jpeg = insertJpegSegments(base, [
      [0xe0, ascii('JFXX\0thumbnail')],
      [0xe1, ascii('Exif\0\0not really TIFF')],
      [0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')],
      [0xeb, ascii('JP\0\0a C2PA manifest')],
      [0xed, ascii('Photoshop 3.0\0caption and keywords')],
      [0xe5, ascii('a vendor block')],
      [0xfe, ascii('a comment with a prompt')],
    ]);

    const result = written(writeEssentialJpeg(jpeg));

    expect(result).toEqual(base);
    expect(await decodeWithSharp(result)).toEqual(await decodeWithSharp(jpeg));
  });

  it('drops a comment between two scans', async () => {
    // A progressive JPEG has several scans; markers may sit between them
    const base = await bytes(picture().jpeg({ progressive: true }));
    const firstScan = Buffer.from(base).indexOf(Uint8Array.of(0xff, 0xda));
    const secondScan = Buffer.from(base).indexOf(
      Uint8Array.of(0xff, 0xda),
      firstScan + 2,
    );
    expect(secondScan).toBeGreaterThan(firstScan);
    const jpeg = insertJpegSegments(
      base,
      [[0xfe, ascii('hidden between scans')]],
      secondScan,
    );

    expect(written(writeEssentialJpeg(jpeg))).toEqual(base);
  });

  it('drops what follows the end of the image', async () => {
    const base = await bytes(picture().jpeg());
    const jpeg = Uint8Array.from([...base, ...ascii('appended after EOI')]);

    expect(written(writeEssentialJpeg(jpeg))).toEqual(base);
  });

  it('carries the orientation over and nothing else of EXIF', async () => {
    const jpeg = await bytes(withCameraExif(picture(), 8).jpeg());
    expect(contains(jpeg, 'TestCam')).toBe(true);

    const result = written(writeEssentialJpeg(jpeg));

    const metadata = await sharp(result).metadata();
    expect(metadata.orientation).toBe(8);
    expect(contains(result, 'TestCam')).toBe(false);
    expect(jpegSegments(result)[0]).toBe('e1:Exif');
  });

  it('writes no EXIF for an upright image', async () => {
    const jpeg = await bytes(withCameraExif(picture(), 1).jpeg());
    expect(jpegSegments(jpeg)).toContain('e1:Exif');

    expect(jpegSegments(written(writeEssentialJpeg(jpeg)))).not.toContain(
      'e1:Exif',
    );
  });

  it('keeps a file that ends without an end marker as far as it goes', async () => {
    const base = await bytes(picture().jpeg());
    const cut = base.subarray(0, base.length - 2);
    const jpeg = insertJpegSegments(cut, [[0xfe, ascii('a comment')]]);

    expect(written(writeEssentialJpeg(jpeg))).toEqual(cut);
  });

  it('refuses a file without image data', async () => {
    const base = await bytes(picture().jpeg());
    const firstScan = Buffer.from(base).indexOf(Uint8Array.of(0xff, 0xda));

    expect(writeEssentialJpeg(base.subarray(0, firstScan))).toEqual({
      ok: false,
      error: 'JPEG has no image data',
    });
  });

  it('refuses a file that breaks off inside a segment', async () => {
    const base = await bytes(picture().jpeg());

    expect(writeEssentialJpeg(base.subarray(0, 30)).ok).toBe(false);
  });

  it('refuses data that is not a JPEG', () => {
    expect(writeEssentialJpeg(new Uint8Array([1, 2, 3, 4])).ok).toBe(false);
  });
});

describe('writeEssentialWebp', () => {
  it('keeps the image and its color profile and drops every other chunk', async () => {
    const base = await bytes(
      picture(true).withIccProfile('p3').webp({ lossless: true }),
    );
    const chunks = readWebpChunks(base);
    expect(chunks.map((chunk) => chunk.type)).toEqual(['VP8X', 'ICCP', 'VP8L']);
    // EXIF, XMP, a C2PA manifest and a chunk nothing here has heard of,
    // with the header flags that announce EXIF and XMP
    const [header, ...rest] = chunks;
    if (!header) throw new Error('no header');
    const flagged = header.payload.slice();
    flagged[0] = (flagged[0] ?? 0) | 0x0c;
    const webp = buildWebp([
      { type: 'VP8X', payload: flagged },
      ...rest,
      { type: 'EXIF', payload: ascii('not really TIFF') },
      { type: 'XMP ', payload: ascii('<x:xmpmeta/>') },
      { type: 'C2PA', payload: ascii('a C2PA manifest') },
      { type: 'vndr', payload: ascii('a vendor block') },
    ]);

    const result = written(writeEssentialWebp(webp));

    expect(result).toEqual(base);
    expect(await decodeWithSharp(result)).toEqual(await decodeWithSharp(webp));
  });

  it('keeps the chunks of an animation', () => {
    // Header with the animation flag, the global parameters, one frame
    const webp = buildWebp([
      {
        type: 'VP8X',
        payload: Uint8Array.of(0x02, 0, 0, 0, 31, 0, 0, 23, 0, 0),
      },
      { type: 'ANIM', payload: new Uint8Array(6) },
      { type: 'ANMF', payload: new Uint8Array(24) },
      { type: 'EXIF', payload: ascii('not really TIFF') },
    ]);

    const types = readWebpChunks(written(writeEssentialWebp(webp))).map(
      (chunk) => chunk.type,
    );

    expect(types).toEqual(['VP8X', 'ANIM', 'ANMF']);
  });

  it('leaves a file in the simple format as it is', async () => {
    const webp = await bytes(picture().webp({ lossless: true }));
    expect(readWebpChunks(webp).map((chunk) => chunk.type)).toEqual(['VP8L']);

    expect(written(writeEssentialWebp(webp))).toEqual(webp);
  });

  it('drops bytes past the size the RIFF header declares', async () => {
    const base = await bytes(picture().webp({ lossless: true }));
    const webp = Uint8Array.from([...base, ...ascii('XTRA\x08\0\0\0appended')]);

    expect(written(writeEssentialWebp(webp))).toEqual(base);
  });

  it('carries the orientation over and nothing else of EXIF', async () => {
    const webp = await bytes(
      withCameraExif(picture(), 3).webp({ lossless: true }),
    );
    expect(contains(webp, 'TestCam')).toBe(true);

    const result = written(writeEssentialWebp(webp));

    const metadata = await sharp(result).metadata();
    expect(metadata.orientation).toBe(3);
    expect(metadata.exif?.length).toBe(26);
    expect(contains(result, 'TestCam')).toBe(false);
  });

  it('writes no EXIF for an upright image and clears the header flag', async () => {
    const webp = await bytes(
      withCameraExif(picture(), 1).webp({ lossless: true }),
    );
    expect(readWebpChunks(webp).map((chunk) => chunk.type)).toContain('EXIF');

    const chunks = readWebpChunks(written(writeEssentialWebp(webp)));

    // The color profile sharp adds along with the orientation stays
    expect(chunks.map((chunk) => chunk.type)).toEqual(['VP8X', 'ICCP', 'VP8L']);
    expect((chunks[0]?.payload[0] ?? 0) & 0x0c).toBe(0);
  });

  it('refuses a chunk that runs past the end of the file', async () => {
    const webp = await bytes(picture().webp({ lossless: true }));

    expect(writeEssentialWebp(webp.subarray(0, webp.length - 10))).toEqual({
      ok: false,
      error: 'WebP ends inside a chunk (VP8L)',
    });
  });

  it('refuses data that is not a WebP', () => {
    expect(writeEssentialWebp(new Uint8Array([1, 2, 3, 4])).ok).toBe(false);
  });
});
