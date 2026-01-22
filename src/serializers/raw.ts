/**
 * Raw metadata serialization utilities
 *
 * Formats RawMetadata as human-readable plain text.
 */

import type { RawMetadata } from '../types';

/**
 * Format raw metadata as plain text
 *
 * Extracts text content from RawMetadata and returns it as a simple string.
 * Multiple entries are separated by double newlines.
 *
 * This is useful for displaying unrecognized metadata to end users
 * without needing to manually iterate over chunks or segments.
 *
 * @param raw - Raw metadata from ParseResult
 * @returns Plain text content from the metadata
 *
 * @example
 * ```typescript
 * import { read, formatRaw } from 'sd-metadata';
 *
 * const result = read(imageData);
 * if (result.status === 'unrecognized') {
 *   console.log(formatRaw(result.raw));
 *   // Output: the raw text content without prefixes
 * }
 * ```
 */
export function formatRaw(raw: RawMetadata): string {
  switch (raw.format) {
    case 'png':
      return raw.chunks.map((chunk) => chunk.text).join('\n\n');

    case 'jpeg':
    case 'webp':
      return raw.segments.map((segment) => segment.data).join('\n\n');
  }
}
