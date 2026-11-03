/**
 * Shared utilities for metadata converters
 */

import type { MetadataSegment, PngTextChunk } from '../types';

/** Segment sources an eXIf chunk (a TIFF structure) can hold */
const EXIF_SOURCES = new Set<MetadataSegment['source']['type']>([
  'exifUserComment',
  'exifImageDescription',
  'exifMake',
  'exifModel',
]);

/**
 * Keep the segments a PNG can carry in an eXIf chunk
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns The EXIF-type segments, unchanged
 */
export function exifSegments(segments: MetadataSegment[]): MetadataSegment[] {
  return segments.filter((s) => EXIF_SOURCES.has(s.source.type));
}

/**
 * Create a tEXt chunk, returns empty array if text is undefined
 *
 * @param keyword - Chunk keyword
 * @param text - Chunk text, if undefined returns empty array
 * @returns Array with one chunk or empty array
 */
export const createTextChunk = (
  keyword: string,
  text: string | undefined,
): PngTextChunk[] =>
  text !== undefined ? [{ type: 'tEXt', keyword, text }] : [];

/**
 * Create an iTXt chunk, returns empty array if text is undefined
 *
 * @param keyword - Chunk keyword
 * @param text - Chunk text, if undefined returns empty array
 * @returns Array with one chunk or empty array
 */
export const createITxtChunk = (
  keyword: string,
  text: string | undefined,
): PngTextChunk[] =>
  text !== undefined
    ? [
        {
          type: 'iTXt',
          keyword,
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: '',
          translatedKeyword: '',
          text,
        },
      ]
    : [];

/**
 * Find a segment by source type
 *
 * @param segments - Array of metadata segments
 * @param type - Source type to find
 * @returns Matching segment or undefined
 */
export const findSegment = (
  segments: MetadataSegment[],
  type: string,
): MetadataSegment | undefined => segments.find((s) => s.source.type === type);

/**
 * Stringify value, returns undefined if value is undefined
 *
 * @param value - Value to stringify
 * @returns Stringified value or undefined
 */
export const stringify = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
};
