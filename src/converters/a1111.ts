/**
 * A1111-format metadata conversion utilities
 *
 * Handles conversion for sd-webui, forge, forge-neo, and civitai.
 * A1111 format stores metadata as plain text in:
 * - PNG: `parameters` tEXt/iTXt chunk (dynamic selection)
 * - JPEG/WebP: Exif UserComment
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { createEncodedChunk } from './chunk-encoding';
import { createTextChunk, findSegment } from './utils';

/**
 * Convert A1111-format PNG chunks to JPEG/WebP segments
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertA1111PngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Find parameters chunk
  const parameters = chunks.find((c) => c.keyword === 'parameters');
  if (!parameters) {
    return [];
  }

  //Simply copy to exifUserComment
  const segments: MetadataSegment[] = [
    {
      source: { type: 'exifUserComment' },
      data: parameters.text,
    },
  ];

  const software = chunks.find((c) => c.keyword === 'Software');
  if (software) {
    segments.push({
      source: { type: 'exifSoftware' },
      data: software.text,
    });
  }

  const title = chunks.find((c) => c.keyword === 'Title');
  if (title) {
    segments.push({
      source: { type: 'exifDocumentName' },
      data: title.text,
    });
  }

  const description = chunks.find((c) => c.keyword === 'Description');
  if (description) {
    segments.push({
      source: { type: 'exifImageDescription' },
      data: description.text,
    });
  }

  const make = chunks.find((c) => c.keyword === 'Make');
  if (make) {
    segments.push({
      source: { type: 'exifMake' },
      data: make.text,
    });
  }

  return segments;
}

/**
 * Convert JPEG/WebP segments to A1111-format PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertA1111SegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Find exifUserComment segment
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  // Use dynamic selection (tEXt for ASCII, iTXt for non-ASCII)
  const parametersChunks = createEncodedChunk(
    'parameters',
    userComment.data,
    'dynamic',
  );

  // Preserve other standard Exif tags if present
  const chunks: PngTextChunk[] = [...parametersChunks];

  const software = findSegment(segments, 'exifSoftware');
  if (software) {
    chunks.push(...createTextChunk('Software', software.data));
  }

  const title = findSegment(segments, 'exifDocumentName');
  if (title) {
    chunks.push(...createTextChunk('Title', title.data));
  }

  const description = findSegment(segments, 'exifImageDescription');
  if (description) {
    // A1111 usually puts description in UserComment parameters but if Exif has it, preserve it
    chunks.push(...createTextChunk('Description', description.data));
  }

  const make = findSegment(segments, 'exifMake');
  if (make) {
    chunks.push(...createTextChunk('Make', make.data));
  }

  return chunks;
}
