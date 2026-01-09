/**
 * Unified WebP API
 *
 * Provides a simplified API for reading and parsing WebP metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readWebpMetadata } from '../readers/webp';
import type { GenerationMetadata, ParseResult, WebpReadError } from '../types';
import { Result } from '../types';
import { segmentsToEntries } from '../utils/convert';

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
  // Read WebP metadata segments
  const readResult = readWebpMetadata(data);
  if (!readResult.ok) {
    return Result.error({
      type: 'parseError',
      message: formatReadError(readResult.error),
    });
  }

  const segments = readResult.value;

  // Convert segments to format-agnostic entries
  const entries = segmentsToEntries(segments);

  // Parse metadata (software detection is handled by the parser)
  const parseResult = parseMetadata(entries);
  if (!parseResult.ok) {
    return parseResult;
  }

  // Attach the correct raw data to create GenerationMetadata
  const metadata = {
    ...parseResult.value,
    raw: { format: 'webp' as const, segments },
  };

  return Result.ok(metadata as GenerationMetadata);
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
