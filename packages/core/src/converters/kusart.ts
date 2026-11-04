/**
 * KusArt metadata conversion utilities
 *
 * KusArt writes PNG only, with two iTXt chunks: `Copyright` and `extra`
 * (indented JSON). For JPEG/WebP both are packed into one JSON object in
 * the EXIF UserComment, each chunk's text kept as a string so that the
 * PNG restored from it carries the same bytes (re-serializing `extra`
 * would drop its formatting and Go's <-style escapes).
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createITxtChunk, findSegment } from './utils';

/**
 * Convert KusArt PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertKusArtPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const data = Object.fromEntries(chunks.map((c) => [c.keyword, c.text]));

  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(data),
    },
  ];
}

/**
 * Convert JPEG/WebP segments to KusArt PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns iTXt chunks in the order of the packed object
 */
export function convertKusArtSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) return [];

  const parsed = parseJson(userComment.data);
  if (!parsed.ok || parsed.type !== 'object') return [];

  return Object.entries(parsed.value).flatMap(([keyword, text]) =>
    typeof text === 'string' ? createITxtChunk(keyword, text) : [],
  );
}
