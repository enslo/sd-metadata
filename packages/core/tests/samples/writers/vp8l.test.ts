import { describe, expect, it } from 'vitest';
import { decodeVp8l } from '../../../src/readers/vp8l';
import { rewriteVp8l } from '../../../src/writers/vp8l';
import { loadSample } from '../../helpers/samples';
import { webpChunk } from '../../helpers/webp-pixels';

const MAX_PIXELS = 8192 * 8192;

/**
 * rewriteVp8l on the image streams of real files. Rewriting leans on what
 * the original encoder chose (transforms, color cache, code groups,
 * backward references), and the lossless samples differ in exactly three
 * ways there, one sample for each:
 *
 * - novelai-curated.webp: no color cache, 54,000 backward references
 * - swarmui.webp: a color cache of 1,024 entries, 6,000 references
 * - dezgo.webp: no cross-color transform, next to no references
 *
 * The pixels are left as they are: a stream that stores them again
 * correctly, at the size it had, stores edited ones the same way. Edits
 * are covered on synthetic pictures in tests/unit/writers/vp8l.test.ts.
 */
const SAMPLES = ['novelai-curated.webp', 'swarmui.webp', 'dezgo.webp'];

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
