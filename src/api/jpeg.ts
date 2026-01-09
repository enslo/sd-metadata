/**
 * Unified JPEG API
 *
 * Provides a simplified API for reading and parsing JPEG metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readJpegMetadata } from '../readers/jpeg';
import type { GenerationMetadata, JpegReadError, ParseResult } from '../types';
import { Result } from '../types';
import { segmentsToEntries } from '../utils/convert';

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
  // Read JPEG metadata segments
  const readResult = readJpegMetadata(data);
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
    raw: { format: 'jpeg' as const, segments },
  };

  return Result.ok(metadata as GenerationMetadata);
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
