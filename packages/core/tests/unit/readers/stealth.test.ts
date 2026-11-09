import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  readStealthChunks,
  scanStealthPixels,
} from '../../../src/readers/stealth';
import { createMinimalPng } from '../../helpers/minimal-images';
import {
  createStealthPng,
  createStealthRgbaPixels,
} from '../../helpers/stealth-images';

/** A NovelAI-style JSON payload mirroring its tEXt chunk layout */
const NOVELAI_PAYLOAD = JSON.stringify({
  Description: 'masterpiece, 1girl',
  Software: 'NovelAI',
  Source: 'NovelAI Diffusion V4.5 TEST',
  'Generation time': '1.5',
  Comment: JSON.stringify({
    prompt: 'masterpiece, 1girl',
    steps: 28,
    seed: 123,
  }),
});

/** An A1111-style plain infotext payload */
const A1111_PAYLOAD =
  'masterpiece, 1girl\nNegative prompt: lowres\n' +
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

describe('readStealthChunks', () => {
  describe('alpha-channel variants', () => {
    it('extracts a gzipped JSON payload (stealth_pngcomp)', async () => {
      const png = createStealthPng({ payload: NOVELAI_PAYLOAD });

      const chunks = await readStealthChunks(png);

      expect(chunks).not.toBeNull();
      const record = Object.fromEntries(
        (chunks ?? []).map((chunk) => [chunk.keyword, chunk.text]),
      );
      expect(record.Software).toBe('NovelAI');
      expect(record.Description).toBe('masterpiece, 1girl');
      expect(record.Source).toBe('NovelAI Diffusion V4.5 TEST');
      expect(record['Generation time']).toBe('1.5');
      expect(JSON.parse(record.Comment ?? '')).toEqual({
        prompt: 'masterpiece, 1girl',
        steps: 28,
        seed: 123,
      });
    });

    it('extracts an uncompressed plain-text payload as a parameters chunk (stealth_pnginfo)', async () => {
      const png = createStealthPng({ payload: A1111_PAYLOAD, compress: false });

      const chunks = await readStealthChunks(png);

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
      ]);
    });
  });

  describe('rgb-channel variants', () => {
    it('extracts a gzipped payload from an RGB image (stealth_rgbcomp)', async () => {
      const png = createStealthPng({ payload: NOVELAI_PAYLOAD, mode: 'rgb' });

      const chunks = await readStealthChunks(png);

      expect(chunks).not.toBeNull();
      const record = Object.fromEntries(
        (chunks ?? []).map((chunk) => [chunk.keyword, chunk.text]),
      );
      expect(record.Software).toBe('NovelAI');
    });

    it('extracts an uncompressed payload from an RGB image (stealth_rgbinfo)', async () => {
      const png = createStealthPng({
        payload: A1111_PAYLOAD,
        mode: 'rgb',
        compress: false,
      });

      const chunks = await readStealthChunks(png);

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
      ]);
    });

    it('extracts rgb-channel data from an RGBA image', async () => {
      const png = createStealthPng({
        payload: A1111_PAYLOAD,
        mode: 'rgb',
        compress: false,
        colorType: 6,
      });

      const chunks = await readStealthChunks(png);

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
      ]);
    });
  });

  describe('graceful failure', () => {
    it('returns null when no stealth signature is present', async () => {
      const png = createStealthPng({
        payload: NOVELAI_PAYLOAD,
        magic: 'xxxxxxxxxxxxxxx',
      });

      expect(await readStealthChunks(png)).toBeNull();
    });

    it('returns null when the declared length exceeds image capacity', async () => {
      const png = createStealthPng({
        payload: A1111_PAYLOAD,
        compress: false,
        declaredBitLength: 100_000_000,
      });

      expect(await readStealthChunks(png)).toBeNull();
    });

    it('returns null when a compressed payload is not valid gzip', async () => {
      // stealth_pngcomp magic, but the payload is plain (uncompressed) text
      const png = createStealthPng({
        payload: A1111_PAYLOAD,
        compress: false,
        magic: 'stealth_pngcomp',
      });

      expect(await readStealthChunks(png)).toBeNull();
    });

    it('returns null for a PNG without pixel data', async () => {
      expect(await readStealthChunks(createMinimalPng())).toBeNull();
    });

    it('returns null for non-PNG data', async () => {
      expect(await readStealthChunks(new Uint8Array([1, 2, 3]))).toBeNull();
    });
  });
});

