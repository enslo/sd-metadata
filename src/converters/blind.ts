/**
 * Blind metadata conversion for unrecognized formats
 *
 * Converts all chunks/segments between formats without understanding content.
 * Uses JSON to combine multiple chunks into single exifUserComment (NovelAI strategy).
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';

/**
 * Convert ALL PNG chunks to SINGLE exifUserComment segment with JSON
 *
 * Uses NovelAI strategy: combines all chunks into JSON object
 * to work around Exif's single UserComment limitation.
 *
 * @param chunks - All PNG text chunks from image
 * @returns Single exifUserComment segment with JSON data
 */
export function blindPngToSegments(chunks: PngTextChunk[]): MetadataSegment[] {
  if (chunks.length === 0) return [];

  // Create object: { keyword: text, ... }
  const chunkMap = Object.fromEntries(
    chunks.map((chunk) => [chunk.keyword, chunk.text]),
  );

  // Return single UserComment with JSON
  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(chunkMap),
    },
  ];
}

/**
 * Convert exifUserComment JSON back to PNG chunks
 *
 * Parses NovelAI-style JSON format and converts back to chunks.
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function blindSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) return [];

  // Try to parse as JSON
  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (parsed.ok) {
    // Convert JSON object back to chunks
    return Object.entries(parsed.value)
      .map(([keyword, value]) => {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        return { type: 'tEXt' as const, keyword, text };
      })
      .filter((chunk) => chunk.text); // Remove empty chunks
  }

  // Fallback: if not JSON, treat as single chunk
  return [{ type: 'tEXt', keyword: 'metadata', text: userComment.data }];
}
