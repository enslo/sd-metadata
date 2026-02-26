/**
 * Draw Things metadata conversion utilities
 *
 * Draw Things stores metadata in XMP (XML) format inside PNG iTXt chunks.
 * For cross-format conversion, the XMP XML is preserved as-is:
 * - PNG → JPEG/WebP: Store XMP XML in native XMP container (APP1 XMP / XMP chunk)
 * - JPEG/WebP → PNG: Restore XMP XML from native XMP container to iTXt chunk
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { isXmpKeyword } from '../utils/xmp';
import { createITxtChunk, findSegment } from './utils';

// XMP chunk keyword
const XMP_KEYWORD = 'XML:com.adobe.xmp';

/**
 * Convert Draw Things PNG chunks to JPEG/WebP segments
 *
 * Stores the entire XMP XML in the native XMP container to preserve all metadata.
 *
 * @param chunks - PNG text chunks (containing XMP iTXt chunk)
 * @returns Metadata segments for JPEG/WebP
 */
export function convertDrawThingsPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const xmpChunk = chunks.find((c) => isXmpKeyword(c.keyword));
  if (!xmpChunk) return [];

  return [
    {
      source: { type: 'xmpPacket' },
      data: xmpChunk.text,
    },
  ];
}

/**
 * Convert JPEG/WebP segments to Draw Things PNG chunks
 *
 * Restores the XMP XML from native XMP container to an iTXt chunk.
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertDrawThingsSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const xmpSegment = findSegment(segments, 'xmpPacket');
  if (!xmpSegment) return [];

  return createITxtChunk(XMP_KEYWORD, xmpSegment.data);
}
