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
import { convertKvPngToSegments, convertKvSegmentsToPng } from './base-json';

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
  // Use generic KV converter
  return convertKvPngToSegments(chunks);
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
  // Use generic KV converter with dynamic encoding strategy
  return convertKvSegmentsToPng(segments, 'dynamic');
}
