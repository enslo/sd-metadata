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
import { convertKvPngToSegments, convertKvSegmentsToPng } from './base-json';
import { createEncodedChunk } from './chunk-encoding';
import { findSegment } from './utils';

/**
 * Convert ComfyUI PNG chunks to JPEG/WebP segments
 *
 * Uses saveimage-plus format: stores chunk keywords as JSON keys.
 * For chunks that contain JSON strings (prompt, workflow), parse them
 * and store as objects to match saveimage-plus format.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertComfyUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  return convertKvPngToSegments(chunks);
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
    ...createEncodedChunk('prompt', make?.data, 'text-unicode-escape'),
    ...createEncodedChunk(
      'workflow',
      imageDescription?.data,
      'text-unicode-escape',
    ),
  ];
};

/**
 * Try saveimage-plus format (exifUserComment with JSON)
 *
 * @returns PNG chunks if format matches, null otherwise
 */
const tryParseSaveImagePlusFormat = (
  segments: MetadataSegment[],
): PngTextChunk[] | null => {
  const chunks = convertKvSegmentsToPng(segments, 'text-unicode-escape');
  return chunks.length > 0 ? chunks : null;
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
