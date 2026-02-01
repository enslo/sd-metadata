/**
 * CivitAI metadata conversion utilities
 *
 * CivitAI has TWO formats:
 *
 * 1. CivitAI Orchestration (ComfyUI-like JSON):
 *    - Node IDs as keys instead of standard "prompt"/"workflow" chunks
 *    - "resource-stack" for model/checkpoint info
 *    - "extra" and "extraMetadata" for CivitAI-specific data
 *
 * 2. CivitAI A1111 (plain text):
 *    - Standard A1111 format with "Civitai resources:" marker
 *    - Should be converted like regular A1111
 *
 * This converter handles BOTH formats by detecting the data type.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { convertA1111PngToSegments, convertA1111SegmentsToPng } from './a1111';
import { createEncodedChunk } from './chunk-encoding';
import { findSegment } from './utils';

/**
 * Convert CivitAI PNG chunks to JPEG/WebP segments
 *
 * Handles BOTH CivitAI formats:
 * - Orchestration (prompt chunk with JSON): Combine into single JSON object
 * - A1111 (parameters chunk with text): Preserve as A1111 format
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertCivitaiPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Check if this is A1111-style (has parameters chunk with non-JSON text)
  const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
  if (parametersChunk && !parametersChunk.text.trimStart().startsWith('{')) {
    // A1111-style: use A1111 converter
    return convertA1111PngToSegments(chunks);
  }

  // Orchestration-style: combine chunks into JSON
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    if (chunk.keyword === 'prompt') {
      // Expand prompt chunk contents as top-level keys
      const parsed = parseJson(chunk.text);
      if (parsed.ok && parsed.type === 'object') {
        Object.assign(data, parsed.value);
      }
    } else if (chunk.keyword === 'extraMetadata') {
      // Keep extraMetadata as string (matches original JPEG format)
      // The parser expects a JSON string, not a parsed object
      data[chunk.keyword] = chunk.text;
    } else {
      // Other chunks: parse JSON if possible
      const parsed = parseJson(chunk.text);
      data[chunk.keyword] = parsed.ok ? parsed.value : chunk.text;
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
 * Convert JPEG/WebP segments to CivitAI PNG chunks
 *
 * Handles BOTH CivitAI formats:
 * - Orchestration (JSON): Store entire JSON in single "prompt" chunk
 * - A1111 (text): Fall back to A1111 converter
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertCivitaiSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) return [];

  // Check if data is JSON (CivitAI Orchestration) or text (CivitAI A1111)
  const isJson = userComment.data.trimStart().startsWith('{');

  if (!isJson) {
    // Fall back to A1111 conversion for text format
    return convertA1111SegmentsToPng(segments);
  }

  // Orchestration format: store entire JSON as single "prompt" chunk
  // This preserves the original structure for round-trip compatibility
  return createEncodedChunk('prompt', userComment.data, 'text-unicode-escape');
}
