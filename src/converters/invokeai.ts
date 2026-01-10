/**
 * InvokeAI metadata conversion utilities
 *
 * InvokeAI stores metadata as:
 * - PNG: `invokeai_metadata` + `invokeai_graph` iTXt chunks (both JSON)
 * - JPEG/WebP: Not officially supported by InvokeAI
 *
 * For conversion, we use a JSON format similar to ComfyUI saveimage-plus:
 * {"invokeai_metadata": {...}, "invokeai_graph": {...}}
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createITxtChunk, findSegment, stringifyValue } from './utils';

/**
 * Convert InvokeAI PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertInvokeAIPngToSegments(
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
 * Convert JPEG/WebP segments to InvokeAI PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertInvokeAISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) {
    return [];
  }

  try {
    const parsed = JSON.parse(userComment.data) as Record<string, unknown>;

    const chunks = [
      createITxtChunk(
        'invokeai_metadata',
        stringifyValue(parsed.invokeai_metadata),
      ),
      createITxtChunk('invokeai_graph', stringifyValue(parsed.invokeai_graph)),
    ].flat();

    if (chunks.length > 0) {
      return chunks;
    }
  } catch {
    // Not valid JSON
  }

  // Fallback
  return createITxtChunk('invokeai_metadata', userComment.data);
}
