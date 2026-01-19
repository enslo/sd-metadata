/**
 * SwarmUI metadata conversion utilities
 *
 * SwarmUI stores metadata as:
 * - PNG: `parameters` chunk containing sui_image_params JSON
 * - JPEG/WebP: exifUserComment contains sui_image_params JSON directly
 *
 * The converter extracts/wraps the content appropriately for each format.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';
import { findSegment } from './utils';

/**
 * Convert SwarmUI PNG chunks to JPEG/WebP segments
 *
 * Extracts the 'parameters' chunk and optionally preserves 'prompt' chunk (ComfyUI workflow).
 * - parameters chunk → exifUserComment (matches native SwarmUI format)
 * - prompt chunk → exifMake (preserves ComfyUI node graph for round-trip)
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertSwarmUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Find 'parameters' chunk
  const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
  if (!parametersChunk) {
    return [];
  }

  // Parse and return the JSON directly (no wrapping in parameters key)
  const parsed = parseJson<unknown>(parametersChunk.text);
  const data = parsed.ok ? parsed.value : parametersChunk.text;

  const segments: MetadataSegment[] = [
    {
      source: { type: 'exifUserComment' },
      data: typeof data === 'string' ? data : JSON.stringify(data),
    },
  ];

  // Preserve node graph if present (prompt chunk contains ComfyUI node graph)
  const promptChunk = chunks.find((c) => c.keyword === 'prompt');
  if (promptChunk) {
    segments.push({
      source: { type: 'exifMake' },
      data: promptChunk.text,
    });
  }

  return segments;
}

/**
 * Convert JPEG/WebP segments to SwarmUI PNG chunks
 *
 * Handles both native SwarmUI format and extended format with node graph:
 * - exifUserComment → parameters chunk (always present)
 * - exifMake → prompt chunk (optional, contains ComfyUI node graph)
 *
 * Chunk order matches original SwarmUI format: [prompt, parameters]
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

  const chunks: PngTextChunk[] = [];

  // Restore node graph first if present (extended format)
  const make = findSegment(segments, 'exifMake');
  if (make) {
    chunks.push(
      ...createEncodedChunk(
        'prompt',
        make.data,
        getEncodingStrategy('swarmui'),
      ),
    );
  }

  // Add parameters chunk second (always present)
  chunks.push(
    ...createEncodedChunk(
      'parameters',
      userComment.data,
      getEncodingStrategy('swarmui'),
    ),
  );

  return chunks;
}
