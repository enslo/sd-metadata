/**
 * A1111-format metadata conversion utilities
 *
 * Handles conversion for sd-webui, forge-classic, forge-neo, and civitai.
 * A1111 format stores metadata as plain text in:
 * - PNG: `parameters` tEXt/iTXt chunk (dynamic selection)
 * - JPEG/WebP: Exif UserComment
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createEncodedChunk } from './chunk-encoding';

/**
 * Convert A1111-format PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertA1111PngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Find parameters chunk
  const parameters = chunks.find((c) => c.keyword === 'parameters');
  if (!parameters) {
    return [];
  }

  return [
    {
      source: { type: 'exifUserComment' },
      data: parameters.text,
    },
  ];
}

/**
 * Convert JPEG/WebP segments to A1111-format PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertA1111SegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Use dynamic selection (tEXt for ASCII, iTXt for non-ASCII)
  return createEncodedChunk('parameters', userComment.data, 'dynamic');
}
