/**
 * Shared logic for JSON-based metadata converters
 *
 * Many formats (ComfyUI, InvokeAI) roughly follow a "Key-Value" pattern:
 * - PNG: Multiple chunks where Keyword=Key, Text=Value (Value might be JSON string)
 * - JPEG/WebP: A single UserComment containing a JSON object { Key: Value, ... }
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import {
  type ChunkEncodingStrategy,
  createEncodedChunk,
  unescapeUnicode,
} from './chunk-encoding';
import { findSegment, stringify } from './utils';

/**
 * Convert KV-style PNG chunks to a unified JSON object in a segment
 *
 * @param chunks - Raw PNG chunks
 * @returns Array containing a single UserComment segment with JSON data
 */
export function convertKvPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    const parsed = parseJson<unknown>(chunk.text);
    if (parsed.ok) {
      data[chunk.keyword] = parsed.value;
    } else {
      data[chunk.keyword] = chunk.text;
    }
  }

  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(data),
    },
  ];
}

/**
 * Convert a unified JSON object in a segment back to KV-style PNG chunks
 *
 * @param segments - Metadata segments
 * @param encodingStrategy - Encoding strategy to use for chunks
 * @returns Array of PNG chunks
 */
export function convertKvSegmentsToPng(
  segments: MetadataSegment[],
  encodingStrategy: ChunkEncodingStrategy,
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) {
    return [];
  }

  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (!parsed.ok) {
    // If not JSON, we can't blindly map keys.
    // Return empty here, letting specific converters handle fallback if needed.
    return [];
  }

  // Map each key back to a chunk
  // Value is stringified if it's an object/array
  // Unescape Unicode sequences that may have been escaped during PNG→JPEG conversion
  return Object.entries(parsed.value).flatMap(([keyword, value]) => {
    const text = stringify(value);
    return createEncodedChunk(
      keyword,
      text !== undefined ? unescapeUnicode(text) : undefined,
      encodingStrategy,
    );
  });
}
