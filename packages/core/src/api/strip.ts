/**
 * Strip API for sd-metadata
 *
 * Leaves an image with nothing but what it takes to display it: every
 * metadata chunk and segment goes, known to this library or not, and so
 * does Stealth PNGInfo, the copy some tools hide in pixel
 * least-significant bits.
 */

import { decodePngPixels, MAX_PIXEL_BYTES } from '../readers/stealth';
import { decodeWebpPixels } from '../readers/webp-pixels';
import type { StripResult, StripWarning } from '../types';
import { detectFormat, toUint8Array } from '../utils/binary';
import {
  writeEssentialJpeg,
  writeEssentialPng,
  writeEssentialWebp,
} from '../writers/essentials';
import { writePngPixels } from '../writers/png-pixels';
import { clearStealth } from '../writers/stealth';

/**
 * Remove all metadata from an image, stealth data included
 *
 * The result keeps what a decoder uses (the image data, transparency,
 * color profile, animation) and drops everything else, whether this
 * library can read it or not: text chunks, EXIF, XMP, comments, C2PA
 * manifests, vendor blocks, anything after the end of the image.
 * `write(image, { status: 'empty' })`, by contrast, only empties the
 * metadata it manages and passes every other chunk through.
 *
 * Stealth PNGInfo is taken out of the pixels as well. That changes only
 * the least-significant bits that carried it, and the image data is
 * compressed again; an image without stealth data keeps its image data
 * byte for byte.
 *
 * The picture looks the same afterwards. For that, one EXIF value is
 * carried over: the orientation, when the image is stored turned.
 *
 * When stealth data could not be looked for or could not be removed, the
 * image is still returned, with a {@link StripWarning} saying so.
 *
 * @example
 * ```typescript
 * import { strip } from '@enslo/sd-metadata/strip';
 *
 * const result = await strip(imageData);
 * if (result.ok && !result.warning) {
 *   writeFileSync('clean.png', result.value);
 * }
 * ```
 *
 * @param input - Image file data (Uint8Array or ArrayBuffer)
 * @returns The image without metadata (with a warning if stealth data may
 *   remain)
 */
export async function strip(
  input: Uint8Array | ArrayBuffer,
): Promise<StripResult> {
  const data = toUint8Array(input);
  const format = detectFormat(data);
  if (!format) {
    return { ok: false, error: { type: 'unsupportedFormat' } };
  }

  // Pixels first. JPEG is left out: its pixels are lossy, and nothing
  // hidden in their low bits survives the encoder.
  let image = data;
  let stealthRemoved = false;
  let warning: StripWarning | undefined;
  if (format === 'png') {
    const pixels = await decodePngPixels(data);
    if (typeof pixels === 'string') {
      warning = { type: 'stealthUnchecked', reason: pixels };
    } else if (clearStealth(pixels)) {
      try {
        image = await writePngPixels(data, pixels);
        stealthRemoved = true;
      } catch {
        // The runtime cannot compress the pixels again
        warning = { type: 'stealthRemains' };
      }
    }
  } else if (format === 'webp') {
    // WebP pixels cannot be written back yet: clear a decoded copy only
    // to learn whether there is anything to remove, and say so
    const pixels = decodeWebpPixels(data, MAX_PIXEL_BYTES);
    if (pixels && clearStealth(pixels)) {
      warning = { type: 'stealthRemains' };
    }
  }

  // Then the container: keep what a decoder uses, drop the rest
  const written =
    format === 'png'
      ? writeEssentialPng(image)
      : format === 'jpeg'
        ? writeEssentialJpeg(image)
        : writeEssentialWebp(image);
  if (!written.ok) {
    return {
      ok: false,
      error: { type: 'writeFailed', message: written.error },
    };
  }
  return warning
    ? { ok: true, value: written.value, stealthRemoved, warning }
    : { ok: true, value: written.value, stealthRemoved };
}
