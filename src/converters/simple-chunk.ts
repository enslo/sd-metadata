/**
 * Simple chunk converter utilities
 *
 * Factory functions for converters that simply copy a single chunk keyword
 * between PNG and JPEG/WebP formats, with encoding based on tool strategy.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';

/**
 * Create a PNG-to-segments converter that extracts a single chunk by keyword
 *
 * @param keyword - The PNG chunk keyword to extract
 * @returns Converter function
 */
export function createPngToSegments(
  keyword: string,
): (chunks: PngTextChunk[]) => MetadataSegment[] {
  return (chunks) => {
    const chunk = chunks.find((c) => c.keyword === keyword);
    return !chunk
      ? []
      : [{ source: { type: 'exifUserComment' }, data: chunk.text }];
  };
}

/**
 * Create a segments-to-PNG converter that writes to a single chunk keyword
 *
 * Uses getEncodingStrategy to determine encoding based on keyword (tool name).
 *
 * @param keyword - The PNG chunk keyword to write (also used as tool name for strategy)
 * @returns Converter function
 */
export function createSegmentsToPng(
  keyword: string,
): (segments: MetadataSegment[]) => PngTextChunk[] {
  return (segments) => {
    const userComment = segments.find(
      (s) => s.source.type === 'exifUserComment',
    );
    if (!userComment) return [];

    // Use keyword as tool name for strategy lookup
    return createEncodedChunk(
      keyword,
      userComment.data,
      getEncodingStrategy(keyword),
    );
  };
}
