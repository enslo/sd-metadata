/**
 * Ruined Fooocus metadata conversion utilities
 *
 * Ruined Fooocus format stores metadata as JSON in the `parameters` chunk (PNG).
 * This is similar to HF-Space but uses different field names.
 */

import type { MetadataSegment, PngTextChunk } from '../types';

/**
 * Convert Ruined Fooocus PNG chunks to JPEG/WebP segments
 *
 * The parameters chunk contains JSON, which we preserve as-is.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertRuinedFooocusPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Find parameters chunk (contains JSON)
  const parameters = chunks.find((c) => c.keyword === 'parameters');
  if (!parameters) {
    return [];
  }

  // Copy JSON to exifUserComment
  return [
    {
      source: { type: 'exifUserComment' },
      data: parameters.text,
    },
  ];
}

/**
 * Convert JPEG/WebP segments to Ruined Fooocus PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertRuinedFooocusSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Find exifUserComment segment (contains JSON)
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Copy JSON to parameters chunk
  return [
    {
      type: 'tEXt',
      keyword: 'parameters',
      text: userComment.data,
    },
  ];
}
