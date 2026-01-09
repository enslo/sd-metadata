/**
 * Unified JPEG API
 *
 * Provides a simplified API for reading and parsing JPEG metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readJpegMetadata } from '../readers/jpeg';
import type { JpegReadError, ParseResult } from '../types';
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
 * if (result.status === 'success') {
 *   console.log(result.metadata.prompt);
 * }
 * ```
 */
export function parseJpeg(data: Uint8Array): ParseResult {
  // Read JPEG metadata segments
  const readResult = readJpegMetadata(data);
  if (!readResult.ok) {
    // invalidSignature is invalid, noMetadata is empty
    if (readResult.error.type === 'noMetadata') {
      return { status: 'empty' };
    }
    return {
      status: 'invalid',
      message: formatReadError(readResult.error),
    };
  }

  const segments = readResult.value;

  // No segments found (already handled above, but for safety)
  if (segments.length === 0) {
    return { status: 'empty' };
  }

  // Build raw metadata
  const raw = { format: 'jpeg' as const, segments };

  // Convert segments to format-agnostic entries
  const entries = segmentsToEntries(segments);

  // Parse metadata (software detection is handled by the parser)
  const parseResult = parseMetadata(entries);
  if (!parseResult.ok) {
    return { status: 'unrecognized', raw };
  }

  return { status: 'success', metadata: parseResult.value, raw };
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
