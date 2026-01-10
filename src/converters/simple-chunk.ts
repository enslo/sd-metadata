/**
 * Simple chunk converter utilities
 *
 * Factory functions for converters that simply copy a single chunk keyword
 * between PNG and JPEG/WebP formats.
 */

import type { MetadataSegment, PngTextChunk } from '../types';

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
 * @param keyword - The PNG chunk keyword to write
 * @returns Converter function
 */
export function createSegmentsToPng(
  keyword: string,
): (segments: MetadataSegment[]) => PngTextChunk[] {
  return (segments) => {
    const userComment = segments.find(
      (s) => s.source.type === 'exifUserComment',
    );
    return !userComment
      ? []
      : [{ type: 'tEXt', keyword, text: userComment.data }];
  };
}
