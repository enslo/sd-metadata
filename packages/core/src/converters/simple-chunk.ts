/**
 * Simple chunk conversion utilities
 *
 * Handles conversion for tools that keep all their metadata as JSON in a
 * single place (Ruined Fooocus, HuggingFace Space):
 * - PNG: `parameters` tEXt chunk, non-ASCII characters as Unicode escapes
 * - JPEG/WebP: Exif UserComment
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createEncodedChunk } from './chunk-encoding';

/**
 * Convert the `parameters` PNG chunk to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertSimpleChunkPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const chunk = chunks.find((c) => c.keyword === 'parameters');
  return !chunk
    ? []
    : [{ source: { type: 'exifUserComment' }, data: chunk.text }];
}

/**
 * Convert JPEG/WebP segments to the `parameters` PNG chunk
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertSimpleChunkSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) return [];

  return createEncodedChunk(
    'parameters',
    userComment.data,
    'text-unicode-escape',
  );
}
