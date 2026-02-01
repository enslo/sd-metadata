/**
 * TensorArt metadata conversion utilities
 *
 * TensorArt stores metadata with two PNG chunks:
 * - generation_data: JSON with generation params (RAW UTF-8 - non-compliant but matches original)
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
 * Chunk encoding map for TensorArt
 *
 * - generation_data: RAW UTF-8 (contains Japanese chars in prompts)
 * - All others: Unicode escape (ComfyUI node graph)
 */
const TENSORART_ENCODING: ChunkEncodingMap = {
  generation_data: 'text-utf8-raw',
  default: 'text-unicode-escape',
};

/**
 * Convert TensorArt PNG chunks to JPEG/WebP segments
 *
 * Combines all chunks into a single JSON object stored in exifUserComment.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertTensorArtPngToSegments(
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
 * Convert JPEG/WebP segments to TensorArt PNG chunks
 *
 * Splits the JSON object back into individual chunks with per-chunk encoding.
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertTensorArtSegmentsToPng(
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

  return createEncodedChunks(entries, TENSORART_ENCODING);
}
