/**
 * @enslo/sd-metadata-lite
 *
 * Lightweight AI image metadata reader for bookmarklets.
 * Reads PNG/JPEG/WebP files and returns A1111-format plain text.
 */

import { extract } from './extract';
import { readJpeg, readPng, readWebp } from './read';

/**
 * Parse AI-generated image metadata and return A1111-format text.
 *
 * Supports PNG, JPEG, and WebP formats across 18+ generation tools.
 * Returns empty string if no metadata is found.
 *
 * @param input - Image file data
 * @returns A1111-format metadata text, or empty string
 */
export function parse(input: Uint8Array | ArrayBuffer): string {
  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  // Format detection is intentionally loose (first 2 bytes only) to
  // minimize bundle size. False positives are harmless: the reader
  // will find no metadata and extract() returns "".

  // PNG: 89 50 (full signature: 89 50 4E 47 0D 0A 1A 0A)
  if (data[0] === 0x89 && data[1] === 0x50) {
    return extract(readPng(data));
  }

  // JPEG: FF D8
  if (data[0] === 0xff && data[1] === 0xd8) {
    return extract(readJpeg(data));
  }

  // WebP: 52 49 (full signature: RIFF....WEBP)
  if (data[0] === 0x52 && data[1] === 0x49) {
    return extract(readWebp(data));
  }

  return '';
}
