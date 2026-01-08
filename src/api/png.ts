/**
 * Unified PNG API
 *
 * Provides a simplified API for reading and parsing PNG metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readPngMetadata } from '../readers/png';
import type { ParseResult, PngReadError } from '../types';
import { Result } from '../types';

/**
 * Read and parse PNG metadata in one step
 *
 * This is a convenience function that combines `readPngMetadata` and `parseMetadata`.
 * For advanced use cases (e.g., accessing raw chunks for write-back), use the
 * individual functions instead.
 *
 * @param data - PNG file data as Uint8Array
 * @returns Parsed generation metadata or error
 *
 * @example
 * ```typescript
 * const result = parsePng(pngData);
 * if (result.ok) {
 *   console.log(result.value.prompt);
 * }
 * ```
 */
export function parsePng(data: Uint8Array): ParseResult {
  // Read PNG chunks
  const readResult = readPngMetadata(data);
  if (!readResult.ok) {
    return Result.error({
      type: 'parseError',
      message: formatReadError(readResult.error),
    });
  }

  // Parse metadata
  return parseMetadata(readResult.value);
}

/**
 * Format read error as human-readable message
 */
function formatReadError(error: PngReadError): string {
  switch (error.type) {
    case 'invalidSignature':
      return 'Not a valid PNG file';
    case 'corruptedChunk':
      return error.message ?? 'Corrupted PNG chunk';
    default:
      return 'Failed to read PNG file';
  }
}
