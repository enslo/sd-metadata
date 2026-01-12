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
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';
import { findSegment, stringify } from './utils';

/**
 * Convert SwarmUI PNG chunks to JPEG/WebP segments
 *
 * Parses JSON chunks and stores them as objects.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertSwarmUIPngToSegments(
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
    // Fallback for non-JSON (use Unicode escaping)
    return createEncodedChunk(
      'parameters',
      userComment.data,
      getEncodingStrategy('swarmui'),
    );
  }

  // Check for round-trip format (prompt and/or parameters keys)
  const chunks = [
    ...createEncodedChunk(
      'prompt',
      stringify(parsed.value.prompt),
      getEncodingStrategy('swarmui'),
    ),
    ...createEncodedChunk(
      'parameters',
      stringify(parsed.value.parameters),
      getEncodingStrategy('swarmui'),
    ),
  ];

  if (chunks.length > 0) {
    return chunks;
  }

  // Fallback: return as parameters chunk
  return createEncodedChunk(
    'parameters',
    userComment.data,
    getEncodingStrategy('swarmui'),
  );
}
