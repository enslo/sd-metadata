/**
 * NovelAI metadata conversion utilities
 *
 * Converts NovelAI metadata between PNG chunks and JPEG/WebP segments.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createEncodedChunk, getEncodingStrategy } from './chunk-encoding';
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
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertNovelaiPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const comment = chunks.find((c) => c.keyword === 'Comment');
  if (!comment) {
    return [];
  }

  // Parse and extract all chunk data
  const data: Record<string, string> = {};
  for (const chunk of chunks) {
    data[chunk.keyword] = chunk.text;
  }

  // For JPEG: store as JSON in exifUserComment
  return [
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify(data),
    },
  ];
}

/**
 * Helper: Parse from exifUserComment (combined JSON format)
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
    // Description (optional, use dynamic selection for this chunk only)
    ...(() => {
      const descText =
        stringify(parsed.value.Description) ?? descriptionSeg?.data;
      if (!descText) return [];
      return createEncodedChunk(
        'Description',
        descText,
        getEncodingStrategy('novelai'),
      );
    })(),
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
 * Helper: Parse from JPEG COM segment format
 */
const parseFromComSegment = (
  comSeg: MetadataSegment,
  descriptionSeg: MetadataSegment | undefined,
): PngTextChunk[] => {
  const descText = descriptionSeg?.data;
  return [
    createTextChunk('Title', NOVELAI_TITLE),
    ...(descText
      ? createEncodedChunk(
          'Description',
          descText,
          getEncodingStrategy('novelai'),
        )
      : []),
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
