/**
 * Easy Diffusion metadata conversion utilities
 *
 * Easy Diffusion format stores metadata as JSON in various locations:
 * - PNG: Each field as separate chunks (negative_prompt, Negative Prompt, etc.)
 * - JPEG/WebP: JSON in exifUserComment
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createTextChunk, findSegment } from './utils';

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
  const json = Object.fromEntries(
    chunks.map((chunk) => [chunk.keyword, chunk.text]),
  );

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
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) {
    return [];
  }

  try {
    const json = JSON.parse(userComment.data) as Record<string, unknown>;

    return Object.entries(json).flatMap(([keyword, value]) =>
      createTextChunk(
        keyword,
        value != null
          ? typeof value === 'string'
            ? value
            : String(value)
          : undefined,
      ),
    );
  } catch {
    return [];
  }
}
