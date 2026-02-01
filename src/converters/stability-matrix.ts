/**
 * Stability Matrix metadata conversion utilities
 *
 * Stability Matrix stores metadata with multiple PNG chunks:
 * - parameters: A1111-style text (RAW UTF-8 - non-compliant but matches original)
 * - parameters-json: JSON with generation params (Unicode escape)
 * - smproj: Project data (Unicode escape)
 * - prompt: ComfyUI node graph JSON (Unicode escape)
 *
 * Per-chunk encoding is critical for round-trip compatibility.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import {
  type ChunkEncodingMap,
  createEncodedChunks,
  unescapeUnicode,
} from './chunk-encoding';
import { findSegment, stringify } from './utils';

/**
 * Chunk encoding map for Stability Matrix
 *
 * - parameters: RAW UTF-8 (A1111-style text with Japanese chars)
 * - All others: Unicode escape (JSON should be ASCII-safe)
 */
const STABILITY_MATRIX_ENCODING: ChunkEncodingMap = {
  parameters: 'text-utf8-raw',
  default: 'text-unicode-escape',
};

/**
 * Convert Stability Matrix PNG chunks to JPEG/WebP segments
 *
 * Combines all chunks into a single JSON object stored in exifUserComment.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertStabilityMatrixPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    const parsed = parseJson(chunk.text);
    data[chunk.keyword] = parsed.ok ? parsed.value : chunk.text;
  }

  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(data),
    },
  ];
}

/**
 * Convert JPEG/WebP segments to Stability Matrix PNG chunks
 *
 * Splits the JSON object back into individual chunks with per-chunk encoding.
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertStabilityMatrixSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) return [];

  const parsed = parseJson(userComment.data);
  if (!parsed.ok || parsed.type !== 'object') return [];

  const value = parsed.value as Record<string, unknown>;

  // Build entries from all keys in the object
  const entries: [string, string | undefined][] = Object.entries(value).map(
    ([key, val]) => {
      const text = stringify(val);
      return [key, text !== undefined ? unescapeUnicode(text) : undefined];
    },
  );

  return createEncodedChunks(entries, STABILITY_MATRIX_ENCODING);
}
