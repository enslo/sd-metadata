/**
 * Fooocus metadata conversion utilities
 *
 * Fooocus stores metadata in:
 * - PNG: `parameters` chunk plus a `fooocus_scheme` chunk whose value names
 *   the metadata scheme (`fooocus` for JSON, `a1111` for A1111-style text)
 * - JPEG/WebP: Exif UserComment; Fooocus names the scheme in MakerNote
 *   (0x927C), a tag this library does not read
 *
 * The scheme is recoverable from the content itself: JSON text is the
 * `fooocus` scheme, anything else is the `a1111` scheme. Fooocus writes the
 * JSON with non-ASCII characters escaped into a tEXt chunk, and the A1111
 * text as-is (iTXt when it contains non-Latin-1 characters), so the PNG
 * encoding is chosen per scheme to match Fooocus's own output.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createEncodedChunk } from './chunk-encoding';

/** Value of the `fooocus_scheme` chunk for each metadata scheme */
type FooocusScheme = 'fooocus' | 'a1111';

/**
 * Determine the Fooocus metadata scheme from the metadata text
 *
 * @param text - Content of the `parameters` chunk or UserComment
 * @returns `fooocus` for JSON content, `a1111` otherwise
 */
function detectScheme(text: string): FooocusScheme {
  return text.trimStart().startsWith('{') ? 'fooocus' : 'a1111';
}

/**
 * Convert Fooocus PNG chunks to JPEG/WebP segments
 *
 * Only the `parameters` chunk is carried over; the `fooocus_scheme` chunk
 * is dropped because the JPEG/WebP readers carry no equivalent tag (Fooocus
 * writes it to MakerNote, which is not read), and the scheme can be
 * re-derived from the content when converting back.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertFooocusPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const parameters = chunks.find((c) => c.keyword === 'parameters');
  if (!parameters) {
    return [];
  }

  return [{ source: { type: 'exifUserComment' }, data: parameters.text }];
}

/**
 * Convert JPEG/WebP segments to Fooocus PNG chunks
 *
 * Restores the `fooocus_scheme` chunk from the content so that the result
 * matches a PNG written by Fooocus itself.
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks (`parameters` followed by `fooocus_scheme`)
 */
export function convertFooocusSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  const scheme = detectScheme(userComment.data);

  // JSON: tEXt with Unicode escapes (Fooocus writes ensure_ascii JSON)
  // A1111 text: tEXt for Latin-1, iTXt otherwise (same as the A1111 family)
  const parameters = createEncodedChunk(
    'parameters',
    userComment.data,
    scheme === 'fooocus' ? 'text-unicode-escape' : 'dynamic',
  );
  const schemeChunk = createEncodedChunk(
    'fooocus_scheme',
    scheme,
    'text-utf8-raw',
  );

  return [...parameters, ...schemeChunk];
}
