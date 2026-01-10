/**
 * Fooocus metadata conversion utilities
 *
 * Fooocus format stores metadata as JSON in the `Comment` chunk (PNG).
 * This is similar to HF-Space but uses a different chunk keyword.
 */

import type { MetadataSegment, PngTextChunk } from '../types';

/**
 * Convert Fooocus PNG chunks to JPEG/WebP segments
 *
 * The Comment chunk contains JSON, which we preserve as-is.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertFooocusPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Find Comment chunk (contains JSON)
  const comment = chunks.find((c) => c.keyword === 'Comment');
  if (!comment) {
    return [];
  }

  // Copy JSON to exifUserComment
  return [
    {
      source: { type: 'exifUserComment' },
      data: comment.text,
    },
  ];
}

/**
 * Convert JPEG/WebP segments to Fooocus PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertFooocusSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Find exifUserComment segment (contains JSON)
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Copy JSON to Comment chunk
  return [
    {
      type: 'tEXt',
      keyword: 'Comment',
      text: userComment.data,
    },
  ];
}
