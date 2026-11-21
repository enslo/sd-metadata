import { describe, expect, it } from 'vitest';
import { decodeWebpPixels } from '../../../src/readers/webp-pixels';
import { loadSample, WEBP_SAMPLES } from '../../helpers/samples';
import { decodeWithSharp } from '../../helpers/webp-pixels';

const MAX_BYTES = 256 * 1024 * 1024;

/**
 * Samples stored losslessly (a VP8L chunk), the only WebP pixels that can
 * carry stealth data. NovelAI's WebP export is among them, with the
 * stealth bits in alpha; the rest come from several other encoders, which
 * makes the set a broad check of the decoder against real files.
 *
 * Every other sample is lossy without an alpha plane: nothing to decode.
 */
const LOSSLESS_SAMPLES = [
  'comfyui-animated-webp.webp',
  'comfyui-comfy-image-saver.webp',
  'comfyui-saveimage-plus.webp',
  'comfyui-saveimagewithmetadata.webp',
  'dezgo-long.webp',
  'dezgo.webp',
  'novelai-curated.webp',
  'novelai-full-3char.webp',
  'novelai-v3.webp',
  'novelai-v5-full.webp',
  'sd-next-hires.webp',
  'sd-next.webp',
  'swarmui.webp',
];

describe('decodeWebpPixels - samples', () => {
  it('lists only samples that exist', () => {
    for (const filename of LOSSLESS_SAMPLES) {
      expect(WEBP_SAMPLES).toContain(filename);
    }
  });

  it('decodes a lossless file that has no extended header: empty.webp', async () => {
    // The metadata-free sample is a bare VP8L chunk, where the samples
    // above all open with VP8X because they carry an EXIF chunk
    const sample = loadSample('webp', 'empty.webp');
    const reference = await decodeWithSharp(sample);
    if (!reference) throw new Error('reference decoder failed');

    const decoded = decodeWebpPixels(sample, MAX_BYTES);

    expect(decoded?.channels).toBe(4);
    expect(
      Buffer.from(decoded?.pixels ?? []).equals(Buffer.from(reference.data)),
    ).toBe(true);
  });

  for (const filename of WEBP_SAMPLES) {
    if (LOSSLESS_SAMPLES.includes(filename)) {
      it(`decodes the same pixels as libwebp: ${filename}`, async () => {
        const sample = loadSample('webp', filename);
        const reference = await decodeWithSharp(sample);
        if (!reference) throw new Error('reference decoder failed');

        const decoded = decodeWebpPixels(sample, MAX_BYTES);

        expect(decoded?.width).toBe(reference.width);
        expect(decoded?.height).toBe(reference.height);
        expect(decoded?.channels).toBe(4);
        // Compared as one value: a megabyte-sized diff is unreadable
        expect(
          Buffer.from(decoded?.pixels ?? []).equals(
            Buffer.from(reference.data),
          ),
        ).toBe(true);
      });
    } else {
      it(`finds no losslessly stored pixels: ${filename}`, () => {
        expect(
          decodeWebpPixels(loadSample('webp', filename), MAX_BYTES),
        ).toBeNull();
      });
    }
  }
});
