/**
 * CivitAI metadata conversion utilities
 *
 * CivitAI has TWO formats:
 *
 * 1. CivitAI Orchestration (ComfyUI-like JSON):
 *    - Node IDs as keys instead of standard "prompt"/"workflow" chunks
 *    - "resource-stack" for model/checkpoint info
 *    - "extra" and "extraMetadata" for CivitAI-specific data
 *
 * 2. CivitAI A1111 (plain text):
 *    - Standard A1111 format with "Civitai resources:" marker
 *    - Should be converted like regular A1111
 *
 * This converter handles BOTH formats by detecting the data type.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { convertA1111PngToSegments, convertA1111SegmentsToPng } from './a1111';
import { createEncodedChunk } from './chunk-encoding';
import { findSegment, stringify } from './utils';

/**
 * CivitAI-specific keys that should be preserved as separate chunks
 *
 * These keys are used for CivitAI detection in PNG format,
 * so they must remain as individual chunks (not merged into "prompt").
 */
const CIVITAI_SPECIAL_KEYS = ['extra', 'extraMetadata', 'resource-stack'];

/**
 * Convert CivitAI PNG chunks to JPEG/WebP segments
 *
 * Handles BOTH CivitAI formats:
 * - Orchestration (prompt chunk with JSON): Combine into single JSON object
 * - A1111 (parameters chunk with text): Preserve as A1111 format
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertCivitaiPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Check if this is A1111-style (has parameters chunk with non-JSON text)
  const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
  if (parametersChunk && !parametersChunk.text.trimStart().startsWith('{')) {
    // A1111-style: use A1111 converter
    return convertA1111PngToSegments(chunks);
  }

  // Orchestration-style: combine chunks into JSON
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    if (chunk.keyword === 'prompt') {
      // Expand prompt chunk contents as top-level keys
      const parsed = parseJson<unknown>(chunk.text);
      if (parsed.ok && typeof parsed.value === 'object' && parsed.value) {
        Object.assign(data, parsed.value);
      }
    } else if (chunk.keyword === 'extraMetadata') {
      // Keep extraMetadata as string (matches original JPEG format)
      // The parser expects a JSON string, not a parsed object
      data[chunk.keyword] = chunk.text;
    } else {
      // Other chunks: parse JSON if possible
      const parsed = parseJson<unknown>(chunk.text);
      data[chunk.keyword] = parsed.ok ? parsed.value : chunk.text;
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
 * Convert JPEG/WebP segments to CivitAI PNG chunks
 *
 * Handles BOTH CivitAI formats:
 * - Orchestration (JSON): Separate special keys, combine node data into "prompt" chunk
 * - A1111 (text): Fall back to A1111 converter
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertCivitaiSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) return [];

  // Check if data is JSON (CivitAI Orchestration) or text (CivitAI A1111)
  const isJson = userComment.data.trimStart().startsWith('{');

  if (!isJson) {
    // Fall back to A1111 conversion for text format
    return convertA1111SegmentsToPng(segments);
  }

  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (!parsed.ok) {
    // If JSON parsing fails, try A1111 conversion
    return convertA1111SegmentsToPng(segments);
  }

  const data = parsed.value;
  const promptData: Record<string, unknown> = {};
  const chunks: PngTextChunk[] = [];

  // Separate CivitAI-specific keys from node data
  for (const [key, value] of Object.entries(data)) {
    if (CIVITAI_SPECIAL_KEYS.includes(key)) {
      // Create separate chunk for CivitAI-specific data
      chunks.push(
        ...createEncodedChunk(key, stringify(value), 'text-utf8-raw'),
      );
    } else {
      // Collect node data for prompt chunk
      promptData[key] = value;
    }
  }

  // Create "prompt" chunk with combined node data
  if (Object.keys(promptData).length > 0) {
    chunks.unshift(
      ...createEncodedChunk(
        'prompt',
        JSON.stringify(promptData),
        'text-utf8-raw',
      ),
    );
  }

  return chunks;
}
