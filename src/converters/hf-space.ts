/**
 * HuggingFace Space metadata conversion utilities
 *
 * HF-Space format stores metadata as JSON in the `parameters` chunk.
 * This is different from A1111 which uses plain text.
 */

import type { MetadataSegment, PngTextChunk } from '../types';

/**
 * Convert HF-Space PNG chunks to JPEG/WebP segments
 *
 * The parameters chunk contains JSON, which we preserve as-is.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertHfSpacePngToSegments(
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
 * Convert JPEG/WebP segments to HF-Space PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertHfSpaceSegmentsToPng(
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
