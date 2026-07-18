/**
 * ComfyUI metadata conversion utilities
 *
 * ComfyUI stores metadata as:
 * - PNG: `prompt` + `workflow` tEXt chunks (both JSON)
 * - JPEG/WebP: labelled IFD0 ASCII tags (Make/Model, matching the official
 *   Save Animated WEBP node) or exifUserComment with {"prompt": {...},
 *   "workflow": {...}} (saveimage-plus format)
 *
 * Also handles: tensorart, stability-matrix (same format)
 */

import type { MetadataSegment, PngTextChunk } from '../types';
import { convertKvSegmentsToPng } from './base-json';
import { createEncodedChunk } from './chunk-encoding';
import { findSegment } from './utils';

/**
 * Convert ComfyUI PNG chunks to JPEG/WebP segments
 *
 * Writes the same Make (0x010F) "workflow:..." / Model (0x0110) "prompt:..."
 * tag pair as the official Save Animated WEBP node — the only EXIF layout
 * ComfyUI's own frontend reads natively for WebP drag-and-drop workflow
 * loading (it splits each IFD0 ASCII tag on the first colon and looks for a
 * "workflow"/"prompt" key, which the saveimage-plus single-JSON-envelope
 * layout does not produce). JPEG uses the same layout for consistency, since
 * both formats carry this data as EXIF.
 *
 * Any chunk other than `prompt`/`workflow` is dropped rather than routed
 * elsewhere. In practice this is only the `parameters` chunk some custom save
 * nodes (e.g. comfy-image-saver) add alongside the real ComfyUI data: an
 * A1111-compatible text rendering for tools that don't understand the node
 * graph, redundant with — and never read back from — `prompt`.
 *
 * @param chunks - PNG text chunks
 * @returns Metadata segments for JPEG/WebP
 */
export function convertComfyUIPngToSegments(
  chunks: PngTextChunk[],
): MetadataSegment[] {
  const prompt = chunks.find((c) => c.keyword === 'prompt');
  const workflow = chunks.find((c) => c.keyword === 'workflow');

  const segments: MetadataSegment[] = [];
  if (workflow) {
    segments.push({
      source: { type: 'exifMake', prefix: 'workflow' },
      data: workflow.text,
    });
  }
  if (prompt) {
    segments.push({
      source: { type: 'exifModel', prefix: 'prompt' },
      data: prompt.text,
    });
  }
  return segments;
}

/**
 * Try the IFD0 ASCII tag formats (exifImageDescription/exifMake/exifModel)
 *
 * Node packs disagree on which tag holds what, so the tag alone cannot say:
 * - save-image-extended: ImageDescription "Workflow: ...", Make "Prompt: ..."
 * - Save Animated WEBP (built-in): Make "workflow:...", Model "prompt:..."
 *
 * The reader keeps each value's label as `prefix`, so route by label and fall
 * back to the save-image-extended layout for values that carry no label.
 *
 * @returns PNG chunks if format matches, null otherwise
 */
const tryParseExtendedFormat = (
  segments: MetadataSegment[],
): PngTextChunk[] | null => {
  const imageDescription = findSegment(segments, 'exifImageDescription');
  const make = findSegment(segments, 'exifMake');
  const model = findSegment(segments, 'exifModel');

  if (!imageDescription && !make && !model) {
    return null;
  }

  const tagged = [imageDescription, make, model].filter((s) => s !== undefined);
  const byLabel = (keyword: string): string | undefined =>
    tagged.find(
      (s) => 'prefix' in s.source && s.source.prefix?.toLowerCase() === keyword,
    )?.data;

  return [
    ...createEncodedChunk(
      'prompt',
      byLabel('prompt') ?? make?.data,
      'text-unicode-escape',
    ),
    ...createEncodedChunk(
      'workflow',
      byLabel('workflow') ?? imageDescription?.data,
      'text-unicode-escape',
    ),
  ];
};

/**
 * Try saveimage-plus format (exifUserComment with JSON)
 *
 * @returns PNG chunks if format matches, null otherwise
 */
const tryParseSaveImagePlusFormat = (
  segments: MetadataSegment[],
): PngTextChunk[] | null => {
  const chunks = convertKvSegmentsToPng(segments, 'text-unicode-escape');
  return chunks.length > 0 ? chunks : null;
};

/**
 * Convert JPEG/WebP segments to ComfyUI PNG chunks
 *
 * Supports:
 * - labelled IFD0 ASCII tags: save-image-extended, Save Animated WEBP
 * - saveimage-plus format: exifUserComment with {"prompt": {...}, "workflow": {...}}
 *
 * @param segments - Metadata segments from JPEG/WebP
 * @returns PNG text chunks
 */
export function convertComfyUISegmentsToPng(
  segments: MetadataSegment[],
): PngTextChunk[] {
  // Try each format in order of priority
  return (
    tryParseExtendedFormat(segments) ??
    tryParseSaveImagePlusFormat(segments) ??
    []
  );
}
