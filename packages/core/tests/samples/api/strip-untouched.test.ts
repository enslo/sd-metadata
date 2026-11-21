import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { strip } from '../../../src/strip';
import {
  JPEG_SAMPLES,
  loadSample,
  PNG_SAMPLES,
  STEALTH_ALPHA_PNG_SAMPLES,
  STEALTH_RGB_PNG_SAMPLES,
  STEALTH_WEBP_SAMPLES,
  WEBP_SAMPLES,
} from '../../helpers/samples';
import { decodeWithSharp } from '../../helpers/webp-pixels';

/**
 * Samples without stealth data: the metadata goes and the picture stays
 * exactly what it was, color profile included (the reference decoder
 * applies it, so a dropped profile would show as different pixels).
 *
 * Kept apart from strip.test.ts because every image here is decoded
 * several times: two files run side by side.
 */
const UNTOUCHED: ['png' | 'jpg' | 'webp', string[]][] = [
  [
    'png',
    PNG_SAMPLES.filter(
      (name) =>
        !STEALTH_ALPHA_PNG_SAMPLES.includes(name) &&
        !STEALTH_RGB_PNG_SAMPLES.includes(name),
    ),
  ],
  ['jpg', JPEG_SAMPLES],
  ['webp', WEBP_SAMPLES.filter((name) => !STEALTH_WEBP_SAMPLES.includes(name))],
];

// Run side by side: most of the time goes to zlib streams and the
// reference decoder, both off the main thread
describe.concurrent('strip - samples without stealth data', () => {
  for (const [format, filenames] of UNTOUCHED) {
    for (const filename of filenames) {
      it(`removes the metadata and keeps the pixels: ${filename}`, async () => {
        const original = loadSample(format, filename);
        expect(read(original).status).not.toBe('empty');

        const result = await strip(original);

        expect(result).toMatchObject({ ok: true, stealthRemoved: false });
        if (!result.ok) return;
        expect(result.warning).toBeUndefined();
        expect((await parse(result.value)).status).toBe('empty');
        expect(result.value.length).toBeLessThan(original.length);

        const before = await decodeWithSharp(original);
        const after = await decodeWithSharp(result.value);
        expect(
          Buffer.from(after?.data ?? []).equals(
            Buffer.from(before?.data ?? [1]),
          ),
        ).toBe(true);
      });
    }
  }
});
