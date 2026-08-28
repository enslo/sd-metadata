import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import {
  createMinimalJpeg,
  createMinimalPng,
  createMinimalWebp,
} from '../../helpers/minimal-images';
import {
  createStealthPng,
  createStealthRgbaPixels,
} from '../../helpers/stealth-images';

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

describe('parse - WebP stealth via decodePixels', () => {
  const stealthPixels = createStealthRgbaPixels({ payload: A1111_PAYLOAD });

  it('recovers metadata from pixels supplied by the callback', async () => {
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

  it('returns the chunk-based result when no decoder is available', async () => {
    // Node.js has no platform decoder and no callback is supplied.
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
