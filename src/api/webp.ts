/**
 * Unified WebP API
 *
 * Provides a simplified API for reading and parsing WebP metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readWebpMetadata } from '../readers/webp';
import type { ParseResult, PngTextChunk, WebpReadError } from '../types';
import { Result } from '../types';

/**
 * Read and parse WebP metadata in one step
 *
 * This is a convenience function that combines `readWebpMetadata` and `parseMetadata`.
 *
 * For advanced use cases (e.g., accessing raw segments for write-back), use the
 * individual functions instead.
 *
 * @param data - WebP file data as Uint8Array
 * @returns Parsed generation metadata or error
 *
 * @example
 * ```typescript
 * const result = parseWebp(webpData);
 * if (result.ok) {
 *   console.log(result.value.prompt);
 * }
 * ```
 */
export function parseWebp(data: Uint8Array): ParseResult {
  // Read WebP segments
  const readResult = readWebpMetadata(data);
  if (!readResult.ok) {
    return Result.error({
      type: 'parseError',
      message: formatReadError(readResult.error),
    });
  }

  // Convert segments to PNG-compatible chunks for parseMetadata
  const chunks: PngTextChunk[] = [];

  // Add Software chunk based on detected software (required by some parsers)
  const software = readResult.value.software;
  if (software === 'novelai') {
    chunks.push({ type: 'tEXt', keyword: 'Software', text: 'NovelAI' });
  }

  for (const segment of readResult.value.segments) {
    const converted = convertToChunks(segment.data);
    chunks.push(...converted);
  }

  // Parse metadata using detected software hint
  const parseResult = parseMetadata({
    chunks,
    software,
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
        // NovelAI WebP format: {"Comment":"{...}"} - double-encoded JSON
        if ('Comment' in parsed && typeof parsed.Comment === 'string') {
          return [{ type: 'tEXt', keyword: 'Comment', text: parsed.Comment }];
        }

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
function formatReadError(error: WebpReadError): string {
  switch (error.type) {
    case 'invalidSignature':
      return 'Not a valid WebP file';
    case 'noExifChunk':
      return 'No EXIF chunk found in WebP file';
    case 'noMetadata':
      return 'No metadata found in WebP file';
    case 'parseError':
      return error.message ?? 'Failed to parse WebP metadata';
    default:
      return 'Failed to read WebP file';
  }
}
