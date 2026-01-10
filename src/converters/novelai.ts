/**
 * NovelAI metadata conversion utilities
 *
 * Converts NovelAI metadata between PNG chunks and JPEG/WebP segments.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createTextChunk, findSegment, stringify } from './utils';

/** Fixed values for NovelAI PNG chunks */
const NOVELAI_TITLE = 'NovelAI generated image';
const NOVELAI_SOFTWARE = 'NovelAI';

/**
 * Convert NovelAI PNG chunks to JPEG/WebP segments
 *
 * PNG structure:
 * - Title: "NovelAI generated image"
 * - Description: short prompt
 * - Software: "NovelAI"
 * - Source: version info
 * - Generation time: time
 * - Comment: full JSON parameters
 *
 * JPEG/WebP structure:
 * - exifImageDescription: short prompt (from Description)
 * - exifUserComment: nested JSON with all chunks
 *
 * @param chunks - PNG text chunks from NovelAI image
 * @returns Metadata segments for JPEG/WebP
 */
export function convertNovelaiPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const chunkMap = Object.fromEntries(
    chunks.map((chunk) => [chunk.keyword, chunk.text]),
  );

  return [
    ...(chunkMap.Description
      ? [
          {
            source: { type: 'exifImageDescription' as const },
            data: chunkMap.Description,
          },
        ]
      : []),
    {
      source: { type: 'exifUserComment' as const },
      data: JSON.stringify(chunkMap),
    },
  ];
}

/**
 * Parse from exifUserComment format
 */
const parseFromUserComment = (
  userCommentSeg: MetadataSegment,
  descriptionSeg: MetadataSegment | undefined,
): PngTextChunk[] | null => {
  const parsed = parseJson<Record<string, unknown>>(userCommentSeg.data);
  if (!parsed.ok) {
    // If parsing fails, treat the whole thing as Comment
    return createTextChunk('Comment', userCommentSeg.data);
  }

  return [
    // Title (required, use default if missing)
    createTextChunk('Title', stringify(parsed.value.Title) ?? NOVELAI_TITLE),
    // Description (optional, fallback to segment)
    createTextChunk(
      'Description',
      stringify(parsed.value.Description) ?? descriptionSeg?.data,
    ),
    // Software (required, use default if missing)
    createTextChunk(
      'Software',
      stringify(parsed.value.Software) ?? NOVELAI_SOFTWARE,
    ),
    // Source (optional)
    createTextChunk('Source', stringify(parsed.value.Source)),
    // Generation time (optional)
    createTextChunk(
      'Generation time',
      stringify(parsed.value['Generation time']),
    ),
    // Comment (optional)
    createTextChunk('Comment', stringify(parsed.value.Comment)),
  ].flat();
};

/**
 * Parse from JPEG COM segment format
 */
const parseFromComSegment = (
  comSeg: MetadataSegment,
  descriptionSeg: MetadataSegment | undefined,
): PngTextChunk[] => {
  return [
    createTextChunk('Title', NOVELAI_TITLE),
    createTextChunk('Description', descriptionSeg?.data),
    createTextChunk('Software', NOVELAI_SOFTWARE),
    createTextChunk('Comment', comSeg.data),
  ].flat();
};

/**
 * Convert JPEG/WebP segments to NovelAI PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertNovelaiSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const userCommentSeg = findSegment(segments, 'exifUserComment');
  const comSeg = findSegment(segments, 'jpegCom');
  const descriptionSeg = findSegment(segments, 'exifImageDescription');

  if (userCommentSeg) {
    return parseFromUserComment(userCommentSeg, descriptionSeg) ?? [];
  }

  if (comSeg) {
    return parseFromComSegment(comSeg, descriptionSeg);
  }

  return [];
}
