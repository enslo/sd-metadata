import { describe, expect, it } from 'vitest';
import { readStealthChunks } from '../../../src/readers/stealth';
import { createMinimalPng } from '../../helpers/minimal-images';
import { createStealthPng } from '../../helpers/stealth-images';

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
