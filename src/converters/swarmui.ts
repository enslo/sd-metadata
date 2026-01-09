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

/**
 * Convert SwarmUI PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertSwarmUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Build a JSON object containing both chunks for round-trip
  const data: Record<string, string> = {};
  for (const chunk of chunks) {
    data[chunk.keyword] = chunk.text;
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
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Try to parse as JSON with chunk keys
  try {
    const parsed = JSON.parse(userComment.data) as Record<string, unknown>;
    const chunks: PngTextChunk[] = [];

    // Check if it has our round-trip format (prompt and/or parameters keys)
    if (typeof parsed.prompt === 'string') {
      chunks.push({
        type: 'tEXt',
        keyword: 'prompt',
        text: parsed.prompt,
      });
    }

    if (typeof parsed.parameters === 'string') {
      chunks.push({
        type: 'tEXt',
        keyword: 'parameters',
        text: parsed.parameters,
      });
    }

    // If we found chunks, return them
    if (chunks.length > 0) {
      return chunks;
    }

    // Otherwise, if it has sui_image_params, it's the original SwarmUI format
    // Store the whole thing as parameters
    if (parsed.sui_image_params) {
      return [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: userComment.data,
        },
      ];
    }
  } catch {
    // Not JSON, store as parameters
  }

  // Fallback: store as parameters
  return [
    {
      type: 'tEXt',
      keyword: 'parameters',
      text: userComment.data,
    },
  ];
}
