/**
 * Blind metadata conversion for unrecognized formats
 *
 * Converts all chunks/segments between formats without understanding content.
 * Uses JSON to combine multiple chunks into single exifUserComment (NovelAI strategy).
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';

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
    // Reconstruct individual chunks with dynamic selection
    return Object.entries(parsed.value).flatMap(([keyword, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      if (!text) return [];
      return createEncodedChunk(keyword, text, getEncodingStrategy('blind'));
    });
  }

  // Not JSON: create single metadata chunk with dynamic selection
  return createEncodedChunk(
    'metadata',
    userComment.data,
    getEncodingStrategy('blind'),
  );
}
