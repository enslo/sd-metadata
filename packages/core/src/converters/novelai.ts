/**
 * NovelAI metadata conversion utilities
 *
 * Converts NovelAI metadata between PNG chunks and JPEG/WebP segments.
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { parseJson } from '../utils/json';
import { createEncodedChunk } from './chunk-encoding';
import { createTextChunk, findSegment, stringify } from './utils';

/** Fixed values for NovelAI PNG chunks */
const NOVELAI_TITLE = 'NovelAI generated image';
const NOVELAI_SOFTWARE = 'NovelAI';

/**
 * Convert NovelAI PNG chunks to JPEG/WebP segments
 *
 * PNG structure:
 * - Title: \"NovelAI generated image\"
 * - Description: short prompt
 * - Software: \"NovelAI\"
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
  // Build segments array declaratively
  const description = chunks.find((c) => c.keyword === 'Description');
  const descriptionSegment: MetadataSegment | undefined = description && {
    source: { type: 'exifImageDescription' },
    data: `\0\0\0\0${description.text}`,
  };

  const data = buildUserCommentJson(chunks);
  const userCommentSegment: MetadataSegment = {
    source: { type: 'exifUserComment' },
    data: JSON.stringify(data),
  };

  return [descriptionSegment, userCommentSegment].filter(
    (segment) => segment !== undefined,
  );
}

/**
 * Build UserComment JSON from PNG chunks in NovelAI's standard key order
 */
function buildUserCommentJson(chunks: PngTextChunk[]): Record<string, string> {
  return NOVELAI_KEY_ORDER.map((key) => {
    const chunk = chunks.find((c) => c.keyword === key);
    return chunk ? { [key]: chunk.text } : null;
  })
    .filter((entry): entry is Record<string, string> => entry !== null)
    .reduce(
      (acc, entry) => Object.assign(acc, entry),
      {} as Record<string, string>,
    );
}

/**
 * NovelAI standard key order for UserComment JSON
 */
const NOVELAI_KEY_ORDER = [
  'Comment',
  'Description',
  'Generation time',
  'Software',
  'Source',
  'Title',
] as const;

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
  const descriptionSeg = findSegment(segments, 'exifImageDescription');

  return parseSegments(userCommentSeg, descriptionSeg);
}

/**
 * Parse UserComment JSON and convert to PNG chunks
 */
function parseSegments(
  userCommentSeg: MetadataSegment | undefined,
  descriptionSeg: MetadataSegment | undefined,
): PngTextChunk[] {
  if (!userCommentSeg || !descriptionSeg) {
    return [];
  }

  const parsed = parseJson(userCommentSeg.data);
  if (!parsed.ok || parsed.type !== 'object') {
    // If parsing fails or not an object, treat the whole thing as Comment
    return createTextChunk('Comment', userCommentSeg.data);
  }

  const jsonData = parsed.value;

  // Extract Description text (prefer exifImageDescription over corrupted JSON)
  const descriptionText = extractDescriptionText(
    descriptionSeg,
    stringify(jsonData.Description),
  );

  return [
    // Title (required, use default if missing)
    createTextChunk('Title', stringify(jsonData.Title) ?? NOVELAI_TITLE),
    // Description (optional, prefer exifImageDescription over JSON)
    createEncodedChunk('Description', descriptionText, 'dynamic'),
    // Software (required, use default if missing)
    createTextChunk(
      'Software',
      stringify(jsonData.Software) ?? NOVELAI_SOFTWARE,
    ),
    // Source (optional)
    createTextChunk('Source', stringify(jsonData.Source)),
    // Generation time (optional)
    createTextChunk('Generation time', stringify(jsonData['Generation time'])),
    // Comment (optional)
    createTextChunk('Comment', stringify(jsonData.Comment)),
  ].flat();
}

/**
 * Extract Description text from exifImageDescription or UserComment JSON
 *
 * NovelAI WebP has corrupted UTF-8 in UserComment JSON Description,
 * so we prefer the clean exifImageDescription segment when available.
 */
function extractDescriptionText(
  descriptionSeg: MetadataSegment | undefined,
  jsonDescription: string | undefined,
): string | undefined {
  // First, try exifImageDescription segment (strip 4-byte null prefix)
  if (descriptionSeg?.data) {
    const data = descriptionSeg.data;
    // NovelAI WebP format has 4-byte null prefix before ImageDescription
    return data.startsWith('\0\0\0\0') ? data.slice(4) : data;
  }

  // Fallback: use JSON value (for non-NovelAI WebP sources)
  if (jsonDescription) {
    // Strip 4-byte null prefix if present
    return jsonDescription.startsWith('\0\0\0\0')
      ? jsonDescription.slice(4)
      : jsonDescription;
  }

  return undefined;
}
