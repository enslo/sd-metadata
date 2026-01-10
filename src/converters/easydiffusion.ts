/**
 * Easy Diffusion metadata conversion utilities
 *
 * Easy Diffusion format stores metadata as JSON in various locations:
 * - PNG: Each field as separate chunks (negative_prompt, Negative Prompt, etc.)
 * - JPEG/WebP: JSON in exifUserComment
 */

import type { MetadataSegment, PngTextChunk } from '../types';

/**
 * Convert Easy Diffusion PNG chunks to JPEG/WebP segments
 *
 * Easy Diffusion PNG stores metadata as individual chunks.
 * We combine them into a JSON object for JPEG/WebP storage.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertEasyDiffusionPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Build JSON object from individual chunks
  const json: Record<string, string> = {};
  for (const chunk of chunks) {
    json[chunk.keyword] = chunk.text;
  }

  // Store as JSON in exifUserComment
  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(json),
    },
  ];
}

/**
 * Convert JPEG/WebP segments to Easy Diffusion PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertEasyDiffusionSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Find exifUserComment segment (contains JSON)
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Parse JSON and convert to individual chunks
  try {
    const json = JSON.parse(userComment.data) as Record<string, unknown>;
    const chunks: PngTextChunk[] = [];

    for (const [keyword, value] of Object.entries(json)) {
      if (typeof value === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword,
          text: value,
        });
      } else if (value !== null && value !== undefined) {
        // Convert non-string values to string
        chunks.push({
          type: 'tEXt',
          keyword,
          text: String(value),
        });
      }
    }

    return chunks;
  } catch {
    // If JSON parsing fails, return empty
    return [];
  }
}
