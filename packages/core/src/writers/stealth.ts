/**
 * Stealth PNGInfo removal on decoded pixels
 *
 * The counterpart of readers/stealth.ts: where that reads the bitstream
 * hidden in pixel least-significant bits, this takes it out. Only those
 * bits change, so the picture looks the same.
 */

import { locateStealth, type PixelData } from '../readers/stealth';

/**
 * Clear stealth data from decoded pixels, in place
 *
 * - A payload found by its magic is overwritten for its whole length:
 *   alpha bits are set (an opaque pixel is opaque again), RGB bits are
 *   cleared.
 * - Alpha values of 254 in the opaque run the picture opens with are
 *   raised to 255, magic or not. That is what a payload looks like once
 *   its first pixels were painted over or cropped away: no reader finds
 *   it, yet writing the known magic back would bring it all back.
 *
 * @returns Whether any pixel was changed
 */
export function clearStealth(image: PixelData): boolean {
  const { width, height, channels, pixels } = image;
  let changed = false;

  for (const { mode, bits } of locateStealth(image)) {
    const pixelCount = Math.ceil(bits / (mode === 'alpha' ? 1 : 3));
    for (let i = 0; i < pixelCount; i++) {
      // Column-major, the order the bitstream is laid out in
      const at = ((i % height) * width + Math.floor(i / height)) * channels;
      if (mode === 'alpha') {
        const alpha = at + channels - 1;
        pixels[alpha] = (pixels[alpha] ?? 0) | 1;
      } else {
        pixels[at] = (pixels[at] ?? 0) & 0xfe;
        pixels[at + 1] = (pixels[at + 1] ?? 0) & 0xfe;
        pixels[at + 2] = (pixels[at + 2] ?? 0) & 0xfe;
      }
    }
    // A magic has bits of both values, so some pixel did change
    changed = true;
  }

  if (channels !== 3 && flattenOpaqueRun(image)) {
    changed = true;
  }
  return changed;
}

/**
 * Raise the 254s of the opaque run a picture opens with to 255
 *
 * The run is followed the way a payload is laid out, down the columns
 * from the first pixel, and ends at the first alpha below 254. A payload
 * written into an opaque picture leaves exactly that: 254 for a zero
 * bit, 255 for a one. Where the run ends the picture has alpha values of
 * its own, which are left alone, as is a picture that opens translucent.
 *
 * @returns Whether there was a 254 to raise
 */
function flattenOpaqueRun(image: PixelData): boolean {
  const { width, height, channels, pixels } = image;
  let changed = false;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const at = (y * width + x) * channels + channels - 1;
      const alpha = pixels[at] ?? 0;
      if (alpha < 254) {
        return changed;
      }
      if (alpha === 254) {
        pixels[at] = 255;
        changed = true;
      }
    }
  }
  return changed;
}
