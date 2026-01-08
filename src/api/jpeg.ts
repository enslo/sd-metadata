/**
 * Unified JPEG API
 *
 * Provides a simplified API for reading and parsing JPEG metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readJpegMetadata } from '../readers/jpeg';
import type { JpegReadError, ParseResult, PngTextChunk } from '../types';
import { Result } from '../types';

/**
 * Read and parse JPEG metadata in one step
 *
 * This is a convenience function that combines `readJpegMetadata` and `parseMetadata`.
 *
 * For advanced use cases (e.g., accessing raw segments for write-back), use the
 * individual functions instead.
 *
 * @param data - JPEG file data as Uint8Array
 * @returns Parsed generation metadata or error
 *
 * @example
 * ```typescript
 * const result = parseJpeg(jpegData);
 * if (result.ok) {
 *   console.log(result.value.prompt);
 * }
 * ```
 */
export function parseJpeg(data: Uint8Array): ParseResult {
  // Read JPEG segments
  const readResult = readJpegMetadata(data);
  if (!readResult.ok) {
    return Result.error({
      type: 'parseError',
      message: formatReadError(readResult.error),
    });
  }

  // Convert segments to PNG-compatible chunks for parseMetadata
  const chunks: PngTextChunk[] = [];

  for (const segment of readResult.value.segments) {
    const converted = convertToChunks(segment.data);
    chunks.push(...converted);
  }

  // Parse metadata using detected software hint
  const parseResult = parseMetadata({
    chunks,
    software: readResult.value.software,
  });

  return parseResult;
}

/**
 * Convert metadata content to PNG-compatible chunks
 *
 * Handles special formats:
 * - ComfyUI SaveImagePlus: {"prompt": {...}, "workflow": {...}}
 * - ComfyUI standard: {nodeId: {...}, ...}
 * - NovelAI: {"v4_prompt": ..., ...}
 * - A1111: text with "Steps:" etc.
 *
 * @param content - Metadata content string
 * @returns Array of chunks to pass to parseMetadata
 */
function convertToChunks(content: string): PngTextChunk[] {
  // Strip null terminators and trim whitespace
  const trimmed = content.replace(/\0+$/, '').trim();

  // Check if it's JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        // ComfyUI SaveImagePlus format: {"prompt": {...}, "workflow": {...}}
        if ('prompt' in parsed && typeof parsed.prompt === 'object') {
          const chunks: PngTextChunk[] = [
            {
              type: 'tEXt',
              keyword: 'prompt',
              text: JSON.stringify(parsed.prompt),
            },
          ];
          if ('workflow' in parsed && typeof parsed.workflow === 'object') {
            chunks.push({
              type: 'tEXt',
              keyword: 'workflow',
              text: JSON.stringify(parsed.workflow),
            });
          }
          return chunks;
        }

        // ComfyUI standard format: nodes with class_type
        const values = Object.values(parsed);
        if (
          values.some(
            (v: unknown) =>
              v && typeof v === 'object' && 'class_type' in (v as object),
          )
        ) {
          return [{ type: 'tEXt', keyword: 'prompt', text: trimmed }];
        }

        // ComfyUI workflow format: has 'nodes' array
        if ('nodes' in parsed && Array.isArray(parsed.nodes)) {
          return [{ type: 'tEXt', keyword: 'workflow', text: trimmed }];
        }

        // NovelAI format: has recognized keys
        if (
          'v4_prompt' in parsed ||
          'noise_schedule' in parsed ||
          'steps' in parsed
        ) {
          return [{ type: 'tEXt', keyword: 'Comment', text: trimmed }];
        }
      }
    } catch {
      // Not valid JSON, fall through to default
    }
  }

  // Default: A1111-style parameters
  return [{ type: 'tEXt', keyword: 'parameters', text: trimmed }];
}

/**
 * Format read error as human-readable message
 */
function formatReadError(error: JpegReadError): string {
  switch (error.type) {
    case 'invalidSignature':
      return 'Not a valid JPEG file';
    case 'noMetadata':
      return 'No metadata found in JPEG file';
    case 'parseError':
      return error.message ?? 'Failed to parse JPEG metadata';
    default:
      return 'Failed to read JPEG file';
  }
}
