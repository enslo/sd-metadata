import { describe, expect, it } from 'vitest';
import { decodePixelsWithPlatform } from '../../../src/readers/pixel-decode';

describe('decodePixelsWithPlatform', () => {
  it('returns null when the platform provides no image decoder', async () => {
    // Node.js ships neither ImageDecoder nor createImageBitmap with a
    // 2D canvas, so the platform tiers must fail gracefully — this is
    // the environment where ReadOptions.decodePixels takes over.
    expect('ImageDecoder' in globalThis).toBe(false);

    const result = await decodePixelsWithPlatform(
      new Uint8Array([1, 2, 3, 4]),
      'image/webp',
    );

    expect(result).toBeNull();
  });
});
