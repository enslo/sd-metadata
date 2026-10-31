/**
 * Stability Matrix metadata conversion utilities
 *
 * Stability Matrix (Inference) stores metadata in four PNG chunks:
 * - prompt: ComfyUI node graph, written by the ComfyUI backend itself as
 *   ASCII JSON with `\uXXXX` escapes in a tEXt chunk
 * - parameters: A1111-style text
 * - parameters-json: JSON with the generation parameters
 * - smproj: project document (JSON)
 *
 * The three Stability Matrix chunks are written by `PngDataHelper`
 * (StabilityMatrix.Avalonia/Helpers). Since v2.16.0 (#1535) it emits an
 * iTXt chunk whenever the text contains characters beyond Latin-1 and a
 * tEXt chunk otherwise, with JSON serialized as raw Unicode. Earlier
 * versions always wrote tEXt (raw UTF-8 for `parameters`, `\u`-escaped
 * JSON for the rest); those files are still read, but the writer below
 * emulates the current, spec-compliant layout.
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
 * - prompt: ComfyUI's own chunk, ASCII JSON with Unicode escapes
 * - everything else: Stability Matrix >= 2.16.0 behaviour, iTXt for
 *   non-Latin-1 text and tEXt otherwise
 */
const STABILITY_MATRIX_ENCODING: ChunkEncodingMap = {
  prompt: 'text-unicode-escape',
  default: 'dynamic',
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
