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
 *
 * CivitAI PNG downloads carry the EXIF (the same UserComment as the JPEG)
 * in an eXIf chunk and have no text chunks, so JPEG/WebP → PNG moves the
 * segments into `exif` (see convertCivitaiSegmentsToPng). PNGs holding
 * text chunks (e.g. written by earlier versions of this library) are still
 * converted back by convertCivitaiPngToSegments.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { convertA1111PngToSegments } from './a1111';

/** Segment sources an eXIf chunk (a TIFF structure) can hold */
const EXIF_SOURCES = new Set<MetadataSegment['source']['type']>([
  'exifUserComment',
  'exifImageDescription',
  'exifMake',
  'exifModel',
]);

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
      const parsed = parseJson(chunk.text);
      if (parsed.ok && parsed.type === 'object') {
        Object.assign(data, parsed.value);
      }
    } else if (chunk.keyword === 'extraMetadata') {
      // Keep extraMetadata as string (matches original JPEG format)
      // The parser expects a JSON string, not a parsed object
      data[chunk.keyword] = chunk.text;
    } else {
      // Other chunks: parse JSON if possible
      const parsed = parseJson(chunk.text);
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
 * Convert JPEG/WebP segments to a CivitAI PNG
 *
 * CivitAI PNGs carry their EXIF in an eXIf chunk and no text chunks, so the
 * EXIF-type segments move into `exif` unchanged; nothing is rewritten into
 * tEXt/iTXt (other segment kinds have no place in an eXIf chunk).
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG raw structure with the segments in `exif`
 */
export function convertCivitaiSegmentsToPng(segments: MetadataSegment[]): {
  chunks: PngTextChunk[];
  exif: MetadataSegment[];
} {
  return {
    chunks: [],
    exif: segments.filter((s) => EXIF_SOURCES.has(s.source.type)),
  };
}
