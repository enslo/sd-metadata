/**
 * Dezgo metadata conversion utilities
 *
 * A Dezgo PNG holds its job record twice: as JSON in the GenInfo chunk
 * (with a GenCode chunk beside it) and as YAML in the EXIF UserComment of
 * an eXIf chunk. JPEG/WebP hold only the EXIF UserComment.
 *
 * The EXIF UserComment is therefore what converts: PNG → JPEG/WebP keeps
 * the eXIf segments (carried over by the converter factory), and JPEG/WebP
 * → PNG puts them back into an eXIf chunk. GenInfo and GenCode have no
 * place in JPEG/WebP and are dropped; the YAML holds the same record.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { exifSegments } from './utils';

/**
 * Convert Dezgo PNG text chunks to JPEG/WebP segments
 *
 * @returns No segments: GenInfo and GenCode are dropped, and the eXIf
 *   segments are carried over separately
 */
export function convertDezgoPngToSegments(
  _chunks: PngTextChunk[],
): MetadataSegment[] {
  return [];
}

/**
 * Convert JPEG/WebP segments to a Dezgo PNG
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG raw structure with the EXIF segments in `exif`
 */
export function convertDezgoSegmentsToPng(segments: MetadataSegment[]): {
  chunks: PngTextChunk[];
  exif: MetadataSegment[];
} {
  return { chunks: [], exif: exifSegments(segments) };
}