describe('scanStealthPixels', () => {
  it('extracts stealth data from an RGBA pixel buffer (alpha mode)', async () => {
    const pixels = createStealthRgbaPixels({
      payload: A1111_PAYLOAD,
      compress: false,
    });

    const chunks = await scanStealthPixels(pixels);

    expect(chunks).toEqual([
      { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
    ]);
  });

  it('extracts stealth data from an RGBA pixel buffer (rgb mode)', async () => {
    const pixels = createStealthRgbaPixels({
      payload: NOVELAI_PAYLOAD,
      mode: 'rgb',
    });

    const chunks = await scanStealthPixels(pixels);

    expect(chunks).not.toBeNull();
    const record = Object.fromEntries(
      (chunks ?? []).map((chunk) => [chunk.keyword, chunk.text]),
    );
    expect(record.Software).toBe('NovelAI');
  });

  it('accepts Uint8ClampedArray data (canvas getImageData shape)', async () => {
    const { data, width, height } = createStealthRgbaPixels({
      payload: A1111_PAYLOAD,
      compress: false,
    });
    const clamped = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );

    const chunks = await scanStealthPixels({ data: clamped, width, height });

    expect(chunks).toEqual([
      { type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD },
    ]);
  });

  it('returns null when the buffer is smaller than the dimensions claim', async () => {
    const { data } = createStealthRgbaPixels({
      payload: A1111_PAYLOAD,
      compress: false,
    });

    expect(
      await scanStealthPixels({ data, width: 10_000, height: 10_000 }),
    ).toBeNull();
  });

  it('returns null for pixels without stealth data', async () => {
    const data = new Uint8Array(64 * 64 * 4).fill(255);

    expect(await scanStealthPixels({ data, width: 64, height: 64 })).toBeNull();
  });
});

describe('readStealthChunks - decompression limits', () => {
  /** RGBA PNG around the given filtered scanlines, whatever their length */
  function pngFrom(
    width: number,
    height: number,
    scanlines: Uint8Array,
  ): Uint8Array {
    const chunk = (type: string, data: Uint8Array) => {
      const out = new Uint8Array(12 + data.length);
      new DataView(out.buffer).setUint32(0, data.length);
      out.set(new TextEncoder().encode(type), 4);
      out.set(data, 8);
      return out; // CRC left zero: the reader does not verify it
    };
    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const parts = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', new Uint8Array(deflateSync(scanlines))),
      chunk('IEND', new Uint8Array(0)),
    ];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  it('does not inflate IDAT past the scanlines the header declares', async () => {
    // A 32×20 RGBA image with stealth data whose IDAT stream goes on for
    // another mebibyte: the scan must not buffer what the image cannot hold
    const { data, width, height } = createStealthRgbaPixels({
      payload: 'hidden text',
      compress: false,
      width: 32,
      height: 20,
    });
    const stride = width * 4;
    const scanlines = new Uint8Array(height * (stride + 1) + 1024 * 1024);
    for (let y = 0; y < height; y++) {
      scanlines.set(
        data.subarray(y * stride, (y + 1) * stride),
        y * (stride + 1) + 1,
      );
    }

    expect(
      await readStealthChunks(pngFrom(width, height, scanlines)),
    ).toBeNull();
  });

  it('skips an image whose header claims more pixels than the scan decodes', async () => {
    // 20,000 × 20,000 RGBA would be 1.6 GB of pixels; the IDAT is tiny
    const png = pngFrom(20_000, 20_000, new Uint8Array(16));

    expect(await readStealthChunks(png)).toBeNull();
  });

  it('returns null when a compressed payload inflates past the payload limit', async () => {
    // 20 MiB of one letter gzip to a few KiB; no generation metadata is that large
    const png = createStealthPng({
      payload: 'x'.repeat(20 * 1024 * 1024),
      compress: true,
      width: 512,
      height: 512,
    });

    expect(await readStealthChunks(png)).toBeNull();
  });
});

describe('readStealthChunks - scanline filters', () => {
  const payload = 'masterpiece, 1girl\nSteps: 20, Seed: 42';

  for (const filter of [1, 2, 3, 4] as const) {
    it(`reads a payload through filter type ${filter} scanlines`, async () => {
      const png = createStealthPng({ payload, compress: false, filter });

      const chunks = await readStealthChunks(png);

      expect(chunks?.map((c) => c.text)).toEqual([payload]);
    });
  }

  it('reads an rgb-channel payload through Paeth-filtered RGB scanlines', async () => {
    const png = createStealthPng({ payload, mode: 'rgb', filter: 4 });

    const chunks = await readStealthChunks(png);

    expect(chunks?.map((c) => c.text)).toEqual([payload]);
  });
});
