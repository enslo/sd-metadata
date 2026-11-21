import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { readChunkType, readUint32BE } from '../../../src/utils/binary';
import { writePngMetadata } from '../../../src/writers/png';
import {
  createMinimalJpeg,
  createMinimalPng,
  createMinimalWebp,
} from '../../helpers/minimal-images';
import { loadVendorSample } from '../../helpers/samples';
import {
  createStealthPng,
  createStealthRgbaPixels,
} from '../../helpers/stealth-images';
import { encodeWebp } from '../../helpers/webp-pixels';

const A1111_PAYLOAD =
  'masterpiece, 1girl\nNegative prompt: lowres\n' +
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123, Size: 512x768';

describe('parse', () => {
  it('recovers A1111 metadata from a stealth-only PNG', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });

    // The chunk-based path sees nothing...
    expect(read(png).status).toBe('empty');

    // ...but parse() recovers the pixel-embedded metadata.
    const result = await parse(png);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.stealth).toBe(true);
      expect(result.metadata.software).toBe('sd-webui');
      expect(result.metadata.prompt).toBe('masterpiece, 1girl');
      expect(result.metadata.negativePrompt).toBe('lowres');
      expect(result.metadata.width).toBe(512);
      expect(result.metadata.height).toBe(768);
      expect(result.raw).toEqual({
        format: 'png',
        chunks: [{ type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD }],
      });
    }
  });

  it('returns unrecognized with synthesized chunks for unknown stealth text', async () => {
    const png = createStealthPng({
      payload: 'some text no parser understands',
      compress: false,
    });

    const result = await parse(png);

    expect(result.status).toBe('unrecognized');
    if (result.status === 'unrecognized') {
      expect(result.stealth).toBe(true);
      expect(result.raw).toEqual({
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'parameters',
            text: 'some text no parser understands',
          },
        ],
      });
    }
  });

  it('matches read() for a PNG without metadata or stealth data', async () => {
    const png = createMinimalPng();

    expect(await parse(png)).toEqual(read(png));
    expect((await parse(png)).status).toBe('empty');
  });

  it('matches read() for non-PNG formats', async () => {
    const jpeg = createMinimalJpeg();

    expect(await parse(jpeg)).toEqual(read(jpeg));
  });

  it('returns invalid for unknown data', async () => {
    const result = await parse(new Uint8Array([1, 2, 3, 4]));

    expect(result.status).toBe('invalid');
  });

  it('accepts ArrayBuffer input', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    const buffer = png.buffer.slice(
      png.byteOffset,
      png.byteOffset + png.byteLength,
    );

    const result = await parse(buffer as ArrayBuffer);

    expect(result.status).toBe('success');
  });
});

describe('parse - WebP stealth', () => {
  it('recovers metadata from a lossless WebP', async () => {
    const webp = await encodeWebp(
      createStealthRgbaPixels({ payload: A1111_PAYLOAD }),
      { lossless: true },
    );

    // The chunk-based path sees nothing...
    expect(read(webp).status).toBe('empty');

    // ...but parse() decodes the pixels and recovers the metadata.
    const result = await parse(webp);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.stealth).toBe(true);
      expect(result.metadata.software).toBe('sd-webui');
      expect(result.metadata.prompt).toBe('masterpiece, 1girl');
      // Stealth raw metadata is chunk-shaped regardless of container.
      expect(result.raw).toEqual({
        format: 'png',
        chunks: [{ type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD }],
      });
    }
  });

  it('recovers RGB-embedded metadata from a lossless WebP', async () => {
    const webp = await encodeWebp(
      createStealthRgbaPixels({ payload: A1111_PAYLOAD, mode: 'rgb' }),
      { lossless: true },
    );

    const result = await parse(webp);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.stealth).toBe(true);
  });

  it('recovers alpha-embedded metadata from a lossy WebP', async () => {
    // A lossy WebP stores its alpha plane losslessly, so the bits hidden
    // there survive a lossy re-save
    const webp = await encodeWebp(
      createStealthRgbaPixels({ payload: A1111_PAYLOAD }),
      { quality: 80 },
    );

    const result = await parse(webp);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.stealth).toBe(true);
      expect(result.metadata.prompt).toBe('masterpiece, 1girl');
    }
  });

  it('finds nothing in a lossy WebP when the metadata was in the colors', async () => {
    const webp = await encodeWebp(
      createStealthRgbaPixels({ payload: A1111_PAYLOAD, mode: 'rgb' }),
      { quality: 80 },
    );

    expect((await parse(webp)).status).toBe('empty');
  });
});

