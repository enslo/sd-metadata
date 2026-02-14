/**
 * Unified metadata stringification
 *
 * Converts a ParseResult to a human-readable string representation,
 * regardless of the parse result status.
 */

import type { ParseResult } from '../types';
import { formatAsWebUI } from './a1111';
import { formatRaw } from './raw';

/**
 * Convert a parse result to a human-readable string
 *
 * Automatically selects the best string representation based on status:
 * - `success`: Formats as human-readable SD WebUI text
 * - `unrecognized`: Returns raw metadata as plain text
 * - `empty` / `invalid`: Returns an empty string
 *
 * This is the recommended way to display metadata to users without
 * needing to handle each status separately.
 *
 * @param result - Parse result from `read()`
 * @returns Human-readable text representation, or empty string if no data
 *
 * @example
 * ```typescript
 * import { read, stringify } from '@enslo/sd-metadata';
 *
 * const result = read(imageData);
 * const text = stringify(result);
 * if (text) {
 *   console.log(text);
 * }
 * ```
 */
export function stringify(result: ParseResult): string {
  switch (result.status) {
    case 'success':
      return formatAsWebUI(result.metadata);
    case 'unrecognized':
      return formatRaw(result.raw);
    case 'empty':
    case 'invalid':
      return '';
  }
}
