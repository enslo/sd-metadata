/**
 * InvokeAI metadata conversion utilities
 *
 * InvokeAI stores metadata as:
 * - PNG: `invokeai_metadata` + `invokeai_graph` iTXt/tEXt chunks (both JSON, dynamic selection)
 * - JPEG/WebP: Not officially supported by InvokeAI
 *
 * For conversion, we use a JSON format similar to ComfyUI saveimage-plus:
 * {"invokeai_metadata": {...}, "invokeai_graph": {...}}
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';
import { findSegment, stringify } from './utils';

/**
 * Convert InvokeAI PNG chunks to JPEG/WebP segments
 *
 * Parses JSON chunks and stores them as objects.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertInvokeAIPngToSegments(
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

  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (!parsed.ok) {
    // Not valid JSON, store as single chunk with dynamic selection
    return createEncodedChunk(
      'invokeai_metadata',
      userComment.data,
      getEncodingStrategy('invokeai'),
    );
  }

  // Parse saved chunks
  const metadataText = stringify(parsed.value.invokeai_metadata);
  const graphText = stringify(parsed.value.invokeai_graph);

  // Create chunks with dynamic selection
  const chunks = [
    ...createEncodedChunk(
      'invokeai_metadata',
      metadataText,
      getEncodingStrategy('invokeai'),
    ),
    ...createEncodedChunk(
      'invokeai_graph',
      graphText,
      getEncodingStrategy('invokeai'),
    ),
  ];

  if (chunks.length > 0) {
    return chunks;
  }

  // Fallback: return as invokeai_metadata chunk
  return createEncodedChunk(
    'invokeai_metadata',
    userComment.data,
    getEncodingStrategy('invokeai'),
  );
}
