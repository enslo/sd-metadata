import { describe, expect, it } from 'vitest';
import { decodeVp8l } from '../../../src/readers/vp8l';
import { rewriteVp8l } from '../../../src/writers/vp8l';
import { loadSample } from '../../helpers/samples';
import { webpChunk } from '../../helpers/webp-pixels';

const MAX_PIXELS = 8192 * 8192;

/**
 * rewriteVp8l on the image streams of real files, one per tool whose
 * WebP output is lossless among the samples. Rewriting leans on what the
 * original encoder chose (transforms, color cache, code groups, backward
 * references), and those choices differ from encoder to encoder: NovelAI
 * uses no color cache, for one, where libwebp's defaults do.
 *
 * The pixels are left as they are: a stream that stores them again
 * correctly, at the size it had, stores edited ones the same way. Edits
 * are covered on synthetic pictures in tests/unit/writers/vp8l.test.ts.
 */
const SAMPLES = [
  'novelai-curated.webp',
  'comfyui-saveimage-plus.webp',
  'dezgo.webp',
  'sd-next.webp',
  'swarmui.webp',
  'empty.webp',
];

// Megapixel streams: decoding twice and rewriting takes a while on a slow
// machine
describe('rewriteVp8l - samples', { timeout: 30_000 }, () => {
  for (const filename of SAMPLES) {
    it(`stores the image again as the original stream did: ${filename}`, () => {
      const stream = webpChunk(loadSample('webp', filename), 'VP8L');
      const decoded = decodeVp8l(stream, {
        maxPixels: MAX_PIXELS,
        layout: true,
      });
      if (!decoded.layout) throw new Error('no layout');

      const rewritten = rewriteVp8l(
        stream,
        decoded.layout,
        decoded.height,
        decoded.pixels,
      );

      const again = decodeVp8l(rewritten, { maxPixels: MAX_PIXELS });
      expect(
        Buffer.from(again.pixels.buffer).equals(
          Buffer.from(decoded.pixels.buffer),
        ),
      ).toBe(true);
      // Only the prefix codes are built anew, from the same symbol counts
      expect(rewritten.length / stream.length).toBeGreaterThan(0.995);
      expect(rewritten.length / stream.length).toBeLessThan(1.005);
    });
  }
});
