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

/**
 * Convert InvokeAI PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertInvokeAIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Build a JSON object with chunk keywords as keys
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    if (
      chunk.keyword === 'invokeai_metadata' ||
      chunk.keyword === 'invokeai_graph'
    ) {
      try {
        data[chunk.keyword] = JSON.parse(chunk.text);
      } catch {
        data[chunk.keyword] = chunk.text;
      }
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
 * Convert JPEG/WebP segments to InvokeAI PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertInvokeAISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  const chunks: PngTextChunk[] = [];

  try {
    const parsed = JSON.parse(userComment.data) as Record<string, unknown>;

    // Extract invokeai_metadata chunk
    if (parsed.invokeai_metadata !== undefined) {
      const text =
        typeof parsed.invokeai_metadata === 'string'
          ? parsed.invokeai_metadata
          : JSON.stringify(parsed.invokeai_metadata);
      chunks.push({
        type: 'iTXt',
        keyword: 'invokeai_metadata',
        compressionFlag: 0,
        compressionMethod: 0,
        languageTag: '',
        translatedKeyword: '',
        text,
      });
    }

    // Extract invokeai_graph chunk
    if (parsed.invokeai_graph !== undefined) {
      const text =
        typeof parsed.invokeai_graph === 'string'
          ? parsed.invokeai_graph
          : JSON.stringify(parsed.invokeai_graph);
      chunks.push({
        type: 'iTXt',
        keyword: 'invokeai_graph',
        compressionFlag: 0,
        compressionMethod: 0,
        languageTag: '',
        translatedKeyword: '',
        text,
      });
    }

    if (chunks.length > 0) {
      return chunks;
    }
  } catch {
    // Not valid JSON
  }

  // Fallback
  return [
    {
      type: 'iTXt',
      keyword: 'invokeai_metadata',
      compressionFlag: 0,
      compressionMethod: 0,
      languageTag: '',
      translatedKeyword: '',
      text: userComment.data,
    },
  ];
}
