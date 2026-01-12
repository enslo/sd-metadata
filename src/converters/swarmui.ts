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
 * Extracts the 'parameters' chunk content directly to match native SwarmUI WebP format.
 * SwarmUI native WebP stores sui_image_params directly in exifUserComment, not wrapped in a parameters key.
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

  return [
    {
      source: { type: 'exifUserComment' },
      data: typeof data === 'string' ? data : JSON.stringify(data),
    },
  ];
}

/**
 * Convert JPEG/WebP segments to SwarmUI PNG chunks
 *
 * Handles native SwarmUI WebP format (direct sui_image_params) by wrapping it
 * in a 'parameters' PNG chunk for compatibility.
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

  // Always wrap exifUserComment data in 'parameters' chunk
  // This works for all cases:
  // - Native WebP format (direct sui_image_params) → wrap as-is
  // - Non-JSON text → wrap as-is
  // - Any other format → wrap as-is
  return createEncodedChunk(
    'parameters',
    userComment.data,
    getEncodingStrategy('swarmui'),
  );
}
