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
 * Supports PNG, JPEG, and WebP formats across 18+ generation tools. For PNG
 * and JPEG images with no generation parameters, falls back to C2PA Content
 * Credentials and returns the name of the tool that made the image
 * (`ChatGPT`, `Kling AI`, `Grok Imagine`), or of the program that signed it
 * when the manifest names no tool (Gemini exports).
 * Returns empty string if no metadata is found.
 *
 * @param input - Image file data
 * @returns A1111-format metadata text, a C2PA tool name, or empty string
 */
export function parse(input: Uint8Array | ArrayBuffer): string {
  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  // Format detection is intentionally loose (first 2 bytes only) to
  // minimize bundle size. False positives are harmless: the reader
  // will find no metadata and extract() returns "".
  //
  // The two bytes are compared as one number, which costs less than a pair
  // of comparisons per format. Data of any other kind has no entries, and
  // extract() returns "" for an empty set too.
  const magic = (data[0]! << 8) | data[1]!;
  return extract(
    magic === 0x8950 // PNG (full signature: 89 50 4E 47 0D 0A 1A 0A)
      ? readPng(data)
      : magic === 0xffd8 // JPEG
        ? readJpeg(data)
        : magic === 0x5249 // WebP (full signature: RIFF....WEBP)
          ? readWebp(data)
          : {},
  );
}
