/**
 * ComfyUI metadata conversion utilities
 *
 * ComfyUI stores metadata as:
 * - PNG: `prompt` + `workflow` tEXt chunks (both JSON)
 * - JPEG/WebP: exifUserComment with {"prompt": {...}, "workflow": {...}} (saveimage-plus format)
 *
 * Also handles: tensorart, stability-matrix (same format)
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createTextChunk, findSegment, stringify } from './utils';

/**
 * Convert ComfyUI PNG chunks to JPEG/WebP segments
 *
 * Uses saveimage-plus format: stores chunk keywords as JSON keys.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertComfyUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Store all chunks as strings to ensure lossless round-trip
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
 * Try save-image-extended format (exifImageDescription + exifMake)
 *
 * @returns PNG chunks if format matches, null otherwise
 */
const tryParseExtendedFormat = (
  segments: MetadataSegment[],
): PngTextChunk[] | null => {
  const imageDescription = findSegment(segments, 'exifImageDescription');
  const make = findSegment(segments, 'exifMake');

  if (!imageDescription && !make) {
    return null;
  }

  return [
    createTextChunk('prompt', make?.data),
    createTextChunk('workflow', imageDescription?.data),
  ].flat();
};

/**
 * Try saveimage-plus format (exifUserComment with JSON)
 *
 * @returns PNG chunks if format matches, null otherwise
 */
const tryParseSaveImagePlusFormat = (
  segments: MetadataSegment[],
): PngTextChunk[] | null => {
  const userComment = findSegment(segments, 'exifUserComment');
  if (!userComment) {
    return null;
  }

  const parsed = parseJson<Record<string, unknown>>(userComment.data);
  if (!parsed.ok) {
    // Not valid JSON, return as prompt fallback
    return createTextChunk('prompt', userComment.data);
  }

  // Convert all keys to PNG chunks
  return Object.entries(parsed.value).flatMap(([keyword, value]) =>
    createTextChunk(keyword, stringify(value)),
  );
};

/**
 * Convert JPEG/WebP segments to ComfyUI PNG chunks
 *
 * Supports:
 * - save-image-extended format: exifImageDescription (workflow) + exifMake (prompt)
 * - saveimage-plus format: exifUserComment with {"prompt": {...}, "workflow": {...}}
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertComfyUISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Try each format in order of priority
  return (
    tryParseExtendedFormat(segments) ??
    tryParseSaveImagePlusFormat(segments) ??
    []
  );
}