describe('parse - deprecated decodePixels', () => {
  const stealthPixels = createStealthRgbaPixels({ payload: A1111_PAYLOAD });

  it('is not asked for a WebP the built-in decoder reads', async () => {
    const webp = await encodeWebp(stealthPixels, { lossless: true });
    let called = false;

    const result = await parse(webp, {
      decodePixels: async () => {
        called = true;
        return null;
      },
    });

    expect(called).toBe(false);
    expect(result.status).toBe('success');
  });

  it('is asked for a WebP without losslessly stored pixels', async () => {
    const webp = createMinimalWebp();
    const formats: string[] = [];

    const result = await parse(webp, {
      decodePixels: async (_data, format) => {
        formats.push(format);
        return stealthPixels;
      },
    });

    expect(formats).toEqual(['webp']);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.stealth).toBe(true);
      expect(result.metadata.software).toBe('sd-webui');
      expect(result.metadata.prompt).toBe('masterpiece, 1girl');
      // Stealth raw metadata is chunk-shaped regardless of container.
      expect(result.raw).toEqual({
        format: 'png',
        chunks: [{ type: 'tEXt', keyword: 'parameters', text: A1111_PAYLOAD }],
      });
    }
  });

  it('returns the chunk-based result when the callback yields null', async () => {
    const webp = createMinimalWebp();

    const result = await parse(webp, { decodePixels: async () => null });

    expect(result.status).toBe('empty');
  });

  it('returns the chunk-based result without a callback', async () => {
    // A lossy image chunk alone: nothing the built-in decoder can read
    expect((await parse(createMinimalWebp())).status).toBe('empty');
  });

  it('survives a throwing callback', async () => {
    const result = await parse(createMinimalWebp(), {
      decodePixels: async () => {
        throw new Error('decoder exploded');
      },
    });

    expect(result.status).toBe('empty');
  });

  it('does not invoke the callback for PNG input', async () => {
    const png = createStealthPng({ payload: A1111_PAYLOAD });
    let called = false;

    const result = await parse(png, {
      decodePixels: async () => {
        called = true;
        return null;
      },
    });

    expect(called).toBe(false);
    expect(result.status).toBe('success');
  });
});

describe('parse - vendor declarations', () => {
  /** The first chunk of the given type: length, type, data and CRC */
  function pngChunk(png: Uint8Array, type: string): Uint8Array {
    let offset = 8;
    while (offset + 8 <= png.length) {
      const length = readUint32BE(png, offset);
      if (readChunkType(png, offset + 4) === type) {
        return png.slice(offset, offset + 12 + length);
      }
      offset += 12 + length;
    }
    throw new Error(`no ${type} chunk`);
  }

  /** The PNG with a chunk inserted right after IHDR */
  function withChunkAfterIhdr(png: Uint8Array, chunk: Uint8Array): Uint8Array {
    const ihdrEnd = 8 + 12 + 13;
    const out = new Uint8Array(png.length + chunk.length);
    out.set(png.subarray(0, ihdrEnd), 0);
    out.set(chunk, ihdrEnd);
    out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return out;
  }

  it('does not scan the pixels of an image that declares its vendor', async () => {
    // The C2PA manifest of a vendor sample, moved into a PNG whose pixels
    // carry stealth data: the declaration decides and the scan is skipped,
    // as commercial services never write stealth data
    const manifest = pngChunk(
      loadVendorSample('png', 'gemini_3.1pro.png'),
      'caBX',
    );
    const png = withChunkAfterIhdr(
      createStealthPng({ payload: A1111_PAYLOAD }),
      manifest,
    );

    const chunkResult = read(png);
    expect(chunkResult.status).toBe('vendor');
    expect(await parse(png)).toEqual(chunkResult);
  });

  it('still scans the pixels of an image whose chunks are unrecognized', async () => {
    const written = writePngMetadata(
      createStealthPng({ payload: A1111_PAYLOAD }),
      [{ type: 'tEXt', keyword: 'unknown_tool', text: 'some data' }],
    );
    if (!written.ok) throw new Error(written.error.type);

    expect(read(written.value).status).toBe('unrecognized');
    const result = await parse(written.value);
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.stealth).toBe(true);
  });
});
