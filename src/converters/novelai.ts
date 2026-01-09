/**
 * NovelAI metadata conversion utilities
 *
 * Converts NovelAI metadata between PNG chunks and JPEG/WebP segments.
 */

import type { MetadataSegment, PngTextChunk } from '../types';

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
  // Extract chunks by keyword
  const chunkMap = new Map<string, string>();
  for (const chunk of chunks) {
    chunkMap.set(chunk.keyword, chunk.text);
  }

  const segments: MetadataSegment[] = [];

  // Get Description for exifImageDescription
  const description = chunkMap.get('Description');
  if (description) {
    segments.push({
      source: { type: 'exifImageDescription' },
      data: description,
    });
  }

  // Build nested JSON for exifUserComment
  // Store all chunks as a JSON object (same format for JPEG and WebP)
  const userCommentObj: Record<string, string> = {};
  for (const chunk of chunks) {
    userCommentObj[chunk.keyword] = chunk.text;
  }

  // Use exifUserComment for both JPEG and WebP
  segments.push({
    source: { type: 'exifUserComment' },
    data: JSON.stringify(userCommentObj),
  });

  return segments;
}

/**
 * Convert JPEG/WebP segments to NovelAI PNG chunks
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertNovelaiSegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const chunks: PngTextChunk[] = [];

  // Find exifUserComment or jpegCom segment
  const userCommentSeg = segments.find(
    (s) => s.source.type === 'exifUserComment',
  );
  const comSeg = segments.find((s) => s.source.type === 'jpegCom');
  const descriptionSeg = segments.find(
    (s) => s.source.type === 'exifImageDescription',
  );

  // Try to parse the nested JSON from exifUserComment
  if (userCommentSeg) {
    try {
      const parsed = JSON.parse(userCommentSeg.data) as Record<string, unknown>;

      // Extract known NovelAI chunks
      if (typeof parsed.Title === 'string') {
        chunks.push({ type: 'tEXt', keyword: 'Title', text: parsed.Title });
      } else {
        // Use fixed value if not present
        chunks.push({ type: 'tEXt', keyword: 'Title', text: NOVELAI_TITLE });
      }

      if (typeof parsed.Description === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword: 'Description',
          text: parsed.Description,
        });
      } else if (descriptionSeg) {
        chunks.push({
          type: 'tEXt',
          keyword: 'Description',
          text: descriptionSeg.data,
        });
      }

      if (typeof parsed.Software === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword: 'Software',
          text: parsed.Software,
        });
      } else {
        chunks.push({
          type: 'tEXt',
          keyword: 'Software',
          text: NOVELAI_SOFTWARE,
        });
      }

      if (typeof parsed.Source === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword: 'Source',
          text: parsed.Source,
        });
      }

      if (typeof parsed['Generation time'] === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword: 'Generation time',
          text: parsed['Generation time'],
        });
      }

      // Comment is the main JSON (may be escaped string or object)
      if (typeof parsed.Comment === 'string') {
        chunks.push({
          type: 'tEXt',
          keyword: 'Comment',
          text: parsed.Comment,
        });
      }
    } catch {
      // If parsing fails, treat the whole thing as Comment
      chunks.push({
        type: 'tEXt',
        keyword: 'Comment',
        text: userCommentSeg.data,
      });
    }
  } else if (comSeg) {
    // JPEG COM segment - this is the main JSON
    chunks.push({
      type: 'tEXt',
      keyword: 'Title',
      text: NOVELAI_TITLE,
    });

    if (descriptionSeg) {
      chunks.push({
        type: 'tEXt',
        keyword: 'Description',
        text: descriptionSeg.data,
      });
    }

    chunks.push({
      type: 'tEXt',
      keyword: 'Software',
      text: NOVELAI_SOFTWARE,
    });

    chunks.push({
      type: 'tEXt',
      keyword: 'Comment',
      text: comSeg.data,
    });
  }

  return chunks;
}
