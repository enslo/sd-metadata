/**
 * Test-only WebP pixel decoding via sharp
 *
 * Node.js has no platform image decoder, so tests exercise the
 * ReadOptions.decodePixels escape hatch exactly the way a Node.js
 * consumer would: by injecting a sharp-backed decoder.
 */

import sharp from 'sharp';
import type { RgbaPixels } from '../../src/types';

/**
 * Decode an image to RGBA pixels using sharp
 */
export async function decodeWithSharp(
  data: Uint8Array,
): Promise<RgbaPixels | null> {
  const { data: pixels, info } = await sharp(data)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(pixels),
    width: info.width,
    height: info.height,
  };
}
