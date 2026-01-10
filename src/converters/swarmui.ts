/**
 * SwarmUI metadata conversion utilities
 *
 * SwarmUI stores metadata as:
 * - PNG: `prompt` (ComfyUI workflow) + `parameters` (sui_image_params JSON)
 * - JPEG/WebP: exifUserComment contains the `parameters` JSON
 *
 * For round-trip preservation, we store both chunks as a JSON object.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createTextChunk, findSegment, stringify } from './utils';

/**
 * Convert SwarmUI PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertSwarmUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const data = Object.fromEntries(
    chunks.map((chunk) => [chunk.keyword, chunk.text]),
  );

  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(data),
    },
  ];
}

/**
 * Convert JPEG/WebP segments to SwarmUI PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertSwarmUISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) {
    return [];
  }

  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (!parsed.ok) {
    // Fallback for non-JSON
    return createTextChunk('parameters', userComment.data);
  }

  // Check for round-trip format (prompt and/or parameters keys)
  const chunks = [
    createTextChunk('prompt', stringify(parsed.value.prompt)),
    createTextChunk('parameters', stringify(parsed.value.parameters)),
  ].flat();

  if (chunks.length > 0) {
    return chunks;
  }

  // Fallback: return as parameters chunk
  return createTextChunk('parameters', userComment.data);
}
