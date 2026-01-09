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

/**
 * Convert ComfyUI PNG chunks to JPEG/WebP segments
 *
 * Uses saveimage-plus format: stores chunk keywords as JSON keys.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertComfyUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  // Build a JSON object with chunk keywords as keys
  const data: Record<string, unknown> = {};

  for (const chunk of chunks) {
    // Try to parse JSON chunks
    if (chunk.keyword === 'prompt' || chunk.keyword === 'workflow') {
      try {
        data[chunk.keyword] = JSON.parse(chunk.text);
      } catch {
        // If not valid JSON, store as string
        data[chunk.keyword] = chunk.text;
      }
    } else {
      // Other chunks stored as-is
      data[chunk.keyword] = chunk.text;
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
 * Convert JPEG/WebP segments to ComfyUI PNG chunks
 *
 * Supports:
 * - saveimage-plus format: exifUserComment with {"prompt": {...}, "workflow": {...}}
 * - save-image-extended format: exifImageDescription (workflow) + exifMake (prompt)
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertComfyUISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  const chunks: PngTextChunk[] = [];

  // Try save-image-extended format first (exifImageDescription + exifMake)
  const imageDescription = segments.find(
    (s) => s.source.type === 'exifImageDescription',
  );
  const make = segments.find((s) => s.source.type === 'exifMake');

  if (imageDescription || make) {
    // save-image-extended format
    if (make) {
      chunks.push({
        type: 'tEXt',
        keyword: 'prompt',
        text: make.data,
      });
    }
    if (imageDescription) {
      chunks.push({
        type: 'tEXt',
        keyword: 'workflow',
        text: imageDescription.data,
      });
    }
    if (chunks.length > 0) {
      return chunks;
    }
  }

  // Try saveimage-plus format (exifUserComment)
  const userComment = segments.find((s) => s.source.type === 'exifUserComment');
  if (!userComment) {
    return [];
  }

  try {
    const parsed = JSON.parse(userComment.data) as Record<string, unknown>;

    // Extract prompt chunk
    if (parsed.prompt !== undefined) {
      const promptText =
        typeof parsed.prompt === 'string'
          ? parsed.prompt
          : JSON.stringify(parsed.prompt);
      chunks.push({
        type: 'tEXt',
        keyword: 'prompt',
        text: promptText,
      });
    }

    // Extract workflow chunk
    if (parsed.workflow !== undefined) {
      const workflowText =
        typeof parsed.workflow === 'string'
          ? parsed.workflow
          : JSON.stringify(parsed.workflow);
      chunks.push({
        type: 'tEXt',
        keyword: 'workflow',
        text: workflowText,
      });
    }

    // If we found chunks, return them
    if (chunks.length > 0) {
      return chunks;
    }
  } catch {
    // Not valid JSON
  }

  // Fallback: store whole content as prompt
  return [
    {
      type: 'tEXt',
      keyword: 'prompt',
      text: userComment.data,
    },
  ];
}
